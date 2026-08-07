#!/bin/bash
cd /Users/jsherron/src/mcp-demo-cloudflare/packages/mcp-server
/Users/jsherron/src/mcp-demo-cloudflare/node_modules/.bin/wrangler dev --port 8787 > /tmp/mcp-server.log 2>&1 &
echo $! > /tmp/mcp-server.pid
