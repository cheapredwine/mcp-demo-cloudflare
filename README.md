# MCP Demo with Code Mode

A stateless MCP (Model Context Protocol) server demonstrating Cloudflare's Code Mode pattern, running on regular Cloudflare Workers without Durable Objects.

## What is Code Mode?

Code Mode is a technique to reduce context window usage in MCP servers. Instead of exposing many individual tools (which consume tokens), you expose just 2 powerful tools that let the LLM:

1. **`search(filter)`** - Dynamically discover available capabilities
2. **`execute(operations)`** - Orchestrate multiple operations in a single call

This reduces context window usage by ~60% (from ~2,500 tokens to ~1,000 tokens) while enabling complex multi-step operations.

## Architecture

```
┌─────────────────┐         ┌─────────────────────────────┐
│  MCP Client     │         │   MCP Server (Stateless)    │
│  (Web UI)       │◄───────►│   Regular Cloudflare Worker │
│                 │  HTTP   │   No Durable Objects needed │
└─────────────────┘         └─────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              ┌─────────┐      ┌──────────┐      ┌──────────┐
              │ search  │      │ execute  │      │resources │
              │  tool   │      │  tool    │      │  specs   │
              └─────────┘      └──────────┘      └──────────┘
```

## Project Structure

```
packages/
├── mcp-server/          # Stateless MCP server with Code Mode
│   ├── src/index.ts     # Main server implementation
│   ├── wrangler.toml    # Regular Worker config (no Durable Objects)
│   └── package.json     # Dependencies (no agents SDK)
│
└── workers-client/      # Web UI client
    ├── src/index.ts     # Web interface + API proxy
    └── wrangler.toml    # Regular Worker config
```

## Quick Start

### Prerequisites

- Node.js 20+
- Cloudflare account (for deployment)
- Wrangler CLI: `npm install -g wrangler`

### Installation

```bash
# Clone or create the project directory
mkdir mcp-demo && cd mcp-demo

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

**Open browser to:** `http://localhost:8788`

## API Endpoints

### Server Endpoints (http://localhost:8787)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP protocol endpoint (Streamable HTTP) |
| `/mcp` | GET | SSE stream for notifications |

### Client Endpoints (http://localhost:8788)

| Endpoint | Description |
|----------|-------------|
| `/` | Web UI with Code Mode demo |
| `/status` | Server connection status |
| `/demo-search` | Demonstrate `search()` tool |
| `/demo-execute` | Demonstrate `execute()` tool |
| `/test-echo` | Test echo via execute |
| `/test-calculator` | Test calculator via execute |
| `/test-weather` | Test weather via execute |
| `/test-fact` | Test random fact via execute |
| `/test-all` | Run all tests in one execute call |

## Code Mode Tools

### 1. `search(filter?)`

Search available tools and their specifications.

**Request:**
```json
{
  "filter": "weather"
}
```

**Response:**
```json
{
  "content": [
    {
      "text": "Search Results (1 tools found):"
    },
    {
      "text": "[{\"name\": \"get_weather\", ...}]"
    }
  ]
}
```

### 2. `execute(operations)`

Execute multiple operations in a single call.

**Request:**
```json
{
  "operations": [
    {
      "tool": "getWeather",
      "params": { "location": "San Francisco", "units": "celsius" }
    },
    {
      "tool": "randomFact",
      "params": { "category": "technology" }
    },
    {
      "tool": "calculator",
      "params": { "operation": "multiply", "a": 42, "b": 100 }
    }
  ]
}
```

**Response:**
```json
{
  "content": [
    {
      "text": "Executed 3 operations:"
    },
    {
      "text": "{\"getWeather_0\": {...}, \"randomFact_1\": {...}, ...}"
    }
  ]
}
```

## Deployment

### Option 1: Manual Deploy with Wrangler

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

### Option 2: GitHub Actions (Automated)

1. **Add secrets to GitHub repository:**
   - `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token

2. **Push to main branch:**
   ```bash
   git push origin main
   ```

3. **GitHub Actions will:**
   - Run tests
   - Deploy server first
   - Deploy client with updated URL

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck
```

## Code Mode vs Traditional MCP

| Feature | Traditional MCP | Code Mode |
|---------|----------------|-----------|
| **Tool Count** | 5+ tools | 2 tools |
| **Context Tokens** | ~2,500 | ~1,000 |
| **Token Savings** | - | **60%** |
| **Multi-step Ops** | Multiple calls | Single call |
| **Discovery** | `list_tools()` | `search(filter)` |
| **State** | Stateless | Stateless |

## Why Stateless?

This demo runs on **regular Cloudflare Workers** without Durable Objects:

- ✅ **Simpler deployment** - No DO bindings needed
- ✅ **Lower cost** - Pay per request, no idle costs
- ✅ **Faster cold start** - No DO initialization
- ✅ **Easier to understand** - No session state complexity

For production use cases requiring state, you would add Durable Objects or use the `agents` SDK.

## Resources

- **MCP Protocol:** https://modelcontextprotocol.io/
- **Cloudflare Workers:** https://workers.cloudflare.com/
- **Code Mode Blog Post:** https://blog.cloudflare.com/code-mode-mcp/
- **MCP SDK:** https://github.com/modelcontextprotocol/typescript-sdk

## License

MIT
