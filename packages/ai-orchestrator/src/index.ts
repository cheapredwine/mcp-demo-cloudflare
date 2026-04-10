/**
 * AI Orchestrator - Uses Cloudflare AI Gateway with MCP Tool Calling
 * 
 * Demonstrates:
 * - Cloudflare AI Gateway via HTTP API (caching, analytics, rate limiting)
 * - Worker AI with structured tool calling
 * - Service Binding to MCP server for tool execution
 */

interface Env {
  CF_AIG_TOKEN: string;  // Cloudflare API token for AI Gateway
  MCP_SERVER: Fetcher;
}

// AI Gateway endpoint
const AI_GATEWAY_URL = "https://gateway.ai.cloudflare.com/v1/1ddebf6f9507d3fc9052158be9d42dee/mcp-demo/compat/chat/completions";

// Tool definition interface
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

// Call AI Gateway endpoint
async function callAIGateway(
  token: string,
  messages: Array<{ role: string; content: string }>,
  tools?: ToolDefinition[]
): Promise<{
  response?: string;
  tool_calls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  error?: string;
}> {
  const body: Record<string, unknown> = {
    model: "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
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

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { error: `AI Gateway error: ${response.status} - ${errorText}` };
  }

  const data = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string;
        tool_calls?: Array<{
          function?: {
            name?: string;
            arguments?: string;
          };
        }>;
      };
    }>;
  };

  const choice = data.choices?.[0];
  const message = choice?.message;
  
  const result: {
    response?: string;
    tool_calls?: Array<{ name: string; arguments: Record<string, unknown> }>;
    error?: string;
  } = {};

  if (message?.content) {
    result.response = message.content;
  }

  if (message?.tool_calls && message.tool_calls.length > 0) {
    result.tool_calls = message.tool_calls
      .filter(tc => tc.function?.name)
      .map(tc => ({
        name: tc.function!.name!,
        arguments: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {},
      }));
  }

  return result;
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
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 10px;
      font-size: 2.5rem;
    }
    .subtitle {
      color: rgba(255,255,255,0.9);
      text-align: center;
      margin-bottom: 30px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .card h2 {
      color: #333;
      margin-bottom: 16px;
      font-size: 1.25rem;
    }
    .input-group {
      margin-bottom: 16px;
    }
    .input-group label {
      display: block;
      margin-bottom: 8px;
      color: #555;
      font-weight: 500;
    }
    textarea {
      width: 100%;
      min-height: 100px;
      padding: 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 1rem;
      resize: vertical;
      font-family: inherit;
    }
    textarea:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      background: #667eea;
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.2s;
      width: 100%;
    }
    button:hover {
      background: #5a67d8;
      transform: translateY(-1px);
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
    }
    .example-prompts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .example-btn {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #e5e7eb;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .example-btn:hover {
      background: #e5e7eb;
    }
    .result-section {
      margin-top: 20px;
    }
    .result-section h3 {
      color: #667eea;
      font-size: 0.9rem;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .result-box {
      background: #f8f9fa;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      white-space: pre-wrap;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.85rem;
      max-height: 400px;
      overflow-y: auto;
      line-height: 1.5;
    }
    .result-box.request {
      background: #f0f9ff;
      border-color: #bae6fd;
    }
    .result-box.response {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .result-box.error {
      background: #fef2f2;
      border-color: #fecaca;
      color: #dc2626;
    }
    .tool-call {
      background: #eff6ff;
      border-left: 3px solid #3b82f6;
      padding: 12px;
      margin: 8px 0;
      border-radius: 0 8px 8px 0;
    }
    .tool-result {
      background: #f0fdf4;
      border-left: 3px solid #22c55e;
      padding: 12px;
      margin: 8px 0;
      border-radius: 0 8px 8px 0;
    }
    .mcp-status {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .mcp-status.used {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
    }
    .mcp-status.not-used {
      background: #f3f4f6;
      color: #6b7280;
      border: 1px solid #e5e7eb;
    }
    .loading {
      color: #667eea;
      font-style: italic;
    }
    .info-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .info-box h4 {
      color: #1e40af;
      margin-bottom: 8px;
    }
    .info-box ul {
      margin-left: 20px;
      color: #1e40af;
    }
    .info-box li {
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 AI Orchestrator + MCP</h1>
    <p class="subtitle">Cloudflare AI Gateway + Workers AI + MCP Tools</p>

    <div class="card">
      <div class="info-box">
        <h4>How it works:</h4>
        <ul>
          <li><strong>Browser</strong> sends prompt to AI Orchestrator (Worker)</li>
          <li><strong>AI Orchestrator</strong> calls AI Gateway HTTP API</li>
          <li><strong>AI Gateway</strong> provides caching, analytics, and rate limiting</li>
          <li><strong>Workers AI</strong> processes prompt and decides which tools to call</li>
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
        <button class="example-btn" onclick="setPrompt('What is the weather in Paris?')">Weather</button>
        <button class="example-btn" onclick="setPrompt('Calculate 25 * 47')">Calculator</button>
        <button class="example-btn" onclick="setPrompt('Tell me a science fact')">Fact</button>
        <button class="example-btn" onclick="setPrompt('If apples cost $3 each and I have $45, how many can I buy? Also, what is the weather where apples grow best?')">Multi-tool</button>
      </div>
    </div>

    <div class="card" id="result-card" style="display: none;">
      <h2>📊 Results <span id="mcp-status" class="mcp-status not-used" style="display: none;"></span></h2>
      
      <div class="result-section">
        <h3>Your Prompt</h3>
        <div id="request-box" class="result-box request"></div>
      </div>

      <div class="result-section" id="tools-section" style="display: none;">
        <h3>🔧 MCP Server Interaction</h3>
        <div id="tools-box" class="result-box response"></div>
      </div>

      <div class="result-section" id="ai-section" style="display: none;">
        <h3>🤖 AI Response</h3>
        <div id="ai-box" class="result-box response"></div>
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
      const resultCard = document.getElementById('result-card');
      const requestBox = document.getElementById('request-box');
      const aiSection = document.getElementById('ai-section');
      const aiBox = document.getElementById('ai-box');
      const toolsSection = document.getElementById('tools-section');
      const toolsBox = document.getElementById('tools-box');
      const mcpStatus = document.getElementById('mcp-status');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing...';
      resultCard.style.display = 'block';
      mcpStatus.style.display = 'none';
      requestBox.textContent = prompt;
      aiSection.style.display = 'none';
      toolsSection.style.display = 'none';

      try {
        const response = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });

        const data = await response.json();

        if (data.error) {
          aiSection.style.display = 'block';
          aiBox.className = 'result-box error';
          aiBox.textContent = 'Error: ' + data.error;
        } else {
          aiSection.style.display = 'block';
          if (data.ai && data.ai.response) {
            aiBox.textContent = data.ai.response;
          } else if (data.ai && data.ai.error) {
            aiBox.className = 'result-box error';
            aiBox.textContent = 'Error: ' + data.ai.error;
          }

          if (data.toolCalls && data.toolCalls.length > 0) {
            // MCP was used
            mcpStatus.style.display = 'inline-block';
            mcpStatus.className = 'mcp-status used';
            mcpStatus.textContent = 'MCP Server Used (' + data.toolCalls.length + ' tool call' + (data.toolCalls.length > 1 ? 's' : '') + ')';
            
            toolsSection.style.display = 'block';
            let toolsHtml = '<div style="margin-bottom: 12px; color: #166534; font-weight: 500;">✅ The AI invoked the MCP server to retrieve data</div>';
            data.toolCalls.forEach(function(call, i) {
              toolsHtml += '<div class="tool-call">';
              toolsHtml += '<strong>Tool #' + (i + 1) + ':</strong> ' + call.tool + '<br>';
              toolsHtml += '<strong>Arguments:</strong><br>' + JSON.stringify(call.arguments, null, 2);
              toolsHtml += '</div>';
              
              if (call.result) {
                toolsHtml += '<div class="tool-result">';
                toolsHtml += '<strong>Result:</strong><br>' + JSON.stringify(call.result, null, 2);
                toolsHtml += '</div>';
              }
            });
            toolsBox.innerHTML = toolsHtml;
          } else {
            // MCP was not used
            mcpStatus.style.display = 'inline-block';
            mcpStatus.className = 'mcp-status not-used';
            mcpStatus.textContent = 'MCP Not Used';
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

        // Check if AI Gateway token is configured
        if (!env.CF_AIG_TOKEN) {
          return new Response(
            JSON.stringify({ 
              error: "AI Gateway token not configured. Please set CF_AIG_TOKEN secret." 
            }, null, 2),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Call AI Gateway with tools available - AI decides whether to use them
        let aiResponse;
        try {
          aiResponse = await callAIGateway(
            env.CF_AIG_TOKEN,
            [
              { 
                role: 'system', 
                content: 'You are a helpful assistant with access to tools. You can answer general knowledge questions directly. Only use the available tools if the user asks for calculations or weather information.'
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

        // Process tool calls if any
        const toolCalls: Array<{ tool: string; arguments: Record<string, unknown>; result?: unknown }> = [];
        let finalResponse = aiResponse.response || "";
        
        if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
          // Execute the tool calls via service binding
          const results = await processToolCalls(env.MCP_SERVER, aiResponse.tool_calls);
          
          for (let i = 0; i < aiResponse.tool_calls.length; i++) {
            toolCalls.push({
              tool: aiResponse.tool_calls[i].name,
              arguments: aiResponse.tool_calls[i].arguments,
              result: results[i]?.result,
            });
          }

          // Build conversation with tool results for final AI response
          const toolResultsMessage = toolCalls.map(tc => 
            `Tool: ${tc.tool}\nArguments: ${JSON.stringify(tc.arguments)}\nResult: ${JSON.stringify(tc.result)}`
          ).join('\n\n');

          // Step 2: Call AI Gateway again with tool results to get final response
          try {
            const finalAiResponse = await callAIGateway(
              env.CF_AIG_TOKEN,
              [
                { 
                  role: 'system', 
                  content: 'You are a helpful assistant. Based on the tool results provided, give a clear and helpful response to the user.'
                },
                { role: 'user', content: prompt },
                { role: 'assistant', content: `I need to use tools to answer this. Let me call: ${aiResponse.tool_calls.map(tc => tc.name).join(', ')}` },
                { role: 'user', content: `Here are the tool results:\n\n${toolResultsMessage}\n\nPlease provide a helpful response based on these results.` }
              ]
            );

            if (!finalAiResponse.error && finalAiResponse.response) {
              finalResponse = finalAiResponse.response;
            }
          } catch (error) {
            // If second AI call fails, use a formatted response with tool results
            finalResponse = `I found the following information:\n\n${toolResultsMessage}`;
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
