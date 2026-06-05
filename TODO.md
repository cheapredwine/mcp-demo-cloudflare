# Project State & Handoff

_Last updated: end of the Access/MCP hardening session._

## TL;DR

The MCP demo is deployed and **fully locked down**. Both the web app and the MCP
server are behind Cloudflare Access; all unauthenticated bypass routes are
closed. The MCP handshake bug that broke Portal/Playground/SDK clients is fixed.

## Current security posture (verified live)

| Endpoint | Status | Meaning |
|----------|--------|---------|
| `https://mcp-demo.jsherron.com/` (web UI) | `302` → Access login | Protected (One-time PIN) |
| `https://mcp-demo.jsherron.com/api/ask`, `/admin` | `302` | Protected (whole host) |
| `https://mcp-server.jsherron.com/mcp` | `401` OAuth challenge | Protected (Access MCP OAuth) |
| `https://mcp.jsherron.com/mcp` | `530` | Alias removed — no longer serves the Worker |
| `https://mcp-demo-server.<sub>.workers.dev/mcp` | `404` | `workers_dev = false` |

Internal path (AI Orchestrator → MCP server via Service Binding) is unchanged
and intentionally bypasses Access (zero latency).

## What changed this session (code)

- **`packages/mcp-server/src/index.ts`** — Fixed the core bug. The Streamable
  HTTP transport was in **stateful** mode (`sessionIdGenerator` set) on a
  per-request Worker with no shared memory, so every request after `initialize`
  failed session validation (400/404). Real MCP clients (Portal, Playground,
  Inspector, SDK) died right after the handshake while one-shot curl
  `initialize` appeared to work. Now: `sessionIdGenerator: undefined` (stateless)
  + `enableJsonResponse: true` (avoids an SSE/`server.close()` race), and all
  `/mcp` methods (POST/GET/DELETE) route to the transport.
- **`packages/mcp-server/wrangler.toml`** — `workers_dev = false`; removed the
  `mcp.jsherron.com` route (was an unauthenticated alias to the same Worker).
- **`packages/ai-orchestrator/src/index.ts`** — removed the "Cloudflare Access
  auth enabled" UI badge + its CSS.
- **`packages/mcp-server/src/__tests__/index.test.ts`** — updated the routing
  assertion to match the new handler. All 84 tests pass.
- **`tools/mcp-portal-client.js`** — removed Cloudflare Access **service-token**
  auth (`CF_ACCESS_CLIENT_ID/SECRET`). Service tokens are not used anymore.
- **Docs** — `AGENTS.md` updated (stateless JSON, single domain, OTP web-app
  auth, no service tokens); this file rewritten as the handoff.

## What changed this session (Cloudflare config, via API)

- **Web-app Access app** (`mcp-demo-app`, id `d8e84822-d158-4519-9ff1-1e3e02c6306e`):
  - Fixed the domain — it was guarding `mcp-demo-app.jsherron.com` (typo) while
    the Worker serves `mcp-demo.jsherron.com`. Now set to `mcp-demo.jsherron.com`.
  - Switched IdP from GitHub → **One-time PIN** (`e529bbec-62d9-46e6-abd6-01f6f1abbfcb`),
    `auto_redirect_to_identity = true`.
  - Policy: **Allow → `jsherron@cloudflare.com`** (unchanged, still attached).
- **MCP server** registered in Zero Trust → AI controls → MCP servers with
  `auth_type = oauth`; admin credential established by interactive login
  (account `jsherron@cloudflare.com`). This is what fixed "unable to refresh
  tools" — sync uses that admin credential.

## Open / next session

- [ ] **Commit + push** the working-tree changes (this session's work) — _in progress at handoff._
- [ ] **Delete the dangling `mcp.jsherron.com` DNS record** (currently returns
      `530`). Cosmetic; not a security issue.
- [ ] **Rotate the Cloudflare API tokens** used this session (`cfat_jFKoc3...`
      already appears dead; rotate/delete `cfat_9yim...`).
- [ ] **(Optional) Validate `Cf-Access-Jwt-Assertion` in the Worker** for
      defense-in-depth. Currently auth is enforced only at the edge, not
      re-checked in code. Per the secure-mcp-servers reference: verify JWT
      signature, issuer, and `POLICY_AUD`. Not required for the demo.
- [ ] **(Optional) Broaden Access policies** if other people need to demo:
      add their emails (Include → Emails) or your domain.
- [ ] **Stale planning docs** still reference `workers_dev = true` and the
      old toggle approach: `docs/MCP-SERVER-TOGGLE-GUIDE.md`,
      `docs/DEMO-SCRIPT.md`, `docs/MCP-PORTAL-*`. Update or mark superseded
      when convenient.

## Key context / IDs

- **Web app:** `https://mcp-demo.jsherron.com` (Access app `mcp-demo-app`, id `d8e84822-d158-4519-9ff1-1e3e02c6306e`)
- **MCP server:** `https://mcp-server.jsherron.com/mcp` (Access-protected, interactive OAuth)
- **Portal endpoint:** `https://mcp-portal.jsherron.com/mcp`
- **Access team:** `cf-jsherron-test-account`
- **OTP IdP ID:** `e529bbec-62d9-46e6-abd6-01f6f1abbfcb`
- **Account ID:** `1ddebf6f9507d3fc9052158be9d42dee`
- **Zone ID:** `6bcf8859da225392d8fae3351eb5de3e`

## Verify after any redeploy

```bash
# web app should 302 to Access; MCP server should 401; bypasses should be dead
curl -s -o /dev/null -w "%{http_code}\n" https://mcp-demo.jsherron.com/            # 302
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://mcp-server.jsherron.com/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'                  # 401
```
