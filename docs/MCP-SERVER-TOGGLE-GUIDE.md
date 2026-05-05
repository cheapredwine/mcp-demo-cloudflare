# MCP Server Visibility Toggle Guide

## The One-Line Kill Switch

You can instantly hide the MCP server from external access while keeping the web demo running. This is controlled by a single line in `packages/mcp-server/wrangler.toml`.

---

## How It Works

The MCP server has **two independent access paths**:

### Path 1: Internal (Web App) — ALWAYS WORKS
```
User → Web UI → AI Orchestrator → Service Binding → MCP Server
```
- Uses Cloudflare Service Bindings (internal, zero-latency)
- Works **regardless** of `workers_dev` setting
- Cannot be blocked by toggling public access

### Path 2: External (Portal/MCP Clients) — TOGGLEABLE
```
MCP Client → HTTPS → MCP Server (via workers.dev or custom domain)
```
- Controlled by `workers_dev` setting
- Enables/disables public URL access

---

## Toggle Reference

### Mode A: Private (Default) — Web Demo Only

```toml
# packages/mcp-server/wrangler.toml
workers_dev = false
```

| Feature | Status |
|---------|--------|
| Web app (mcp-demo.jsherron.com) | ✅ Works (Service Binding) |
| MCP Portal integration | ❌ Not accessible |
| Direct curl to MCP server | ❌ Blocked (404) |
| Claude/Cursor discovery | ❌ Not accessible |

**Use when:** You only want the web demo, keeping MCP server completely private.

---

### Mode B: Public (Demo Mode) — Web + External Clients

```toml
# packages/mcp-server/wrangler.toml
workers_dev = true
```

| Feature | Status |
|---------|--------|
| Web app (mcp-demo.jsherron.com) | ✅ Works (Service Binding) |
| MCP Portal integration | ✅ Works (HTTPS) |
| Direct curl to MCP server | ✅ Works |
| Claude/Cursor discovery | ✅ Works (via Portal or direct) |

**Use when:** You want to show both the web app AND external MCP client integration.

---

## Toggle Commands

### Hide MCP Server (Go Private)

```bash
# 1. Edit the file
cd packages/mcp-server

# 2. Change workers_dev from true to false
# workers_dev = true → workers_dev = false

# 3. Deploy (takes ~10 seconds)
wrangler deploy

# Done. MCP server is now private.
# Web demo at mcp-demo.jsherron.com still works perfectly.
```

### Expose MCP Server (Go Public)

```bash
# 1. Edit the file
cd packages/mcp-server

# 2. Change workers_dev from false to true
# workers_dev = false → workers_dev = true

# 3. Deploy (takes ~10 seconds)
wrangler deploy

# Done. MCP server is now accessible publicly.
# Web demo at mcp-demo.jsherron.com still works perfectly.
```

---

## Quick Toggle Script

Create this alias or script for instant toggling:

```bash
#!/bin/bash
# toggle-mcp.sh

WRANGLER_FILE="packages/mcp-server/wrangler.toml"
CURRENT=$(grep "workers_dev" $WRANGLER_FILE | head -1 | sed 's/.*= //')

cd packages/mcp-server

if [ "$CURRENT" = "true" ]; then
  sed -i '' 's/workers_dev = true/workers_dev = false/' wrangler.toml
  echo "🔒 MCP server is now PRIVATE (web demo still works)"
else
  sed -i '' 's/workers_dev = false/workers_dev = true/' wrangler.toml
  echo "🌐 MCP server is now PUBLIC (web demo + external clients)"
fi

wrangler deploy
echo "Deployed!"
```

Usage:
```bash
./toggle-mcp.sh
# Output: 🔒 MCP server is now PRIVATE (web demo still works)
# Or:     🌐 MCP server is now PUBLIC (web demo + external clients)
```

---

## Architecture Diagrams

### Private Mode (`workers_dev = false`)

```
┌─────────────────────────────────────────────────────┐
│  User (Browser)                                     │
└──────────┬──────────────────────────────────────────┘
           │ HTTPS
┌──────────┴──────────────────────────────────────────┐
│  AI Orchestrator (Worker)                           │
│  • Workers AI + AI Gateway                          │
│  • Service Binding → MCP Server                     │
└──────────┬──────────────────────────────────────────┘
           │ Service Binding (internal, always works)
┌──────────┴──────────────────────────────────────────┐
│  MCP Server (Worker)                                │
│  • Private: no public URL                           │
│  • Only accessible via Service Binding              │
│  • 🔒 workers_dev = false                           │
└─────────────────────────────────────────────────────┘
```

### Public Mode (`workers_dev = true`)

```
┌─────────────────────────────────────────────────────┐
│  User (Browser)                                     │
└──────────┬──────────────────────────────────────────┘
           │ HTTPS
┌──────────┴──────────────────────────────────────────┐
│  AI Orchestrator (Worker)                           │
│  • Workers AI + AI Gateway                          │
│  • Service Binding → MCP Server (unchanged)         │
└──────────┬──────────────────────────────────────────┘
           │ Service Binding (internal)
┌──────────┴──────────────────────────────────────────┐
│  MCP Server (Worker)                                │
│  • Public URL: mcp-demo-server.jsherron.workers.dev │
│  • Accessible via HTTPS                             │
│  • 🌐 workers_dev = true                            │
└──────────┬──────────────────────────────────────────┘
           │ HTTPS
┌──────────┴──────────────────────────────────────────┐
│  MCP Portal / External Clients                      │
│  • Claude Desktop                                   │
│  • Cursor                                           │
│  • Direct curl                                      │
└─────────────────────────────────────────────────────┘
```

---

## Testing the Toggle

### Verify Private Mode

```bash
# 1. Ensure workers_dev = false
# 2. Deploy
cd packages/mcp-server && wrangler deploy

# 3. Test web app (should work)
curl -s https://mcp-demo.jsherron.com/health
# Expected: {"status":"ok"}

# 4. Test MCP server directly (should fail)
curl -s https://mcp-demo-server.jsherron.workers.dev/mcp
# Expected: 404 or connection error

# 5. Test Service Binding (should work)
# This only works from the AI Orchestrator Worker itself
```

### Verify Public Mode

```bash
# 1. Ensure workers_dev = true
# 2. Deploy
cd packages/mcp-server && wrangler deploy

# 3. Test web app (should still work)
curl -s https://mcp-demo.jsherron.com/health
# Expected: {"status":"ok"}

# 4. Test MCP server directly (should work)
curl -X POST https://mcp-demo-server.jsherron.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
# Expected: {"jsonrpc":"2.0","id":1,"result":{...}}
```

---

## Demo Script Integration

Use this toggle as part of your demo narrative:

### Demo Flow: "Lock It Down"

**You:** "Right now, our MCP server is public. Any MCP client can discover and use our tools."

**Action:** Show Claude Desktop with tools discovered.

**You:** "But what if I want to restrict access? Maybe I'm done with the demo, or I only want internal teams using it through our web app."

**Action:** Change `workers_dev = true` to `false`. Deploy.

**You:** "Now the MCP server is completely private. External clients can't reach it."

**Action:** Show Claude Desktop — tools are now disconnected.

**You:** "But our web app? Still works perfectly. The internal Service Binding is unaffected."

**Action:** Show web app working normally.

**You:** "And if I want to open it back up? Just one line change."

**Action:** Change back to `true`. Deploy. Show Claude Desktop reconnecting.

---

## Summary

| Operation | Command | Time |
|-----------|---------|------|
| Hide MCP server | Edit `workers_dev = false` + deploy | ~15 seconds |
| Expose MCP server | Edit `workers_dev = true` + deploy | ~15 seconds |
| Check current mode | `grep workers_dev packages/mcp-server/wrangler.toml` | Instant |

**The web demo never goes down. The toggle only affects external access.**

---

*Document version: 1.0*
*Branch: plan/mcp-portal-integration*
