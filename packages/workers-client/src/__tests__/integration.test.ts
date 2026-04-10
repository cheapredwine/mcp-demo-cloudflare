import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8787';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:8788';

// Type for tool results
interface ToolResult {
  content: Array<{ type: string; text: string }>;
}

describe('Workers Client Live Integration', () => {
  let serverAvailable = false;
  let clientAvailable = false;

  beforeAll(async () => {
    try {
      await fetch(`${SERVER_URL}/mcp`, { method: 'POST', signal: AbortSignal.timeout(2000) });
      serverAvailable = true;
    } catch {
      console.log(`\n⚠️  MCP Server not available at ${SERVER_URL}`);
      console.log('   Start it with: npm run dev:server');
    }

    try {
      await fetch(CLIENT_URL, { signal: AbortSignal.timeout(2000) });
      clientAvailable = true;
    } catch {
      console.log(`\n⚠️  Client not available at ${CLIENT_URL}`);
      console.log('   Start it with: npm run dev:client');
    }
  });

  describe('Web UI', () => {
    it('should serve the web UI', async () => {
      expect(clientAvailable, `Client not available at ${CLIENT_URL}`).toBe(true);
      const response = await fetch(`${CLIENT_URL}/`);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/html');
      
      const html = await response.text();
      expect(html).toContain('MCP Demo');
      expect(html).toContain('echo');
      expect(html).toContain('calculator');
    });

    it('should have CORS headers', async () => {
      expect(clientAvailable).toBe(true);
      const response = await fetch(`${CLIENT_URL}/`);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Status Endpoint', () => {
    it('should return server status', async () => {
      expect(clientAvailable).toBe(true);
      const response = await fetch(`${CLIENT_URL}/status`);
      expect(response.status).toBe(200);
      
      const data = await response.json() as { status: string };
      expect(data.status).toBe('connected');
    });
  });

  describe('Test Endpoints', () => {
    it('should test echo tool', async () => {
      expect(clientAvailable).toBe(true);
      const response = await fetch(`${CLIENT_URL}/test-echo`);
      expect(response.status).toBe(200);
      
      const data = await response.json() as { tool: string; result: unknown };
      expect(data.tool).toBe('echo');
      expect(data.result).toBeDefined();
    });

    it('should test calculator tool', async () => {
      expect(clientAvailable).toBe(true);
      const response = await fetch(`${CLIENT_URL}/test-calculator`);
      expect(response.status).toBe(200);
      
      const data = await response.json() as { tool: string; result: unknown };
      expect(data.tool).toBe('calculator');
      expect(data.result).toBeDefined();
    });

    it('should test weather tool', async () => {
      expect(clientAvailable).toBe(true);
      const response = await fetch(`${CLIENT_URL}/test-weather`);
      expect(response.status).toBe(200);
      
      const data = await response.json() as { tool: string; result: unknown };
      expect(data.tool).toBe('get_weather');
      expect(data.result).toBeDefined();
    });

    it('should test random fact tool', async () => {
      expect(clientAvailable).toBe(true);
      const response = await fetch(`${CLIENT_URL}/test-fact`);
      expect(response.status).toBe(200);
      
      const data = await response.json() as { tool: string; result: unknown };
      expect(data.tool).toBe('random_fact');
      expect(data.result).toBeDefined();
    });

    it('should run all tests', async () => {
      expect(clientAvailable).toBe(true);
      const response = await fetch(`${CLIENT_URL}/test-all`);
      expect(response.status).toBe(200);
      
      const data = await response.json() as { tests: Record<string, unknown> };
      expect(data.tests).toBeDefined();
      expect(data.tests.echo).toBeDefined();
      expect(data.tests.calculator).toBeDefined();
      expect(data.tests.weather).toBeDefined();
      expect(data.tests.fact).toBeDefined();
      expect(data.tests.traffic).toBeDefined();
    });
  });
});

describe('End-to-End MCP Flow', () => {
  let client: Client;
  let connected = false;

  beforeAll(async () => {
    try {
      client = new Client({
        name: "e2e-test-client",
        version: "1.0.0",
      });
      const transport = new StreamableHTTPClientTransport(new URL(`${SERVER_URL}/mcp`));
      await client.connect(transport);
      connected = true;
    } catch {
      console.log(`\n⚠️  Could not connect to server at ${SERVER_URL} for E2E tests`);
    }
  });

  it('should execute full tool chain', async () => {
    expect(connected).toBe(true);
    
    // Echo
    const echoResult = await client.callTool({
      name: "echo",
      arguments: { message: "Start test" },
    }) as ToolResult;
    expect(echoResult.content[0].text).toContain('Echo:');

    // Calculate
    const calcResult = await client.callTool({
      name: "calculator",
      arguments: { operation: "add", a: 10, b: 20 },
    }) as ToolResult;
    expect(calcResult.content[0].text).toContain('30');

    // Weather
    const weatherResult = await client.callTool({
      name: "get_weather",
      arguments: { location: "Test City" },
    }) as ToolResult;
    const weatherText = weatherResult.content.map((c: {text: string}) => c.text).join(' ');
    expect(weatherText).toContain('Condition:');

    // Fact
    const factResult = await client.callTool({
      name: "random_fact",
      arguments: { category: "science" },
    }) as ToolResult;
    expect(factResult.content[0].text.length).toBeGreaterThan(0);
  });
});
