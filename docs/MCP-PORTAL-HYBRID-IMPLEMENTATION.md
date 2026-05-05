# MCP Portal Hybrid Integration - Implementation Plan

## Goal
Enable Cloudflare MCP Portal to access our MCP server via HTTP while preserving the existing Service Binding path for internal AI Orchestrator traffic.

```
┌─────────────────────────────────────────────────────────────┐
│  AI Orchestrator (Worker)                                   │
│  • Internal path: Service Binding → MCP Server (FAST)      │
│  • External path: Not applicable (Orchestrator is public)   │
└──────────────┬──────────────────────────────────────────────┘
               │ Service Binding (zero latency)
┌──────────────┴──────────────────────────────────────────────┐
│  MCP Server (Worker)                                        │
│  • Receives Service Binding calls from AI Orchestrator     │
│  • Receives HTTP calls from MCP Portal (via Access)        │
│  • Same code, same endpoint: POST /mcp                     │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTPS (public, Access-protected)
┌──────────────┴──────────────────────────────────────────────┐
│  Cloudflare MCP Portal                                      │
│  • Registered with MCP server URL                           │
│  • Provides discovery, governance, analytics                │
│  • Users authenticate via Portal → Access → MCP Server     │
└─────────────────────────────────────────────────────────────┘
```

---

## Changes Required

### Summary

| Component | Change | Impact |
|-----------|--------|--------|
| MCP Server | `workers_dev = true` | Enables public URL for Portal |
| AI Orchestrator | None | Service Binding continues working |
| Portal | Register server URL | Discovery and governance |

> 🔒 **Kill Switch:** You can hide the MCP server anytime by changing `workers_dev = false`. The web demo keeps running. See [MCP Server Toggle Guide](./MCP-SERVER-TOGGLE-GUIDE.md) for details.

---

### 1. MCP Server - Add Public Route

**File:** `packages/mcp-server/wrangler.toml`

Currently:
```toml
workers_dev = false  # Private only
```

Change to:
```toml
# Enable public access for MCP Portal integration
# Keep Service Binding for internal AI Orchestrator traffic
workers_dev = true

# This server supports TWO access paths:
# 1. Internal: AI Orchestrator → Service Binding (zero latency)
# 2. External: MCP Portal → HTTPS → this Worker (for governance/analytics)
```

This is the **only code change required**. The MCP server will now be accessible at:
- **Internal:** `env.MCP_SERVER.fetch()` (Service Binding, zero latency) ← **unchanged**
- **External:** `https://mcp-demo-server.jsherron.workers.dev/mcp` (HTTPS for Portal) ← **new**

> **Toggle:** See [MCP Server Toggle Guide](./MCP-SERVER-TOGGLE-GUIDE.md) for switching between public/private modes.

---

**In Cloudflare Dashboard:**
1. Go to **Zero Trust → Access → Applications**
2. Click **Add an application** → **Self-hosted**
3. Configure:
   - **Application Name:** MCP Demo Server
   - **Domain:** `mcp-server.jsherron.com` (or workers.dev equivalent)
   - **Session Duration:** 24 hours
4. Add Access Policy:
   - **Name:** Allow GitHub Users
   - **Action:** Allow
   - **Include:** Everyone (or specific emails)
   - **Identity Providers:** GitHub (match existing AI Orchestrator setup)

This ensures only authenticated users can reach the MCP server directly.

### 3. MCP Portal Registration

**In Cloudflare Dashboard:**
1. Navigate to **MCP Portal** (Zero Trust → Access controls → AI controls → MCP Portals)
2. Click **Add a server** or **Create portal**
3. Enter MCP server details:
   - **Name:** MCP Demo Server
   - **HTTP URL:** `https://mcp-server.jsherron.com/mcp` (or workers.dev URL)
   - **Authentication:** Select "Self-hosted Access application" (if using Access)
   - Or "Unauthenticated" (if just testing, not recommended for production)
4. Save and verify connection

### 4. AI Orchestrator - No Changes Needed

The AI Orchestrator continues using `env.MCP_SERVER.fetch()` via Service Binding. Zero latency, no auth overhead.

**File:** `packages/ai-orchestrator/src/index.ts`
```typescript
// UNCHANGED - Service Binding for internal traffic
const result = await callMCPToolWithSession(
  env.MCP_SERVER,  // <-- Still using Service Binding
  null, 
  'calculator', 
  { operation, a, b }
);
```

---

## Architecture Comparison

| Path | Connection | Latency | Auth | Use Case |
|------|-----------|---------|------|----------|
| **Internal** | Service Binding | ~0ms | Implicit (Cloudflare internal) | AI Orchestrator → Tools |
| **External** | HTTPS via Portal | ~50-200ms | OAuth/Access JWT | External clients, governance, audit |

---

## Testing Strategy

### Phase 1: Verify Internal Path (No Regression)
1. Deploy MCP server with new route
2. Verify AI Orchestrator still works via Service Binding:
   - Ask "What is 25 * 4?" → Calculator tool via binding
   - Ask "Weather in London?" → Weather tool via binding
3. Confirm zero latency change

### Phase 2: Verify Public Endpoint
1. Test MCP server health via public URL:
   ```bash
   curl https://mcp-server.jsherron.com/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
   ```
2. Expect 401 or redirect if Access is enabled (good!)
3. Test with Access token:
   ```bash
   curl https://mcp-server.jsherron.com/mcp \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -d '{...}'
   ```

### Phase 3: Verify MCP Portal Integration
1. Check Portal dashboard shows server as "Connected"
2. Use Portal's test/ping feature
3. View tool catalog in Portal - should show calculator, get_weather, echo, random_fact
4. Check Portal analytics for request volume

### Phase 4: End-to-End via Portal
1. From an external MCP client (or Portal's built-in tester):
   - Connect to Portal URL
   - Call calculator tool
   - Verify request flows: Client → Portal → Access → MCP Server
2. Check logs in all layers:
   - Portal request logs
   - Access audit logs
   - MCP server logs (observability)

### Phase 5: Verify Both Paths Simultaneously
1. Send requests through both paths:
   - **Path A:** Web UI → AI Orchestrator → Service Binding → MCP Server
   - **Path B:** External client → MCP Portal → HTTPS → MCP Server
2. Confirm both succeed independently
3. Check that internal path is faster (no extra hop)

---

## Rollback Plan

If anything breaks:

1. **Remove route from MCP server wrangler.toml**
   ```toml
   # Comment out or delete:
   # routes = [
   #   { pattern = "mcp-server.jsherron.com", custom_domain = true }
   # ]
   ```

2. **Restore `workers_dev = false`** (if changed)

3. **Delete Portal registration** (optional)

4. **Remove Access application** (optional)

5. **Deploy MCP server**
   ```bash
   cd packages/mcp-server && wrangler deploy
   ```

**Rollback time:** < 5 minutes

---

## Files to Modify

| File | Change | Status |
|------|--------|--------|
| `packages/mcp-server/wrangler.toml` | Add public route | Ready |
| `packages/ai-orchestrator/src/index.ts` | No changes needed | N/A |
| `packages/ai-orchestrator/wrangler.toml` | No changes needed | N/A |

**New files:**
- `docs/MCP-PORTAL-HYBRID-IMPLEMENTATION.md` (this document)
- `docs/MCP-PORTAL-TESTING.md` (detailed test procedures)

---

## Deployment Order

1. ✅ Update MCP server wrangler.toml (add route)
2. ✅ Deploy MCP server: `cd packages/mcp-server && wrangler deploy`
3. ✅ Configure DNS for custom domain (if using)
4. ✅ Create Cloudflare Access application
5. ✅ Register server in MCP Portal
6. ✅ Run test suite (Phase 1-5)
7. ⏳ **Await approval before merging to main**

---

## Open Questions Before Deploy

1. **Domain:** Should we use `mcp-server.jsherron.com` or enable `workers_dev = true` for simplicity?
2. **Auth:** Should MCP server be unauthenticated (easier testing) or Access-protected (more realistic)?
3. **Portal Auth:** If server is Access-protected, does Portal need admin credentials to connect?

*Document version: 1.0*
*Branch: plan/mcp-portal-integration*
