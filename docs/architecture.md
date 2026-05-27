# Architecture

```mermaid
flowchart TB
  user([User<br/>Web browser<br/>3-Panel UI])
  access["Cloudflare Access<br/>Zero Trust authentication"]
  aiOrch["AI Orchestrator (Worker)<br/>Workers AI binding + AI Gateway<br/>Tool calling logic<br/>SSE streaming responses<br/>Service Binding to MCP Server"]
  workersAI["Workers AI<br/>LLM model instance<br/>Tool calling capability<br/>Tool calling support"]
  gateway["AI Gateway + Security<br/>Caching + Analytics + Rate limiting<br/>Guardrails: prompt injection, PII detection"]
  mcp["MCP Server (Worker)<br/>Private: no public URL<br/>MCP protocol implementation<br/>Tools: calculator, get_weather, echo, random_fact"]

  user -->|HTTPS| access
  access -->|Authenticated request| gateway
  gateway -->|Filtered inbound request| aiOrch
  aiOrch -->|Workers AI Binding| workersAI
  workersAI -->|Outbound response filtered| gateway
  gateway -->|Filtered response| aiOrch
  aiOrch -->|Service Binding| mcp
  externalClient([External MCP client<br/>via MCP Portal])
  portal["Cloudflare MCP Portal<br/>(conceptual external discovery)"]
  externalClient -->|MCP discovery| portal
  portal -->|HTTPS / Access| mcp

  classDef cloudflare fill:#0D47A1,stroke:#082B5B,color:#fff,stroke-width:2px;
  classDef worker fill:#F48120,stroke:#C9691C,color:#fff,stroke-width:2px;
  classDef ai fill:#9C27B0,stroke:#6A1B9A,color:#fff,stroke-width:2px;
  classDef gateway fill:#FF6B35,stroke:#BF360C,color:#fff,stroke-width:2px;
  classDef private fill:#2196F3,stroke:#0D47A1,color:#fff,stroke-width:2px;
  classDef planned fill:#607D8B,stroke:#455A64,color:#fff,stroke-width:2px,stroke-dasharray: 5 5;

  class user cloudflare;
  class access cloudflare;
  class aiOrch worker;
  class workersAI ai;
  class gateway gateway;
  class mcp private;
  class portal planned;
  class externalClient planned;
```

> **Note:** The external Portal path shown above is conceptual only. The current repository implementation uses only the internal Service Binding path.

## Overview

This document describes the high-level architecture for the MCP demo running on Cloudflare Workers and the rationale behind the key design choices. The goal is to demonstrate safe, low-latency model orchestration on the edge while keeping the tool execution path internal and auditable.

## Components and why they were chosen

- **User (Browser)** — interactive 3-panel UI that shows prompt input, MCP status, and streaming AI responses.
  - Why: a simple, focused UI makes streaming, tool calls, and internal logs visible for demos and debugging.

- **Cloudflare Access (Zero Trust)** — authenticates users at the edge (SSO, org selectors, device posture), preventing unauthenticated requests from ever reaching the Worker.
  - Why: offloading identity and access policy to Cloudflare reduces in-worker complexity, centralizes policy, and provides enterprise-grade auth without embedding auth logic in demo workers.

- **AI Orchestrator (Worker)** — serves the web UI, orchestrates calls to `Workers AI` and the `AI Gateway`, makes tool-selection decisions, and streams responses via SSE.
  - Why: keeps orchestration, UI, and tool-calling logic colocated for transparency, and allows easy inspection of requests and internal logs.

- **Workers AI** — the model runtime accessed via the Workers AI binding.
  - Why: platform binding avoids extra HTTP hops, reduces latency and cost, and integrates with Cloudflare’s model governance and billing.

- **AI Gateway** — sits inline between Cloudflare Access and the model/orchestrator path for caching, analytics, rate limiting, and security guardrails (prompt-injection detection, PII blocking).
  - Why: consolidates caching and safety policies so both inbound requests and outbound model responses are filtered before they reach the worker or the model.

- **MCP Server (Worker)** — implements the MCP protocol and exposes demo tools. It is private (`workers_dev = false`) and only reachable via Service Binding.
  - Why: keeping the tool server private reduces attack surface and ensures tools run only when invoked by trusted orchestrator workers.
  - Note: a Cloudflare MCP Portal path is conceptually possible, but this repo does not currently implement it.

- **Service Binding** — internal binding used by the orchestrator to call the MCP server.
  - Why: Cloudflare prevents worker-to-worker HTTP calls between `*.workers.dev` domains (error 1042). Service Bindings are the supported, lower-latency, secure way to call internal worker code.
  - Footnote: using a Portal-based external path would add latency, auth complexity, and require exposing the MCP server publicly.

## Security and operational considerations

- Centralize authentication and access policy in Cloudflare Access rather than in-app. This removes session storage, cookie handling, and user-management code from the workers.
- Use the AI Gateway to detect and block prompt injection and to scrub or redact PII before it reaches models or logs.
- Keep the MCP Server private and minimize its public exposure. Use role-scoped credentials and service bindings for any administrative operations.

## Deployment tips

- In `packages/ai-orchestrator/wrangler.toml`, configure the Workers AI binding and the AI Gateway integration.
- In `packages/mcp-server/wrangler.toml`, set `workers_dev = false` to make the server private and configure the service binding on the orchestrator side.

## Viewing and editing this diagram

- Open this file in VS Code and use Markdown preview (Cmd+Shift+V / Ctrl+Shift+V) or paste the Mermaid block into https://mermaid.live/ to render.

## Summary (TL;DR)

- Simplicity: let Cloudflare handle auth and safety so the workers can focus on orchestration and demo logic.
- Security: Cloudflare Access + private MCP + AI Gateway guardrails minimize risk and data exposure.
- Performance: Workers AI binding and Service Bindings remove extra network hops and reduce latency.

If you'd like, I can append example `wrangler.toml` snippets and a short checklist for deploying the orchestrator + private MCP server.
