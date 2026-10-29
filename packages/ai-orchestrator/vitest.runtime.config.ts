import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Runs src/__tests__/runtime.test.ts inside a real workerd runtime, loaded
// from wrangler.jsonc (AI binding, MCP_SERVER service binding).
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        // Stub the MCP_SERVER service binding: the upstream mcp-demo-server
        // Worker isn't part of this test project. Runtime tests below never
        // route through it; production wiring is verified post-deploy.
        serviceBindings: {
          MCP_SERVER() {
            return new Response(JSON.stringify({ jsonrpc: "2.0", id: 0, result: {} }), {
              headers: { "Content-Type": "application/json" },
            });
          },
        },
      },
    }),
  ],
  test: {
    include: ["src/__tests__/runtime.test.ts"],
  },
});
