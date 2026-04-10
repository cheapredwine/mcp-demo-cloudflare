import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/integration.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/node_modules/',
        '**/dist/',
        '**/build/',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/src/**/*.test.ts',
      ],
    },
  },
  resolve: {
    alias: {
      // Ensure proper module resolution for workspace packages
      '@mcp-demo/server': './packages/mcp-server/src/index.ts',
      '@mcp-demo/client': './packages/workers-client/src/index.ts',
    },
  },
});
