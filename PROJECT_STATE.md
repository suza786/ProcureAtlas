# PROJECT_STATE.md

> Authoritative current state of ProcureAtlas AI. Update at the end of every phase. Do not remove useful history.

## Current Phase

**Phase 5 — Public API Marketplace, MCP Production, Embeddings, Inbound Webhooks, Data Export** (complete, verified)

## Phase 4 → Phase 5 Summary

Phase 4 delivered the bid operations layer (Proposal Studio, Approval Workflows, Webhooks, Financials). Phase 5 opened the platform to external developers: a versioned public REST API with API key auth and rate limiting, an embeddings API for semantic search, inbound webhook ingestion from external sources, data export, and a Developer Portal with interactive API explorer.

---

## Phase 5 Completed Work

### Versioned Public REST API (`/api/v1/*`)
- **13 API endpoints**: tenders (list + get), awards, buyers, suppliers, pursuits, company, embeddings (POST + GET), exports (POST + GET), usage, webhooks/ingest
- **API key authentication**: Bearer token validation via `validateApiKey()` — bcrypt hash comparison, prefix lookup, tenant plan resolution
- **Rate limiting**: Token bucket algorithm with tier-based limits (Free: 100/hr, Intelligence: 1K/hr, Pursuit Pro: 5K/hr, Team: 25K/hr, Enterprise: 100K/hr) + burst capacity
- **Rate limit headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` on 429 responses
- **Usage metering**: Every API call logged in AuditLog with action, tenant, API key ID
- **RateLimitBucket model**: Persistent token bucket with lazy refill

### Embeddings API (pgvector-ready)
- **POST /api/v1/embeddings**: Generate deterministic hash-based embeddings (256 dimensions) for up to 20 texts per request
- **GET /api/v1/embeddings?q=**: Semantic search using cosine similarity over cached embeddings
- **Caching**: Embeddings cached in Embedding table by entityType + entityId with textHash for invalidation
- **Production path**: Same interface will use real embedding model (e.g., text-embedding-3-small) + pgvector cosine similarity in production

### Inbound Webhook Ingestion
- **POST /api/v1/webhooks/ingest**: Accept signed webhooks from external sources (World Bank, ADB, UNGM, CRM, custom)
- **Signature verification**: `x-webhook-signature` header validation
- **Auto-processing**: Automatically creates Tender records from World Bank/ADB/UNGM webhook payloads
- **InboundWebhook model**: Full audit trail — source, event type, payload, signature validity, processed status, created entities, error messages

### Data Export API
- **POST /api/v1/exports**: Create export jobs for tenders, pursuits, evidence, audit_log, awards, full_backup
- **Formats**: JSON and CSV (with proper escaping)
- **DataExport model**: Job tracking with status, record count, file size, download URL, 24h expiry
- **Full backup**: Exports pursuits + company + evidence + audit logs + proposals in one job

### Developer Portal UI
- **4 tabs**: API Docs, API Keys, Interactive Explorer, Usage Stats
- **API Docs**: Quick start guide, 13 endpoint catalog with method/path/scope, rate limit table by plan, TypeScript + Python code examples
- **API Keys**: Create/revoke keys with scope selection (api:read, api:write, mcp:read), one-time key reveal with copy
- **Interactive Explorer**: Select endpoint, set query params, run live request, view JSON response
- **Usage Stats**: 24h/7d/30d call counts, utilization percentage, rate limit status with remaining tokens, LLM cost/tokens, top endpoints

### Prisma Schema Extensions
- 4 new models: RateLimitBucket, Embedding, InboundWebhook, DataExport
- Total models across all phases: 46

## Verified Functionality (Phase 5)

- `bun run lint` — passes (zero errors)
- `bun run build` — passes (all routes compiled)
- Dev server starts cleanly on port 3000
- **v1/tenders**: 11 tenders returned with API key auth ✅
- **v1/awards**: 14 awards returned ✅
- **v1/buyers**: 8 buyers returned ✅
- **v1/suppliers**: 13 suppliers with profiles ✅
- **v1/embeddings (POST)**: 2 embeddings generated, 256 dimensions ✅
- **v1/usage**: Professional plan, rate limit remaining tracked ✅
- **v1/exports**: 11 records exported as JSON ✅
- **v1/webhooks/ingest**: External webhook processed, 1 entity created ✅
- **Agent-browser verified**: Developer Portal with API Docs, endpoints catalog, code examples all render correctly
- 1 screenshot saved: `developer-portal-phase5.png`

## API Routes (Phase 5 complete)

### Phase 5 (new — 13 v1 routes)
- `GET /api/v1/tenders` — search tenders (API key + rate limited)
- `GET /api/v1/tenders/[id]` — get tender by ID
- `GET /api/v1/awards` — search awards
- `GET /api/v1/buyers` — list buyers
- `GET /api/v1/suppliers` — list suppliers with profiles
- `GET /api/v1/pursuits` — list tenant pursuits
- `GET /api/v1/company` — get tenant company brain
- `POST /api/v1/embeddings` — generate embeddings
- `GET /api/v1/embeddings` — semantic search
- `POST /api/v1/exports` — create data export
- `GET /api/v1/exports` — list export jobs
- `GET /api/v1/usage` — API usage statistics
- `POST /api/v1/webhooks/ingest` — inbound webhook ingestion

## Architecture Decisions (Phase 5 additions)

- **ADR-023**: Versioned public API at `/api/v1/*` with API key auth + token bucket rate limiting
- **ADR-024**: Deterministic hash-based embeddings as pgvector-ready interface (256 dimensions)
- **ADR-025**: Inbound webhook ingestion with auto-tender-creation for known sources (WB, ADB, UNGM)
- **ADR-026**: Data export with 24h expiry and CSV/JSON format support

## Incomplete Work (Phase 6)

- **PostgreSQL + pgvector migration** — schema is Postgres-ready; dev still uses SQLite
- **OpenSearch** — faceted search uses SQLite; prod will use OpenSearch
- **Live connector fetching** — CPTU skeleton ready; awaiting legal sign-off
- **Stripe/SSLCommerz payment processing** — scaffolded; needs API keys + webhooks
- **Email/Slack/Teams delivery** — notification preferences configured; delivery channels need integration
- **MCP SSE transport** — MCP server uses HTTP JSON-RPC; SSE transport for streaming not yet implemented
- **SDK packages** — TypeScript/Python SDK code examples in docs; actual packages not published
- **Expansion markets** — Malaysia, Indonesia, Philippines, India, Australia, UK, Canada, Middle East, Africa
- **i18n (Bangla UI)** — next-intl available; not wired
- **Vitest + Playwright test suites** — deferred

## Next Recommended Phase

**Phase 6 — Expansion Markets, i18n, Mobile**
- Expansion markets: Malaysia, Indonesia, Philippines, India, Australia, UK, Canada, Middle East, Africa
- i18n: Bangla UI live; Malay, Bahasa Indonesia, Vietnamese, Arabic (RTL), French, Spanish
- Mobile: full responsive QA pass; PWA support (installable, offline Command Center)
- Multi-region deployment: Bangladesh tenant data stored in-region (data residency)
- SCIM provisioning: enterprise SSO with automated user provisioning/deprovisioning
- Advanced analytics: tenant-level dashboard, cohort retention, win-rate trends

