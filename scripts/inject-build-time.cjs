#!/usr/bin/env node
// Inject build timestamp into the AI Orchestrator Worker before deployment.
// Cross-platform (no shell quoting hazards, no BSD/GNU sed differences).
const fs = require('fs');

const FILE = 'packages/ai-orchestrator/src/index.ts';
const buildTime = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

const src = fs.readFileSync(FILE, 'utf8');
if (!src.includes('BUILD_TIME = "UNKNOWN"')) {
  console.error('Placeholder BUILD_TIME = "UNKNOWN" not found in ' + FILE);
  process.exit(1);
}
fs.writeFileSync(FILE, src.replace('BUILD_TIME = "UNKNOWN"', `BUILD_TIME = "${buildTime}"`));
console.log('Build time injected:', buildTime);
