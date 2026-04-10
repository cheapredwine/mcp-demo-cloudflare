/**
 * MCP Demo - Combined Server + Client
 * 
 * A single Cloudflare Worker that serves both:
 * - MCP protocol endpoint at /mcp
 * - Web UI at /
 * - Test endpoints at /test-*
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface Env {
  // No external dependencies needed - everything is in one worker
}

// Fact database for random_fact tool
const FACTS: Record<string, string[]> = {
  science: [
    "Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible.",
    "A day on Venus is longer than its year. Venus rotates so slowly that one rotation takes 243 Earth days.",
    "Octopuses have three hearts, nine brains, and blue blood.",
  ],
  history: [
    "The shortest war in history lasted only 38 minutes between Britain and Zanzibar in 1896.",
    "Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid of Giza.",
    "The first computer bug was an actual bug - a moth found in a Harvard Mark II computer in 1947.",
  ],
  technology: [
    "The first computer mouse was made of wood.",
    "Email existed before the World Wide Web.",
    "The first 1GB hard drive, announced in 1980, weighed over 500 pounds and cost $40,000.",
  ],
  nature: [
    "Bananas are berries, but strawberries aren't.",
    "A group of flamingos is called a 'flamboyance'.",
    "Trees can communicate with each other through an underground fungal network.",
  ],
  space: [
    "There's a planet made of diamonds, called 55 Cancri e.",
    "One day on Mercury lasts 1,408 hours.",
    "Neutron stars can spin at a rate of 600 rotations per second.",
  ],
};

// Create and configure the MCP server
function createServer(): Server {
  const server = new Server(
    {
      name: "mcp-demo-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "echo",
          description: "Echo back the input message",
          inputSchema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Message to echo back" },
            },
            required: ["message"],
          },
        },
        {
          name: "calculator",
          description: "Perform basic arithmetic operations",
          inputSchema: {
            type: "object",
            properties: {
              operation: { 
                type: "string", 
                enum: ["add", "subtract", "multiply", "divide"],
                description: "Math operation to perform"
              },
              a: { type: "number", description: "First number" },
              b: { type: "number", description: "Second number" },
            },
            required: ["operation", "a", "b"],
          },
        },
        {
          name: "get_weather",
          description: "Get current weather for a location (simulated/demo data)",
          inputSchema: {
            type: "object",
            properties: {
              location: { type: "string", description: "City name or location" },
              units: { 
                type: "string", 
                enum: ["celsius", "fahrenheit"],
                description: "Temperature units"
              },
            },
            required: ["location"],
          },
        },
        {
          name: "random_fact",
          description: "Get a random interesting fact",
          inputSchema: {
            type: "object",
            properties: {
              category: { 
                type: "string", 
                enum: ["science", "history", "technology", "nature", "space"],
                description: "Fact category (optional)"
              },
            },
          },
        },
        {
          name: "get_traffic_log",
          description: "Get request traffic log (demo)",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Max number of entries" },
            },
          },
        },
      ],
    };
  });

  // List resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "mcp://resources/server-info",
          name: "Server Information",
          mimeType: "application/json",
          description: "Information about this MCP server",
        },
      ],
    };
  });

  // Read resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    
    if (uri === "mcp://resources/server-info") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({
              name: "MCP Demo Server",
              version: "1.0.0",
              description: "Stateless MCP server with 5 demo tools",
              tools: ["echo", "calculator", "get_weather", "random_fact", "get_traffic_log"],
            }),
          },
        ],
      };
    }
    
    throw new Error(`Resource not found: ${uri}`);
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    try {
      switch (name) {
        case "echo": {
          const message = args?.message as string;
          return {
            content: [
              { type: "text" as const, text: `Echo: ${message}` },
            ],
          };
        }

        case "calculator": {
          const operation = args?.operation as string;
          const a = args?.a as number;
          const b = args?.b as number;
          
          let result: number;
          let opSymbol: string;
          
          switch (operation) {
            case "add":
              result = a + b;
              opSymbol = "+";
              break;
            case "subtract":
              result = a - b;
              opSymbol = "-";
              break;
            case "multiply":
              result = a * b;
              opSymbol = "*";
              break;
            case "divide":
              if (b === 0) {
                return {
                  content: [{ type: "text" as const, text: "Error: Division by zero" }],
                  isError: true,
                };
              }
              result = a / b;
              opSymbol = "/";
              break;
            default:
              return {
                content: [{ type: "text" as const, text: `Unknown operation: ${operation}` }],
                isError: true,
              };
          }
          
          return {
            content: [
              { type: "text" as const, text: `${a} ${opSymbol} ${b} = ${result}` },
            ],
          };
        }

        case "get_weather": {
          const location = args?.location as string;
          const units = (args?.units as string) || "celsius";
          
          const conditions = ["Sunny", "Cloudy", "Rainy", "Partly Cloudy", "Windy"];
          const condition = conditions[Math.floor(Math.random() * conditions.length)];
          const tempC = Math.floor(Math.random() * 35) - 5;
          const temp = units === "fahrenheit" ? Math.round(tempC * 9 / 5 + 32) : tempC;
          const unitSymbol = units === "fahrenheit" ? "°F" : "°C";
          
          return {
            content: [
              { type: "text" as const, text: `Weather for ${location}:` },
              { type: "text" as const, text: `Condition: ${condition}` },
              { type: "text" as const, text: `Temperature: ${temp}${unitSymbol}` },
              { type: "text" as const, text: `Humidity: ${Math.floor(Math.random() * 60 + 30)}%` },
              { type: "text" as const, text: `Wind: ${Math.floor(Math.random() * 20 + 5)} km/h` },
            ],
          };
        }

        case "random_fact": {
          const category = args?.category as string | undefined;
          const selectedCategory = category || Object.keys(FACTS)[Math.floor(Math.random() * Object.keys(FACTS).length)];
          const categoryFacts = FACTS[selectedCategory] || FACTS["science"];
          const fact = categoryFacts[Math.floor(Math.random() * categoryFacts.length)];
          
          return {
            content: [
              { type: "text" as const, text: `Category: ${selectedCategory}` },
              { type: "text" as const, text: `Fact: ${fact}` },
            ],
          };
        }

        case "get_traffic_log": {
          return {
            content: [
              { type: "text" as const, text: "Traffic Log (Stateless Demo)" },
              { type: "text" as const, text: "Each request is independent" },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  });

  return server;
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
    <p class="subtitle">MCP Server running on Cloudflare Workers</p>

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

// Main Worker export
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers
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

    // MCP protocol endpoint
    if (url.pathname === "/mcp" && request.method === "POST") {
      try {
        const server = createServer();
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        
        await server.connect(transport);
        const response = await transport.handleRequest(request);
        ctx.waitUntil(server.close());
        
        return response;
      } catch (error) {
        console.error("MCP Server Error:", error);
        return new Response(
          JSON.stringify({ 
            error: "Internal Server Error",
            message: error instanceof Error ? error.message : String(error)
          }, null, 2),
          { 
            status: 500, 
            headers: { "Content-Type": "application/json" } 
          }
        );
      }
    }

    // Test endpoints - call MCP tools directly (no external HTTP)
    if (url.pathname === "/test-echo") {
      return testTool("echo", { message: "Hello from MCP!" }, corsHeaders);
    }

    if (url.pathname === "/test-calculator") {
      return testTool("calculator", { operation: "multiply", a: 42, b: 100 }, corsHeaders);
    }

    if (url.pathname === "/test-weather") {
      return testTool("get_weather", { location: "San Francisco", units: "celsius" }, corsHeaders);
    }

    if (url.pathname === "/test-fact") {
      return testTool("random_fact", { category: "technology" }, corsHeaders);
    }

    if (url.pathname === "/test-all") {
      try {
        const results: Record<string, unknown> = {};
        
        results.echo = await callToolDirectly("echo", { message: "Test echo" });
        results.calculator = await callToolDirectly("calculator", { operation: "add", a: 10, b: 20 });
        results.weather = await callToolDirectly("get_weather", { location: "Tokyo" });
        results.fact = await callToolDirectly("random_fact", { category: "space" });
        results.traffic = await callToolDirectly("get_traffic_log", { limit: 5 });
        
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

    // Status check
    if (url.pathname === "/status") {
      return new Response(
        JSON.stringify({ status: "connected", server: "MCP Demo Server v1.0.0" }, null, 2),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }, null, 2),
      { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  },
};

// Test a single tool directly (no HTTP)
async function testTool(
  toolName: string,
  args: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const result = await callToolDirectly(toolName, args);
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

// Call tool directly using in-memory MCP server
async function callToolDirectly(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const client = new Client({
    name: "mcp-demo-client",
    version: "1.0.0",
  });

  // Create a dummy transport that routes to our own server
  const transport = {
    async start() {},
    async close() {},
    async send(message: unknown) {
      // Handle the message directly
      const server = createServer();
      const serverTransport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      
      await server.connect(serverTransport);
      
      // Create a mock request
      const mockRequest = new Request("http://localhost/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      
      const response = await serverTransport.handleRequest(mockRequest);
      const data = await response.json();
      
      await server.close();
      
      // Send response back through client transport
      return data;
    },
    onmessage: undefined as ((message: unknown) => void) | undefined,
    onerror: undefined as ((error: Error) => void) | undefined,
    onclose: undefined as (() => void) | undefined,
  };
  
  await client.connect(transport as any);
  
  const result = await client.callTool({
    name: toolName,
    arguments: args,
  });

  await client.close();
  return result;
}
