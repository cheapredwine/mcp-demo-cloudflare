#!/usr/bin/env node
/**
 * MCP Portal Traffic Generator
 * 
 * A simple CLI tool that connects to the Cloudflare MCP Portal
 * and calls tools to generate traffic for testing/demo purposes.
 * 
 * Usage:
 *   CF_ACCESS_CLIENT_ID=xxx CF_ACCESS_CLIENT_SECRET=yyy node mcp-portal-client.js
 *   node mcp-portal-client.js --help
 */

const MCP_PORTAL_URL = process.env.MCP_PORTAL_URL || 'https://mcp-portal.jsherron.com/mcp';
const MCP_SERVER_ID = process.env.MCP_SERVER_ID || 'mcp-demo';
const CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID;
const CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET;

let sessionId = null;

function getHeaders(includeSession = true) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };
  if (CLIENT_ID && CLIENT_SECRET) {
    headers['CF-Access-Client-Id'] = CLIENT_ID;
    headers['CF-Access-Client-Secret'] = CLIENT_SECRET;
  }
  if (includeSession && sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
  }
  return headers;
}

async function mcpRequest(method, params = {}, isInitialize = false) {
  const response = await fetch(MCP_PORTAL_URL, {
    method: 'POST',
    headers: getHeaders(!isInitialize),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Math.floor(Math.random() * 1000000),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Capture session ID from initialize response
  if (isInitialize) {
    const newSessionId = response.headers.get('Mcp-Session-Id');
    if (newSessionId) {
      sessionId = newSessionId;
    }
  }

  const contentType = response.headers.get('Content-Type') || '';
  
  // Handle SSE streaming responses
  if (contentType.includes('text/event-stream')) {
    const text = await response.text();
    
    // DEBUG: Show raw response for troubleshooting
    if (process.env.MCP_DEBUG) {
      console.log('📡 Raw SSE response:', JSON.stringify(text).slice(0, 500));
    }
    
    // Parse SSE format: multiple "event: ...\ndata: ...\n\n" blocks
    const events = [];
    const blocks = text.split('\n\n');
    
    for (const block of blocks) {
      const lines = block.split('\n');
      let eventName = 'message';
      let dataLines = [];
      
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventName = line.slice(7);
        } else if (line.startsWith('data: ')) {
          dataLines.push(line.slice(6));
        }
      }
      
      if (dataLines.length > 0) {
        const data = dataLines.join('\n');
        try {
          events.push({ event: eventName, data: JSON.parse(data) });
        } catch {
          events.push({ event: eventName, data });
        }
      }
    }
    
    // Find the event with actual JSON-RPC content
    const jsonRpcEvent = events.find(e => e.data && (e.data.jsonrpc || e.data.result || e.data.error));
    if (jsonRpcEvent) {
      return jsonRpcEvent.data;
    }
    
    // Fallback: return first event if no JSON-RPC found
    if (events.length > 0) {
      return events[0].data;
    }
    
    throw new Error('No data in SSE response');
  }

  return response.json();
}

async function initialize() {
  console.log('🔌 Initializing MCP session...');
  const result = await mcpRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mcp-portal-cli', version: '1.0.0' },
  }, true);
  console.log('✅ Connected:', result.result?.serverInfo?.name || 'unknown');
  if (sessionId) {
    console.log('📌 Session ID:', sessionId);
  }
  return result;
}

async function listTools() {
  console.log('📋 Listing tools...');
  const result = await mcpRequest('tools/list');
  const tools = result.result?.tools || [];
  console.log(`Found ${tools.length} tool(s):`);
  tools.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.name} - ${t.description || 'No description'}`);
  });
  return tools;
}

async function callTool(name, args) {
  // Portal requires serverId_toolName format
  const fullToolName = `${MCP_SERVER_ID}_${name}`;
  console.log(`🔧 Calling tool: ${fullToolName}(${JSON.stringify(args)})`);
  const result = await mcpRequest('tools/call', { name: fullToolName, arguments: args });
  
  // Handle errors
  if (result.error) {
    console.log(`   ❌ Error ${result.error.code}: ${result.error.message}`);
    return result;
  }
  
  // Handle successful results
  const content = result.result?.content || [];
  if (content.length === 0) {
    console.log(`   ⚠️ No content returned`);
  }
  content.forEach(item => {
    if (item.type === 'text') {
      console.log(`   → ${item.text}`);
    } else {
      console.log(`   → ${JSON.stringify(item)}`);
    }
  });
  return result;
}

async function runTrafficBatch(count = 5) {
  console.log(`\n🚀 Running ${count} random tool calls...\n`);
  
  const tools = [
    { name: 'calculator', args: () => ({
      operation: ['add', 'subtract', 'multiply', 'divide'][Math.floor(Math.random() * 4)],
      a: Math.floor(Math.random() * 100),
      b: Math.floor(Math.random() * 100) + 1,
    })},
    { name: 'get_weather', args: () => ({
      location: ['London', 'Tokyo', 'New York', 'Paris', 'Sydney'][Math.floor(Math.random() * 5)],
    })},
    { name: 'echo', args: () => ({
      message: `Hello from CLI at ${new Date().toISOString()}`,
    })},
    { name: 'random_fact', args: () => ({
      category: ['science', 'history', 'technology', 'nature', 'space'][Math.floor(Math.random() * 5)],
    })},
  ];

  for (let i = 0; i < count; i++) {
    const tool = tools[Math.floor(Math.random() * tools.length)];
    try {
      await callTool(tool.name, tool.args());
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
    if (i < count - 1) {
      await new Promise(r => setTimeout(r, 500)); // small delay between calls
    }
  }
}

async function interactiveMode() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  console.log('\n🎮 Interactive Mode');
  console.log('Commands: calc, weather, echo, fact, batch, list, quit\n');

  while (true) {
    const cmd = await ask('> ');
    const [action, ...rest] = cmd.trim().split(' ');

    try {
      switch (action.toLowerCase()) {
        case 'calc':
        case 'calculator': {
          const [op, a, b] = rest;
          await callTool('calculator', { operation: op || 'add', a: Number(a) || 5, b: Number(b) || 3 });
          break;
        }
        case 'weather': {
          await callTool('get_weather', { location: rest.join(' ') || 'London' });
          break;
        }
        case 'echo': {
          await callTool('echo', { message: rest.join(' ') || 'Hello!' });
          break;
        }
        case 'fact': {
          await callTool('random_fact', { category: rest[0] || 'science' });
          break;
        }
        case 'batch': {
          const count = Number(rest[0]) || 5;
          await runTrafficBatch(count);
          break;
        }
        case 'list':
          await listTools();
          break;
        case 'quit':
        case 'exit':
          rl.close();
          return;
        default:
          console.log('Unknown command. Try: calc, weather, echo, fact, batch, list, quit');
      }
    } catch (err) {
      console.error(`❌ Error: ${err.message}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
MCP Portal Traffic Generator

Environment Variables:
  MCP_PORTAL_URL            Portal MCP endpoint (default: https://jsherron.com/mcp)
  CF_ACCESS_CLIENT_ID       Cloudflare Access Service Token ID
  CF_ACCESS_CLIENT_SECRET   Cloudflare Access Service Token Secret

Usage:
  node mcp-portal-client.js              # Interactive mode
  node mcp-portal-client.js --batch 10   # Run 10 random tool calls
  node mcp-portal-client.js --list       # List available tools

Examples:
  CF_ACCESS_CLIENT_ID=xxx CF_ACCESS_CLIENT_SECRET=yyy node mcp-portal-client.js
`);
    return;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn('⚠️  Warning: CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET not set.');
    console.warn('   If your Portal requires authentication, requests will fail.\n');
  }

  await initialize();

  if (args.includes('--list')) {
    await listTools();
  } else if (args.includes('--batch')) {
    const idx = args.indexOf('--batch');
    const count = Number(args[idx + 1]) || 5;
    await runTrafficBatch(count);
  } else {
    await interactiveMode();
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
