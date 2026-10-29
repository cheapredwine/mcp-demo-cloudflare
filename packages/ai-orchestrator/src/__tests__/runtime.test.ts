/**
 * Runtime integration tests for the AI Orchestrator Worker (workerd via
 * @cloudflare/vitest-plugin). Covers the routes that don't require live
 * Workers AI inference: health check, web UI, and input validation on
 * /api/ask.
 */
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("AI Orchestrator runtime (workerd)", () => {
  it("reports healthy on /health", async () => {
    const res = await exports.default.fetch("https://example.com/health");
    expect(res.status).toBe(200);
    const body = await res.json<{ status: string; service: string }>();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("ai-orchestrator");
  });

  it("serves the web UI on /", async () => {
    const res = await exports.default.fetch("https://example.com/");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("<!DOCTYPE html");
  });

  it("rejects /api/ask POSTs without a prompt (400)", async () => {
    const res = await exports.default.fetch("https://example.com/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("returns JSON for /api/ask with a malformed body (API responses stay parseable)", async () => {
    // The client guards against non-JSON responses (expired Access sessions
    // return HTML). Contract test: even error paths from the Worker itself
    // must always be application/json so response.json() never sees HTML.
    const res = await exports.default.fetch("https://example.com/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("returns 404 JSON for unknown paths", async () => {
    const res = await exports.default.fetch("https://example.com/nope");
    expect(res.status).toBe(404);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Not found");
  });

  it("serves the admin panel on /admin", async () => {
    const res = await exports.default.fetch("https://example.com/admin");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });
});
