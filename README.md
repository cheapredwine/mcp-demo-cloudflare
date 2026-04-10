# MCP Demo on Cloudflare Workers

A working MCP (Model Context Protocol) server and client running on Cloudflare Workers. This demonstrates how to build and deploy MCP infrastructure on Cloudflare's edge platform.

## What This Is

- **MCP Server**: Stateless server handling MCP protocol requests via Streamable HTTP transport
- **MCP Client**: Web UI that connects to and demonstrates the server
- **Both run on Cloudflare Workers**: Serverless, globally distributed, pay-per-request

## Architecture

```
┌─────────────────────┐
│   MCP Client        │  Web UI + API proxy
│   (Cloudflare       │  Serves HTML demo page
│    Worker)          │  Makes MCP requests to server
└──────────┬──────────┘
           │ HTTP (MCP protocol)
           ▼
┌─────────────────────┐
│   MCP Server        │  Handles MCP protocol
│   (Cloudflare       │  Exposes 5 demo tools:
│    Worker)          │  - echo, calculator, weather
│                     │  - random_fact, traffic_log
└─────────────────────┘
```

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

**Open browser:** `http://localhost:8788`

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
| `/mcp` | GET | SSE stream endpoint |

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

### Manual Deploy

**Deploy MCP Server:**
```bash
cd packages/mcp-server
wrangler deploy
```

**Update Client with Server URL:**
Edit `packages/workers-client/wrangler.toml`:
```toml
[vars]
MCP_SERVER_URL = "https://mcp-demo-server.YOUR_ACCOUNT.workers.dev"
```

**Deploy Client:**
```bash
cd packages/workers-client
wrangler deploy
```

### Automated (GitHub Actions)

1. Add `CLOUDFLARE_API_TOKEN` to GitHub repository secrets
2. Push to main branch - GitHub Actions deploys automatically

## Monitoring Logs

Watch live logs with wrangler:

```bash
# Watch server logs
wrangler tail --name mcp-demo-server

# Watch client logs
wrangler tail --name mcp-demo-client
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck
```

## Project Structure

```
packages/
├── mcp-server/          # MCP protocol server
│   ├── src/index.ts     # Server implementation
│   ├── wrangler.toml    # Worker config
│   └── package.json
│
└── workers-client/      # Web UI + API client
    ├── src/index.ts     # Client implementation
    ├── wrangler.toml    # Worker config
    └── package.json
```

## Key Technologies

- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **WebStandardStreamableHTTPServerTransport**: HTTP transport for Workers
- **Cloudflare Workers**: Serverless edge platform
- **Wrangler**: CLI for Workers deployment

## Resources

- **MCP Protocol**: https://modelcontextprotocol.io/
- **Cloudflare Workers**: https://workers.cloudflare.com/
- **MCP SDK**: https://github.com/modelcontextprotocol/typescript-sdk

## License

MIT
