/**
 * MCP Demo Client - Cloudflare Workers with Code Mode Support
 * 
 * A Cloudflare Workers client that connects to the MCP demo server
 * with Code Mode capabilities. Demonstrates both traditional tool
 * calling and Code Mode (search + execute).
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface Env {
  MCP_SERVER_URL: string;
}

// HTML template for the web interface
const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Demo - Code Mode</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
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
      font-size: 1.5rem;
    }
    .card h3 {
      color: #555;
      margin: 20px 0 10px 0;
      font-size: 1.1rem;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .info-item {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .info-item h4 {
      color: #667eea;
      margin-bottom: 8px;
    }
    .info-item p {
      color: #666;
      font-size: 0.9rem;
    }
    .code-block {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.85rem;
      margin: 10px 0;
    }
    .code-block .comment { color: #6a9955; }
    .code-block .keyword { color: #569cd6; }
    .code-block .string { color: #ce9178; }
    .code-block .function { color: #dcdcaa; }
    button {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1rem;
      margin: 5px;
      transition: background 0.2s;
    }
    button:hover {
      background: #5a67d8;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .endpoint-list {
      list-style: none;
    }
    .endpoint-list li {
      padding: 8px 12px;
      background: #f8f9fa;
      margin: 4px 0;
      border-radius: 4px;
      font-family: monospace;
    }
    .endpoint-list li::before {
      content: "→ ";
      color: #667eea;
      font-weight: bold;
    }
    .result {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
      white-space: pre-wrap;
      font-family: monospace;
      font-size: 0.85rem;
    }
    .error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
    }
    .comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 20px;
    }
    @media (max-width: 768px) {
      .comparison {
        grid-template-columns: 1fr;
      }
    }
    .comparison-item {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
    }
    .comparison-item h4 {
      margin-bottom: 10px;
      color: #333;
    }
    .token-count {
      font-size: 2rem;
      font-weight: bold;
      color: #667eea;
    }
    .savings {
      color: #10b981;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 MCP Demo with Code Mode</h1>
    <p class="subtitle">Reduce context window usage by 60% with just 2 tools instead of 5</p>

    <div class="card">
      <h2>📊 Token Comparison</h2>
      <div class="comparison">
        <div class="comparison-item">
          <h4>Traditional MCP (5 tools)</h4>
          <div class="token-count">~2,500</div>
          <p>tokens in context window</p>
        </div>
        <div class="comparison-item">
          <h4>Code Mode (2 tools)</h4>
          <div class="token-count">~1,000</div>
          <p>tokens in context window</p>
          <p class="savings">↓ 60% reduction</p>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>🔧 Available Tools (2 instead of 5!)</h2>
      <div class="info-grid">
        <div class="info-item">
          <h4>search(filter)</h4>
          <p>Explore available tools and their specifications by filtering the tool specs</p>
        </div>
        <div class="info-item">
          <h4>execute(operations)</h4>
          <p>Execute multiple tool operations in a single call by passing an array</p>
        </div>
      </div>

      <h3>Example: Search for weather-related tools</h3>
      <div class="code-block">
{
  <span class="string">"filter"</span>: <span class="string">"weather"</span>
}</div>

      <h3>Example: Execute multiple operations</h3>
      <div class="code-block">
{
  <span class="string">"operations"</span>: [
    { <span class="string">"tool"</span>: <span class="string">"getWeather"</span>, <span class="string">"params"</span>: { <span class="string">"location"</span>: <span class="string">"Tokyo"</span> } },
    { <span class="string">"tool"</span>: <span class="string">"randomFact"</span>, <span class="string">"params"</span>: { <span class="string">"category"</span>: <span class="string">"space"</span> } },
    { <span class="string">"tool"</span>: <span class="string">"calculator"</span>, <span class="string">"params"</span>: { <span class="string">"operation"</span>: <span class="string">"multiply"</span>, <span class="string">"a"</span>: 42, <span class="string">"b"</span>: 100 } }
  ]
}</div>
    </div>

    <div class="card">
      <h2>🎮 Test the API</h2>
      <p>Use these endpoints to test the MCP server:</p>
      <ul class="endpoint-list">
        <li>GET /status - Check server connection</li>
        <li>GET /test-echo - Test echo via Code Mode</li>
        <li>GET /test-calculator - Test calculator via Code Mode</li>
        <li>GET /test-weather - Test weather via Code Mode</li>
        <li>GET /test-fact - Test random fact via Code Mode</li>
        <li>GET /test-all - Run all tests</li>
        <li>GET /demo-search - Demonstrate search() tool</li>
        <li>GET /demo-execute - Demonstrate execute() tool</li>
      </ul>
    </div>

    <div class="card">
      <h2>📝 API Response</h2>
      <button onclick="testEndpoint('/status')">Test /status</button>
      <button onclick="testEndpoint('/test-echo')">Test /test-echo</button>
      <button onclick="testEndpoint('/test-calculator')">Test /test-calculator</button>
      <button onclick="testEndpoint('/test-weather')">Test /test-weather</button>
      <button onclick="testEndpoint('/test-fact')">Test /test-fact</button>
      <button onclick="testEndpoint('/test-all')">Test All</button>
      <button onclick="testEndpoint('/demo-search')">Demo Search</button>
      <button onclick="testEndpoint('/demo-execute')">Demo Execute</button>
      <div id="result" class="result" style="display:none;"></div>
    </div>
  </div>

  <script>
    async function testEndpoint(endpoint) {
      const resultDiv = document.getElementById('result');
      resultDiv.style.display = 'block';
      resultDiv.textContent = 'Loading...';
      resultDiv.classList.remove('error');
      
      try {
        const response = await fetch(endpoint);
        const data = await response.json();
        resultDiv.textContent = JSON.stringify(data, null, 2);
      } catch (error) {
        resultDiv.textContent = 'Error: ' + error.message;
        resultDiv.classList.add('error');
      }
    }
  </script>
</body>
</html>
`;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers for browser access
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Serve the web UI on root
    if (url.pathname === "/") {
      return new Response(HTML_TEMPLATE, {
        headers: { 
          "Content-Type": "text/html",
          ...corsHeaders 
        },
      });
    }

    // Status check
    if (url.pathname === "/status") {
      try {
        const serverInfo = await getServerInfo(env.MCP_SERVER_URL);
        return new Response(
          JSON.stringify({ status: "connected", server: serverInfo }, null, 2),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ 
            status: "error", 
            error: error instanceof Error ? error.message : String(error) 
          }, null, 2),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Demo search tool
    if (url.pathname === "/demo-search") {
      try {
        const result = await callMCPTool(env.MCP_SERVER_URL, "search", { filter: "weather" });
        return new Response(
          JSON.stringify({ 
            demo: "Code Mode - search() tool", 
            filter: "weather",
            result 
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

    // Demo execute tool
    if (url.pathname === "/demo-execute") {
      try {
        const operations = [
          { tool: "getWeather", params: { location: "San Francisco", units: "celsius" } },
          { tool: "randomFact", params: { category: "technology" } },
          { tool: "calculator", params: { operation: "multiply", a: 42, b: 100 } },
        ];
        
        const result = await callMCPTool(env.MCP_SERVER_URL, "execute", { operations });
        return new Response(
          JSON.stringify({ 
            demo: "Code Mode - execute() tool", 
            operations,
            explanation: "This single execute() call made 3 tool calls internally",
            result 
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

    // Test endpoints using Code Mode
    if (url.pathname === "/test-echo") {
      try {
        const result = await callMCPTool(env.MCP_SERVER_URL, "execute", {
          operations: [{ tool: "echo", params: { message: "Hello from Code Mode!" } }]
        });
        return new Response(
          JSON.stringify({ tool: "echo", result }, null, 2),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: String(error) }, null, 2),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (url.pathname === "/test-calculator") {
      try {
        const result = await callMCPTool(env.MCP_SERVER_URL, "execute", {
          operations: [{ tool: "calculator", params: { operation: "multiply", a: 42, b: 100 } }]
        });
        return new Response(
          JSON.stringify({ tool: "calculator", result }, null, 2),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: String(error) }, null, 2),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (url.pathname === "/test-weather") {
      try {
        const result = await callMCPTool(env.MCP_SERVER_URL, "execute", {
          operations: [{ tool: "getWeather", params: { location: "San Francisco", units: "celsius" } }]
        });
        return new Response(
          JSON.stringify({ tool: "get_weather", result }, null, 2),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: String(error) }, null, 2),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (url.pathname === "/test-fact") {
      try {
        const result = await callMCPTool(env.MCP_SERVER_URL, "execute", {
          operations: [{ tool: "randomFact", params: { category: "technology" } }]
        });
        return new Response(
          JSON.stringify({ tool: "random_fact", result }, null, 2),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: String(error) }, null, 2),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (url.pathname === "/test-all") {
      try {
        const operations = [
          { tool: "echo", params: { message: "Testing echo" } },
          { tool: "calculator", params: { operation: "add", a: 10, b: 20 } },
          { tool: "getWeather", params: { location: "Tokyo" } },
          { tool: "randomFact", params: { category: "space" } },
          { tool: "getTrafficLog", params: { limit: 5 } },
        ];
        
        const result = await callMCPTool(env.MCP_SERVER_URL, "execute", { operations });
        
        // Parse the result content
        let parsedResult;
        if (result && typeof result === 'object' && 'content' in result) {
          const content = (result as { content: Array<{ text: string }> }).content;
          if (content && content[1] && content[1].text) {
            try {
              parsedResult = JSON.parse(content[1].text);
            } catch {
              parsedResult = result;
            }
          } else {
            parsedResult = result;
          }
        } else {
          parsedResult = result;
        }
        
        return new Response(
          JSON.stringify({ tests: parsedResult }, null, 2),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: String(error) }, null, 2),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Not found" }, null, 2),
      { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  },
};

/**
 * Call an MCP tool on the server
 */
async function callMCPTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const client = new Client({
    name: "mcp-demo-client",
    version: "1.0.0",
  });

  const transport = new StreamableHTTPClientTransport(new URL(`${serverUrl}/mcp`));
  
  try {
    await client.connect(transport);
    
    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    await client.close();
    return result;
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

/**
 * Get server info via MCP resources
 */
async function getServerInfo(serverUrl: string): Promise<unknown> {
  const client = new Client({
    name: "mcp-demo-client",
    version: "1.0.0",
  });

  const transport = new StreamableHTTPClientTransport(new URL(`${serverUrl}/mcp`));
  
  try {
    await client.connect(transport);
    
    const result = await client.readResource({
      uri: "mcp://resources/server-info",
    });

    await client.close();
    return result;
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}
