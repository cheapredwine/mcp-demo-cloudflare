# MCP Demo Script

## Overview

This script guides you through a live demo showing:
1. **Web App** — AI-powered chat with tool calling (internal Service Binding)
2. **MCP Portal** — External discovery and tool usage from any MCP client
3. **The Toggle** — Instantly hide/show the MCP server without breaking the web app

**Demo duration:** ~10-15 minutes

---

## Pre-Demo Setup (Do This Beforehand)

### 1. Deploy MCP Server in Public Mode

```bash
cd packages/mcp-server
# Ensure workers_dev = true in wrangler.toml
wrangler deploy
```

**Verify:**
```bash
curl -X POST https://mcp-demo-server.jsherron.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

### 2. Deploy AI Orchestrator

```bash
cd packages/ai-orchestrator
wrangler deploy
```

**Verify:**
```bash
curl -s https://mcp-demo.jsherron.com/health
# Expected: {"status":"ok"}
```

### 3. Register MCP Server in Portal

1. Open Cloudflare Dashboard → Zero Trust → MCP Portals
2. Click "Add server"
3. Enter:
   - **Name:** MCP Demo Server
   - **URL:** `https://mcp-demo-server.jsherron.workers.dev/mcp`
   - **Auth:** Unauthenticated (for demo simplicity)
4. Save
5. Verify server shows as "Connected"

### 4. Set Up MCP Client (Claude Desktop or Cursor)

**Claude Desktop:**
1. Open Settings → Developer → Edit Config
2. Add to `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "mcp-demo": {
         "command": "npx",
         "args": ["-y", "@anthropic/mcp-remote"],
         "env": {
           "MCP_REMOTE_URL": "https://<your-portal-url>/mcp/mcp-demo-server"
         }
       }
     }
   }
   ```
   
**Alternative:** Use the Portal's web interface for testing (no client setup needed)

### 5. Open Browser Tabs

Have these ready:
- [ ] Web app: https://mcp-demo.jsherron.com/
- [ ] Cloudflare Dashboard → MCP Portal (server list)
- [ ] Code editor: `packages/mcp-server/wrangler.toml` (for the toggle)
- [ ] Terminal: `packages/mcp-server/` directory

---

## Demo Flow

### Phase 1: The Web App (3 minutes)

**Narrative:** "Let me show you our AI-powered demo."

**Action:**
1. Open https://mcp-demo.jsherron.com/
2. Point out the three panels: Prompt | MCP Status | AI Response

**Demo Questions:**

**Question 1:** "What is 25 times 4?"
- **Expected:** Shows calculator tool call, result = 100
- **Point out:** "See how it used the calculator tool?"

**Question 2:** "What's the weather in Tokyo?"
- **Expected:** Shows weather tool call with simulated data
- **Point out:** "Our AI decided which tool to use based on the question."

**Question 3:** "Tell me a fun fact about space"
- **Expected:** Direct AI response (no tool)
- **Point out:** "Not every question needs a tool."

**Key Message:** "This all happens through an internal Service Binding — zero latency, completely private."

---

### Phase 2: MCP Portal Discovery (3 minutes)

**Narrative:** "But what if someone wants to use these tools from their own AI assistant?"

**Action:**
1. Switch to Cloudflare Dashboard → MCP Portal
2. Show the server catalog
3. Click on "MCP Demo Server"

**Show:**
- Server status: "Connected" ✅
- Tool list: calculator, get_weather, echo, random_fact
- Each tool with description

**Test via Portal:**
1. Find the test interface (or use Portal's built-in tool tester)
2. Select "calculator" tool
3. Enter arguments: `{"operation": "add", "a": 10, "b": 20}`
4. Execute

**Expected:** Result shows "10 + 20 = 30"

**Key Message:** "Now any MCP-compatible client can discover and use our tools. We're not locked to our web UI."

---

### Phase 3: External MCP Client (3 minutes)

**Narrative:** "Let me show you this in an actual AI assistant."

**Action:**
1. Open Claude Desktop (or Cursor, or Portal's web client)
2. Show the MCP tools sidebar
3. Point out the discovered tools from our server

**Demo in Claude:**
- Type: "What's the weather in Paris?"
- Claude shows it's about to use the `get_weather` tool
- Execute
- Show the result

**Key Message:** "The user didn't even know about our server — Claude discovered it through the Portal. This is the power of MCP standardization."

---

### Phase 4: The Toggle — Lock It Down (3 minutes)

**Narrative:** "But what about security? What if I want to take this offline?"

**Action:**
1. Switch to code editor showing `packages/mcp-server/wrangler.toml`
2. Point out the line: `workers_dev = true`
3. Change it to: `workers_dev = false`
4. Save

**Deploy:**
```bash
cd packages/mcp-server
wrangler deploy
# Output: Published mcp-demo-server
```

**Show Impact:**
1. **Claude Desktop:** Try to use a tool — it fails/disconnects
2. **Portal:** Server status changes to "Disconnected" or shows errors
3. **Direct curl:** 
   ```bash
   curl https://mcp-demo-server.jsherron.workers.dev/mcp
   ```
   Expected: 404 or error

**But then:**
1. Switch back to web app: https://mcp-demo.jsherron.com/
2. Ask: "What is 10 plus 20?"
3. **It still works perfectly.**

**Key Message:** "The web app never broke. The internal Service Binding is completely independent. External clients are cut off, but our application keeps running."

---

### Phase 5: Unlock It (2 minutes)

**Narrative:** "And if I want to open it back up?"

**Action:**
1. Change `workers_dev = false` back to `workers_dev = true`
2. Save and deploy

```bash
wrangler deploy
```

**Show Recovery:**
1. **Portal:** Status returns to "Connected"
2. **Claude Desktop:** Tools reappear
3. **Direct curl:** Works again

**Key Message:** "One line. One deploy. Instant control."

---

## Post-Demo: Reset to Private Mode

If you want to leave the demo in the default (private) state:

```bash
cd packages/mcp-server
# Set workers_dev = false
wrangler deploy
```

---

## Talking Points

### Architecture
- "We have two independent paths to the same MCP server"
- "Internal uses Service Bindings — zero latency, no internet hop"
- "External goes through MCP Portal — adds governance and discovery"

### Security
- "The MCP server is just a Worker. We control access at the edge."
- "Our web app doesn't even notice when we toggle — it's completely decoupled"
- "Portal adds an extra layer: Access policies, DLP, audit logs"

### Standardization
- "MCP means any client can discover our tools — not just our web app"
- "We're not building a silo. We're building infrastructure."

### Performance
- "Internal path: ~0ms latency"
- "External path: ~50-200ms (one extra hop through Portal)"
- "But both work simultaneously"

---

## Troubleshooting During Demo

### Web App Not Working
- Check AI Orchestrator is deployed: `wrangler deploy` in `packages/ai-orchestrator`
- Check Service Binding is configured in `wrangler.toml`

### Portal Shows "Disconnected"
- Check MCP server is deployed with `workers_dev = true`
- Test direct: `curl https://mcp-demo-server.jsherron.workers.dev/mcp`
- Check Portal URL is correct (must end in `/mcp`)

### Claude Desktop Not Finding Tools
- Restart Claude after config changes
- Check Claude logs: `~/Library/Logs/Claude/mcp.log`
- Verify Portal URL format

### Toggle Doesn't Work
- Make sure you deployed after changing `wrangler.toml`
- Check you're editing the right file: `packages/mcp-server/wrangler.toml`
- Wait 10-30 seconds for changes to propagate

---

## Demo Checklist

Before starting the demo:
- [ ] MCP server deployed with `workers_dev = true`
- [ ] AI Orchestrator deployed
- [ ] MCP server registered in Portal
- [ ] Portal shows "Connected" status
- [ ] Web app loads and responds
- [ ] (Optional) Claude Desktop configured and shows tools
- [ ] Code editor open to `wrangler.toml`
- [ ] Terminal ready in `packages/mcp-server`

---

## Appendix: Alternative Demos

### Quick Demo (5 minutes)
Skip Phase 3 (external client). Just show web app + Portal + toggle.

### Deep Dive (20 minutes)
Add:
- Show actual code for Service Binding usage
- Show MCP protocol messages in browser dev tools
- Show Cloudflare analytics dashboards
- Compare latency with `curl -w` timing

### Team Demo (30 minutes)
Add:
- Architecture diagram walkthrough
- Security discussion (Access policies, DLP)
- Q&A about MCP standard
- Discussion of production considerations

---

*Demo script version: 1.0*
*Branch: plan/mcp-portal-integration*
*Last updated: 2026-05-04*
