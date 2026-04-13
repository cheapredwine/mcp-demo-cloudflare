#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcFile = join(__dirname, '..', 'src', 'index.ts');
const timestamp = new Date().toISOString().slice(0, 10) + ' ' + new Date().toISOString().slice(11, 16);

let content = readFileSync(srcFile, 'utf-8');
content = content.replace(
  /const BUILD_TIMESTAMP = ['"]BUILD_TIMESTAMP['"];/,
  `const BUILD_TIMESTAMP = '${timestamp}';`
);
writeFileSync(srcFile, content);
console.log(`✅ Build timestamp injected: ${timestamp}`);
