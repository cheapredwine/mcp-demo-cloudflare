/**
 * Runtime integration tests: exercise the real Worker inside workerd
 * (vitest-pool-workers) over the actual HTTP layer — no mocks, no Node env.
 *
 * Covers routing, the stateless MCP handshake, tool listing, and a real
 * tool call, validating the behavior real MCP clients depend on.
 */
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("MCP Server runtime (workerd)", () => {
  it("returns 404 JSON for non-/mcp paths", async () => {
    const res = await exports.default.fetch("https://example.com/");
    expect(res.status).toBe(404);
    const body = await res.json<Record<string, unknown>>();
    expect(body["error"]).toBe("Not Found");
    expect(body["status"]).toBe("MCP Demo Server is running");
  });

  it("completes the stateless initialize handshake in a single POST", async () => {
    const res = await exports.default.fetch("https://example.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "vitest-pool-workers", version: "1.0.0" },
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<{
      result: { serverInfo: { name: string }; protocolVersion: string };
    }>();
    expect(body.result.serverInfo.name).toBe("mcp-demo-server");
    expect(typeof body.result.protocolVersion).toBe("string");
  });

  it("rejects invalid JSON-RPC with 400", async () => {
    const res = await exports.default.fetch("https://example.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: "not json",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("lists all 5 demo tools", async () => {
    const res = await exports.default.fetch("https://example.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ result: { tools: Array<{ name: string }> } }>();
    const names = body.result.tools.map((t) => t.name).sort();
    expect(names).toEqual(["calculator", "echo", "get_traffic_log", "get_weather", "random_fact"]);
  });

  it("calls the calculator tool and returns the computed result", async () => {
    const res = await exports.default.fetch("https://example.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "calculator",
          arguments: { operation: "add", a: 7, b: 8 },
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<{
      result: { content: Array<{ text: string }>; isError?: boolean };
    }>();
    expect(body.result.isError).toBeFalsy();
    expect(body.result.content[0].text).toContain("15");
  });

  it("echoes a message back through the echo tool", async () => {
    const res = await exports.default.fetch("https://example.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "echo", arguments: { message: "runtime-test-hello" } },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ result: { content: Array<{ text: string }> } }>();
    expect(body.result.content[0].text).toContain("runtime-test-hello");
  });
});
