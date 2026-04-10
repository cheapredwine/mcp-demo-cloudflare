# MCP Demo on Cloudflare Workers

A working MCP (Model Context Protocol) server and client running on Cloudflare Workers. This demonstrates how to build and deploy MCP infrastructure on Cloudflare's edge platform using **Service Bindings** for worker-to-worker communication.

## 🚀 Live Demo

- **AI Orchestrator:** https://mcp-demo-ai-orchestrator.jsherron-test-account.workers.dev/
- **MCP Server:** https://mcp-demo-server.jsherron-test-account.workers.dev/mcp

Open the AI Orchestrator Web UI and type a message to see the MCP protocol in action!

## What This Is

- **MCP Server**: Stateless server handling MCP protocol requests via Streamable HTTP transport
- **AI Orchestrator**: Worker AI that intelligently calls MCP tools via Service Bindings
- **All run on Cloudflare Workers**: Serverless, globally distributed, pay-per-request
- **Key Innovation**: Uses Service Bindings instead of HTTP for worker-to-worker communication (avoids Cloudflare's 1042 error)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User                                                       │
│  • Web browser                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
┌──────────────────────────┴──────────────────────────────────┐
│  AI Orchestrator                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Worker AI                                             │  │
│  │ • Natural language understanding                      │  │
│  │ • Intelligent tool selection                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ Service Binding
┌──────────────────────────┴──────────────────────────────────┐
│  MCP Server                                                 │
│  • Handles MCP protocol                                     │
│  • Exposes 2 demo tools:                                    │
│    - calculator, get_weather                                │
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

**Terminal 2 - Start AI Orchestrator:**
```bash
cd packages/ai-orchestrator
npm run dev
# AI Orchestrator runs on http://localhost:8789
```

**Open browser:** 
- AI Orchestrator: `http://localhost:8789`

## Available Tools

The MCP server exposes these tools:

| Tool | Description |
|------|-------------|
| `calculator` | Basic math (add, subtract, multiply, divide) |
| `get_weather` | Simulated weather data |

## API Endpoints

### Server (http://localhost:8787)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP protocol endpoint |

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

**Deploy AI Orchestrator:**
```bash
cd packages/ai-orchestrator
wrangler deploy

# Set your AI Gateway token (get from Cloudflare Dashboard)
wrangler secret put CF_AIG_TOKEN
```

**Configure Service Binding (one-time):**

For AI Orchestrator:
```bash
cd packages/ai-orchestrator
wrangler service bind MCP_SERVER --service=mcp-demo-server
```

Or via Cloudflare Dashboard:
1. Go to Workers & Pages → Select worker (mcp-demo-ai-orchestrator)
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

# Watch AI Orchestrator logs  
wrangler tail --name mcp-demo-ai-orchestrator
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
│   ├── src/__tests__/   # Tests
│   ├── wrangler.toml    # Worker config
│   └── package.json
│
└── ai-orchestrator/     # AI Orchestrator with Worker AI
    ├── src/index.ts     # AI + MCP integration
    ├── src/__tests__/   # Tests
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

### AI Orchestrator Flow
1. **AI Orchestrator receives prompt** from browser
2. **Worker AI** processes the prompt with tool definitions
3. **AI decides which tools to call** (if any)
4. **Service Binding** calls MCP server for each tool
5. **Results returned to AI** for natural language response
6. **Formatted response** returned to browser

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
