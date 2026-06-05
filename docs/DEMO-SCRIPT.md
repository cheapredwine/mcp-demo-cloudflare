# MCP Demo Script

## Overview

This script guides you through a live demo showing:
1. **Web App** — AI-powered chat with tool calling (internal Service Binding)
2. **Cloudflare Access** — both the web app and the MCP server require authentication at the edge
3. **MCP Portal** — external discovery and tool usage from any MCP client, via OAuth

**Demo duration:** ~10-15 minutes

> Current architecture: both public hostnames are behind Cloudflare Access.
> There is **no** `workers_dev`/unauthenticated path — that approach is retired.
> See `AGENTS.md` and `TODO.md` for the canonical state.

---

## Pre-Demo Setup (Do This Beforehand)

### 1. Confirm deployments

```bash
cd packages/mcp-server && wrangler deploy
cd ../ai-orchestrator && wrangler deploy   # CI injects the build timestamp
```

### 2. Confirm the security posture (no bypass routes)

```bash
# Web app → 302 to Access login
curl -s -o /dev/null -w "%{http_code}\n" https://mcp-demo.jsherron.com/            # 302
# MCP server → 401 Access OAuth challenge
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://mcp-server.jsherron.com/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'                  # 401
# Old bypasses are dead
curl -s -o /dev/null -w "%{http_code}\n" https://mcp-demo-server.<sub>.workers.dev/mcp # 404
```

### 3. Confirm the MCP server is registered + Ready in the Portal

Zero Trust → Access controls → **AI controls** → **MCP servers** → `mcp-server`
shows **Ready**. If not, Edit → **Authenticate server**, then **Sync capabilities**.

### 4. Pre-connect an MCP client (recommended)

Connect Workers AI Playground to the portal beforehand so the homepage shows
**Connected** during the demo (see Phase 3 for steps). Portal sessions last 24h
of inactivity.

### 5. Open browser tabs

- [ ] Web app: https://mcp-demo.jsherron.com/
- [ ] Cloudflare Dashboard → Zero Trust → AI controls (MCP servers + portal)
- [ ] Workers AI Playground: https://playground.ai.cloudflare.com/

---

## Demo Flow

### Phase 1: The Web App + Access login (3 minutes)

**Narrative:** "Our AI demo is gated by Cloudflare Access."

**Action:**
1. Open https://mcp-demo.jsherron.com/ in a fresh/incognito window.
2. You're redirected to the Access **One-time PIN** login → enter the allowed email → PIN → in.
3. Point out the three panels: Prompt | MCP Status | AI Response.

**Demo questions:**
- "What is 25 times 4?" → calculator tool, result 100
- "What's the weather in Tokyo?" → weather tool, simulated data
- "Tell me a fun fact about space" → direct AI response (no tool)

**Key message:** "Auth is enforced at the edge — zero auth code in the Worker. Tool calls run over an internal Service Binding: zero latency, fully private."

---

### Phase 2: The MCP server is Access-protected (2 minutes)

**Narrative:** "The MCP server itself isn't open to the internet."

**Action:** hit it unauthenticated and show the OAuth challenge:
```bash
curl -i -X POST https://mcp-server.jsherron.com/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
# 401 + WWW-Authenticate: Bearer realm="OAuth" ... resource_metadata=.../cloudflare-access-protected-resource
```

**Key message:** "Unauthenticated requests get a 401 OAuth challenge. There's no `workers.dev` bypass and no alias hostname — the only way in is through Access."

---

### Phase 3: MCP Portal discovery via OAuth (4 minutes)

**Narrative:** "Any MCP client can use these tools — after authenticating."

**Action (Workers AI Playground):**
1. https://playground.ai.cloudflare.com/ → **MCP Servers** → add `https://mcp-portal.jsherron.com/mcp` → **Connect**.
2. Popup → log in to Cloudflare Access (One-time PIN).
3. The popup lists upstream servers requiring auth → **Connect** `mcp-server` → **Done**.
4. Playground shows **Connected** and lists the tools (namespaced, e.g. `mcp-server_get_weather`).
5. Ask: "What's the weather in Paris?" → the model calls the tool through the portal.

**Optional:** reload the portal homepage (`https://mcp-portal.jsherron.com/`) — the session bar now shows **Connected** + your email.

**Key message:** "The portal centralizes discovery, governance, and audit logging. Clients authenticate with OAuth; the portal proxies to the upstream server."

> Note: the portal homepage has **no browser sign-in button**. "Disconnected"
> there is just the idle state — you connect by attaching an MCP client to
> `/mcp`, which runs the OAuth flow.

---

### Phase 4: Security story (2 minutes)

**Narrative:** "Everything external is behind Access; the internal path stays fast."

**Talking points:**
- Web app + MCP server each have their own Access application (web app: One-time PIN; MCP server: OAuth).
- No unauthenticated routes: `workers_dev = false`, no `mcp.jsherron.com` alias, `workers.dev` → 404.
- The AI Orchestrator reaches tools over an internal **Service Binding**, which bypasses Access by design (zero latency).
- Portal adds governance: per-tool enable/disable, aliases, audit logs, optional Gateway/DLP.

---

## Talking Points

### Architecture
- "Two paths to the same MCP server: internal Service Binding (fast, private) and external Access-protected HTTPS (governed)."
- "The Worker has zero auth logic — Cloudflare Access enforces identity at the edge."

### Standardization
- "MCP means any compatible client can discover and use our tools after auth — not just our web UI."

### Performance
- "Internal path: ~0ms. External path adds a hop through Access/Portal but stays usable."

---

## Troubleshooting During Demo

### Web app not loading / not prompting for login
- Confirm the `mcp-demo-app` Access application's domain is exactly `mcp-demo.jsherron.com` and it has an Allow policy + One-time PIN IdP.
- Test in incognito (an existing 24h session skips the login).

### Portal homepage shows "Disconnected"
- Expected when no client session is active. Connect a client (Phase 3); it then shows Connected. It is **not** a fault and there is no sign-in button on the page.

### Portal can't reach the server / "unable to refresh tools"
- AI controls → MCP servers → `mcp-server` must be **Ready**. If Error/Stale, Edit → **Authenticate server**, then **Sync capabilities**.

### Client login loops or denies
- Check the relevant Access application's Allow policy includes your identity and an IdP is enabled (web app: `mcp-demo-app`; portal: its auto-created Access app; server: `mcp-server`).

---

## Demo Checklist

- [ ] MCP server + AI Orchestrator deployed
- [ ] `mcp-server` shows **Ready** in AI controls
- [ ] Web app loads and prompts for Access login (incognito)
- [ ] Portal pre-connected via Playground (shows Connected)
- [ ] Verified bypass routes are closed (`workers.dev` → 404)

---

*Demo script — reflects the Access-protected, stateless-JSON architecture. See `AGENTS.md`/`TODO.md` for canonical state.*
