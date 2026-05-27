import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration tests for AI Orchestrator
 * These tests require both the MCP server and AI Orchestrator to be running
 *
 * To run these tests:
 * 1. Start MCP server: cd packages/mcp-server && npm run dev
 * 2. Start AI Orchestrator: cd packages/ai-orchestrator && npm run dev
 * 3. Run tests: npm run test:integration
 */

const AI_ORCHESTRATOR_URL = process.env.AI_ORCHESTRATOR_URL || 'http://localhost:8789';
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8787';

describe('AI Orchestrator Integration', () => {
  let mcpServerHealthy = false;

  beforeAll(async () => {
    // Check if MCP server is running
    try {
      const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0.0' },
          },
        }),
      });
      mcpServerHealthy = response.status === 200 || response.status === 400;
      console.log(`MCP Server status: ${mcpServerHealthy ? 'healthy' : 'unhealthy'}`);
    } catch (error) {
      console.log('MCP Server not running, skipping integration tests');
    }
  });

  it('should return health check', async () => {
    const response = await fetch(`${AI_ORCHESTRATOR_URL}/health`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('ai-orchestrator');
  });

  it('should return HTML for root path', async () => {
    const response = await fetch(`${AI_ORCHESTRATOR_URL}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('AI Orchestrator + MCP');
  });

  it('should handle CORS preflight', async () => {
    const response = await fetch(`${AI_ORCHESTRATOR_URL}/api/ask`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('should process a calculator request via MCP', async () => {
    const response = await fetch(`${AI_ORCHESTRATOR_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Calculate 25 * 47',
        action: 'calculate',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ai).toBeDefined();
    expect(data.ai.response).toContain('1175');
    expect(data.toolCalls).toBeDefined();
    expect(data.toolCalls.length).toBeGreaterThan(0);
    expect(data.toolCalls[0].tool).toBe('calculator');
    expect(data.callLogs).toBeDefined();
  }, 30000);

  it('should process a weather request via MCP', async () => {
    const response = await fetch(`${AI_ORCHESTRATOR_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'What is the weather in Paris?',
        action: 'weather',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ai).toBeDefined();
    expect(data.toolCalls).toBeDefined();
    expect(data.toolCalls.length).toBeGreaterThan(0);
    expect(data.toolCalls[0].tool).toBe('get_weather');
  }, 30000);

  it('should process a chat request without tools', async () => {
    const response = await fetch(`${AI_ORCHESTRATOR_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Say hello',
        action: 'chat',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ai).toBeDefined();
    expect(data.ai.response).toBeDefined();
  }, 30000);
});
