#!/bin/bash
cd /Users/jsherron/src/workers-mcp-demo/packages/workers-client
/Users/jsherron/src/workers-mcp-demo/node_modules/.bin/wrangler dev --port 8788 > /tmp/mcp-client.log 2>&1 &
echo $! > /tmp/mcp-client.pid
