#!/bin/bash
set -e

echo "=== MCP Integration Test Runner ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is already running
if curl -s http://127.0.0.1:8787/mcp -X POST -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{}' > /dev/null 2>&1; then
    echo -e "${GREEN}Using existing server at http://127.0.0.1:8787${NC}"
    SERVER_ALREADY_RUNNING=true
else
    echo -e "${YELLOW}Starting MCP server...${NC}"
    cd packages/mcp-server
    npx wrangler dev &
    SERVER_PID=$!
    cd ../..
    
    # Wait for server to be ready
    echo "Waiting for server to start..."
    ATTEMPTS=0
    MAX_ATTEMPTS=60
    while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
        if curl -s http://127.0.0.1:8787/mcp -X POST -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{}' > /dev/null 2>&1; then
            echo -e "${GREEN}Server is ready!${NC}"
            break
        fi
        ATTEMPTS=$((ATTEMPTS + 1))
        sleep 1
        echo -n "."
    done
    
    if [ $ATTEMPTS -eq $MAX_ATTEMPTS ]; then
        echo -e "${RED}Server failed to start within timeout${NC}"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
    
    SERVER_ALREADY_RUNNING=false
fi

# Run the integration tests
echo -e "${YELLOW}Running integration tests...${NC}"
npx vitest run --config vitest.integration.config.ts

# Cleanup
if [ "$SERVER_ALREADY_RUNNING" = false ]; then
    echo -e "${YELLOW}Stopping MCP server...${NC}"
    kill $SERVER_PID 2>/dev/null || true
fi

echo -e "${GREEN}Done!${NC}"
