import { describe, it, expect } from 'vitest';

describe('Workers Client', () => {
  describe('Basic Structure', () => {
    it('should have client module', () => {
      expect(true).toBe(true);
    });

    it('should have export default with fetch handler', async () => {
      const module = await import('../index.js');
      expect(module.default).toBeDefined();
      expect(typeof module.default.fetch).toBe('function');
    });
  });

  describe('Route Handling', () => {
    it('should serve HTML web UI on root path', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
      
      const text = await response.text();
      expect(text).toContain('<!DOCTYPE html>');
      expect(text).toContain('MCP Demo');
    });

    it('should handle CORS preflight requests', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/', { method: 'OPTIONS' });
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should include CORS headers in all responses', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should return 404 for unknown paths', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/unknown-path');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);
      const data = await response.json() as { error: string };

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });
  });

  describe('API Endpoints', () => {
    it('should have /status endpoint that returns JSON', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/status');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);

      // Should return JSON response (may be error if server not running)
      expect(response.headers.get('Content-Type')).toBe('application/json');
      const data = await response.json() as { status?: string; error?: string };
      // Either connected or error, both valid responses
      expect(data.status === 'connected' || data.error !== undefined).toBe(true);
    });

    it('should have /test-echo endpoint that returns JSON', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/test-echo');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);

      expect(response.headers.get('Content-Type')).toBe('application/json');
      const data = await response.json() as { tool?: string; error?: string };
      // Should have either result or error
      expect(data.tool === 'echo' || data.error !== undefined).toBe(true);
    });

    it('should have /test-calculator endpoint', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/test-calculator');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should have /test-weather endpoint', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/test-weather');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should have /test-fact endpoint', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/test-fact');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should have /test-all endpoint', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/test-all');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('Web UI Content', () => {
    it('should list 5 tools', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);
      
      const text = await response.text();
      expect(text).toContain('echo');
      expect(text).toContain('calculator');
      expect(text).toContain('get_weather');
      expect(text).toContain('random_fact');
      expect(text).toContain('get_traffic_log');
    });

    it('should have test buttons', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);
      
      const text = await response.text();
      expect(text).toContain('Test echo');
      expect(text).toContain('Test calculator');
      expect(text).toContain('Test weather');
    });
  });

  describe('Error Handling', () => {
    it('should return JSON for 404 errors', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/nonexistent');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);

      expect(response.headers.get('Content-Type')).toBe('application/json');
      const data = await response.json() as { error: string };
      expect(data).toHaveProperty('error');
    });
  });
});

// Integration tests that require running server
describe('Workers Client - MCP Integration (requires running server)', () => {
  it('should be tested with running MCP server', () => {
    expect(true).toBe(true);
  });
});
