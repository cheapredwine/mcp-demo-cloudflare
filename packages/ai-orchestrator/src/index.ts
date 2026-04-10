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
  args: Record<string, unknown>
): Promise<unknown> {
  // Initialize MCP session
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
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>
): Promise<Array<{ tool: string; result: unknown }>> {
  const results = [];
  
  for (const call of toolCalls) {
    const result = await callMCPToolViaBinding(service, call.name, call.arguments);
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
      font-size: 2rem;
      font-weight: 700;
    }
    .subtitle {
      color: rgba(255,255,255,0.9);
      text-align: center;
      margin-bottom: 20px;
      font-size: 1rem;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 1px solid #E5E5E5;
    }
    .card h2 {
      color: #1E1E1E;
      margin-bottom: 12px;
      font-size: 1.25rem;
      font-weight: 600;
    }
    .input-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .input-group {
      flex: 1;
      margin-bottom: 0;
    }
    .input-group label {
      display: block;
      margin-bottom: 6px;
      color: #333;
      font-weight: 600;
      font-size: 0.9rem;
    }
    textarea {
      width: 100%;
      min-height: 80px;
      padding: 10px;
      border: 2px solid #E5E5E5;
      border-radius: 6px;
      font-size: 0.95rem;
      resize: vertical;
      font-family: inherit;
      transition: border-color 0.2s;
    }
    textarea:focus {
      outline: none;
      border-color: #F48120;
      box-shadow: 0 0 0 3px rgba(244,129,32,0.1);
    }
    .button-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 140px;
    }
    button {
      background: #F48120;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.95rem;
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
      gap: 6px;
      margin-top: 10px;
      align-items: center;
    }
    .example-prompts span {
      color: #666;
      font-weight: 500;
      font-size: 0.85rem;
    }
    .example-btn {
      background: #FFF5EB;
      color: #E06C1F;
      border: 1px solid #FFD4B3;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
    }
    .example-btn:hover {
      background: #F48120;
      color: white;
      border-color: #F48120;
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
    .result-box {
      background: #FAFAFA;
      border: 1px solid #E5E5E5;
      border-radius: 6px;
      padding: 12px;
      white-space: pre-wrap;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 0.8rem;
      line-height: 1.5;
      min-height: 100px;
    }
    .result-box.prompt {
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
      padding: 10px;
      margin: 6px 0;
      border-radius: 0 6px 6px 0;
      font-size: 0.8rem;
    }
    .tool-result {
      background: #F6FDF9;
      border-left: 4px solid #22C55E;
      padding: 10px;
      margin: 6px 0;
      border-radius: 0 6px 6px 0;
      font-size: 0.8rem;
    }
    .mcp-status {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
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
    .empty-state {
      color: #999;
      font-style: italic;
      text-align: center;
      padding: 40px 20px;
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
    @media (max-width: 900px) {
      .results-container {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 AI Orchestrator + MCP</h1>
    <p class="subtitle"><span class="cloudflare-badge">⚡ Cloudflare</span> Workers AI + AI Gateway + MCP Tools</p>

    <div class="card">
      <div class="input-row">
        <div class="input-group">
          <label for="prompt">Your prompt:</label>
          <textarea id="prompt" placeholder="Try: 'What is the weather in Tokyo?'"></textarea>
          <div class="example-prompts">
            <span>Examples:</span>
            <button class="example-btn" onclick="setPrompt('What is the weather in Paris?')">Weather</button>
            <button class="example-btn" onclick="setPrompt('Calculate 25 * 47')">Calculator</button>
            <button class="example-btn" onclick="setPrompt('Tell me about terns')">Fact</button>
            <button class="example-btn" onclick="setPrompt('If apples cost $3 and I have $45, how many can I buy?')">Multi-step</button>
          </div>
        </div>
        <div class="button-group">
          <button id="submit-btn" onclick="sendPrompt()">Send to AI</button>
        </div>
      </div>
    </div>

    <div class="results-container" id="results-container" style="display: none;">
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

    async function sendPrompt() {
      const prompt = document.getElementById('prompt').value.trim();
      if (!prompt) {
        alert('Please enter a prompt');
        return;
      }

      const submitBtn = document.getElementById('submit-btn');
      const resultsContainer = document.getElementById('results-container');
      const requestBox = document.getElementById('request-box');
      const aiBox = document.getElementById('ai-box');
      const toolsBox = document.getElementById('tools-box');
      const mcpStatus = document.getElementById('mcp-status');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing...';
      resultsContainer.style.display = 'grid';
      
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

        if (data.error) {
          aiBox.className = 'result-box error';
          aiBox.textContent = 'Error: ' + data.error;
          toolsBox.innerHTML = '<div class="empty-state">Error occurred</div>';
        } else {
          // Show AI response
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
        toolsBox.innerHTML = '<div class="empty-state">Error occurred</div>';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send to AI';
      }
    }
  </script>
</body>
</html>`;
          }
        }
      } catch (error) {
        aiSection.style.display = 'block';
        aiBox.className = 'result-box error';
        aiBox.textContent = 'Error: ' + error.message;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send to AI';
      }
    }
  </script>
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
      try {
        const body = await request.json() as { prompt: string };
        const prompt = body.prompt || "";

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
        } catch (error) {
          return new Response(
            JSON.stringify({ error: String(error) }, null, 2),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        if (aiResponse.error) {
          return new Response(
            JSON.stringify({ error: aiResponse.error }, null, 2),
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
          const results = await processToolCalls(env.MCP_SERVER, validToolCalls);
          
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
            const finalAiResponse = await callWorkersAI(
              env.AI,
              [
                { 
                  role: 'system', 
                  content: 'You are a helpful assistant. Based on the tool results provided, give a clear and helpful response to the user.'
                },
                { role: 'user', content: prompt },
                { role: 'assistant', content: `I need to use tools to answer this. Let me call: ${validToolCalls.map(tc => tc.name).join(', ')}` },
                { role: 'user', content: `Here are the tool results:\n\n${toolResultsMessage}\n\nPlease provide a helpful response based on these results.` }
              ]
            );

            if (!finalAiResponse.error && finalAiResponse.response) {
              finalResponse = finalAiResponse.response;
            }
          } catch (error) {
            // If second AI call fails, append tool results to any existing response
            finalResponse = finalResponse 
              ? `${finalResponse}\n\nTool Results:\n${toolResultsMessage}`
              : `Tool Results:\n${toolResultsMessage}`;
          }
        }

        return new Response(
          JSON.stringify({
            ai: { 
              response: finalResponse,
              tool_calls: aiResponse.tool_calls || [],
            },
            toolCalls: toolCalls,
          }, null, 2),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({ error: String(error) }, null, 2),
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
