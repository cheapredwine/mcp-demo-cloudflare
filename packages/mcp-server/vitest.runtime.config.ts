import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Runs src/__tests__/runtime.test.ts inside a real workerd runtime, loaded
// from wrangler.jsonc (compatibility_date/flags, observability).
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
  test: {
    include: ["src/__tests__/runtime.test.ts"],
  },
});
