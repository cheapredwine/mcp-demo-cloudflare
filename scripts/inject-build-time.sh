#!/bin/bash
# Inject build timestamp into the Worker before deployment

BUILD_TIME=$(date -u +"%Y-%m-%d %H:%M UTC")
FILE="packages/ai-orchestrator/src/index.ts"

# Replace the placeholder with actual build time
sed -i '' "s/BUILD_TIME = 'UNKNOWN'/BUILD_TIME = '$BUILD_TIME'/g" "$FILE"

echo "Build time injected: $BUILD_TIME"
