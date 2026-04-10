/**
 * MCP Demo Client - Cloudflare Workers
 * 
 * A Cloudflare Workers client with web UI for testing the MCP server.
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
  <title>MCP Demo</title>
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
      margin-bottom: 20px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .card h2 {
      color: #333;
      margin-bottom: 12px;
      font-size: 1.25rem;
    }
    .tools-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tool-badge {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    button {
      background: #667eea;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.95rem;
      margin: 4px;
      transition: background 0.2s;
    }
    button:hover {
      background: #5a67d8;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .result-container {
      margin-top: 16px;
    }
    .result-section {
      margin-bottom: 16px;
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
      padding: 12px;
      white-space: pre-wrap;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.8rem;
      max-height: 300px;
      overflow-y: auto;
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
    .loading {
      color: #667eea;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 MCP Demo</h1>
    <p class="subtitle">MCP Server and Client running on Cloudflare Workers</p>

    <div class="card">
      <h2>🔧 Available Tools</h2>
      <div class="tools-row">
        <span class="tool-badge">echo</span>
        <span class="tool-badge">calculator</span>
        <span class="tool-badge">get_weather</span>
        <span class="tool-badge">random_fact</span>
        <span class="tool-badge">get_traffic_log</span>
      </div>
    </div>

    <div class="card">
      <h2>🎮 Test the Tools</h2>
      <button onclick="testTool('echo')">Test echo</button>
      <button onclick="testTool('calculator')">Test calculator</button>
      <button onclick="testTool('weather')">Test weather</button>
      <button onclick="testTool('fact')">Test random fact</button>
      <button onclick="testTool('all')">Test all</button>
      
      <div id="result" class="result-container">
        <div class="result-section">
          <h3>Request</h3>
          <div id="request-box" class="result-box request">Click a button to send a request...</div>
        </div>
        <div class="result-section">
          <h3>Response</h3>
          <div id="response-box" class="result-box response">Response will appear here...</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const toolRequests = {
      'echo': {
        name: 'echo',
        arguments: { message: 'Hello from MCP!' }
      },
      'calculator': {
        name: 'calculator',
        arguments: { operation: 'multiply', a: 42, b: 100 }
      },
      'weather': {
        name: 'get_weather',
        arguments: { location: 'San Francisco', units: 'celsius' }
      },
      'fact': {
        name: 'random_fact',
        arguments: { category: 'technology' }
      },
      'all': 'Run all 5 tool tests'
    };

    async function testTool(tool) {
      const requestBox = document.getElementById('request-box');
      const responseBox = document.getElementById('response-box');
      
      const endpoints = {
        'echo': '/test-echo',
        'calculator': '/test-calculator',
        'weather': '/test-weather',
        'fact': '/test-fact',
        'all': '/test-all'
      };
      
      // Show request
      if (tool === 'all') {
        requestBox.textContent = toolRequests[tool];
      } else {
        requestBox.textContent = JSON.stringify(toolRequests[tool], null, 2);
      }
      
      responseBox.textContent = 'Loading...';
      responseBox.className = 'result-box response loading';
      
      try {
        const response = await fetch(endpoints[tool]);
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        const data = await response.json();
        responseBox.textContent = JSON.stringify(data, null, 2);
        responseBox.className = 'result-box response';
      } catch (error) {
        responseBox.textContent = 'Error: ' + error.message;
        responseBox.className = 'result-box error';
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

    // Test endpoints using MCP tools
    if (url.pathname === "/test-echo") {
      return testTool(env.MCP_SERVER_URL, "echo", { message: "Hello from MCP!" }, corsHeaders);
    }

    if (url.pathname === "/test-calculator") {
      return testTool(env.MCP_SERVER_URL, "calculator", { operation: "multiply", a: 42, b: 100 }, corsHeaders);
    }

    if (url.pathname === "/test-weather") {
      return testTool(env.MCP_SERVER_URL, "get_weather", { location: "San Francisco", units: "celsius" }, corsHeaders);
    }

    if (url.pathname === "/test-fact") {
      return testTool(env.MCP_SERVER_URL, "random_fact", { category: "technology" }, corsHeaders);
    }

    if (url.pathname === "/test-all") {
      try {
        const results: Record<string, unknown> = {};
        
        results.echo = await callMCPTool(env.MCP_SERVER_URL, "echo", { message: "Test echo" });
        results.calculator = await callMCPTool(env.MCP_SERVER_URL, "calculator", { operation: "add", a: 10, b: 20 });
        results.weather = await callMCPTool(env.MCP_SERVER_URL, "get_weather", { location: "Tokyo" });
        results.fact = await callMCPTool(env.MCP_SERVER_URL, "random_fact", { category: "space" });
        results.traffic = await callMCPTool(env.MCP_SERVER_URL, "get_traffic_log", { limit: 5 });
        
        return new Response(
          JSON.stringify({ tests: results }, null, 2),
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
 * Test a single tool
 */
async function testTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const result = await callMCPTool(serverUrl, toolName, args);
    return new Response(
      JSON.stringify({ tool: toolName, result }, null, 2),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }, null, 2),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}

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
