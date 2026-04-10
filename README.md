# MCP Demo on Cloudflare Workers

A working MCP (Model Context Protocol) server and client running on Cloudflare Workers. This demonstrates how to build and deploy MCP infrastructure on Cloudflare's edge platform using **Service Bindings** for worker-to-worker communication.

## 🚀 Live Demo

- **MCP Client:** https://mcp-demo-client.jsherron-test-account.workers.dev/
- **AI Gateway:** https://mcp-demo-ai-gateway.jsherron-test-account.workers.dev/ 🆕
- **MCP Server:** https://mcp-demo-server.jsherron-test-account.workers.dev/mcp

Open the Web UI and click any test button to see the MCP protocol in action!

## What This Is

- **MCP Server**: Stateless server handling MCP protocol requests via Streamable HTTP transport
- **MCP Client**: Web UI that connects to the server using Cloudflare Service Bindings
- **AI Gateway** 🆕: Worker AI with Firewall for AI protection, intelligently calling MCP tools
- **All run on Cloudflare Workers**: Serverless, globally distributed, pay-per-request
- **Key Innovation**: Uses Service Bindings instead of HTTP for worker-to-worker communication (avoids Cloudflare's 1042 error)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  AI Gateway (NEW)                                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Firewall for AI                                       │  │
│  │ • Block prompt injection attacks                      │  │
│  │ • Rate limiting                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Worker AI + Tools                                     │  │
│  │ • Natural language understanding                      │  │
│  │ • Intelligent tool selection                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ Service Binding
┌──────────────────────────┴──────────────────────────────────┐
│  MCP Client                                                 │
│  • Web UI + API proxy                                       │
│  • Service Binding to MCP Server                            │
└──────────────────────────┬──────────────────────────────────┘
                           │ Service Binding
┌──────────────────────────┴──────────────────────────────────┐
│  MCP Server                                                 │
│  • Handles MCP protocol                                     │
│  • Exposes 5 demo tools:                                    │
│    - echo, calculator, weather                              │
│    - random_fact, traffic_log                               │
└─────────────────────────────────────────────────────────────┘
```

### Why Service Bindings?

Cloudflare Workers cannot make HTTP requests to other `*.workers.dev` domains (error 1042). Service Bindings provide direct internal communication between workers, which:
- ✅ Avoids the 1042 error
- ✅ Lower latency (no HTTP overhead)
- ✅ More secure (internal network)
- ✅ Still uses real MCP protocol

## Quick Start

### Prerequisites

- Node.js 20+
- Cloudflare account (for deployment)
- Wrangler CLI: `npm install -g wrangler`

### Installation

```bash
# Install dependencies
npm install
```

### Local Development

**Terminal 1 - Start MCP Server:**
```bash
cd packages/mcp-server
npm run dev
# Server runs on http://localhost:8787
```

**Terminal 2 - Start Client:**
```bash
cd packages/workers-client
npm run dev
# Client runs on http://localhost:8788
```

**Terminal 3 - Start AI Gateway (optional):**
```bash
cd packages/ai-gateway
npm run dev
# AI Gateway runs on http://localhost:8789
```

**Open browser:** 
- MCP Client: `http://localhost:8788`
- AI Gateway: `http://localhost:8789`

## Available Tools

The MCP server exposes these tools:

| Tool | Description |
|------|-------------|
| `echo` | Echo back a message |
| `calculator` | Basic math (add, subtract, multiply, divide) |
| `get_weather` | Simulated weather data |
| `random_fact` | Random facts by category |
| `get_traffic_log` | Request logging info |

## API Endpoints

### Server (http://localhost:8787)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP protocol endpoint |

### Client (http://localhost:8788)

| Endpoint | Description |
|----------|-------------|
| `/` | Web UI demo page |
| `/status` | Server connection check |
| `/test-echo` | Test echo tool |
| `/test-calculator` | Test calculator tool |
| `/test-weather` | Test weather tool |
| `/test-fact` | Test random fact tool |
| `/test-all` | Run all tool tests |

### AI Gateway (http://localhost:8789)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | AI Gateway Web UI |
| `/api/ask` | POST | Ask the AI (with Firewall for AI protection) |
| `/health` | GET | Health check |

**AI Gateway Features:**
- 🛡️ **Firewall for AI**: Detects and blocks prompt injection attacks
- 🤖 **Worker AI**: Natural language processing with tool calling
- 🔧 **MCP Tool Integration**: AI intelligently decides which tools to call
- 🎮 **Attack Mode**: Toggle to test prompt injection detection

## Example Tool Call

**Request:**
```json
{
  "tool": "get_weather",
  "arguments": {
    "location": "San Francisco",
    "units": "celsius"
  }
}
```

**Response:**
```json
{
  "content": [
    { "type": "text", "text": "Weather for San Francisco:" },
    { "type": "text", "text": "Condition: Sunny" },
    { "type": "text", "text": "Temperature: 22°C" }
  ]
}
```

## Deployment

### Automated (GitHub Actions) - Recommended

1. Fork this repository
2. Add secrets to GitHub:
   - `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
   - `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
3. Push to main branch - GitHub Actions deploys automatically

**To get your Account ID:**
- Go to https://dash.cloudflare.com
- Look at the right sidebar, or check the URL: `https://dash.cloudflare.com/<ACCOUNT_ID>/home`

### Manual Deploy

**Deploy MCP Server:**
```bash
cd packages/mcp-server
wrangler deploy
```

**Deploy Client:**
```bash
cd packages/workers-client
wrangler deploy
```

**Deploy AI Gateway:**
```bash
cd packages/ai-gateway
wrangler deploy
```

**Configure Service Bindings (one-time):**

For Client:
```bash
cd packages/workers-client
wrangler service bind MCP_SERVER --service=mcp-demo-server
```

For AI Gateway:
```bash
cd packages/ai-gateway
wrangler service bind MCP_SERVER --service=mcp-demo-server
```

Or via Cloudflare Dashboard:
1. Go to Workers & Pages → Select worker (mcp-demo-client or mcp-demo-ai-gateway)
2. Settings → Service bindings
3. Add: `MCP_SERVER` → `mcp-demo-server`

## Troubleshooting

### Error 1042 (Worker-to-Worker HTTP Blocked)

**Problem:** Workers can't make HTTP requests to other `*.workers.dev` domains.

**Solution:** Use Service Bindings (already configured in this project).

### Client shows 500 errors

**Check:**
1. Is the server deployed? `curl https://your-server.workers.dev/mcp`
2. Is the service binding configured? Check Cloudflare Dashboard
3. Check server logs: `wrangler tail --name mcp-demo-server`

### GitHub Actions deployment fails

**Check secrets:**
- `CLOUDFLARE_API_TOKEN` must have "Edit Cloudflare Workers" permission
- `CLOUDFLARE_ACCOUNT_ID` must be your actual account ID (not token ID)

## Monitoring Logs

Watch live logs with wrangler:

```bash
# Watch server logs
wrangler tail --name mcp-demo-server

# Watch client logs  
wrangler tail --name mcp-demo-client
```

Or view in Cloudflare Dashboard:
- Workers & Pages → Select worker → Logs

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests (requires running server)
npm run test:integration

# Type check
npm run typecheck
```

## Project Structure

```
packages/
├── mcp-server/          # MCP protocol server
│   ├── src/index.ts     # Server implementation
│   ├── src/__tests__/   # Tests (40 tests)
│   ├── wrangler.toml    # Worker config
│   └── package.json
│
├── workers-client/      # Web UI + API client
│   ├── src/index.ts     # Client with Service Binding
│   ├── src/__tests__/   # Tests (16 tests)
│   ├── wrangler.toml    # Worker config (with service binding)
│   └── package.json
│
└── ai-gateway/          # 🆕 AI Gateway with Firewall for AI
    ├── src/index.ts     # Worker AI + Firewall + MCP integration
    ├── src/__tests__/   # Tests (20 tests)
    ├── wrangler.toml    # Worker config (AI binding + service binding)
    └── package.json
```

## Key Technologies

- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **WebStandardStreamableHTTPServerTransport**: HTTP transport for Workers
- **Cloudflare Workers**: Serverless edge platform
- **Cloudflare Service Bindings**: Internal worker-to-worker communication
- **Cloudflare Worker AI**: AI inference at the edge
- **Cloudflare Firewall for AI**: Prompt injection detection and protection
- **Wrangler**: CLI for Workers deployment
- **Vitest**: Testing framework

## How It Works

### MCP Client Flow
1. **Client receives HTTP request** from browser
2. **Client uses Service Binding** to call server (`env.MCP_SERVER.fetch()`)
3. **Server processes MCP protocol** and returns result
4. **Client returns result** to browser as JSON

### AI Gateway Flow
1. **AI Gateway receives prompt** from browser
2. **Firewall for AI** checks for prompt injection attacks
3. **Worker AI** processes the prompt with tool definitions
4. **AI decides which tools to call** (if any)
5. **Service Binding** calls MCP server for each tool
6. **Results returned to AI** for natural language response
7. **Formatted response** returned to browser

The MCP protocol flow:
1. Initialize connection
2. Get session ID
3. Call tool with session ID
4. Return tool result

## Resources

- **MCP Protocol**: https://modelcontextprotocol.io/
- **Cloudflare Workers**: https://workers.cloudflare.com/
- **Service Bindings**: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
- **Cloudflare Worker AI**: https://developers.cloudflare.com/workers-ai/
- **Cloudflare Firewall for AI**: https://developers.cloudflare.com/firewall-for-ai/
- **MCP SDK**: https://github.com/modelcontextprotocol/typescript-sdk

## License

MIT
