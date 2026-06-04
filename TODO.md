## Active

- [ ] **Fix Portal tool execution** — Returns `Tool Server not found` or `Invalid tool name format`
  - Portal discovers 5 tools but cannot route calls to them
  - Tool name format: tried `mcp-demo_get_weather`, `get_weather`, `mcp-demo-server_get_weather`
  - May need browser OAuth to enable server in Portal (service token API auth != browser session)
  - Direct server calls work fine — issue is Portal proxy layer

- [ ] **Fix Portal service token auth** — Returns `invalid_token` despite policy configured
  - Service token `076ee7885452696502b0e36d4ab7753d.access` in Service Auth policy
  - Policy exists in `mcp-demo-portal` Access app but token rejected
  - May need to re-verify token is explicitly selected (not just created)
  - May need to recreate token and update policy

- [ ] **Secure direct MCP server** — `mcp-server.jsherron.com` publicly accessible
  - Add Cloudflare Access app for `mcp-server.jsherron.com`
  - Add Service Auth policy (allow service token only)
  - Add Block policy for everything else

## Completed

- [x] Rename Workers: `mcp-demo-app` and `mcp-demo-server`
- [x] Deploy MCP server with public custom domains: `mcp-server.jsherron.com`, `mcp.jsherron.com`
- [x] Register MCP server in Cloudflare MCP Portal (shows Ready, 5 tools)
- [x] Build CLI traffic generator: `tools/mcp-portal-client.js` with SSE parsing, session tracking, debug mode
- [x] Portal session initializes successfully (returns `cloudflare-mcp-portal` + session ID)
- [x] Change MCP server from stateless JSON to stateful SSE mode for Portal compatibility
- [x] Direct MCP server fully functional at `mcp-server.jsherron.com/mcp`
- [x] AI Orchestrator still works via Service Binding (unchanged)

## Known Issues

| Issue | Symptom | Likely Cause |
|-------|---------|-------------|
| Portal tool routing | `Tool Server mcp-demo_get_weather not found` | Server not enabled in Portal UI, or name format mismatch |
| Service token auth | `invalid_token` | Token not properly linked to Access app policy, or token rotated |
| Public direct server | No auth required | No Access app configured for `mcp-server.jsherron.com` |

## Next Session Priorities

1. **Verify service token** — Check Cloudflare Dashboard → Zero Trust → Access → Service Auth. Ensure token `076ee7885452696502b0e36d4ab7753d.access` is active and explicitly included in `mcp-demo-portal` app policy.
2. **Enable server in Portal UI** — Open Portal in browser, authenticate with GitHub OAuth, toggle `mcp-demo` server ON. Service token API auth and browser auth are separate contexts.
3. **Retest tool calls** — After browser enablement, run `node tools/mcp-portal-client.js --list` to see if 5 demo tools appear.
4. **Secure direct server** — Create Access app for `mcp-server.jsherron.com` with Service Auth allow + Block everyone else.

## Key Context

- **Portal endpoint:** `https://mcp-portal.jsherron.com/mcp`
- **Direct server:** `https://mcp-server.jsherron.com/mcp`
- **AI Orchestrator:** `https://mcp-demo.jsherron.com`
- **Access team:** `cf-jsherron-test-account`
- **Service token ID:** `076ee7885452696502b0e36d4ab7753d.access`
- **Account ID:** `1ddebf6f9507d3fc9052158be9d42dee`
- **Zone ID:** `6bcf8859da225392d8fae3351eb5de3e`
