# MCP Portal Testing Guide

How to validate the MCP server and the MCP Portal in their current,
Access-protected configuration. The old `workers_dev = true` / unauthenticated
testing flow is retired.

## Pre-checks

- [ ] `wrangler deploy` works for both packages
- [ ] DNS control for `jsherron.com`
- [ ] AI Orchestrator works via the internal Service Binding (web app responds)
- [ ] You can complete the Cloudflare Access login (One-time PIN to the allowed email)

---

## 1. MCP server is deployed and Access-protected

The MCP server lives at `https://mcp-server.jsherron.com/mcp` with
`workers_dev = false` and a single custom-domain route (no `mcp.jsherron.com`).

```bash
# Expect 401 with an OAuth challenge (Access protecting the endpoint)
curl -i -X POST https://mcp-server.jsherron.com/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
# → HTTP/2 401, WWW-Authenticate: Bearer realm="OAuth" ... resource_metadata=.../cloudflare-access-protected-resource

# Expect 404 — the unauthenticated bypass is closed
curl -s -o /dev/null -w "%{http_code}\n" https://mcp-demo-server.<sub>.workers.dev/mcp
```

> A plain `curl` cannot complete the interactive OAuth flow, so `401` is the
> correct, expected result. Use a real MCP client (below) for end-to-end tests,
> or `cloudflared access curl` to attach a token.

---

## 2. Internal path (no regression)

The AI Orchestrator reaches tools over the Service Binding, independent of Access:

1. Visit https://mcp-demo.jsherron.com/ (log in via Access if prompted).
2. "What is 25 times 4?" → 100 (calculator).
3. "What's the weather in Tokyo?" → weather response.

Pass: web app works regardless of the MCP server's external Access state.

---

## 3. Register / verify the server in AI controls

Zero Trust → Access controls → **AI controls** → **MCP servers**:

1. The server's **HTTP URL** is `https://mcp-server.jsherron.com/mcp`, `auth_type = oauth`.
2. Status should be **Ready**. If **Error/Stale/Waiting**: Edit → **Authenticate
   server** (re-mint the admin credential), then three-dots → **Sync capabilities**.
3. The server must have an attached **Access policy** (Allow your identity), or it
   won't surface in the portal ("No allowed servers available").

Tools expected: `calculator`, `get_weather`, `echo`, `random_fact`, `get_traffic_log`.

---

## 4. Connect a client to the portal (end-to-end)

The portal is at `https://mcp-portal.jsherron.com/mcp`
(DNS: proxied CNAME → `gateway.agents.cloudflare.com`).

**Workers AI Playground:**
1. https://playground.ai.cloudflare.com/ → **MCP Servers** → add the portal `/mcp` URL → **Connect**.
2. Popup → log in to Cloudflare Access (One-time PIN).
3. Connect the `mcp-server` upstream when listed → **Done**.
4. Playground shows **Connected** and lists the tools (namespaced as `mcp-server_<tool>`).
5. Ask "What's the weather in Paris?" → tool call proxied through the portal.

**Config-file client (Claude Desktop, Cursor, etc.):**
```json
{
  "mcpServers": {
    "mcp-demo-portal": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "https://mcp-portal.jsherron.com/mcp"]
    }
  }
}
```
Use the `command`/`args` form, not `serverURL`.

---

## 5. Portal homepage status

- `https://mcp-portal.jsherron.com/` renders an info page; the session bar shows
  **Disconnected** until a client authenticates, then **Connected** + your email.
- "Disconnected" alone is **not** a fault and there is no browser sign-in button.
- Do not open `/mcp` directly in a browser — it returns an `invalid token` error
  by design; it's for MCP clients only.

---

## Success criteria

| Test | Criteria |
|------|----------|
| MCP server protected | Direct `/mcp` returns 401 OAuth; `workers.dev` returns 404 |
| Internal path | Web app tool calls work via Service Binding |
| Server registered | AI controls shows the server **Ready** with all 5 tools |
| Portal end-to-end | A client connects via OAuth and calls a tool successfully |
| Portal homepage | Flips to **Connected** after a client authenticates |

---

## Troubleshooting

- **Server stuck Waiting / "unable to refresh tools"** → reauthenticate the server in AI controls, then Sync capabilities; confirm the URL is reachable and Streamable HTTP.
- **"No allowed servers available"** → the server (and portal) each need an attached Access policy for your identity.
- **Client login loops/denies** → check the relevant Access app's Allow policy + enabled IdP.
- **Portal `522`** → DNS CNAME missing/incorrect (must be proxied → `gateway.agents.cloudflare.com`).
- **`mcp-remote` issues** → `npx -y mcp-remote@latest` to update; use `command`/`args`, not `serverURL`; `rm -rf ~/.mcp-auth` to clear cached creds.

See `AGENTS.md` and `TODO.md` for canonical state.
