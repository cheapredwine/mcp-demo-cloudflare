# MCP Server Access Control Guide

_Previously "MCP Server Visibility Toggle Guide" — the `workers_dev` toggle
approach is retired. This document now describes how external access is actually
controlled._

## How access is controlled today

The MCP server has **two independent access paths**:

### Path 1: Internal (AI Orchestrator) — always works
- AI Orchestrator → **Service Binding** → MCP server.
- Stays inside Cloudflare's edge, bypasses Access by design, zero latency.
- Unaffected by any external access change below.

### Path 2: External (MCP clients / Portal) — Cloudflare Access
- `https://mcp-server.jsherron.com/mcp` is fronted by a Cloudflare **Access**
  application (AI controls "MCP server", OAuth).
- Unauthenticated requests get `401` with a `WWW-Authenticate` OAuth challenge.
- `workers_dev = false` and there is **no** `mcp.jsherron.com` alias, so there is
  no unauthenticated entry point.

> ⚠️ **Do not re-enable `workers_dev`.** A `*.workers.dev` hostname is not covered
> by the custom-domain Access app and would reopen an unauthenticated bypass.

## The actual "kill switch"

To take the MCP server offline for external clients, change the **Access policy**
or the **route** — not `workers_dev`:

| Goal | Action | Effect |
|------|--------|--------|
| Block all external users | Edit the `mcp-server` Access app policy → set to **Block** (or remove the Allow include) | External clients/Portal can't authenticate; internal Service Binding still works |
| Restrict to specific people | Access policy Include → **Emails**/domain | Only those identities pass |
| Fully remove the public endpoint | Remove the `mcp-server.jsherron.com` route from `packages/mcp-server/wrangler.toml` and `wrangler deploy` | Hostname stops serving the Worker; internal Service Binding still works |
| Pause Portal exposure only | AI controls → portal → disable the server, or AI controls → MCP servers → remove its Allow policy | Server no longer surfaced in the portal |

In every case the **web app keeps working**, because it reaches the MCP server
over the internal Service Binding, independent of the external Access path.

## Verify

```bash
# External endpoint should be 401 (Access) — or unreachable if you removed the route
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://mcp-server.jsherron.com/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# There must be no unauthenticated bypass
curl -s -o /dev/null -w "%{http_code}\n" https://mcp-demo-server.<sub>.workers.dev/mcp  # 404

# Web app (internal path) is unaffected — still serves behind its own Access app
curl -s -o /dev/null -w "%{http_code}\n" https://mcp-demo.jsherron.com/                  # 302
```

## Summary

| Want to… | Do this | Time |
|----------|---------|------|
| Block external access | Set the `mcp-server` Access policy to Block / remove Allow | seconds |
| Limit who can connect | Scope the Access policy Include | seconds |
| Remove the endpoint entirely | Drop the route in `wrangler.toml` + deploy | ~1 min |
| Keep internal app running | Nothing — Service Binding is always independent | — |

See `AGENTS.md` → "MCP Server Security" and `TODO.md` for the canonical state.
