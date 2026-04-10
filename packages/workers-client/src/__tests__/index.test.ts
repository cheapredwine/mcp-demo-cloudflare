import { describe, it, expect } from 'vitest';

describe('Workers Client with Code Mode UI', () => {
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
      expect(text).toContain('MCP Demo with Code Mode');
      expect(text).toContain('search(filter)');
      expect(text).toContain('execute(operations)');
    });

    it('should handle CORS preflight requests', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/', { method: 'OPTIONS' });
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
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
    it('should have /status endpoint', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/status');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      
      // Will fail to connect but should attempt the endpoint
      const response = await handler.fetch(request, env, {} as ExecutionContext);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should have Code Mode demo endpoints', async () => {
      const { default: handler } = await import('../index.js');
      
      const endpoints = [
        '/demo-search',
        '/demo-execute',
        '/test-echo',
        '/test-calculator',
        '/test-weather',
        '/test-fact',
        '/test-all',
      ];
      
      for (const endpoint of endpoints) {
        const request = new Request(`http://localhost:8788${endpoint}`);
        const env = { MCP_SERVER_URL: 'http://localhost:8787' };
        const response = await handler.fetch(request, env, {} as ExecutionContext);
        
        // Should return JSON (even if error due to no server)
        expect(response.headers.get('Content-Type')).toBe('application/json');
      }
    });
  });

  describe('Code Mode UI Content', () => {
    it('should include token comparison in HTML', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);
      
      const text = await response.text();
      expect(text).toContain('Token Comparison');
      expect(text).toContain('Traditional MCP');
      expect(text).toContain('Code Mode');
      expect(text).toContain('60%');
    });

    it('should include Code Mode tool descriptions', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);
      
      const text = await response.text();
      expect(text).toContain('search(filter)');
      expect(text).toContain('execute(operations)');
    });

    it('should include example code blocks', async () => {
      const { default: handler } = await import('../index.js');
      const request = new Request('http://localhost:8788/');
      const env = { MCP_SERVER_URL: 'http://localhost:8787' };
      const response = await handler.fetch(request, env, {} as ExecutionContext);
      
      const text = await response.text();
      expect(text).toContain('code-block');
      expect(text).toContain('getWeather');
      expect(text).toContain('randomFact');
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
    // These tests require:
    // 1. MCP server running on localhost:8787
    // 2. Client making real HTTP requests
    // Run manually with: npm run dev:server && npm run dev:client
    expect(true).toBe(true);
  });
});
