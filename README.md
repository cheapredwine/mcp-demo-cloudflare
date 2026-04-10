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

### AI Orchestrator (http://localhost:8789)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | AI Orchestrator Web UI |
| `/api/ask` | POST | Ask the AI (with MCP tool calling) |
| `/health` | GET | Health check |

**AI Orchestrator Features:**
- 🤖 **Worker AI**: Natural language processing with tool calling
- 🔧 **MCP Tool Integration**: AI intelligently decides which tools to call
- 📊 **MCP Usage Indicator**: UI shows whether MCP server was used or not
- 🔄 **Two-Step Flow**: AI decides tools → executes → responds naturally

**Example Interactions:**

| Prompt | MCP Used? | Why |
|--------|-----------|-----|
| `"What is 25 * 47?"` | ✅ **YES** | Calculator tool needed |
| `"What's the weather in Tokyo?"` | ✅ **YES** | Weather tool needed |
| `"Hello, how are you?"` | ❌ **NO** | Direct response, no tools needed |
| `"Tell me about yourself"` | ❌ **NO** | Direct response, no tools needed |
| `"Calculate 10+5 and what's the weather in Paris?"` | ✅ **YES** | Both calculator AND weather tools |

**How it works:**
1. You type a prompt
2. AI analyzes if it needs MCP tools
3. If YES: Calls MCP server → shows "MCP Server Used" badge with tool details
4. If NO: Responds directly → shows "MCP Not Used" badge

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

**Deploy AI Orchestrator:**
```bash
cd packages/ai-orchestrator
wrangler deploy

# Set your AI Gateway token (get from Cloudflare Dashboard)
wrangler secret put CF_AIG_TOKEN
```

**Configure Service Bindings (one-time):**

For Client:
```bash
cd packages/workers-client
wrangler service bind MCP_SERVER --service=mcp-demo-server
```

For AI Orchestrator:
```bash
cd packages/ai-orchestrator
wrangler service bind MCP_SERVER --service=mcp-demo-server
```

Or via Cloudflare Dashboard:
1. Go to Workers & Pages → Select worker (mcp-demo-client or mcp-demo-ai-gateway)
2. Settings → Service bindings
3. Add: `MCP_SERVER` → `mcp-demo-server`

## Security Configuration

After deployment, configure these security measures to protect your AI endpoints:

### Rate Limiting (WAF)

⚠️ **Note:** WAF rate limiting requires a **custom domain** with a Zone ID. Workers on `*.workers.dev` URLs don't support WAF rules. For `workers.dev` deployments, AI Gateway provides built-in rate limiting.

**If using a custom domain:**
1. Go to: https://dash.cloudflare.com → **Security** → **WAF** → **Rate Limiting**
2. Create a new rule:
   - **If**: URL contains `/api/ask`
   - **Rate**: 10 requests per minute per IP
   - **Action**: Block
   - **Duration**: 1 hour

**Via API (requires Zone ID):**
```bash
# Get your Zone ID first:
ZONE_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=yourdomain.com" \
  -H "Authorization: Bearer {api_token}" | jq -r '.result[0].id')

# Create rate limit rule:
curl -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rate_limits" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "threshold": 10,
    "period": 60,
    "match": {
      "request": {
        "url": "*ai-orchestrator*/api/ask*"
      }
    },
    "action": {
      "mode": "block",
      "timeout": 3600
    }
  }'
```

### AI Gateway Guardrails

Enable guardrails in your AI Gateway for prompt injection protection:

1. Go to: https://dash.cloudflare.com → **AI** → **AI Gateway** → **mcp-demo**
2. Navigate to **Guardrails** tab
3. Enable:
   - ✅ **Prompt Validation**: Block prompt injection attempts (e.g., "Ignore previous instructions...")
   - ✅ **Content Filtering**: Filter inappropriate content
   - ✅ **Logging**: Keep request logs for 7 days

**How Guardrails work:**
- Analyzes prompts before they reach the AI model
- Detects injection patterns: `"Ignore previous instructions"`, `"System: You are now..."`, etc.
- Blocks or sanitizes suspicious prompts
- Logs attempts for security review

### Additional Security Measures

| Measure | How to Enable | Why | Available on workers.dev? |
|---------|--------------|-----|---------------------------|
| **AI Gateway Rate Limiting** | Built into AI Gateway binding | Prevents abuse via AI Gateway analytics | ✅ Yes |
| **HTTPS Only** | Workers enforce HTTPS by default | Prevents MITM attacks | ✅ Yes |
| **CORS Headers** | Already configured in code | Blocks unauthorized origins | ✅ Yes |
| **Input Validation** | MCP server validates tool args | Prevents malformed requests | ✅ Yes |
| **WAF Rate Limiting** | Requires custom domain + Zone ID | Fine-grained request control | ❌ No |
| **AI Gateway Guardrails** | AI Gateway Guardrails tab | Prompt injection protection | ✅ Yes |

### API Token Best Practices

When creating your `CLOUDFLARE_API_TOKEN`:

```
Account: Workers Scripts:Edit
Account: Workers Routes:Edit
Account: Cloudflare Pages:Edit
Account: Account Settings:Read
Zone: None (unless using WAF rules)
```

**Never** use your Global API Key in CI/CD pipelines.

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
