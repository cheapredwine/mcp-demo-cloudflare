import { describe, it } from 'vitest';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8787';

describe('Debug MCP Client', () => {
  it('should connect and call echo tool', async () => {
    console.log('\n=== Connecting to', SERVER_URL, '===');
    
    const client = new Client({
      name: "debug-client",
      version: "1.0.0",
    });

    const transport = new StreamableHTTPClientTransport(new URL(`${SERVER_URL}/mcp`));
    
    try {
      console.log('Connecting...');
      await client.connect(transport);
      console.log('Connected!');
      
      console.log('Calling echo tool...');
      const result = await client.callTool({
        name: "echo",
        arguments: { message: "Hello debug test!" },
      });
      console.log('Result:', JSON.stringify(result, null, 2));
      
      await client.close();
    } catch (error) {
      console.error('Error:', error);
      await client.close().catch(() => {});
      throw error;
    }
  });
});
