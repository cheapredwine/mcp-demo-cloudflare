/**
 * MCP Demo Server - Stateless Regular Worker
 * 
 * A stateless MCP server running on regular Cloudflare Workers.
 * Exposes 5 demo tools: echo, calculator, get_weather, random_fact, get_traffic_log
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

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
                description: "Temperature units",
                default: "celsius"
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
                description: "Fact category"
              },
            },
          },
        },
        {
          name: "get_traffic_log",
          description: "Get request info (stateless demo)",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Number of entries", default: 1 },
            },
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
              name: "MCP Demo Server",
              version: "1.0.0",
              description: "Stateless MCP server on Cloudflare Workers",
              tools: ["echo", "calculator", "get_weather", "random_fact", "get_traffic_log"],
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
          status: "MCP Demo Server is running"
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
