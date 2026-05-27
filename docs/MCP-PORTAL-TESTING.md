# MCP Portal Testing Guide

## Pre-Deployment Checklist

Before making any changes, verify:
- [ ] You have Cloudflare MCP Portal access
- [ ] You can deploy Workers (`wrangler deploy` works)
- [ ] You have DNS control for `jsherron.com` (or can use workers.dev)
- [ ] AI Orchestrator is currently working (internal Service Binding path)

---

## Test Environment Setup

### Option A: Custom Domain (Recommended for Production Demo)

**MCP Server URL:** `https://mcp-server.jsherron.com/mcp`

Pros:
- Full Cloudflare Access integration
- WAF support
- Professional demo appearance

Cons:
- Requires DNS setup
- Takes time to propagate

### Option B: Workers.dev (Fastest for Testing)

**MCP Server URL:** `https://mcp-demo-server.jsherron.workers.dev/mcp`

Pros:
- Instant deployment (no DNS)
- Quick to test
- Easy to rollback

Cons:
- Workers.dev limitations (no WAF)
- Less realistic for enterprise demo

**For this demo, I recommend Option B first**, then migrate to Option A if needed.

---

## Step-by-Step Testing

### Step 1: Deploy MCP Server with Public Access

**File change:** `packages/mcp-server/wrangler.toml`

Change from:
```toml
workers_dev = false
```

To:
```toml
# Enable public access for MCP Portal
workers_dev = true
```

Deploy:
```bash
cd packages/mcp-server
wrangler deploy
```

**Expected result:** MCP server is now accessible at:
`https://mcp-demo-server.jsherron.workers.dev/mcp`

---

### Step 2: Verify Internal Path Still Works

The AI Orchestrator should still work via Service Binding. Test via web UI:

1. Visit https://mcp-demo.jsherron.com/
2. Ask: "What is 25 times 4?"
3. **Expected:** Answer = 100 (via calculator tool through Service Binding)
4. Ask: "What's the weather in Tokyo?"
5. **Expected:** Weather response (via get_weather tool through Service Binding)

**Pass criteria:** No regression in internal path

---

### Step 3: Verify Public Endpoint

Test the MCP server directly via HTTP:

```bash
# Test initialize endpoint
curl -X POST https://mcp-demo-server.jsherron.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'
```

**Expected response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": {
      "name": "mcp-demo-server",
      "version": "1.0.0"
    },
    "capabilities": {
      "tools": {},
      "resources": {}
    }
  }
}
```

**Pass criteria:** Returns valid MCP initialize response

---

### Step 4: Test Tool Call via Public Endpoint

```bash
# First initialize (stateless, so each request is independent)
curl -X POST https://mcp-demo-server.jsherron.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0"}
    }
  }'

# Then call calculator tool
curl -X POST https://mcp-demo-server.jsherron.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "calculator",
      "arguments": {
        "operation": "multiply",
        "a": 25,
        "b": 4
      }
    }
  }'
```

**Expected response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "25 × 4 = 100"
      }
    ]
  }
}
```

**Pass criteria:** Tool returns correct result

---

### Step 5: Register in MCP Portal

**In Cloudflare Dashboard:**
1. Go to **Zero Trust → Access controls → AI controls → MCP Portals**
2. Click **Add a server**
3. Fill in:
   - **Name:** MCP Demo Server
   - **HTTP URL:** `https://mcp-demo-server.jsherron.workers.dev/mcp`
   - **Description:** Demo MCP server with calculator, weather, echo, and random fact tools
   - **Authentication:** Select based on your preference:
     - "Unauthenticated" (easiest for testing)
     - "Self-hosted Access" (if you set up Access)
     - "OAuth" (if server implements OAuth)
4. Click **Save**

**Expected result:** Portal shows server status (may take a moment to verify)

---

### Step 6: Verify Portal Integration

**In MCP Portal dashboard:**
1. Check server status shows **"Connected"** or **"Healthy"**
2. View tool catalog - should list:
   - calculator
   - get_weather
   - echo
   - random_fact
   - get_traffic_log
3. Check if Portal shows a test interface

**Pass criteria:** Portal recognizes all tools

---

### Step 7: Test via MCP Portal

If Portal provides a test interface:
1. Select the "calculator" tool
2. Enter arguments: `{"operation": "add", "a": 10, "b": 20}`
3. Execute

**Expected result:** Response shows "10 + 20 = 30"

**Alternative:** Use Portal's API or connect an external MCP client to the Portal endpoint.

---

### Step 8: End-to-End Comparison Test

Run both paths simultaneously and compare:

**Path A: Internal (Service Binding)**
```bash
# Time the internal path via AI Orchestrator
curl -X POST https://mcp-demo.jsherron.com/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is 10 + 20?"}' \
  -w "\nTotal time: %{time_total}s\n"
```

**Path B: External (via Portal)**
```bash
# Time the external path via Portal
# (Requires Portal client endpoint - check Portal dashboard for URL)
curl -X POST <PORTAL_CLIENT_ENDPOINT> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"tool": "calculator", "arguments": {"operation": "add", "a": 10, "b": 20}}' \
  -w "\nTotal time: %{time_total}s\n"
```

**Expected:** Path A is significantly faster (<100ms) than Path B (>200ms)

---

### Step 9: Verify Analytics

**Check dashboards:**
1. **MCP Portal:** Request volume, tool breakdown, error rates
2. **Cloudflare Access:** (if enabled) Auth events, user access
3. **Workers AI Gateway:** LLM calls (unchanged)
4. **MCP Server Observability:** Worker logs in Cloudflare dashboard

**Pass criteria:** All dashboards show expected traffic

---

## Success Criteria

| Test | Criteria | Status |
|------|----------|--------|
| Internal path | AI Orchestrator → Service Binding → MCP Server works with zero regression | ⬜ |
| Public endpoint | Direct HTTP to MCP server returns valid responses | ⬜ |
| Portal registration | Server appears in Portal with all tools listed | ⬜ |
| Portal execution | Tool calls through Portal return correct results | ⬜ |
| Analytics | Portal dashboard shows request metrics | ⬜ |
| Performance | Internal path faster than Portal path | ⬜ |

---

## Troubleshooting

### "Connection refused" or 404
- Verify MCP server deployed successfully: `wrangler tail --name mcp-demo-server`
- Check URL is correct (including `/mcp` path)
- Ensure `workers_dev = true` in wrangler.toml

### 401 Unauthorized
- If using Access: ensure valid token/header
- If not using Access: check if Access policy is blocking

### Portal shows "Disconnected"
- Verify URL is reachable from internet (not localhost)
- Check if server responds to POST /mcp with valid MCP
- Review server logs for errors

### Tool calls fail through Portal
- Compare request format between direct HTTP and Portal
- Check if Portal modifies headers or body
- Verify server handles both paths identically

---

## Cleanup (If Needed)

To remove Portal integration:
```bash
# 1. Delete server from MCP Portal (via Dashboard)
# 2. Restore MCP server to private
cd packages/mcp-server
# Edit wrangler.toml: workers_dev = false
wrangler deploy
# 3. Verify AI Orchestrator still works via Service Binding
```

---

*Test document version: 1.0*
*Branch: plan/mcp-portal-integration*
