/**
 * AI Orchestrator - Uses Cloudflare Workers AI with AI Gateway
 * 
 * Demonstrates:
 * - Workers AI binding with AI Gateway integration (caching, analytics)
 * - MCP Tool Calling via Workers AI
 * - Service Binding to MCP server for tool execution
 * - Optimized for performance: parallel tool calls, session reuse
 */

// Build timestamp - set at deployment time
const BUILD_TIME = '2026-04-13 08:55 UTC'; // Injected by CI/CD

interface Env {
  AI: Ai;
  MCP_SERVER: Fetcher;
}

// Call log tracking
interface CallLog {
  timestamp: string;
  type: 'ai' | 'mcp-init' | 'mcp-tool';
  method?: string;
  endpoint: string;
  status?: number;
  details?: string;
}

function createCallLogger() {
  const logs: CallLog[] = [];
  
  function log(type: CallLog['type'], endpoint: string, status?: number, details?: string, method?: string) {
    logs.push({
      timestamp: new Date().toISOString().split('T')[1].split('.')[0],
      type,
      method,
      endpoint,
      status,
      details
    });
  }
  
  return { logs, log };
}

// Tool definition interface for Workers AI
interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Tool definitions for Worker AI
const AI_TOOLS: ToolDefinition[] = [
  {
    name: "calculator",
    description: "Use for mathematical calculations and arithmetic operations like addition, subtraction, multiplication, division.",
    parameters: {
      type: "object",
      properties: {
        operation: { 
          type: "string", 
          enum: ["add", "subtract", "multiply", "divide"],
          description: "The mathematical operation"
        },
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" }
      },
      required: ["operation", "a", "b"]
    }
  },
  {
    name: "get_weather",
    description: "Use when the user asks about weather, temperature, or forecast for a specific location.",
    parameters: {
      type: "object",
      properties: {
        location: { 
          type: "string", 
          description: "City name"
        },
        units: { 
          type: "string", 
          enum: ["celsius", "fahrenheit"],
          description: "Temperature units"
        }
      },
      required: ["location"]
    }
  }
];

// Call Workers AI with AI Gateway
async function callWorkersAI(
  ai: Ai,
  messages: Array<{ role: string; content: string }>,
  tools?: ToolDefinition[]
): Promise<{
  response?: string;
  tool_calls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  error?: string;
}> {
  const body: Record<string, unknown> = {
    messages,
  };
  
  if (tools && tools.length > 0) {
    body.tools = tools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }
    }));
  }

  try {
    const response = await ai.run(
      "@cf/meta/llama-3.1-8b-instruct-fast" as keyof AiModels,
      body,
      {
        gateway: {
          id: "mcp-demo",
          skipCache: false,
          cacheTtl: 86400,
        },
      }
    ) as {
      response?: string;
      tool_calls?: Array<{
        name: string;
        arguments: Record<string, unknown>;
      }>;
    };

    return {
      response: response.response,
      tool_calls: response.tool_calls,
    };
  } catch (error) {
    return { error: `AI error: ${error}` };
  }
}

// Call Workers AI with streaming support
async function callWorkersAIStream(
  ai: Ai,
  messages: Array<{ role: string; content: string }>
): Promise<ReadableStream | null> {
  const body = {
    messages,
    stream: true,
  };

  try {
    const response = await ai.run(
      "@cf/meta/llama-3.1-8b-instruct-fast" as keyof AiModels,
      body,
      {
        gateway: {
          id: "mcp-demo",
          skipCache: false,
          cacheTtl: 86400,
        },
      }
    );

    // Check if response is a stream using getReader (more reliable)
    if (response && typeof response === 'object' && 'getReader' in response) {
      return response as ReadableStream;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Initialize MCP session once for multiple tool calls
async function initMCP(
  service: Fetcher
): Promise<string | null> {
  const initBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ai-orchestrator', version: '1.0.0' },
    },
  };

  const initResponse = await service.fetch('http://mcp-server/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify(initBody),
  });

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    throw new Error(`MCP init failed: ${initResponse.status} - ${errorText}`);
  }

  return initResponse.headers.get('mcp-session-id');
}

// Call MCP tool using existing session
async function callMCPToolWithSession(
  service: Fetcher,
  sessionId: string | null,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const toolBody = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Mcp-Protocol-Version': '2024-11-05',
  };
  
  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
  }

  const response = await service.fetch('http://mcp-server/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify(toolBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tool call failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { result?: unknown; error?: { message?: string; code?: number } | string };
  
  if (data.error) {
    const errorMessage = typeof data.error === 'object' 
      ? (data.error.message || JSON.stringify(data.error))
      : String(data.error);
    throw new Error(errorMessage);
  }
  
  return data.result;
}

// Process AI response with tool calls - optimized: single session init, parallel tool calls
async function processToolCalls(
  service: Fetcher,
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>,
  log?: (type: CallLog['type'], endpoint: string, status?: number, details?: string, method?: string) => void
): Promise<Array<{ tool: string; result: unknown }>> {
  // Initialize MCP session once for all tools
  if (log) log('mcp-init', 'Service Binding: MCP initialize', undefined, 'Single session init for ' + toolCalls.length + ' tool(s)', 'POST');
  const sessionId = await initMCP(service);
  if (log) log('mcp-init', 'Service Binding: MCP initialize', 200, 'Session established', 'POST');
  
  // Call all tools in parallel
  if (log) log('mcp-tool', 'Service Binding: tools/call', undefined, 'Executing ' + toolCalls.length + ' tool call(s) in parallel', 'POST');
  
  const toolPromises = toolCalls.map(async (call) => {
    const result = await callMCPToolWithSession(service, sessionId, call.name, call.arguments);
    return { tool: call.name, result };
  });
  
  const results = await Promise.all(toolPromises);
  
  if (log) log('mcp-tool', 'Service Binding: tools/call', 200, 'All tools completed', 'POST');
  
  return results;
}

// HTML template for the web interface
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Orchestrator + MCP</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%23F48120'/%3E%3Ctext x='50' y='65' font-size='45' text-anchor='middle' fill='white'%3E🤖%3C/text%3E%3C/svg%3E">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #F48120 0%, #E06C1F 50%, #1E1E1E 100%);
      min-height: 100vh;
      padding: 10px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 5px;
      font-size: 1.8rem;
      font-weight: 700;
    }
    .subtitle {
      color: rgba(255,255,255,0.9);
      text-align: center;
      margin-bottom: 15px;
      font-size: 0.9rem;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 1px solid #E5E5E5;
    }
    .card h2 {
      color: #1E1E1E;
      margin-bottom: 10px;
      font-size: 1.1rem;
      font-weight: 600;
    }
    .input-row {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      width: 100%;
    }
    .input-row textarea {
      flex: 1;
      width: 100%;
      min-height: 40px;
      height: 40px;
      padding: 8px;
      border: 2px solid #E5E5E5;
      border-radius: 6px;
      font-size: 0.9rem;
      resize: none;
      font-family: inherit;
    }
    .input-row textarea:focus {
      outline: none;
      border-color: #F48120;
    }
    #submit-btn {
      height: 40px !important;
      padding: 0 20px !important;
      font-size: 0.9rem !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
      width: auto !important;
      min-width: 80px !important;
    }
    .input-group {
      margin-bottom: 0;
      flex: 1;
      min-width: 0;
    }
    .input-group label {
      display: block;
      margin-bottom: 4px;
      color: #333;
      font-weight: 600;
      font-size: 0.85rem;
    }
    button {
      background: #F48120;
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.2s;
    }
    button:not(#submit-btn):not(.example-btn):not(.http-log-toggle) {
      width: 100%;
    }
    button:hover {
      background: #E06C1F;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(244,129,32,0.3);
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    .example-prompts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 8px;
      max-width: 300px;
    }
    .example-btn {
      background: #FFF5EB;
      color: #E06C1F;
      border: 1px solid #FFD4B3;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
      text-align: center;
      white-space: nowrap;
    }
    .example-btn:hover {
      background: #F48120;
      color: white;
      border-color: #F48120;
    }
    .result-section {
      margin-top: 20px;
    }
    .result-section h3 {
      color: #F48120;
      font-size: 0.85rem;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 700;
    }
    .result-box {
      background: #FAFAFA;
      border: 1px solid #E5E5E5;
      border-radius: 6px;
      padding: 16px;
      white-space: pre-wrap;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 0.85rem;
      max-height: 400px;
      overflow-y: auto;
      line-height: 1.5;
    }
    .result-box.request {
      background: #FFF8F3;
      border-color: #FFD4B3;
      border-left: 4px solid #F48120;
    }
    .result-box.response {
      background: #F6FDF9;
      border-color: #B8E5D0;
      border-left: 4px solid #22C55E;
    }
    .result-box.error {
      background: #FEF2F2;
      border-color: #FECACA;
      border-left: 4px solid #EF4444;
      color: #DC2626;
    }
    .tool-call {
      background: #FFF8F3;
      border-left: 4px solid #F48120;
      padding: 12px;
      margin: 8px 0;
      border-radius: 0 6px 6px 0;
    }
    .tool-result {
      background: #F6FDF9;
      border-left: 4px solid #22C55E;
      padding: 12px;
      margin: 8px 0;
      border-radius: 0 6px 6px 0;
    }
    .mcp-status {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 16px;
      margin-left: 12px;
    }
    .mcp-status.used {
      background: #DCFCE7;
      color: #166534;
      border: 1px solid #86EFAC;
    }
    .mcp-status.not-used {
      background: #F3F4F6;
      color: #6B7280;
      border: 1px solid #E5E7EB;
    }
    .info-box {
      background: linear-gradient(135deg, #FFF8F3 0%, #FFF5EB 100%);
      border: 1px solid #FFD4B3;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 0.85rem;
    }
    .info-box h4 {
      color: #E06C1F;
      margin-bottom: 8px;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .info-box .flow-steps {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }
    .flow-step {
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 0.85rem;
      border-left: 3px solid #ccc;
      background: #f5f5f5;
    }
    .flow-step.always { border-left-color: #333; background: #e8e8e8; }
    .flow-step.chat { border-left-color: #F48120; background: #FFF5EB; }
    .flow-step.calc { border-left-color: #22C55E; background: #F0FDF4; }
    .flow-step.weather { border-left-color: #3B82F6; background: #EFF6FF; }
    .flow-step.multistep { border-left-color: #8B5CF6; background: #F5F3FF; }
    .flow-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 0.75rem;
    }
    .flow-legend .badge {
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 500;
    }
    .badge.always { background: #333; color: white; }
    .badge.chat { background: #F48120; color: white; }
    .badge.calc { background: #22C55E; color: white; }
    .badge.weather { background: #3B82F6; color: white; }
    .badge.multistep { background: #8B5CF6; color: white; }
    .info-box .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
    }
    .info-box ol {
      margin: 0;
      padding-left: 20px;
      color: #333;
    }
    .info-box li {
      margin-bottom: 4px;
      line-height: 1.3;
    }
    .info-box li strong {
      color: #F48120;
    }
    @media (max-width: 600px) {
      .info-box .two-col {
        grid-template-columns: 1fr;
      }
    }
    .cloudflare-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #F48120;
      color: white;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .http-log-panel {
      background: #1E1E1E;
      color: #00FF00;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 0.75rem;
      padding: 12px;
      border-radius: 0 0 6px 6px;
      max-height: 200px;
      overflow-y: auto;
      margin-top: 0;
    }
    .http-log-entry {
      padding: 4px 0;
      border-bottom: 1px solid #333;
    }
    .http-log-entry:last-child {
      border-bottom: none;
    }
    .http-log-toggle {
      background: #333;
      color: #00FF00;
      border: none;
      padding: 8px 16px;
      border-radius: 6px 6px 0 0;
      cursor: pointer;
      font-family: monospace;
      font-size: 0.8rem;
      margin-top: 20px;
      width: 100%;
      text-align: left;
    }
    .http-log-toggle:hover {
      background: #444;
    }
    .http-log-container {
      display: none;
    }
    .http-log-container.open {
      display: block;
    }
    .empty-state {
      color: #999;
      font-style: italic;
      text-align: center;
      padding: 40px 20px;
    }
    .loading {
      color: #F48120;
      font-style: italic;
      text-align: center;
      padding: 20px;
    }
    /* Three panel layout */
    .results-container {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      margin-top: 20px;
    }
    .panel {
      background: white;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border: 1px solid #E5E5E5;
      min-height: 300px;
      display: flex;
      flex-direction: column;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 2px solid #F48120;
    }
    .panel h3 {
      color: #1E1E1E;
      font-size: 0.95rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .panel-content {
      flex: 1;
      overflow-y: auto;
      max-height: 400px;
    }
    @media (max-width: 900px) {
      .results-container {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container" style="position: relative;">
    <h1>AI Orchestrator + MCP</h1>
    <p class="subtitle"><span class="cloudflare-badge">⚡ Cloudflare</span> Workers AI + AI Gateway + Firewall for AI + MCP Tools</p>
    <span id="build-time" style="position: absolute; top: 0; right: 0; font-size: 0.7rem; color: rgba(255,255,255,0.5); font-family: monospace;">__BUILD_TIME__</span>

    <div class="card">
      <div class="info-box">
        <h4>Request Flow:</h4>
        <div class="flow-steps">
          <div class="flow-step always">1. <strong>Firewall for AI</strong> - All requests</div>
          <div class="flow-step chat multistep">2. <strong>AI Gateway + LLM</strong> - Chat & Multistep (decide)</div>
          <div class="flow-step calc weather multistep">3. <strong>Service Binding → MCP</strong> - Tools only (execute)</div>
          <div class="flow-step multistep">4. <strong>LLM again</strong> - Multistep only (format results)</div>
        </div>
      </div>

      <div class="input-row">
        <div class="input-group" style="flex: 1;">
          <label for="prompt">Your prompt:</label>
          <textarea id="prompt" placeholder="Try: 'Tell me about tabby cats' or 'What is 25 * 47?' or 'Weather in Tokyo'"></textarea>
        </div>
        <button id="submit-btn" onclick="sendPrompt('chat')" style="height: 40px; padding: 0 20px; font-size: 0.9rem; margin-top: 22px;">Send</button>
      </div>

      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button id="calc-btn" onclick="randomCalc()" style="flex: 1; background: #22C55E; font-size: 0.85rem;">🔢 <span id="calc-label">25 × 47</span></button>
        <button id="weather-btn" onclick="randomWeather()" style="flex: 1; background: #3B82F6; font-size: 0.85rem;">🌤️ <span id="weather-label">Paris Weather</span></button>
        <button id="chat-btn" onclick="autoSubmit('Tell me about tabby cats', 'chat')" style="flex: 1; background: #F48120; font-size: 0.85rem;">🐱 Tabby Cats</button>
        <button id="multistep-btn" onclick="randomMultistep()" style="flex: 1; background: #8B5CF6; font-size: 0.85rem;">🔄 <span id="multistep-label">Apples Problem</span></button>
      </div>
    </div>

    <div class="results-container" id="results-container">
      <!-- Left Panel: Prompt -->
      <div class="panel" id="prompt-panel">
        <div class="panel-header">
          <h3>💬 Your Prompt</h3>
        </div>
        <div class="panel-content">
          <div id="request-box" class="result-box prompt">
            <div class="empty-state">Enter a prompt above and click "Send to AI"</div>
          </div>
        </div>
      </div>

      <!-- Center Panel: MCP Interaction -->
      <div class="panel" id="mcp-panel">
        <div class="panel-header">
          <h3>🔧 MCP Server</h3>
          <span id="mcp-status" class="mcp-status" style="display: none;"></span>
        </div>
        <div class="panel-content">
          <div id="tools-box" class="result-box">
            <div class="empty-state">MCP interaction will appear here when tools are called</div>
          </div>
        </div>
      </div>

      <!-- Right Panel: AI Response -->
      <div class="panel" id="response-panel">
        <div class="panel-header">
          <h3>🤖 AI Response</h3>
        </div>
        <div class="panel-content">
          <div id="ai-box" class="result-box response">
            <div class="empty-state">AI response will appear here</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    function autoSubmit(text, action) {
      document.getElementById('prompt').value = text;
      sendPrompt(action);
    }
    
    function randomCalc() {
      // Generate two random numbers between 10 and 99
      const a = Math.floor(Math.random() * 90) + 10;
      const b = Math.floor(Math.random() * 90) + 10;
      
      // Update the button label
      document.getElementById('calc-label').textContent = a + ' × ' + b;
      
      // Submit with the new numbers
      autoSubmit('Calculate ' + a + ' * ' + b, 'calculate');
    }
    
    const CITIES = ['Paris', 'Tokyo', 'London', 'New York', 'Sydney', 'Berlin', 'Toronto', 'Dubai', 'Singapore', 'Barcelona'];
    let cityIndex = 0;
    let shuffledCities = [...CITIES].sort(() => Math.random() - 0.5);
    
    function randomWeather() {
      // Get current city from shuffled order
      const city = shuffledCities[cityIndex];
      
      // Move to next city
      cityIndex = (cityIndex + 1) % shuffledCities.length;
      
      // Update button label to show NEXT city
      const nextCity = shuffledCities[cityIndex];
      document.getElementById('weather-label').textContent = nextCity + ' Weather';
      
      // Submit with CURRENT city
      autoSubmit('What is the weather in ' + city + '?', 'weather');
    }
    
    const MULTISTEP_QUESTIONS = [
      { label: 'Apples Problem', prompt: 'If apples cost $3 each and I have $45, how many can I buy?' },
      { label: 'Book Store', prompt: 'A book costs $12. If I have $60 and buy 3 books, how much money do I have left?' },
      { label: 'Cookie Baking', prompt: 'I want to bake 48 cookies. Each batch makes 12 cookies. How many batches do I need?' },
      { label: 'Gas Mileage', prompt: 'My car gets 25 miles per gallon. How many gallons do I need for a 300 mile trip?' },
      { label: 'Pizza Party', prompt: 'Pizza costs $15 each. If 8 people want 2 slices each and each pizza has 8 slices, how much will it cost?' },
      { label: 'Garden Fence', prompt: 'My garden is 20 feet by 15 feet. How many feet of fencing do I need to surround it?' },
    ];
    
    let multistepIndex = 0;
    
    function randomMultistep() {
      // Use current index question
      const currentQuestion = MULTISTEP_QUESTIONS[multistepIndex];
      
      // Move to next index for the next click
      multistepIndex = (multistepIndex + 1) % MULTISTEP_QUESTIONS.length;
      
      // Update button label to show NEXT question
      const nextQuestion = MULTISTEP_QUESTIONS[multistepIndex];
      document.getElementById('multistep-label').textContent = nextQuestion.label;
      
      // Submit with CURRENT question
      autoSubmit(currentQuestion.prompt, 'multistep');
    }
    
    // Enter to submit chat mode
    document.addEventListener('DOMContentLoaded', function() {
      const textarea = document.getElementById('prompt');
      
      // Select all text on click (for easy replacement)
      textarea.addEventListener('click', function() {
        this.select();
      });
      
      textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendPrompt('chat');
        }
      });
    });

    async function sendPrompt(action) {
      const prompt = document.getElementById('prompt').value.trim();
      if (!prompt) {
        alert('Please enter a prompt');
        return;
      }

      // Disable all buttons
      document.getElementById('chat-btn').disabled = true;
      document.getElementById('calc-btn').disabled = true;
      document.getElementById('weather-btn').disabled = true;
      document.getElementById('multistep-btn').disabled = true;
      document.getElementById('submit-btn').disabled = true;
      
      const requestBox = document.getElementById('request-box');
      const aiBox = document.getElementById('ai-box');
      const toolsBox = document.getElementById('tools-box');
      const mcpStatus = document.getElementById('mcp-status');

      // Show prompt immediately
      requestBox.textContent = '[' + action.toUpperCase() + '] ' + prompt;
      requestBox.className = 'result-box prompt';
      
      // Reset other panels
      aiBox.innerHTML = action === 'chat' ? '' : '<div class="loading">Processing...</div>';
      aiBox.className = 'result-box response';
      toolsBox.innerHTML = action === 'chat' 
        ? '<div style="color: #6B7280; font-style: italic; padding: 20px; text-align: center;">Direct AI response - no tools used</div>'
        : '<div class="loading">Calling MCP tool...</div>';
      mcpStatus.style.display = 'none';

      // Use streaming for chat action
      if (action === 'chat') {
        await sendPromptStream(prompt, action);
        return;
      }

      // Regular non-streaming flow for other actions

      try {
        const response = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, action })
        });

        const data = await response.json();
        
        // Display HTTP call logs if available
        if (data.callLogs && data.callLogs.length > 0) {
          const logContainer = document.getElementById('http-log-content');
          const logContainer2 = document.getElementById('http-log-container');
          const logToggle = document.getElementById('http-log-toggle');
          if (logContainer && logContainer2 && logToggle) {
            logContainer.innerHTML = data.callLogs.map(function(log) {
              var statusColor = log.status >= 200 && log.status < 300 ? '#22C55E' : 
                               log.status >= 400 ? '#EF4444' : '#F48120';
              return '<div class="http-log-entry">' +
                '<span style="color: #888;">[' + log.timestamp + ']</span> ' +
                '<span style="color: #00FF00;">' + (log.method || 'POST') + '</span> ' +
                '<span style="color: #fff;">' + log.endpoint + '</span> ' +
                (log.status ? '<span style="color: ' + statusColor + ';">' + log.status + '</span>' : '') +
                (log.details ? ' <span style="color: #888;">- ' + log.details + '</span>' : '') +
                '</div>';
            }).join('');
            logContainer2.classList.add('open');
            logToggle.textContent = '▼ HTTP Log (' + data.callLogs.length + ' calls)';
          }
        }

        if (data.error) {
          aiBox.className = 'result-box error';
          aiBox.textContent = 'Error: ' + (typeof data.error === 'object' ? JSON.stringify(data.error) : data.error);
        } else {
          if (data.ai && data.ai.response) {
            aiBox.textContent = data.ai.response;
          } else if (data.ai && data.ai.error) {
            aiBox.className = 'result-box error';
            aiBox.textContent = 'Error: ' + (typeof data.ai.error === 'object' ? JSON.stringify(data.ai.error) : data.ai.error);
          }

          // Show MCP status and tools
          mcpStatus.style.display = 'inline-block';
          if (data.toolCalls && data.toolCalls.length > 0) {
            // MCP was used
            mcpStatus.className = 'mcp-status used';
            mcpStatus.textContent = 'MCP Used (' + data.toolCalls.length + ')';
            
            let toolsHtml = '<div style="margin-bottom: 10px; color: #166534; font-weight: 500; font-size: 0.85rem;">✅ AI invoked MCP tools</div>';
            data.toolCalls.forEach(function(call, i) {
              toolsHtml += '<div class="tool-call">';
              toolsHtml += '<strong>Tool #' + (i + 1) + ':</strong> ' + call.tool + '<br>';
              toolsHtml += '<strong>Args:</strong> ' + JSON.stringify(call.arguments);
              toolsHtml += '</div>';
              
              if (call.result) {
                toolsHtml += '<div class="tool-result">';
                toolsHtml += '<strong>Result:</strong> ' + JSON.stringify(call.result);
                toolsHtml += '</div>';
              }
            });
            toolsBox.innerHTML = toolsHtml;
          } else {
            // MCP was not used
            mcpStatus.className = 'mcp-status not-used';
            mcpStatus.textContent = 'MCP Not Used';
            toolsBox.innerHTML = '<div style="color: #6B7280; font-style: italic; padding: 20px; text-align: center;">AI answered directly without using tools</div>';
          }
        }
      } catch (error) {
        aiBox.className = 'result-box error';
        aiBox.textContent = 'Error: ' + error.message;
      } finally {
        // Re-enable all buttons
        document.getElementById('chat-btn').disabled = false;
        document.getElementById('calc-btn').disabled = false;
        document.getElementById('weather-btn').disabled = false;
        document.getElementById('multistep-btn').disabled = false;
        document.getElementById('submit-btn').disabled = false;
      }
    }
    
    async function sendPromptStream(prompt, action) {
      const aiBox = document.getElementById('ai-box');
      const toolsBox = document.getElementById('tools-box');
      
      try {
        const response = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, action, stream: true })
        });
        
        if (!response.ok) {
          throw new Error('Stream request failed: ' + response.status);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        
        aiBox.innerHTML = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          // Find complete lines (ones that have a newline)
          let lineEnd;
          while ((lineEnd = buffer.indexOf(String.fromCharCode(10))) !== -1) {
            const line = buffer.slice(0, lineEnd).trim();
            buffer = buffer.slice(lineEnd + 1);
            
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              if (jsonStr === '[DONE]') continue;
              
              try {
                const data = JSON.parse(jsonStr);
                if (data.response) {
                  fullText += data.response;
                  aiBox.textContent = fullText;
                }
              } catch (err) {
                // Invalid JSON, skip
              }
            }
          }
        }
      } catch (error) {
        aiBox.className = 'result-box error';
        aiBox.textContent = 'Streaming error: ' + error.message;
      } finally {
        // Show "No MCP used" chip for streaming (chat doesn't use tools)
        toolsBox.innerHTML = '<div style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; background: #F3F4F6; color: #6B7280; border: 1px solid #E5E7EB; margin: 10px;">No MCP used</div>';
        
        // Re-enable all buttons
        document.getElementById('chat-btn').disabled = false;
        document.getElementById('calc-btn').disabled = false;
        document.getElementById('weather-btn').disabled = false;
        document.getElementById('multistep-btn').disabled = false;
        document.getElementById('submit-btn').disabled = false;
      }
    }
  </script>
  
  <button id="http-log-toggle" class="http-log-toggle" onclick="var c = document.getElementById('http-log-container'), t = document.getElementById('http-log-toggle'); c.classList.toggle('open'); t.textContent = c.classList.contains('open') ? '▼ HTTP Log' : '▶ HTTP Log';">▶ HTTP Log</button>
  <div id="http-log-container" class="http-log-container">
    <div id="http-log-content" class="http-log-panel">
      <div style="color: #666;">HTTP requests will appear here after you send a prompt...</div>
    </div>
  </div>
</body>
</html>`;

// Main Worker export
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Web UI
    if (url.pathname === "/") {
      // Inject build time into HTML template
      const htmlWithBuildTime = HTML_TEMPLATE.replace('__BUILD_TIME__', BUILD_TIME);
      return new Response(htmlWithBuildTime, {
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    }

    // API endpoint to process prompts
    if (url.pathname === "/api/ask" && request.method === "POST") {
      const { logs, log } = createCallLogger();
      
      try {
        const body = await request.json() as { prompt: string; action: string; stream?: boolean };
        const prompt = body.prompt || "";
        const action = body.action || 'chat';
        const useStream = body.stream === true;
        
        log('ai', 'Workers AI /ai/run', undefined, 'Action: ' + action + (useStream ? ' (stream)' : ''), 'POST');

        // Streaming only supported for chat action
        if (useStream && action === 'chat') {
          const stream = await callWorkersAIStream(
            env.AI,
            [
              { 
                role: 'system', 
                content: 'You are a helpful assistant. Answer directly and concisely.'
              },
              { role: 'user', content: prompt }
            ]
          );
          
          if (stream) {
            return new Response(stream, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                ...corsHeaders
              }
            });
          }
          
          // Fallback if streaming fails
          log('ai', 'Workers AI /ai/run', 500, 'Streaming failed, falling back');
        }

        // Route based on user-selected action
        let aiResponse;
        let toolCalls: Array<{ tool: string; arguments: Record<string, unknown>; result?: unknown }> = [];
        
        try {
          if (action === 'chat') {
            // Direct AI chat - no tools
            aiResponse = await callWorkersAI(
              env.AI,
              [
                { 
                  role: 'system', 
                  content: 'You are a helpful assistant. Answer directly and concisely.'
                },
                { role: 'user', content: prompt }
              ]
            );
          } else if (action === 'calculate') {
            // Direct to calculator tool
            log('mcp-tool', 'Service Binding: calculator', undefined, 'Direct tool call', 'POST');
            
            // Extract expression from prompt
            const expression = prompt.replace(/calculate|compute|what is|math/gi, '').trim();
            
            // Try to parse simple expressions like "25 * 47" or "25 times 47"
            let operation = 'add';
            let a = 0, b = 0;
            let opSymbol = '+';
            
            // Simple parsing for demo
            const match = expression.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/]|plus|minus|times?|divided?)\s*(\d+(?:\.\d+)?)/);
            if (match) {
              a = parseFloat(match[1]);
              b = parseFloat(match[3]);
              const opStr = match[2].toLowerCase();
              if (opStr === '+' || opStr === 'plus') { operation = 'add'; opSymbol = '+'; }
              else if (opStr === '-' || opStr === 'minus') { operation = 'subtract'; opSymbol = '-'; }
              else if (opStr === '*' || opStr === 'x' || opStr === 'times') { operation = 'multiply'; opSymbol = '×'; }
              else if (opStr === '/' || opStr === 'divide') { operation = 'divide'; opSymbol = '÷'; }
            }
            
            const result = await callMCPToolWithSession(
              env.MCP_SERVER, 
              null, 
              'calculator', 
              { operation, a, b }
            ) as { content: Array<{ type: string; text: string }> };
            
            toolCalls = [{ tool: 'calculator', arguments: { operation, a, b }, result }];
            
            // Extract text from MCP response
            const resultText = result.content?.[0]?.text || `${a} ${opSymbol} ${b} = [error]`;
            
            // Format result directly (no AI call needed)
            aiResponse = {
              response: resultText
            };
          } else if (action === 'weather') {
            // Direct to weather tool
            log('mcp-tool', 'Service Binding: get_weather', undefined, 'Direct tool call', 'POST');
            
            // Extract location - handles "What is the weather in Paris?" → "Paris"
            const locationMatch = prompt.match(/(?:weather|temperature)(?:\s+in|\s+at|\s+for)?\s+([^?]+)/i);
            const location = locationMatch ? locationMatch[1].trim() : 'Unknown';
            
            const result = await callMCPToolWithSession(
              env.MCP_SERVER, 
              null, 
              'get_weather', 
              { location, units: 'celsius' }
            ) as { content: Array<{ type: string; text: string }> };
            
            toolCalls = [{ tool: 'get_weather', arguments: { location, units: 'celsius' }, result }];
            
            // Extract text lines from MCP response
            const weatherLines = result.content?.map(c => c.text).join('\n') || 'Weather data unavailable';
            
            // Format result directly (no AI call needed)
            aiResponse = {
              response: weatherLines
            };
          } else if (action === 'multistep') {
            // Multi-step: AI decides which tools to use
            log('ai', 'Workers AI /ai/run', undefined, 'Multi-step: AI with tools', 'POST');
            
            // First call with tools to see what AI wants to do
            const initialResponse = await callWorkersAI(
              env.AI,
              [
                { 
                  role: 'system', 
                  content: 'You are a helpful assistant. Use the calculator or weather tools as needed to answer the question.'
                },
                { role: 'user', content: prompt }
              ],
              AI_TOOLS
            );
            
            if (initialResponse.tool_calls && initialResponse.tool_calls.length > 0) {
              // AI wants to use tools
              const VALID_TOOLS = ['calculator', 'get_weather'];
              const validToolCalls = initialResponse.tool_calls.filter(
                tc => VALID_TOOLS.includes(tc.name)
              );
              
              // Execute the tool calls
              log('mcp-init', 'Service Binding: Starting tool execution', undefined, 'Executing ' + validToolCalls.length + ' tool call(s)', 'POST');
              const results = await processToolCalls(env.MCP_SERVER, validToolCalls, log);
              
              for (let i = 0; i < validToolCalls.length; i++) {
                toolCalls.push({
                  tool: validToolCalls[i].name,
                  arguments: validToolCalls[i].arguments,
                  result: results[i]?.result,
                });
              }
              
              // Get final response with tool results
              const toolResultsMessage = toolCalls.map(tc => {
                // Extract readable text from MCP result format
                const resultText = typeof tc.result === 'object' && tc.result !== null && 'content' in tc.result
                  ? (tc.result as { content: Array<{ text: string }> }).content.map(c => c.text).join(', ')
                  : JSON.stringify(tc.result);
                return `Tool: ${tc.tool}\nArguments: ${JSON.stringify(tc.arguments)}\nResult: ${resultText}`;
              }).join('\n\n');
              
              aiResponse = await callWorkersAI(
                env.AI,
                [
                  { 
                    role: 'system', 
                    content: 'You are a helpful assistant answering the user\'s question. The tool results below were computed to help answer the question. Use them to provide a clear, direct answer.'
                  },
                  { role: 'user', content: 'Question: ' + prompt },
                  { role: 'assistant', content: 'Let me use tools to solve this.' },
                  { role: 'user', content: 'Here are the tool results I computed:\n\n' + toolResultsMessage + '\n\nBased on these results, what is the answer to the question?' }
                ]
              );
            } else {
              // AI answered directly
              aiResponse = initialResponse;
            }
          }
          
          log('ai', 'Workers AI /ai/run', 200, 'AI responded', 'POST');
        } catch (error) {
          log('ai', 'Workers AI /ai/run', 500, 'Error: ' + String(error), 'POST');
          return new Response(
            JSON.stringify({ error: String(error), callLogs: logs }, null, 2),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        if (!aiResponse || aiResponse.error) {
          return new Response(
            JSON.stringify({ error: aiResponse?.error || 'No response', callLogs: logs }, null, 2),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Simple response - tool calls already handled above
        let finalResponse = aiResponse.response || "";

        return new Response(
          JSON.stringify({
            ai: { 
              response: finalResponse,
              tool_calls: [],
            },
            toolCalls: toolCalls,
            callLogs: logs,
          }, null, 2),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({ error: String(error), callLogs: logs }, null, 2),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Admin control panel
    if (url.pathname === "/admin") {
      const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Demo - Admin Control Panel</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1E1E1E 0%, #2D2D2D 100%);
      min-height: 100vh;
      padding: 20px;
      color: #fff;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      color: #F48120;
      margin-bottom: 10px;
      font-size: 2rem;
    }
    .subtitle {
      color: #888;
      margin-bottom: 30px;
    }
    .card {
      background: #333;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid #444;
    }
    .card h2 {
      color: #F48120;
      margin-bottom: 15px;
      font-size: 1.2rem;
    }
    .cache-item {
      background: #2a2a2a;
      padding: 12px;
      margin: 8px 0;
      border-radius: 6px;
      border-left: 3px solid #666;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .cache-item.warmed {
      border-left-color: #22C55E;
    }
    .cache-item.pending {
      border-left-color: #F48120;
    }
    .cache-item.error {
      border-left-color: #EF4444;
    }
    button {
      background: #F48120;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: background 0.2s;
    }
    button:hover:not(:disabled) {
      background: #E06C1F;
    }
    button:disabled {
      background: #666;
      cursor: not-allowed;
    }
    .status {
      font-size: 0.85rem;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .status.cached {
      background: #22C55E;
      color: white;
    }
    .status.miss {
      background: #666;
      color: #ccc;
    }
    .status.error {
      background: #EF4444;
      color: white;
    }
    .progress {
      margin-top: 15px;
      padding: 10px;
      background: #2a2a2a;
      border-radius: 6px;
      font-family: monospace;
      font-size: 0.9rem;
      max-height: 200px;
      overflow-y: auto;
    }
    .progress-line {
      margin: 4px 0;
      color: #aaa;
    }
    .progress-line.success {
      color: #22C55E;
    }
    .progress-line.error {
      color: #EF4444;
    }
    a.back-link {
      color: #F48120;
      text-decoration: none;
      display: inline-block;
      margin-bottom: 20px;
    }
    a.back-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">← Back to Demo</a>
    <h1>🔧 Admin Control Panel</h1>
    <p class="subtitle">AI Gateway Cache Management</p>

    <div class="card">
      <h2>Cache Pre-warming</h2>
      <p style="margin-bottom: 15px; color: #aaa;">
        Warm the AI Gateway cache by calling all multistep question variants.
        This makes subsequent requests faster for demo users.
      </p>
      <button id="warm-btn" onclick="warmCache()">🚀 Pre-warm Cache</button>
      <div id="progress" class="progress" style="display: none;"></div>
    </div>

    <div class="card">
      <h2>Cacheable Queries</h2>
      <div id="query-list">
        <div class="cache-item pending">
          <span>🔄 Apples Problem</span>
          <span class="status miss">Not Cached</span>
        </div>
        <div class="cache-item pending">
          <span>🔄 Book Store</span>
          <span class="status miss">Not Cached</span>
        </div>
        <div class="cache-item pending">
          <span>🔄 Cookie Baking</span>
          <span class="status miss">Not Cached</span>
        </div>
        <div class="cache-item pending">
          <span>🔄 Gas Mileage</span>
          <span class="status miss">Not Cached</span>
        </div>
        <div class="cache-item pending">
          <span>🔄 Pizza Party</span>
          <span class="status miss">Not Cached</span>
        </div>
        <div class="cache-item pending">
          <span>🔄 Garden Fence</span>
          <span class="status miss">Not Cached</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    const QUERIES = [
      { name: 'Apples Problem', prompt: 'If apples cost $3 each and I have $45, how many can I buy?' },
      { name: 'Book Store', prompt: 'A book costs $12. If I have $60 and buy 3 books, how much money do I have left?' },
      { name: 'Cookie Baking', prompt: 'I want to bake 48 cookies. Each batch makes 12 cookies. How many batches do I need?' },
      { name: 'Gas Mileage', prompt: 'My car gets 25 miles per gallon. How many gallons do I need for a 300 mile trip?' },
      { name: 'Pizza Party', prompt: 'Pizza costs $15 each. If 8 people want 2 slices each and each pizza has 8 slices, how much will it cost?' },
      { name: 'Garden Fence', prompt: 'My garden is 20 feet by 15 feet. How many feet of fencing do I need to surround it?' },
    ];

    function addProgress(message, type = 'normal') {
      const progress = document.getElementById('progress');
      const line = document.createElement('div');
      line.className = 'progress-line ' + type;
      line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
      progress.appendChild(line);
      progress.scrollTop = progress.scrollHeight;
    }

    async function warmCache() {
      const btn = document.getElementById('warm-btn');
      const progress = document.getElementById('progress');
      
      btn.disabled = true;
      btn.textContent = 'Warming...';
      progress.style.display = 'block';
      progress.innerHTML = '';
      
      addProgress('Starting cache pre-warm...', 'normal');
      
      for (let i = 0; i < QUERIES.length; i++) {
        const query = QUERIES[i];
        addProgress('Warming: ' + query.name + '...', 'normal');
        
        try {
          const response = await fetch('/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: query.prompt, action: 'multistep' })
          });
          
          if (response.ok) {
            addProgress('✓ ' + query.name + ' warmed successfully', 'success');
            updateQueryStatus(i, 'cached');
          } else {
            addProgress('✗ ' + query.name + ' failed: ' + response.status, 'error');
            updateQueryStatus(i, 'error');
          }
        } catch (error) {
          addProgress('✗ ' + query.name + ' error: ' + error.message, 'error');
          updateQueryStatus(i, 'error');
        }
        
        // Small delay to avoid overwhelming the API
        if (i < QUERIES.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      addProgress('Cache pre-warming complete!', 'success');
      btn.disabled = false;
      btn.textContent = '🚀 Pre-warm Cache Again';
    }

    function updateQueryStatus(index, status) {
      const items = document.querySelectorAll('.cache-item');
      const item = items[index];
      const statusEl = item.querySelector('.status');
      
      item.classList.remove('pending', 'warmed', 'error');
      item.classList.add(status === 'cached' ? 'warmed' : status);
      
      statusEl.className = 'status ' + status;
      statusEl.textContent = status === 'cached' ? 'Cached' : status === 'error' ? 'Error' : 'Not Cached';
    }
  </script>
</body>
</html>`;
      
      return new Response(ADMIN_HTML, {
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "ai-orchestrator" }, null, 2),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }, null, 2),
      { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  },
};
