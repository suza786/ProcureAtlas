# MCP Server — ProcureAtlas AI

**Status:** Phase 2 skeleton — running and tested.
**Port:** 3001 (forwarded by Caddy via `XTransformPort` query parameter)
**Transport:** HTTP + JSON-RPC 2.0 (SSE-ready)
**Auth:** Bearer token (API key starting with `pak_`, created via Settings → API Keys)

## Overview

The ProcureAtlas MCP server exposes the procurement intelligence graph as tools consumable by external AI clients (Claude Desktop, custom agents, IDE assistants). It is **read-only** — no tools perform consequential actions.

## Running

The MCP server runs as a mini-service in `mini-services/mcp-server/`. It auto-starts with the sandbox dev environment. To start manually:

```bash
cd mini-services/mcp-server
bun run dev
```

## Available Tools (7 read-only tools)

| Tool | Description |
|------|-------------|
| `tenders.search` | Search tenders by market, sector, status, or free-text query |
| `tenders.get` | Get the full Tender Digital Twin by ID |
| `tenders.requirements` | List requirements for a tender, with source citations |
| `pursuits.list` | List pursuits for the current tenant |
| `company.brain` | Get the Company Brain (evidence graph) for the current tenant |
| `alerts.list` | List active alerts for the current tenant |
| `compliance.matrix` | Get the compliance matrix for a pursuit |

## Authorization

1. Create an API key in Settings → API Keys with `mcp:read` scope.
2. Use the key as a Bearer token in the Authorization header.

```bash
curl -X POST http://localhost:3001/ \
  -H "Authorization: Bearer pak_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Protocol

The server implements a subset of MCP (Model Context Protocol) over JSON-RPC 2.0:

- `initialize` — returns server info and capabilities
- `tools/list` — returns the tool catalog
- `tools/call` — invokes a tool by name with arguments

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Server info |
| `/` | POST | JSON-RPC endpoint (MCP) |
| `/health` | GET | Health check |
| `/tools` | GET | Human-readable tool catalog (HTML) |

## Guardrails (per `/docs/AI_ARCHITECTURE.md` §6)

1. **No consequential actions** — no submit, no delete, no approval decide.
2. **No cross-tenant data** — every tool call is scoped to the API key's tenant.
3. **No LLM invocation** — the MCP server returns structured data; the caller's LLM is the caller's responsibility.
4. **Full audit logging** — every tool call is logged in the AuditLog table with caller, tool, arguments, and result size.
5. **API key validation** — every request requires a valid, non-expired, non-revoked API key with the `mcp:read` scope.

## Testing

```bash
# Health check
curl http://localhost:3001/health

# List tools (requires API key)
curl -X POST http://localhost:3001/ \
  -H "Authorization: Bearer pak_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Call a tool
curl -X POST http://localhost:3001/ \
  -H "Authorization: Bearer pak_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"tenders.search","arguments":{"market":"BD","limit":5}}}'

# View tool catalog in browser
open http://localhost:3001/tools
```

## Phase 3+ Roadmap

- SSE transport for streaming results
- Additional tools: `tenders.eligibility`, `company.capability_map`, `extraction.list`
- Rate limiting per API key
- Usage metering for billing
- stdio transport for Claude Desktop bridge
