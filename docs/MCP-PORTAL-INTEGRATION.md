# Cloudflare MCP Portal Integration Plan

## Executive Summary

This document outlines a plan to integrate **Cloudflare MCP Portal** (managed MCP service) into our existing MCP demo application. The goal is to leverage Cloudflare's managed MCP infrastructure while preserving our AI Gateway, Workers AI, and web UI investments.

**Current State:** Custom MCP server (private Worker) + AI Orchestrator with Service Bindings
**Target State:** Cloudflare MCP Portal manages tool registration/routing + AI Orchestrator connects via Portal

---

## 1. Architecture Comparison

### Current Architecture (Custom MCP)

```
┌─────────────────────────────────────────────┐
│  User (Browser)                             │
└──────────────┬──────────────────────────────┘
               │ HTTPS
┌──────────────┴──────────────────────────────┐
│  AI Orchestrator (Worker)                   │
│  • Workers AI + AI Gateway                  │
│  • Service Binding → MCP Server             │
└──────────────┬──────────────────────────────┘
               │ Service Binding (internal)
┌──────────────┴──────────────────────────────┐
│  MCP Server (Worker)                        │
│  • Custom MCP protocol implementation       │
│  • Tools: calculator, get_weather, echo     │
│  • Private (workers_dev = false)            │
└─────────────────────────────────────────────┘
```

### Proposed Architecture (MCP Portal Integration)

```
┌──────────────────────────────────────────────────────────────┐
│  User (Browser)                                              │
└──────────────┬───────────────────────────────────────────────┘
               │ HTTPS
┌──────────────┴───────────────────────────────────────────────┐
│  AI Orchestrator (Worker)                                    │
│  • Workers AI + AI Gateway (unchanged)                       │
│  • MCP Client connects to Portal (BINDING or FETCH)          │
└──────────────┬───────────────────────────────────────────────┘
               │ Service Binding (preferred) OR HTTPS
┌──────────────┴───────────────────────────────────────────────┐
│  Cloudflare MCP Portal                                       │
│  • Managed MCP server registry                               │
│  • Authentication & authorization                            │
│  • Request routing to tool handlers                          │
│  • Analytics & observability                                 │
└──────────────┬───────────────────────────────────────────────┘
               │ Service Binding (preferred) OR Fetch
┌──────────────┴───────────────────────────────────────────────┐
│  MCP Server (Worker) - RENAMED/REPURPOSED                    │
│  • Option A: Tool Handlers (stateless functions)             │
│  • Option B: Keep as MCP server, Portal proxies to it        │
│  • Option C: Migrate tools to Portal-native format           │
└───────────────────────────────────────────────────────────────┘
```

> ⚠️ **CRITICAL ARCHITECTURAL CONCERN:** Service Bindings provide zero-latency, internal communication that never leaves Cloudflare's edge. Replacing them with `fetch()` calls introduces network hops, latency, and authentication complexity. The ideal integration preserves Service Bindings where possible. See Section 2.4 for analysis.

---

## 2. Integration Approaches

We have three viable approaches, ordered by complexity:

### Approach A: Portal as Proxy (Easiest, Recommended for Demo)

**Concept:** Keep our custom MCP server exactly as-is. Register it with MCP Portal. Portal handles external client connections and proxies authenticated requests to our server.

**Changes Needed:**
- Register `mcp-demo-server` in MCP Portal
- Update AI Orchestrator to connect via Portal URL instead of Service Binding
- Add Portal authentication headers to MCP requests
- Keep existing MCP server Worker unchanged

**Pros:**
- Minimal code changes
- Shows Portal's auth/routing capabilities immediately
- Easy to revert
- Our MCP server stays private (Portal provides the public face)

**Cons:**
- Extra network hop (latency)
- Not leveraging Portal's full potential (just using as proxy)

**Estimated Effort:** 1-2 days

---

### Approach B: Portal-Native Tools (Medium Complexity)

**Concept:** Migrate our tool implementations to Cloudflare MCP Portal's native format. Each tool becomes a separate Worker or Durable Object registered with the Portal.

**Changes Needed:**
- Refactor tools from monolithic MCP server into individual handlers
- Register each tool with MCP Portal registry
- Update tool schemas to Portal format
- AI Orchestrator uses Portal client SDK to discover and call tools
- Remove custom MCP server Worker entirely

**Pros:**
- Leverages full Portal feature set (per-tool analytics, independent scaling)
- Each tool can have its own auth policy
- Portal handles MCP protocol entirely
- Most "Cloudflare-native" approach

**Cons:**
- More refactoring required
- Need to understand Portal's specific API/format
- May lose some custom MCP protocol features

**Estimated Effort:** 3-5 days

---

### Approach C: Hybrid Model (Most Flexible)

**Concept:** Use Portal for external/public access and keep Service Bindings for internal/AI Orchestrator traffic.

**Changes Needed:**
- Register MCP server with Portal for external access
- AI Orchestrator keeps Service Binding for fast internal calls
- Add conditional routing: external → Portal, internal → direct binding
- Portal provides analytics for external traffic

**Pros:**
- Best of both worlds
- Internal traffic stays fast (no extra hop)
- External users get Portal benefits (auth, analytics)
- Good for production scenarios

**Cons:**
- More complex architecture
- Two paths to maintain

**Estimated Effort:** 2-3 days

---

### Approach D: Service Binding-First Integration (RECOMMENDED - Architecture Preservation)

**Concept:** Use MCP Portal for **discovery, registry, and external analytics** while keeping **Service Bindings for actual tool execution**. This gives us Portal's dashboard and management features without sacrificing performance.

**How it works:**
1. Register our MCP server in Portal (for catalog visibility and external access)
2. AI Orchestrator queries Portal for tool discovery/schema validation
3. AI Orchestrator calls tools via **existing Service Binding** (fast, internal)
4. Portal receives telemetry/logs for dashboard display (async, out-of-band)

**Changes Needed:**
- Register `mcp-demo-server` in MCP Portal
- Add optional Portal telemetry reporting to MCP server
- Keep `env.MCP_SERVER.fetch()` exactly as-is for tool execution
- Optionally query Portal for tool schema discovery

**Pros:**
- ✅ **Preserves Service Bindings** (zero-latency internal calls)
- ✅ Gets Portal dashboard/analytics
- ✅ No performance regression
- ✅ MCP server stays completely private
- ✅ Can still expose tools externally via Portal if needed

**Cons:**
- Requires Portal to support telemetry-only or discovery-only modes
- Slightly more complex (two connections: binding + telemetry)

**Estimated Effort:** 1-2 days

**Verdict:** This is the best approach if Cloudflare MCP Portal supports it.

---

## 2.4 The Service Binding vs. Fetch() Problem

You caught an important issue in the original plan. Here's the analysis:

### Why Service Bindings Matter

| Metric | Service Binding | `fetch()` to Portal |
|--------|----------------|---------------------|
| **Latency** | ~0ms (same colo) | ~50-200ms (internet) |
| **Reliability** | Never leaves Cloudflare edge | Subject to internet conditions |
| **Security** | Internal, no auth tokens needed | Requires auth headers, TLS |
| **Rate Limits** | No external rate limits | Subject to API rate limits |
| **Cost** | Free (internal traffic) | May incur egress/ingress |
| **Error 1042** | Avoided automatically | Risk if using workers.dev |

### How MCP Portal Might Support Bindings

Cloudflare MCP Portal could support Service Bindings in several ways:

**Option 1: Portal exposes a Worker binding**
```toml
[[services]]
binding = "MCP_PORTAL"
service = "mcp-portal"  # If Portal is a Worker service
```
AI Orchestrator calls `env.MCP_PORTAL.fetch()` instead of `fetch()`.

**Option 2: MCP Server reports to Portal (telemetry only)**
```typescript
// MCP Server keeps Service Binding
// But also sends analytics to Portal
await fetch('https://mcp-portal.cloudflare.com/telemetry', {
  method: 'POST',
  body: JSON.stringify(toolCallMetrics)
});
```

**Option 3: Portal as optional external access layer**
```
Internal path (fast):     AI Orchestrator → Service Binding → MCP Server
External path (managed):  External Client → MCP Portal → MCP Server
```
Both paths work simultaneously.

### Updated Recommendation

**Try Approach D first (Service Binding-First).** Only fall back to fetch()-based approaches if Portal truly requires it.

---

## 3. Detailed Implementation Plan (Approach D - Service Binding-First)

### Phase 1: Discovery & Setup (Day 1)

1. **Access MCP Portal**
   - Log into Cloudflare Dashboard
   - Navigate to new MCP Portal section (likely under Workers or AI)
   - Verify account has MCP Portal access (may require beta/early access)

2. **Register MCP Server**
   - Create new MCP server entry in Portal
   - Name: `mcp-demo-server`
   - Provide tool schemas (calculator, get_weather, echo, random_fact)
   - Note the Portal server ID and any API endpoints

3. **Determine Binding Support**
   - **CRITICAL:** Check if MCP Portal exposes a Worker Service Binding
   - If yes: Add Service Binding to `mcp-demo-server` or `mcp-portal` service
   - If no: Mark for fetch()-based fallback (see Phase 3)

### Phase 2: Preserve Service Bindings (Day 1)

**File: `packages/ai-orchestrator/src/index.ts`**

Keep existing Service Binding code:
```typescript
// KEEP THIS - Service Binding is fast and internal
const mcpResponse = await env.MCP_SERVER.fetch(/* ... */);
```

If Portal provides a binding for discovery:
```typescript
// OPTIONAL - Query Portal for tool schemas (only if needed)
const toolSchema = await env.MCP_PORTAL.fetch('/tools/calculator/schema');
```

**File: `packages/ai-orchestrator/wrangler.toml`**

```toml
# KEEP existing Service Binding
[[services]]
binding = "MCP_SERVER"
service = "mcp-demo-server"

# ADD Portal binding IF supported (discovery/telemetry)
# [[services]]
# binding = "MCP_PORTAL"
# service = "mcp-portal"
```

### Phase 3: Add Portal Telemetry (Fallback if No Binding)

If Portal does NOT support Service Bindings, we add telemetry reporting while keeping the binding for execution:

**File: `packages/mcp-server/src/index.ts`**

Add optional telemetry reporting:
```typescript
// After handling a tool call, report to Portal
if (env.MCP_PORTAL_URL) {
  fetch(env.MCP_PORTAL_URL + '/telemetry', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.MCP_PORTAL_TOKEN}` },
    body: JSON.stringify({
      server: 'mcp-demo-server',
      tool: toolName,
      duration: Date.now() - startTime,
      success: !error
    })
  }).catch(() => {}); // Fire and forget
}
```

**File: `packages/mcp-server/wrangler.toml`**

Keep private:
```toml
workers_dev = false  # Remains private, accessed only via Service Binding
```

### Phase 4: Fetch-Based Fallback (Only if Required)

If Portal mandates all traffic go through it:

**File: `packages/ai-orchestrator/src/index.ts`**

```typescript
// FALLBACK ONLY - if Portal requires fetch()
const MCP_PORTAL_URL = env.MCP_PORTAL_URL || 'https://mcp-portal.cloudflare.com/v1/servers/mcp-demo';

const mcpResponse = await fetch(MCP_PORTAL_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.MCP_PORTAL_TOKEN}`,
  },
  body: JSON.stringify(mcpRequest),
});
```

**Trade-offs:**
- ❌ Loses zero-latency Service Binding
- ❌ Adds authentication overhead
- ✅ Gets full Portal analytics
- ✅ External clients can access tools

### Phase 5: Testing & Validation (Day 2)

1. **Unit Tests**
   - Update mock in `ai-orchestrator` tests to simulate Portal responses
   - Add tests for Portal authentication flow
   - Verify tool calling still works end-to-end

2. **Integration Tests**
   - Deploy to staging
   - Test each tool via Portal:
     - Calculator: "What is 25 * 4?"
     - Weather: "What's the weather in Tokyo?"
     - Echo: "Echo hello"
     - Random fact: "Tell me a science fact"

3. **Dashboard Verification**
   - Check Cloudflare MCP Portal dashboard for:
     - Server status (healthy/unhealthy)
     - Request volume
     - Tool call breakdown
     - Error rates
   - Verify AI Gateway still shows LLM calls

---

## 4. File Changes Summary

### Modified Files (Approach D - Service Binding-First)

| File | Change | Reason |
|------|--------|--------|
| `packages/mcp-server/src/index.ts` | Add optional Portal telemetry reporting | Send metrics to Portal dashboard without losing bindings |
| `packages/ai-orchestrator/wrangler.toml` | Add optional `MCP_PORTAL` Service Binding | If Portal exposes a Worker binding |
| `packages/mcp-server/wrangler.toml` | No changes | Stays private, accessed via existing binding |
| `packages/ai-orchestrator/src/index.ts` | No changes to core logic | Keeps `env.MCP_SERVER.fetch()` |

### Modified Files (Fallback - Fetch-Based, Only if Required)

| File | Change | Reason |
|------|--------|--------|
| `packages/ai-orchestrator/src/index.ts` | Add `fetch()` path to Portal | Route traffic through Portal |
| `packages/ai-orchestrator/wrangler.toml` | Remove Service Binding, add Portal vars | Configuration |
| `packages/ai-orchestrator/src/__tests__/*.ts` | Update mocks for Portal responses | Test compatibility |
| `.github/workflows/deploy.yml` | Add Portal token secret | CI/CD auth |

### New Files

| File | Purpose |
|------|---------|
| `docs/MCP-PORTAL-INTEGRATION.md` | This plan document |
| `packages/ai-orchestrator/src/mcp-portal-client.ts` | Portal client wrapper (optional abstraction) |
| `scripts/setup-portal.sh` | One-time Portal registration script |

---

## 5. Configuration & Secrets

### Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `MCP_PORTAL_URL` | `wrangler.toml` [vars] | Portal API endpoint |
| `MCP_PORTAL_TOKEN` | Wrangler secret | Authentication token |

### GitHub Secrets (CI/CD)

| Secret | Purpose |
|--------|---------|
| `MCP_PORTAL_TOKEN` | Deploy-time auth for Portal verification |

---

## 6. Rollback Plan

### Approach D (Service Binding-First) Rollback:
If issues arise, rollback is trivial:

1. **Disable telemetry reporting**
   - Remove or comment out the Portal telemetry `fetch()` call in MCP server
   - Service Binding calls are unchanged

2. **No deployment needed for core functionality**
   - AI Orchestrator needs zero changes
   - MCP server still works exactly as before

**Rollback time:** < 1 minute (just stop sending telemetry)

### Fetch-Based Rollback (if implemented):
If you had to switch to fetch() and want to revert:

1. **Restore `ai-orchestrator/src/index.ts`**
   - Restore `env.MCP_SERVER.fetch()` calls
   - Remove Portal URL/token references

2. **Restore `ai-orchestrator/wrangler.toml`**
   - Restore Service Binding configuration
   - Remove Portal vars

3. **Update deployment**
   - Deploy reverted AI Orchestrator
   - MCP server Worker needs no changes

**Rollback time:** < 5 minutes

---

## 7. Post-Integration Dashboard Views

After integration, you'll be able to show:

### Cloudflare MCP Portal Dashboard
- **Server Health:** Status of `mcp-demo-server`
- **Request Volume:** Traffic over time
- **Tool Breakdown:** Which tools are called most
- **Error Rates:** Failed requests by tool
- **Latency:** Response times per tool

### Cloudflare AI Gateway Dashboard (unchanged)
- **LLM Requests:** AI calls with tool definitions
- **Cache Performance:** Hit/miss rates
- **Token Usage:** Input/output tokens
- **Cost Analytics:** Estimated costs

### Combined View (Approach D - Service Binding-First)
```
User Request
     ↓
[AI Orchestrator] ──AI Gateway──→ [Workers AI]
     │                                    │
     │         Tool call needed?          │
     │◄───────────────────────────────────┘
     │
     ├──Service Binding──→ [MCP Server]──→ [Tools]
     │                           ↑
     │                           │
     └──── Telemetry ────────────┘
           (async, optional)
           ↓
    [MCP Portal Dashboard]
```

### Combined View (Fetch-Based Fallback)
```
User Request
     ↓
[AI Orchestrator] ──AI Gateway──→ [Workers AI]
     │                                    │
     │         Tool call needed?          │
     │◄───────────────────────────────────┘
     │
     └──HTTP fetch──→ [MCP Portal]──→ [MCP Server]──→ [Tools]
          │                              │
          └──── Analytics ───────────────┘
```

---

## 8. Open Questions

Before implementation, we should clarify:

1. **Portal Access:** Is Cloudflare MCP Portal available on our account? (May require beta access)
2. **Pricing:** What are the costs for Portal requests vs. our current setup?
3. **Protocol Version:** Does Portal support MCP 2024-11-05 or require an older/newer version?
4. **🔴 Service Bindings (CRITICAL):** Can Portal connect to private Workers via Service Binding? Does Portal itself expose a Worker service that can be bound to? **This determines whether we use Approach D or are forced into fetch().**
5. **Authentication:** What auth mechanism does Portal use? (API tokens, OAuth, mTLS?)
6. **Tool Registration:** Is it automatic discovery or manual schema upload?
7. **Streaming:** Does Portal support streaming MCP responses?
8. **Telemetry Only:** Does Portal support a "report-only" mode where we keep direct execution but send metrics to the dashboard?

---

## 9. Recommendation

**Proceed with Approach D (Service Binding-First Integration)** because:

- ✅ **Preserves Service Bindings** (zero-latency, internal, no auth overhead)
- ✅ Gets Portal dashboard/analytics/observability
- ✅ No performance regression
- ✅ MCP server stays private
- ✅ Easy to add external Portal access later if needed
- ✅ Minimal code changes

**Only fall back to fetch()-based approaches if Cloudflare MCP Portal explicitly requires it and provides no binding alternative.**

**Next Steps:**
1. Review and approve this plan
2. Verify MCP Portal access in Cloudflare Dashboard
3. **Determine if Portal supports Service Bindings** (critical decision point)
4. If yes: Implement Approach D (telemetry reporting only)
5. If no: Decide between fetch() fallback or staying with current architecture
6. Deploy to production

---

*Plan created: 2026-05-04*
*Branch: `plan/mcp-portal-integration`*

## Appendix A: Decision Tree

```
Can you access Cloudflare MCP Portal?
├── No → Stop. Portal not available. Keep current architecture.
│
└── Yes → Continue
    │
    ├── Does Portal expose a Worker Service Binding?
    │   ├── YES → Use Approach D (Service Binding-First)
    │   │         • Register server in Portal
    │   │         • Keep env.MCP_SERVER.fetch()
    │   │         • Optionally add Portal binding for discovery
    │   │         • ✅ Best performance, best architecture
    │   │
    │   └── NO → Continue
    │       │
    │       ├── Does Portal support telemetry/report-only mode?
    │       │   ├── YES → Use Approach D variant
    │       │   │         • Keep Service Bindings for execution
    │       │   │         • Add telemetry reporting to MCP server
    │       │   │         • ✅ Good performance + Portal analytics
    │       │   │
    │       │   └── NO → Use Approach A (Portal as Proxy via fetch)
    │       │             • Replace Service Binding with fetch()
    │       │             • Full Portal integration
    │       │             • ⚠️ Performance cost, but full features
    │       │
    │       └── Is fetch() performance acceptable for your use case?
    │           ├── YES → Proceed with fetch()
    │           └── NO → Keep current architecture, revisit later
    │
    └── Does Portal require replacing Service Bindings?
        ├── YES → See "NO" path above
        └── NO → See "YES" path above
```
