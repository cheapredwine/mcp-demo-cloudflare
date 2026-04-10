/**
 * AI Orchestrator - Uses Cloudflare Workers AI with AI Gateway
 * 
 * Demonstrates:
 * - Workers AI binding with AI Gateway integration (caching, analytics)
 * - MCP Tool Calling via Workers AI
 * - Service Binding to MCP server for tool execution
 */

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
      "@cf/mistralai/mistral-small-3.1-24b-instruct",
      body,
      {
        gateway: {
          id: "mcp-demo",
          skipCache: false,
          cacheTtl: 3360,
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

// Call MCP tool via service binding
async function callMCPToolViaBinding(
  service: Fetcher,
  toolName: string,
  args: Record<string, unknown>,
  log?: (type: CallLog['type'], endpoint: string, status?: number, details?: string, method?: string) => void
): Promise<unknown> {
  // Initialize MCP session
  if (log) log('mcp-init', 'Service Binding: MCP initialize', undefined, 'MCP protocol initialization', 'POST');
  
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

  const sessionId = initResponse.headers.get('mcp-session-id');

  // Call the tool
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

  const data = await response.json() as { result?: unknown; error?: { message: string } };
  
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  return data.result;
}

// Process AI response with tool calls
async function processToolCalls(
  service: Fetcher,
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>,
  log?: (type: CallLog['type'], endpoint: string, status?: number, details?: string, method?: string) => void
): Promise<Array<{ tool: string; result: unknown }>> {
  const results = [];
  
  for (const call of toolCalls) {
    if (log) log('mcp-tool', 'Service Binding: tools/call - ' + call.name, undefined, 'Calling tool: ' + call.name, 'POST');
    const result = await callMCPToolViaBinding(service, call.name, call.arguments, log);
    if (log) log('mcp-tool', 'Service Binding: tools/call - ' + call.name, 200, 'Tool completed', 'POST');
    results.push({ tool: call.name, result });
  }
  
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
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 10px;
      font-size: 2.5rem;
      font-weight: 700;
    }
    .subtitle {
      color: rgba(255,255,255,0.9);
      text-align: center;
      margin-bottom: 30px;
      font-size: 1.1rem;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 1px solid #E5E5E5;
    }
    .card h2 {
      color: #1E1E1E;
      margin-bottom: 16px;
      font-size: 1.5rem;
      font-weight: 600;
    }
    .input-group {
      margin-bottom: 16px;
    }
    .input-group label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-weight: 600;
      font-size: 0.95rem;
    }
    textarea {
      width: 100%;
      min-height: 100px;
      padding: 12px;
      border: 2px solid #E5E5E5;
      border-radius: 6px;
      font-size: 1rem;
      resize: vertical;
      font-family: inherit;
      transition: border-color 0.2s;
    }
    textarea:focus {
      outline: none;
      border-color: #F48120;
      box-shadow: 0 0 0 3px rgba(244,129,32,0.1);
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
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
      align-items: center;
    }
    .example-prompts span {
      color: #666;
      font-weight: 500;
    }
    .example-btn {
      background: #FFF5EB;
      color: #E06C1F;
      border: 1px solid #FFD4B3;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
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
    .loading {
      color: #F48120;
      font-style: italic;
    }
    .info-box {
      background: linear-gradient(135deg, #FFF8F3 0%, #FFF5EB 100%);
      border: 1px solid #FFD4B3;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .info-box h4 {
      color: #E06C1F;
      margin-bottom: 12px;
      font-size: 1rem;
      font-weight: 600;
    }
    .info-box ul {
      margin-left: 20px;
      color: #333;
    }
    .info-box li {
      margin-bottom: 8px;
      line-height: 1.5;
    }
    .info-box li strong {
      color: #F48120;
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
  <div class="container">
    <h1>AI Orchestrator + MCP</h1>
    <p class="subtitle"><span class="cloudflare-badge">⚡ Cloudflare</span> Workers AI + AI Gateway + MCP Tools</p>

    <div class="card">
      <div class="info-box">
        <h4>How it works:</h4>
        <ul>
          <li><strong>Browser</strong> sends prompt to AI Orchestrator (Worker)</li>
          <li><strong>Workers AI</strong> processes prompt and decides which tools to call</li>
          <li><strong>AI Gateway</strong> provides caching, analytics, and rate limiting</li>
          <li><strong>Service Binding</strong> securely connects to MCP server</li>
        </ul>
      </div>

      <h2>💬 Ask the AI</h2>
      
      <div class="input-group">
        <label for="prompt">Your prompt:</label>
        <textarea id="prompt" placeholder="Try: 'What is the weather in Tokyo?'"></textarea>
      </div>

      <button id="submit-btn" onclick="sendPrompt()">Send to AI</button>

          <div class="example-prompts">
            <span>Examples:</span>
            <button class="example-btn" onclick="setPromptAndSubmit('What is the weather in Paris?')">Weather</button>
            <button class="example-btn" onclick="setPromptAndSubmit('Calculate 25 * 47')">Calculator</button>
            <button class="example-btn" onclick="setPromptAndSubmit('Tell me about tabby cats')">No MCP</button>
            <button class="example-btn" onclick="setPromptAndSubmit('If apples cost $3 each and I have $45, how many can I buy? Also, what is the weather where apples grow best?')">Multi-tool</button>
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
    function setPrompt(text) {
      document.getElementById('prompt').value = text;
    }
    
    function setPromptAndSubmit(text) {
      setPrompt(text);
      sendPrompt();
    }
    
    // Enter to submit, Shift+Enter for newline
    document.addEventListener('DOMContentLoaded', function() {
      const textarea = document.getElementById('prompt');
      textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendPrompt();
        }
      });
    });

    async function sendPrompt() {
      const prompt = document.getElementById('prompt').value.trim();
      if (!prompt) {
        alert('Please enter a prompt');
        return;
      }

      const submitBtn = document.getElementById('submit-btn');
      const requestBox = document.getElementById('request-box');
      const aiBox = document.getElementById('ai-box');
      const toolsBox = document.getElementById('tools-box');
      const mcpStatus = document.getElementById('mcp-status');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing...';
      
      // Show prompt immediately
      requestBox.textContent = prompt;
      requestBox.className = 'result-box prompt';
      
      // Reset other panels
      aiBox.innerHTML = '<div class="loading">Waiting for AI response...</div>';
      aiBox.className = 'result-box response';
      toolsBox.innerHTML = '<div class="loading">Checking if MCP tools needed...</div>';
      mcpStatus.style.display = 'none';

      try {
        const response = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
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
          aiBox.textContent = 'Error: ' + data.error;
        } else {
          if (data.ai && data.ai.response) {
            aiBox.textContent = data.ai.response;
          } else if (data.ai && data.ai.error) {
            aiBox.className = 'result-box error';
            aiBox.textContent = 'Error: ' + data.ai.error;
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
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send to AI';
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
      return new Response(HTML_TEMPLATE, {
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    }

    // API endpoint to process prompts
    if (url.pathname === "/api/ask" && request.method === "POST") {
      const { logs, log } = createCallLogger();
      
      try {
        const body = await request.json() as { prompt: string };
        const prompt = body.prompt || "";
        
        log('ai', 'Workers AI /ai/run', undefined, 'Initial AI call with tools', 'POST');

        // Call Workers AI with tools available - AI decides whether to use them
        let aiResponse;
        try {
          aiResponse = await callWorkersAI(
            env.AI,
            [
              { 
                role: 'system', 
                content: 'You are a helpful assistant. You have access to exactly TWO tools: (1) calculator - for math operations, (2) get_weather - for weather info. For general questions, answer directly without tools. Do not invent or use any other tools.'
              },
              { role: 'user', content: prompt }
            ],
            AI_TOOLS
          );
          log('ai', 'Workers AI /ai/run', 200, 'AI responded', 'POST');
        } catch (error) {
          log('ai', 'Workers AI /ai/run', 500, 'Error: ' + String(error), 'POST');
          return new Response(
            JSON.stringify({ error: String(error), callLogs: logs }, null, 2),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        if (aiResponse.error) {
          log('ai', 'Workers AI', 500, 'AI error: ' + aiResponse.error);
          return new Response(
            JSON.stringify({ error: aiResponse.error, callLogs: logs }, null, 2),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Standard tool calling flow:
        // 1. If AI returned content and no tool_calls -> use content directly
        // 2. If AI returned tool_calls -> execute tools -> get final response
        const VALID_TOOLS = ['calculator', 'get_weather'];
        const toolCalls: Array<{ tool: string; arguments: Record<string, unknown>; result?: unknown }> = [];
        
        // Filter out invalid tool calls (AI sometimes hallucinates tools)
        const validToolCalls = (aiResponse.tool_calls || []).filter(
          tc => VALID_TOOLS.includes(tc.name)
        );
        
        // Start with direct response if AI provided one
        let finalResponse = aiResponse.response || "";
        
        if (validToolCalls.length > 0) {
          // Execute the tool calls via service binding
          log('mcp-init', 'Service Binding: Starting tool execution', undefined, 'Executing ' + validToolCalls.length + ' tool call(s)', 'POST');
          const results = await processToolCalls(env.MCP_SERVER, validToolCalls, log);
          
          for (let i = 0; i < validToolCalls.length; i++) {
            toolCalls.push({
              tool: validToolCalls[i].name,
              arguments: validToolCalls[i].arguments,
              result: results[i]?.result,
            });
          }

          // Build conversation with tool results for final AI response
          const toolResultsMessage = toolCalls.map(tc => 
            `Tool: ${tc.tool}\nArguments: ${JSON.stringify(tc.arguments)}\nResult: ${JSON.stringify(tc.result)}`
          ).join('\n\n');

          // Call AI again with tool results to get final response
          try {
            log('ai', 'Workers AI /ai/run', undefined, 'Second AI call with tool results', 'POST');
            const finalAiResponse = await callWorkersAI(
              env.AI,
              [
                { 
                  role: 'system', 
                  content: 'You are a helpful assistant. Based on the tool results provided, give a clear and helpful response to the user.'
                },
                { role: 'user', content: prompt },
                { role: 'assistant', content: 'I need to use tools to answer this. Let me call: ' + validToolCalls.map(tc => tc.name).join(', ') },
                { role: 'user', content: 'Here are the tool results:\n\n' + toolResultsMessage + '\n\nPlease provide a helpful response based on these results.' }
              ]
            );
            log('ai', 'Workers AI /ai/run', 200, 'Final response received', 'POST');

            if (!finalAiResponse.error && finalAiResponse.response) {
              finalResponse = finalAiResponse.response;
            }
          } catch (error) {
            log('ai', 'Workers AI /ai/run', 500, 'Second AI call failed: ' + String(error), 'POST');
            // If second AI call fails, append tool results to any existing response
            finalResponse = finalResponse 
              ? finalResponse + '\n\nTool Results:\n' + toolResultsMessage
              : 'Tool Results:\n' + toolResultsMessage;
          }
        }

        return new Response(
          JSON.stringify({
            ai: { 
              response: finalResponse,
              tool_calls: aiResponse.tool_calls || [],
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
