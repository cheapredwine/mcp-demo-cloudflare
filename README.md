# MCP Demo on Cloudflare Workers

A working MCP (Model Context Protocol) server and client running on Cloudflare Workers with **streaming AI responses**, intelligent tool calling, and **AI Gateway caching**. This demonstrates how to build and deploy MCP infrastructure on Cloudflare's edge platform using **Service Bindings** for worker-to-worker communication.

## 🚀 Live Demo

- **AI Orchestrator:** https://mcp-demo.jsherron.com/
- **MCP Server:** Private (accessible only via Service Binding from AI Orchestrator)

Open the AI Orchestrator Web UI and type a message to see the MCP protocol in action!

## What This Is

- **MCP Server**: Private stateless server handling MCP protocol (no public URL)
- **AI Orchestrator**: Workers AI + AI Gateway + Web UI with streaming
  - Uses Workers AI LLM model instance
  - AI Gateway provides caching, analytics, and rate limiting
  - **Security**: Firewall for AI blocks prompt injection, PII detection protects sensitive data
  - **Streaming**: Real-time SSE streaming for chat responses
  - Calls MCP tools via Service Bindings
- **All run on Cloudflare Workers**: Serverless, globally distributed, pay-per-request
- **Key Innovation**: Uses Service Bindings instead of HTTP for worker-to-worker communication (avoids Cloudflare's 1042 error)

## 🎯 Demo Features

### Interactive Buttons

| Button | Behavior |
|--------|----------|
| **🔢 Calculator** | Cycles through preset problems. Shows **NEXT** problem on button, calculates **CURRENT** when clicked. |
| **🌤️ Weather** | Cycles through 10 cities randomly. Shows **NEXT** city on button, queries **CURRENT** when clicked. |
| **🔄 Multistep** | Cycles through 6 math word problems. Shows **NEXT** problem on button, solves **CURRENT** when clicked. |
| **🐱 Tabby Cats** | Streams a response about tabby cats with real-time text display. |

### Smart Caching

- **AI Gateway** caches responses for 24 hours
- **Admin Panel** (`/admin`) pre-warms cache for all demo queries
- First request is slower, subsequent requests are instant

### Build Timestamp

The UI shows the deployment timestamp (top-right corner) so you know when the code was last deployed. Updated automatically via CI/CD.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User                                                       │
│  • Web browser with 3-Panel UI                              │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
┌──────────────────────────┴──────────────────────────────────┐
│  AI Orchestrator (Worker)                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 3-Panel Web UI                                       │  │
│  │ • Prompt | MCP Status | AI Response                  │  │
│  │ • Interactive buttons (calc, weather, multistep)     │  │
│  │ • Streaming chat responses                           │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                            │ Workers AI Binding¹
┌──────────────────────────┴──────────────────────────────────┐
│  Cloudflare AI Platform                                     │
│  ┌───────────────────┐  ┌───────────────────────────────┐  │
│  │ Workers AI        │  │ AI Gateway + WAF²             │  │
│  │ • LLM model inst. │←─┤ • Caching + Analytics         │  │
│  │ • Tool calling    │  │ • Guardrails (prompt inj.)    │  │
│  │ • SSE Streaming   │  │ • Firewall for AI (PII)       │  │
│  └───────────────────┘  └───────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ Service Binding
┌──────────────────────────┴──────────────────────────────────┐
│  MCP Server (Worker)                                        │
│  • Handles MCP protocol                                     │
│  • Exposes 2 tools: calculator, get_weather                 │
│  • Private (no public URL)                                  │
└─────────────────────────────────────────────────────────────┘
```

**¹ Note:** Workers AI is a Cloudflare platform service. In this demo we access it via binding from the AI Orchestrator worker. You can also call it via the REST API from any worker or external service.

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
- Admin Panel: `http://localhost:8789/admin`

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
| `/api/ask` | POST | Ask the AI (with MCP tool calling or streaming) |
| `/admin` | GET | Admin panel for cache warming |
| `/health` | GET | Health check |

### Admin Panel Features

The `/admin` endpoint provides:
- **Cache Pre-warming**: Warm AI Gateway cache by calling all demo queries
- **Cache Status**: See which queries are cached vs not cached
- **Progress Logging**: Real-time progress of cache warming

## Streaming

Chat actions use **Server-Sent Events (SSE)** for real-time streaming:

```javascript
// Client-side streaming handler
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  // Parse SSE format: data: {"response": "text"}
  buffer += decoder.decode(value, { stream: true });
  // ... parse and display
}
```

**Streaming Features:**
- Real-time text appears as it's generated
- Parses Workers AI SSE format with `response` field
- Shows "No MCP used" chip for streaming (chat doesn't use tools)
- Handles `[DONE]` marker and error responses

## AI Orchestrator Features

- 🤖 **Worker AI**: Natural language processing with tool calling
- 🔄 **Streaming**: Real-time SSE responses for chat
- 🔧 **MCP Tool Integration**: AI intelligently decides which tools to call
- 📊 **MCP Usage Indicator**: UI shows whether MCP server was used or not
- 💾 **AI Gateway Caching**: 24-hour cache for faster responses
- 🎯 **Smart Buttons**: Calc/Weather/Multistep cycle through items intelligently

**Example Interactions:**

| Prompt | MCP Used? | Why |
|--------|-----------|-----|
| `"What is 25 * 47?"` | ✅ **YES** | Calculator tool needed |
| `"What's the weather in Tokyo?"` | ✅ **YES** | Weather tool needed |
| `"Hello, how are you?"` | ❌ **NO** | Direct response, streaming used |
| `"Tell me about tabby cats"` | ❌ **NO** | Direct response, streaming used |
| `"Calculate 10+5 and what's the weather in Paris?"` | ✅ **YES** | Both calculator AND weather tools |

**How it works:**
1. You type a prompt or click a button
2. For chat: Streaming response with real-time text
3. For tools: AI analyzes if it needs MCP tools
4. If YES: Calls MCP server → shows "MCP Server Used" badge with tool details
5. If NO: Responds directly → shows "MCP Not Used" badge

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

**Build Timestamp:** The deployment workflow automatically injects the build timestamp:
```bash
BUILD_TIME=$(date -u +"%Y-%m-%d %H:%M UTC")
sed -i "s/BUILD_TIME = 'UNKNOWN'/BUILD_TIME = '$BUILD_TIME'/g" packages/ai-orchestrator/src/index.ts
```

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

# Inject build timestamp first
BUILD_TIME=$(date -u +"%Y-%m-%d %H:%M UTC")
sed -i '' "s/BUILD_TIME = 'UNKNOWN'/BUILD_TIME = '$BUILD_TIME'/g" src/index.ts

wrangler deploy
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

### Firewall for AI (WAF)

With a **custom domain**, Cloudflare WAF provides additional AI-specific protections:

**PII Detection & Blocking:**
1. Go to: https://dash.cloudflare.com → **jsherron.com** → **Security** → **WAF** → **Custom Rules**
2. Create or edit the PII detection rule
3. Use expression: `cf.llm.prompt.pii_detected`
4. **Action**: Block

**What gets blocked:**
- Email addresses, phone numbers, SSNs
- Credit card numbers
- Physical addresses and locations
- Other personally identifiable information

**Tuning PII sensitivity:**
The default rules may be too sensitive for legitimate queries like "weather in Tokyo" (location PII). To allow these:

**Solution: Custom Topics**

Use WAF Custom Topics to explicitly allow "weather" and other legitimate patterns that may contain location data:

1. Dashboard → **jsherron.com** → **Security** → **WAF** → **Custom Topics**
2. Create a new allowed topic:
   - **Name**: Weather Queries
   - **Pattern**: `weather.*in.*`
   - **Action**: Allow
3. This permits "weather in Tokyo", "weather in Paris", etc. without disabling PII protection for actual sensitive data.

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
1. Is the AI Orchestrator deployed? Check the live demo URL
2. Is the MCP server deployed? (It has no public URL - check via Cloudflare Dashboard)
3. Is the service binding configured? Check Cloudflare Dashboard → Workers → Service Bindings
4. Check server logs: `wrangler tail --name mcp-demo-server`

### GitHub Actions deployment fails

**Check secrets:**
- `CLOUDFLARE_API_TOKEN` must have "Edit Cloudflare Workers" permission
- `CLOUDFLARE_ACCOUNT_ID` must be your actual account ID (not token ID)

### Streaming not working

**Check:**
1. AI Gateway is configured correctly
2. Workers AI binding is active
3. No PII filter blocking the prompt (try "hello" instead of specific locations)

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

# With coverage
npm run test:coverage
```

**Current Test Count: 99 tests passing**

## Project Structure

```
packages/
├── mcp-server/          # MCP protocol server
│   ├── src/index.ts     # Server implementation
│   ├── src/__tests__/   # Tests (40 tests)
│   ├── wrangler.toml    # Worker config
│   └── package.json
│
└── ai-orchestrator/     # AI Orchestrator with Worker AI
    ├── src/index.ts     # AI + MCP integration + streaming
    ├── src/__tests__/   # Tests (43 tests: 16 index + 27 mcp-protocol)
    ├── wrangler.toml    # Worker config (AI binding + service binding)
    └── package.json

scripts/
└── inject-build-time.sh # Build timestamp injection

.github/workflows/
└── deploy.yml           # CI/CD with build timestamp
```

## Key Technologies

- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **WebStandardStreamableHTTPServerTransport**: HTTP transport for Workers
- **Cloudflare Workers**: Serverless edge platform
- **Cloudflare Service Bindings**: Internal worker-to-worker communication
- **Cloudflare Worker AI**: AI inference at the edge
- **Cloudflare AI Gateway**: Caching, analytics, and guardrails
- **Cloudflare Firewall for AI**: Prompt injection detection and protection
- **Server-Sent Events (SSE)**: Real-time streaming
- **Wrangler**: CLI for Workers deployment
- **Vitest**: Testing framework

## How It Works

### AI Orchestrator Flow
1. **AI Orchestrator receives prompt** from browser
2. **If chat action**: Stream response via SSE
3. **If tool action**: Worker AI processes with tool definitions
4. **AI decides which tools to call** (if any)
5. **Service Binding** calls MCP server for each tool
6. **Results returned to AI** for natural language response
7. **Formatted response** returned to browser

### Button Cycling Logic
Buttons show the NEXT item but execute the CURRENT item:
```javascript
// On click:
const current = items[index];        // Use this
index = (index + 1) % items.length;  // Move to next
const next = items[index];            // Show this on button
```

### Build Timestamp Injection
CI/CD injects build time before deployment:
```yaml
- name: Inject build timestamp
  run: |
    BUILD_TIME=$(date -u +"%Y-%m-%d %H:%M UTC")
    sed -i "s/BUILD_TIME = 'UNKNOWN'/BUILD_TIME = '$BUILD_TIME'/g" src/index.ts
```

## Resources

- **MCP Protocol**: https://modelcontextprotocol.io/
- **Cloudflare Workers**: https://workers.cloudflare.com/
- **Service Bindings**: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
- **Cloudflare Worker AI**: https://developers.cloudflare.com/workers-ai/
- **Cloudflare AI Gateway**: https://developers.cloudflare.com/ai-gateway/
- **Cloudflare Firewall for AI**: https://developers.cloudflare.com/firewall-for-ai/
- **MCP SDK**: https://github.com/modelcontextprotocol/typescript-sdk

## License

MIT
