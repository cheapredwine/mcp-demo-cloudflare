import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the source file as text
describe('MCP Server Source Code', () => {
  let sourceCode: string;

  beforeAll(() => {
    sourceCode = readFileSync(join(__dirname, '../index.ts'), 'utf-8');
  });

  describe('Architecture', () => {
    it('should mention stateless in header', () => {
      expect(sourceCode).toContain('Stateless');
    });

    it('should NOT import from agents/mcp', () => {
      expect(sourceCode).not.toContain('import { McpAgent } from "agents/mcp"');
    });

    it('should import from @modelcontextprotocol/sdk/server/index.js', () => {
      expect(sourceCode).toContain('import { Server } from "@modelcontextprotocol/sdk/server/index.js"');
    });

    it('should use WebStandardStreamableHTTPServerTransport', () => {
      expect(sourceCode).toContain('WebStandardStreamableHTTPServerTransport');
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

  describe('Fact Database', () => {
    it('should have FACTS constant', () => {
      expect(sourceCode).toContain('const FACTS');
    });

    it('should have all 5 categories', () => {
      expect(sourceCode).toContain('science:');
      expect(sourceCode).toContain('history:');
      expect(sourceCode).toContain('technology:');
      expect(sourceCode).toContain('nature:');
      expect(sourceCode).toContain('space:');
    });
  });
});

describe('MCP Tools', () => {
  let sourceCode: string;

  beforeAll(() => {
    sourceCode = readFileSync(join(__dirname, '../index.ts'), 'utf-8');
  });

  describe('Tool Registration', () => {
    it('should register 5 tools', () => {
      const toolMatches = sourceCode.match(/name: "(echo|calculator|get_weather|random_fact|get_traffic_log)"/g);
      expect(toolMatches).toHaveLength(5);
    });

    it('should have echo tool', () => {
      expect(sourceCode).toContain('name: "echo"');
    });

    it('should have calculator tool', () => {
      expect(sourceCode).toContain('name: "calculator"');
    });

    it('should have get_weather tool', () => {
      expect(sourceCode).toContain('name: "get_weather"');
    });

    it('should have random_fact tool', () => {
      expect(sourceCode).toContain('name: "random_fact"');
    });

    it('should have get_traffic_log tool', () => {
      expect(sourceCode).toContain('name: "get_traffic_log"');
    });
  });

  describe('Echo Tool', () => {
    it('should handle echo in switch', () => {
      expect(sourceCode).toContain('case "echo":');
    });

    it('should echo the message', () => {
      expect(sourceCode).toContain('`Echo: ${message}`');
    });
  });

  describe('Calculator Tool', () => {
    it('should handle calculator in switch', () => {
      expect(sourceCode).toContain('case "calculator":');
    });

    it('should handle all operations', () => {
      expect(sourceCode).toContain('case "add":');
      expect(sourceCode).toContain('case "subtract":');
      expect(sourceCode).toContain('case "multiply":');
      expect(sourceCode).toContain('case "divide":');
    });

    it('should handle division by zero', () => {
      expect(sourceCode).toContain('if (b === 0)');
      expect(sourceCode).toContain('Error: Division by zero');
    });
  });

  describe('Weather Tool', () => {
    it('should handle get_weather in switch', () => {
      expect(sourceCode).toContain('case "get_weather":');
    });

    it('should support celsius and fahrenheit', () => {
      expect(sourceCode).toContain('celsius');
      expect(sourceCode).toContain('fahrenheit');
    });

    it('should return weather fields', () => {
      expect(sourceCode).toContain('Condition:');
      expect(sourceCode).toContain('Temperature:');
      expect(sourceCode).toContain('Humidity:');
      expect(sourceCode).toContain('Wind:');
    });
  });

  describe('Random Fact Tool', () => {
    it('should handle random_fact in switch', () => {
      expect(sourceCode).toContain('case "random_fact":');
    });

    it('should select from FACTS', () => {
      expect(sourceCode).toContain('FACTS[selectedCategory]');
    });
  });

  describe('Traffic Log Tool', () => {
    it('should handle get_traffic_log in switch', () => {
      expect(sourceCode).toContain('case "get_traffic_log":');
    });
  });
});

describe('MCP Resources', () => {
  let sourceCode: string;

  beforeAll(() => {
    sourceCode = readFileSync(join(__dirname, '../index.ts'), 'utf-8');
  });

  describe('Resource Registration', () => {
    it('should register server-info resource', () => {
      expect(sourceCode).toContain('"mcp://resources/server-info"');
    });

    it('should list tools in server info', () => {
      expect(sourceCode).toContain('tools:');
      expect(sourceCode).toContain('"echo"');
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

  it('should handle errors', () => {
    expect(sourceCode).toContain('try {');
    expect(sourceCode).toContain('catch (error)');
  });

  it('should include JSDoc comments', () => {
    expect(sourceCode).toContain('/**');
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
