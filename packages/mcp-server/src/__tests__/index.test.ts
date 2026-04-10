import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the source file as text
describe('MCP Server Source Code - Stateless Regular Worker', () => {
  let sourceCode: string;

  beforeAll(() => {
    sourceCode = readFileSync(join(__dirname, '../index.ts'), 'utf-8');
  });

  describe('Architecture', () => {
    it('should mention stateless in header', () => {
      expect(sourceCode).toContain('Stateless');
    });

    it('should mention regular Workers', () => {
      expect(sourceCode).toContain('regular Workers');
    });

    it('should NOT import from agents/mcp', () => {
      expect(sourceCode).not.toContain('import { McpAgent } from "agents/mcp"');
    });

    it('should import from @modelcontextprotocol/sdk/server/index.js', () => {
      expect(sourceCode).toContain('import { Server } from "@modelcontextprotocol/sdk/server/index.js"');
    });

    it('should use StreamableHTTPServerTransport', () => {
      expect(sourceCode).toContain('StreamableHTTPServerTransport');
    });

    it('should NOT use McpAgent', () => {
      expect(sourceCode).not.toContain('extends McpAgent');
    });

    it('should NOT use Durable Objects', () => {
      expect(sourceCode).not.toContain('DurableObject');
    });
  });

  describe('Module Structure', () => {
    it('should export default fetch handler', () => {
      expect(sourceCode).toContain('export default {');
      expect(sourceCode).toContain('async fetch(');
    });

    it('should have createServer function', () => {
      expect(sourceCode).toContain('function createServer(): Server');
    });
  });

  describe('Tool Specifications', () => {
    it('should have TOOL_SPECS constant', () => {
      expect(sourceCode).toContain('const TOOL_SPECS');
    });

    it('should have FACTS database', () => {
      expect(sourceCode).toContain('const FACTS');
    });
  });
});

describe('Stateless Tools', () => {
  let sourceCode: string;

  beforeAll(() => {
    sourceCode = readFileSync(join(__dirname, '../index.ts'), 'utf-8');
  });

  describe('Tool Functions', () => {
    it('should have executeEcho as standalone function', () => {
      expect(sourceCode).toContain('async function executeEcho');
      expect(sourceCode).not.toContain('private async executeEcho');
    });

    it('should have executeCalculator as standalone function', () => {
      expect(sourceCode).toContain('async function executeCalculator');
    });

    it('should have executeWeather as standalone function', () => {
      expect(sourceCode).toContain('async function executeWeather');
    });

    it('should have executeRandomFact as standalone function', () => {
      expect(sourceCode).toContain('async function executeRandomFact');
    });

    it('should have executeTrafficLog as standalone function', () => {
      expect(sourceCode).toContain('async function executeTrafficLog');
    });
  });

  describe('Server Configuration', () => {
    it('should create Server with name and version', () => {
      expect(sourceCode).toContain('name: "mcp-demo-server"');
      expect(sourceCode).toContain('version: "1.0.0"');
    });

    it('should register ListToolsRequestSchema handler', () => {
      expect(sourceCode).toContain('ListToolsRequestSchema');
      expect(sourceCode).toContain('server.setRequestHandler(ListToolsRequestSchema');
    });

    it('should register CallToolRequestSchema handler', () => {
      expect(sourceCode).toContain('CallToolRequestSchema');
      expect(sourceCode).toContain('server.setRequestHandler(CallToolRequestSchema');
    });

    it('should register ListResourcesRequestSchema handler', () => {
      expect(sourceCode).toContain('ListResourcesRequestSchema');
    });

    it('should register ReadResourceRequestSchema handler', () => {
      expect(sourceCode).toContain('ReadResourceRequestSchema');
    });
  });

  describe('Code Mode Tools (Stateless)', () => {
    it('should have search tool registered', () => {
      expect(sourceCode).toContain('name: "search"');
    });

    it('should have execute tool registered', () => {
      expect(sourceCode).toContain('name: "execute"');
    });

    it('should filter TOOL_SPECS in search', () => {
      expect(sourceCode).toContain('for (const [name, spec] of Object.entries(TOOL_SPECS))');
    });

    it('should iterate over operations in execute', () => {
      expect(sourceCode).toContain('for (let i = 0; i < operations.length; i++)');
    });

    it('should switch on tool name', () => {
      expect(sourceCode).toContain('switch (op.tool)');
    });
  });
});

describe('Resources', () => {
  let sourceCode: string;

  beforeAll(() => {
    sourceCode = readFileSync(join(__dirname, '../index.ts'), 'utf-8');
  });

  describe('Server Info Resource', () => {
    it('should have server-info resource', () => {
      expect(sourceCode).toContain('"mcp://resources/server-info"');
    });

    it('should mention stateless in server info', () => {
      expect(sourceCode).toContain('Stateless');
      expect(sourceCode).toContain('regular Cloudflare Workers');
    });

    it('should list Code Mode tools', () => {
      expect(sourceCode).toContain('tools: ["search", "execute"]');
    });
  });

  describe('Tool Specs Resource', () => {
    it('should have tool-specs resource', () => {
      expect(sourceCode).toContain('"mcp://resources/tool-specs"');
    });

    it('should include examples', () => {
      expect(sourceCode).toContain('examples:');
    });
  });
});

describe('Request Handling', () => {
  let sourceCode: string;

  beforeAll(() => {
    sourceCode = readFileSync(join(__dirname, '../index.ts'), 'utf-8');
  });

  describe('HTTP Endpoint', () => {
    it('should handle POST /mcp', () => {
      expect(sourceCode).toContain('url.pathname !== "/mcp" || request.method !== "POST"');
    });

    it('should return 404 for other paths', () => {
      expect(sourceCode).toContain('status: 404');
    });

    it('should create server per request', () => {
      expect(sourceCode).toContain('const server = createServer()');
    });

    it('should create transport per request', () => {
      expect(sourceCode).toContain('const transport = new WebStandardStreamableHTTPServerTransport');
    });

    it('should clean up with ctx.waitUntil', () => {
      expect(sourceCode).toContain('ctx.waitUntil(server.close())');
    });
  });
});

describe('Code Quality', () => {
  let sourceCode: string;

  beforeAll(() => {
    sourceCode = readFileSync(join(__dirname, '../index.ts'), 'utf-8');
  });

  it('should have proper TypeScript types', () => {
    expect(sourceCode).toContain('interface Env');
  });

  it('should handle errors in search', () => {
    expect(sourceCode).toContain('try {');
    expect(sourceCode).toContain('catch (error)');
  });

  it('should handle errors in tool calls', () => {
    expect(sourceCode).toMatch(/catch \(error\)/);
  });

  it('should include JSDoc comments', () => {
    expect(sourceCode).toContain('/**');
  });

  it('should NOT have state management', () => {
    expect(sourceCode).not.toContain('setState(');
    expect(sourceCode).not.toContain('initialState');
  });
});

describe('Wrangler Configuration', () => {
  let wranglerConfig: string;

  beforeAll(() => {
    wranglerConfig = readFileSync(join(__dirname, '../../wrangler.toml'), 'utf-8');
  });

  it('should NOT have durable_objects.bindings', () => {
    expect(wranglerConfig).not.toContain('durable_objects');
  });

  it('should NOT have migrations', () => {
    expect(wranglerConfig).not.toContain('migrations');
  });

  it('should mention stateless', () => {
    expect(wranglerConfig).toContain('STATELESS');
  });
});

describe('Package Dependencies', () => {
  let packageJson: string;

  beforeAll(() => {
    packageJson = readFileSync(join(__dirname, '../../package.json'), 'utf-8');
  });

  it('should NOT depend on agents', () => {
    expect(packageJson).not.toContain('"agents"');
  });

  it('should depend on @modelcontextprotocol/sdk', () => {
    expect(packageJson).toContain('@modelcontextprotocol/sdk');
  });
});
