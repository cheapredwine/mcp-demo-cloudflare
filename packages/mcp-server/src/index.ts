/**
 * MCP Demo Server - Stateless Regular Worker
 * 
 * A stateless MCP server running on regular Cloudflare Workers (no Durable Objects).
 * Uses Code Mode pattern with just 2 tools:
 * - search(): Explore available capabilities
 * - execute(): Execute multiple operations in one call
 * 
 * This can run:
 * - Locally via Wrangler dev (wrangler dev)
 * - Deployed to regular Cloudflare Workers (wrangler deploy)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

/**
 * Tool specification for the demo API
 */
const TOOL_SPECS = {
  echo: {
    name: "echo",
    description: "Echo back the input message - great for testing connectivity",
    parameters: {
      message: { type: "string", description: "Message to echo back", required: true }
    },
    returns: "Object with echoed message"
  },
  calculator: {
    name: "calculator",
    description: "Perform basic arithmetic operations (add, subtract, multiply, divide)",
    parameters: {
      operation: { type: "enum['add', 'subtract', 'multiply', 'divide']", description: "Math operation", required: true },
      a: { type: "number", description: "First number", required: true },
      b: { type: "number", description: "Second number", required: true }
    },
    returns: "Object with operation result details"
  },
  get_weather: {
    name: "get_weather",
    description: "Get current weather for a location (simulated/demo data)",
    parameters: {
      location: { type: "string", description: "City name or location", required: true },
      units: { type: "enum['celsius', 'fahrenheit']", description: "Temperature units", default: "celsius" }
    },
    returns: "Object with weather condition, temperature, humidity, and wind"
  },
  random_fact: {
    name: "random_fact",
    description: "Get a random interesting fact",
    parameters: {
      category: { type: "enum['science', 'history', 'technology', 'nature', 'space']", description: "Fact category", optional: true }
    },
    returns: "Object with category and fact text"
  },
  get_traffic_log: {
    name: "get_traffic_log",
    description: "Get recent request info (stateless - returns current request only)",
    parameters: {
      limit: { type: "number", description: "Number of entries (always returns 1 in stateless mode)", default: 1 }
    },
    returns: "Array with single current request info"
  }
};

/**
 * Fact database for random_fact tool
 */
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

/**
 * Execute the echo tool
 */
async function executeEcho(message: string): Promise<unknown> {
  return {
    content: [
      { type: "text" as const, text: `Echo: ${message}` },
      { type: "text" as const, text: "Note: This is a stateless server" },
    ],
  };
}

/**
 * Execute the calculator tool
 */
async function executeCalculator(
  operation: string,
  a: number,
  b: number
): Promise<unknown> {
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
        content: [{ type: "text" as const, text: `Error: Unknown operation ${operation}` }],
        isError: true,
      };
  }
  
  return {
    content: [
      { type: "text" as const, text: `${a} ${opSymbol} ${b} = ${result}` },
      { type: "text" as const, text: `Operation: ${operation}` },
      { type: "text" as const, text: `Result: ${result}` },
    ],
  };
}

/**
 * Execute the weather tool
 */
async function executeWeather(
  location: string,
  units: string
): Promise<unknown> {
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

/**
 * Execute the random fact tool
 */
async function executeRandomFact(
  category: string | undefined
): Promise<unknown> {
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

/**
 * Execute the traffic log tool (stateless - just returns current request info)
 */
async function executeTrafficLog(): Promise<unknown> {
  return {
    content: [
      { type: "text" as const, text: "Traffic Log (Stateless Mode):" },
      { type: "text" as const, text: "This server runs on regular Workers without Durable Objects." },
      { type: "text" as const, text: "Each request is independent with no persistent state." },
    ],
  };
}

/**
 * Create and configure the MCP server
 */
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
          name: "search",
          description: "Search and explore the available tools and their specifications. Query the tool specs with filters.",
          inputSchema: {
            type: "object",
            properties: {
              filter: { 
                type: "string", 
                description: "Filter to apply (e.g., 'weather', 'fact', 'math')" 
              },
            },
          },
        },
        {
          name: "execute",
          description: "Execute multiple tool operations in a single call. Pass an array of operations to execute sequentially.",
          inputSchema: {
            type: "object",
            properties: {
              operations: {
                type: "array",
                description: "Array of operations to execute. Each operation should have {tool: string, params: object}",
                items: {
                  type: "object",
                },
              },
            },
            required: ["operations"],
          },
        },
      ],
    };
  });

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "mcp://resources/server-info",
          name: "server-info",
          mimeType: "application/json",
          description: "Server metadata and statistics",
        },
        {
          uri: "mcp://resources/tool-specs",
          name: "tool-specs",
          mimeType: "application/json",
          description: "Full tool specifications for Code Mode",
        },
      ],
    };
  });

  // Handle resource reads
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === "mcp://resources/server-info") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({
              name: "MCP Demo Server (Code Mode - Stateless)",
              version: "1.0.0",
              description: "A stateless MCP server using Code Mode with just 2 tools: search() and execute(). Runs on regular Cloudflare Workers.",
              capabilities: ["tools", "resources", "code_mode"],
              tools: ["search", "execute"],
              architecture: "stateless_regular_worker",
              note: "No Durable Objects - each request is independent",
            }, null, 2),
          },
        ],
      };
    }

    if (uri === "mcp://resources/tool-specs") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({
              codeMode: {
                description: "This server uses Code Mode - only 2 tools exposed",
                searchTool: "search(filter) - Search tool specifications",
                executeTool: "execute(operations) - Execute multiple operations",
                benefits: [
                  "60% reduction in context window usage",
                  "Single execute() call can chain multiple operations",
                  "Declarative operations instead of imperative code",
                  "Runs on regular Workers (no Durable Objects needed)",
                ],
              },
              specs: TOOL_SPECS,
              examples: {
                search: {
                  description: "Find weather and fact tools",
                  params: { filter: "weather" },
                },
                execute: {
                  description: "Get weather in multiple cities and a random fact",
                  params: {
                    operations: [
                      { tool: "getWeather", params: { location: "San Francisco", units: "celsius" } },
                      { tool: "getWeather", params: { location: "New York", units: "fahrenheit" } },
                      { tool: "randomFact", params: { category: "space" } },
                    ],
                  },
                },
              },
            }, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "search") {
        const filter = (args?.filter as string)?.toLowerCase() || '';
        const results = [];
        
        for (const [name, spec] of Object.entries(TOOL_SPECS)) {
          const match = !filter || 
            spec.description.toLowerCase().includes(filter) ||
            name.toLowerCase().includes(filter);
            
          if (match) {
            results.push({
              name: spec.name,
              description: spec.description,
              parameters: Object.entries(spec.parameters).map(([paramName, param]) => ({
                name: paramName,
                type: (param as { type: string }).type,
                required: (param as { required?: boolean }).required,
              })),
            });
          }
        }
        
        return {
          content: [
            { type: "text" as const, text: `Search Results (${results.length} tools found):` },
            { type: "text" as const, text: JSON.stringify(results, null, 2) },
          ],
        };
      }

      if (name === "execute") {
        const operations = args?.operations as Array<{ tool: string; params?: Record<string, unknown> }> || [];
        const results: Record<string, unknown> = {};
        
        for (let i = 0; i < operations.length; i++) {
          const op = operations[i];
          const params = op.params || {};
          
          let result: unknown;
          switch (op.tool) {
            case "echo":
              result = await executeEcho(params.message as string);
              break;
            case "calculator":
              result = await executeCalculator(
                params.operation as string,
                params.a as number,
                params.b as number
              );
              break;
            case "getWeather":
              result = await executeWeather(
                params.location as string,
                (params.units as string) || "celsius"
              );
              break;
            case "randomFact":
              result = await executeRandomFact(params.category as string | undefined);
              break;
            case "getTrafficLog":
              result = await executeTrafficLog();
              break;
            default:
              result = {
                content: [{ type: "text" as const, text: `Unknown tool: ${op.tool}` }],
                isError: true,
              };
          }
          
          results[`${op.tool}_${i}`] = result;
        }
        
        return {
          content: [
            { type: "text" as const, text: `Executed ${operations.length} operations:` },
            { type: "text" as const, text: JSON.stringify(results, null, 2) },
          ],
        };
      }

      throw new Error(`Unknown tool: ${name}`);
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

/**
 * Main Worker export - handles HTTP requests
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Only handle POST requests to /mcp
    if (url.pathname !== "/mcp" || request.method !== "POST") {
      return new Response(
        JSON.stringify({ 
          error: "Not Found",
          message: "MCP endpoint is at POST /mcp",
          status: "MCP Demo Server (Stateless) is running"
        }, null, 2),
        { 
          status: 404, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    try {
      // Create server and transport for this request
      const server = createServer();
      
      // Use WebStandard transport for Cloudflare Workers
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });
      
      // Connect server to transport
      await server.connect(transport);
      
      // Handle the request
      const response = await transport.handleRequest(request);
      
      // Clean up
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
  },
};

// Environment interface
interface Env {
  // No bindings needed for stateless server
}
