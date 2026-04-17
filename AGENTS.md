# AGENTS.md - MCP Demo on Cloudflare Workers

## Project Overview

This is a **Model Context Protocol (MCP)** demo running on Cloudflare Workers. It demonstrates:

- **MCP Server**: A private, stateless MCP server exposing tools (calculator, get_weather, echo, random_fact)
- **AI Orchestrator**: A web UI that uses Cloudflare Workers AI with AI Gateway for intelligent tool calling
- **Service Bindings**: Internal worker-to-worker communication (avoids Cloudflare's 1042 error)
- **Streaming**: Real-time SSE streaming for chat responses
- **AI Gateway**: Caching, analytics, and guardrails for AI requests

### Live URLs

- **AI Orchestrator**: https://mcp-demo.jsherron.com/
- **MCP Server**: Private (no public URL, accessed via Service Binding)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User (Browser)                                             │
│  • 3-Panel Web UI (Prompt | MCP Status | AI Response)       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
┌──────────────────────────┴──────────────────────────────────┐
│  AI Orchestrator (Worker)                                   │
│  • Workers AI binding with AI Gateway                       │
│  • Tool calling logic                                       │
│  • SSE streaming responses                                  │
│  • Service Binding to MCP Server                            │
└──────────────────────────┬──────────────────────────────────┘
                           │ Service Binding (internal)
┌──────────────────────────┴──────────────────────────────────┐
│  MCP Server (Worker)                                        │
│  • MCP protocol implementation                              │
│  • Tools: calculator, get_weather, echo, random_fact        │
│  • Private (workers_dev = false)                            │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
packages/
├── mcp-server/              # MCP protocol server
│   ├── src/index.ts         # Server implementation (5 tools)
│   ├── src/__tests__/       # Unit tests (40 tests)
│   ├── wrangler.toml        # Worker config (private, no workers_dev)
│   └── package.json
│
└── ai-orchestrator/         # AI Orchestrator with Workers AI
    ├── src/index.ts         # Main implementation (~1600 lines)
    ├── src/__tests__/       # Tests (43+ tests)
    ├── wrangler.toml        # Config with AI binding + Service Binding
    └── package.json

.github/workflows/
└── deploy.yml               # CI/CD deployment workflow
```

## Key Technologies

- **@modelcontextprotocol/sdk**: MCP protocol implementation (^1.8.0)
- **Cloudflare Workers**: Serverless edge platform
- **Cloudflare Workers AI**: AI inference at the edge
- **Cloudflare AI Gateway**: Caching, analytics, guardrails
- **Service Bindings**: Internal worker-to-worker communication
- **Wrangler**: CLI for Workers deployment (^4.0.0)
- **Vitest**: Testing framework (^3.0.0)

## Development Commands

### Install Dependencies
```bash
npm install
```

### Local Development

**Terminal 1 - MCP Server:**
```bash
cd packages/mcp-server
npm run dev
# Runs on http://localhost:8787
```

**Terminal 2 - AI Orchestrator:**
```bash
cd packages/ai-orchestrator
npm run dev
# Runs on http://localhost:8789
```

**Shortcuts from root:**
```bash
npm run dev:server    # Start MCP server
npm run dev:ai        # Start AI orchestrator
```

### Testing

```bash
npm test              # Run all tests (99 tests)
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
npm run typecheck     # TypeScript type checking
```

## Deployment

### Automated (GitHub Actions)

Deployment is triggered automatically on push to `main` branch.

**Required GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN` - API token with Workers edit permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

**Workflow:**
1. Run tests
2. Deploy MCP Server
3. Deploy AI Orchestrator (with build timestamp injection)

### Manual Deploy

```bash
# Deploy MCP Server
cd packages/mcp-server
wrangler deploy

# Deploy AI Orchestrator
cd packages/ai-orchestrator
wrangler deploy
```

### Service Binding Setup

The AI Orchestrator needs a Service Binding to the MCP Server:

```bash
cd packages/ai-orchestrator
wrangler service bind MCP_SERVER --service=mcp-demo-server
```

Or via Cloudflare Dashboard:
1. Workers & Pages → mcp-demo-ai-orchestrator
2. Settings → Service bindings
3. Add: `MCP_SERVER` → `mcp-demo-server`

## Important Configuration Details

### AI Orchestrator (packages/ai-orchestrator/wrangler.toml)

```toml
name = "mcp-demo-ai-orchestrator"
routes = [
  { pattern = "mcp-demo.jsherron.com", custom_domain = true }
]

# Service binding to MCP server
[[services]]
binding = "MCP_SERVER"
service = "mcp-demo-server"

# Workers AI binding with AI Gateway integration
[ai]
binding = "AI"
```

### MCP Server (packages/mcp-server/wrangler.toml)

```toml
name = "mcp-demo-server"
workers_dev = false  # Private - no public URL
# Only accessible via Service Binding from AI Orchestrator
```

### Build Timestamp

The build timestamp is injected during deployment:
```bash
BUILD_TIME=$(date -u +"%Y-%m-%d %H:%M UTC")
sed -i "s/BUILD_TIME = 'UNKNOWN'/BUILD_TIME = '$BUILD_TIME'/g" packages/ai-orchestrator/src/index.ts
```

This appears in the UI top-right corner.

## Available Tools

The MCP server exposes these tools:

| Tool | Description |
|------|-------------|
| `calculator` | Basic math (add, subtract, multiply, divide) |
| `get_weather` | Simulated weather data for a location |
| `echo` | Echo back the input message |
| `random_fact` | Returns random facts by category |

## API Endpoints

### AI Orchestrator

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web UI (3-panel interface) |
| `/api/ask` | POST | AI query with tool calling or streaming |
| `/admin` | GET | Admin panel for cache warming |
| `/health` | GET | Health check |

### MCP Server

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP protocol endpoint |

## Common Tasks

### Trigger Redeploy

Create an empty commit and push:
```bash
git commit --allow-empty -m "chore: trigger redeploy"
git push
```

### Monitor Logs

```bash
# MCP Server logs
wrangler tail --name mcp-demo-server

# AI Orchestrator logs
wrangler tail --name mcp-demo-ai-orchestrator
```

### Run Integration Tests

Requires both servers to be running:
```bash
npm run dev:server &
npm run dev:ai &
npm run test:integration
```

## Security

- **MCP Server** is private (`workers_dev = false`)
- **AI Gateway** provides guardrails for prompt injection
- **WAF** can be configured for rate limiting (requires custom domain)
- **PII Detection** available via Cloudflare Firewall for AI

## Troubleshooting

### Error 1042
Workers cannot make HTTP requests to other `*.workers.dev` domains. This project uses Service Bindings to avoid this issue.

### Deployment Failures
- Check `CLOUDFLARE_API_TOKEN` has correct permissions
- Verify `CLOUDFLARE_ACCOUNT_ID` is correct
- Ensure Service Binding is configured

### Streaming Issues
- Verify AI Gateway configuration
- Check Workers AI binding is active
- Review logs for PII filter blocking

## Key Files for Context

- `packages/ai-orchestrator/src/index.ts` - Main AI orchestration logic (~1600 lines)
- `packages/mcp-server/src/index.ts` - MCP server implementation
- `.github/workflows/deploy.yml` - CI/CD configuration
- `wrangler.toml` files - Worker configurations

## Notes for Future Sessions

1. **This is a demo project** - Not production-ready without additional security review
2. **Service Bindings are required** - Don't try to use HTTP between workers
3. **AI Gateway caching** - Responses cached for 24 hours
4. **Build timestamp** - Automatically updated via CI/CD
5. **Tests must pass** - Run `npm test` before any commit
