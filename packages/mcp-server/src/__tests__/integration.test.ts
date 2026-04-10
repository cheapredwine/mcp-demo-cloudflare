import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8787';

describe('MCP Server Live Integration', () => {
  let client: Client;
  let transport: StreamableHTTPClientTransport;
  let connected = false;

  beforeAll(async () => {
    try {
      client = new Client({
        name: "test-client",
        version: "1.0.0",
      });
      transport = new StreamableHTTPClientTransport(new URL(`${SERVER_URL}/mcp`));
      await client.connect(transport);
      connected = true;
    } catch (err) {
      console.log(`\n⚠️  Could not connect to server at ${SERVER_URL}`);
      console.log('   Start server with: npm run dev:server');
      console.log('   Then run: npm run test:integration\n');
      // Don't throw - tests will check connected flag
    }
  });

  describe('Connection', () => {
    it('should connect to the server', async () => {
      expect(connected, `Server not available at ${SERVER_URL}. Run: npm run dev:server`).toBe(true);
      expect(client).toBeDefined();
    });

    it('should read server info resource', async () => {
      expect(connected).toBe(true);
      const result = await client.readResource({
        uri: "mcp://resources/server-info",
      });
      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
    });
  });

  describe('Echo Tool', () => {
    it('should echo a message', async () => {
      expect(connected).toBe(true);
      const result = await client.callTool({
        name: "echo",
        arguments: { message: "Hello MCP!" },
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Echo: Hello MCP!');
    });
  });

  describe('Calculator Tool', () => {
    it('should add numbers', async () => {
      expect(connected).toBe(true);
      const result = await client.callTool({
        name: "calculator",
        arguments: { operation: "add", a: 5, b: 3 },
      });
      
      expect(result.content[0].text).toContain('8');
    });

    it('should multiply numbers', async () => {
      expect(connected).toBe(true);
      const result = await client.callTool({
        name: "calculator",
        arguments: { operation: "multiply", a: 6, b: 7 },
      });
      
      expect(result.content[0].text).toContain('42');
    });

    it('should handle division by zero', async () => {
      expect(connected).toBe(true);
      const result = await client.callTool({
        name: "calculator",
        arguments: { operation: "divide", a: 10, b: 0 },
      });
      
      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('Weather Tool', () => {
    it('should get weather for a location', async () => {
      expect(connected).toBe(true);
      const result = await client.callTool({
        name: "get_weather",
        arguments: { location: "San Francisco", units: "celsius" },
      });
      
      expect(result).toBeDefined();
      const allText = result.content.map((c: {text: string}) => c.text).join(' ');
      expect(allText).toContain('Condition:');
    });

    it('should get weather in fahrenheit', async () => {
      expect(connected).toBe(true);
      const result = await client.callTool({
        name: "get_weather",
        arguments: { location: "New York", units: "fahrenheit" },
      });
      
      const allText = result.content.map((c: {text: string}) => c.text).join(' ');
      expect(allText).toContain('°F');
    });
  });

  describe('Random Fact Tool', () => {
    it('should return a fact from a specific category', async () => {
      expect(connected).toBe(true);
      const result = await client.callTool({
        name: "random_fact",
        arguments: { category: "technology" },
      });
      
      expect(result).toBeDefined();
      expect(result.content[0].text.length).toBeGreaterThan(0);
    });

    it('should return a fact from random category when not specified', async () => {
      expect(connected).toBe(true);
      const result = await client.callTool({
        name: "random_fact",
        arguments: {},
      });
      
      expect(result).toBeDefined();
      expect(result.content[0].text.length).toBeGreaterThan(0);
    });
  });

  describe('Traffic Log Tool', () => {
    it('should return traffic log', async () => {
      expect(connected).toBe(true);
      // First make some calls to generate traffic
      await client.callTool({ name: "echo", arguments: { message: "test" } });
      
      const result = await client.callTool({
        name: "get_traffic_log",
        arguments: { limit: 5 },
      });
      
      expect(result).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });
  });
});
