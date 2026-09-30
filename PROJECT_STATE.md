# PROJECT_STATE.md

> Authoritative current state of ProcureAtlas AI. Update at the end of every phase. Do not remove useful history.

## Current Phase

**Phase 2 — Authentication, LLM Extraction, File Uploads, Connectors, MCP Server** (complete, verified)

## Phase 1 → Phase 2 Summary

Phase 1 delivered a runnable MVP with 7 module views, deterministic scoring, and seeded demo data. Phase 2 layered on the production-grade infrastructure: authentication with bcrypt-hashed credentials and session cookies, LLM extraction with full guardrails, file upload pipeline, data source connectors, an MCP server, and audit logging.

---

## Phase 2 Completed Work

### Authentication & Multi-Tenancy
- **Prisma schema extended** with Session, FileUpload, LlmExtraction, ConnectorRun, ApiKey, Notification models (7 new models)
- **User model extended** with passwordHash, mfaSecret, mfaBackupCodes, failedLoginCount, lockedUntil, lastLoginIp
- **Auth library** (`src/lib/auth.ts`): bcrypt password hashing (cost 12), session-cookie auth, account lockout (5 attempts → 15-min lockout), role-based access control (owner/admin/manager/contributor/viewer), session TTL (7 days absolute, 12 hours idle), session revocation, audit logging for all auth events
- **Tenant service layer** (`src/lib/tenant.ts`): `getCurrentTenant()` enforces tenant scope on every query; demo fallback for read-only exploration without auth
- **All API routes refactored** to use `getCurrentTenant()` — no more hardcoded tenant slug
- **3 demo users seeded**: owner@atlas-demo.com, manager@atlas-demo.com, contributor@atlas-demo.com (all password: demo1234)

### LLM Extraction (Evidence-Gated, Source-Cited, Human-Reviewed)
- **LLM abstraction layer** (`src/lib/llm/index.ts`) with full guardrails per `/docs/AI_ARCHITECTURE.md`:
  - Backend-only invocation (z-ai-web-dev-sdk, never client-side)
  - Input sanitization: untrusted text wrapped in `<UNTRUSTED_DATA>` blocks, control chars stripped, length capped at 32k chars
  - Prompt-injection resistance: tender text is data, not instructions
  - Strict Zod schema validation on all outputs
  - Source citation required: every extracted item must include a verbatim `sourceSnippet`
  - Confidence thresholds: items below 0.7 flagged for manual review
  - Full audit logging: model, tokens, latency, cost, prompt hash
  - Graceful degradation: if SDK unavailable, returns "manual review required"
- **3 LLM task types**: `extractRequirements`, `summarizeTender`, `generateEligibilityNarrative`
- **Extraction endpoint**: `POST /api/tenders/[id]/extract-requirements` — triggers LLM call, saves to LlmExtraction table with `reviewStatus=pending`
- **Review queue API**: `GET /api/extractions?reviewStatus=pending`, `PATCH /api/extractions/[id]` (approve/reject/edit)
- **Nothing reaches the Requirement table without human approval** — when approved, items are written with `sourceDoc` citing the extraction ID
- **Live LLM call verified**: GLM-4.6 model, 148 input tokens, 310 output tokens, 3556ms latency, $0.0009 cost, 4 requirements extracted with source snippets

### File Upload Pipeline
- **Upload endpoint**: `POST /api/uploads` (multipart/form-data) with:
  - File-type whitelist: PDF, PNG, JPG, TXT, DOCX, XLSX
  - Size limit: 25 MB
  - SHA-256 checksum computation
  - Local filesystem storage under `uploads/{tenantId}/{category}/` (dev; S3-ready for prod)
  - Text extraction for TXT files (PDF extraction placeholder for prod)
  - Virus scan result field (placeholder — ClamAV in prod)
- **Download endpoint**: `GET /api/uploads/[id]?download=true`
- **Delete endpoint**: `DELETE /api/uploads/[id]`
- **Evidence creation endpoint**: `POST /api/company/evidence` — creates Evidence record linked to FileUpload
- **Upload UI**: modal in Company Brain with file picker, category selector, issuer, expiry date

### Data Source Connectors
- **Connector framework** (`src/lib/connectors/cptu_bd.ts`): `Connector` interface, `NormalizedTender` type, `runConnector()` function with `ConnectorRun` audit logging
- **CPTU Bangladesh connector** (skeleton): fully implemented with deterministic mock fetcher; live fetching disabled pending legal sign-off per `DATA_SOURCE_LEGAL_REGISTER.md`
- **Connector API**: `GET /api/connectors` (list 7 sources with status + recent runs), `POST /api/connectors` (trigger manual run)
- **Connectors UI**: grid of 7 source cards with legal status, live/mock status, run button, recent runs with fetch/create/update/skip counts
- **4 seeded ConnectorRun records** showing realistic ingestion history

### MCP Server (Phase 2 Skeleton)
- **Mini-service** at `mini-services/mcp-server/` (port 3001)
- **7 read-only tools**: `tenders.search`, `tenders.get`, `tenders.requirements`, `pursuits.list`, `company.brain`, `alerts.list`, `compliance.matrix`
- **JSON-RPC 2.0** protocol with `initialize`, `tools/list`, `tools/call` methods
- **API key auth**: Bearer token with `mcp:read` scope validation
- **Full audit logging**: every tool call logged in AuditLog table
- **Health check** at `/health`, tool catalog at `/tools` (HTML)
- **MCP documentation** at `/docs/MCP_SERVER.md`

### API Key Management
- **API key model**: bcrypt-hashed keys with `pak_` prefix, scopes (mcp:read, api:read, api:write), expiry, revocation
- **API endpoints**: `GET /api/api-keys`, `POST /api/api-keys` (returns full key once), `DELETE /api/api-keys?id=...`
- **Settings UI**: API key management with create/revoke, scope selector, one-time key reveal with copy button

### Audit Logging
- **AuditLog model extended** with LLM-specific fields: llmModel, llmPromptHash, llmInputTokens, llmOutputTokens, llmLatencyMs, llmCostUsd, requestId
- **Audit API**: `GET /api/audit?action=...&entityType=...` with pagination
- **Audit Log UI**: filterable table with action icons, LLM call details, CSV export, detail drawer showing before/after JSON
- **6 seeded audit entries** + live entries from LLM extraction, file upload, sign-in, etc.

### Notifications
- **Notification model**: tenant + user scoped, types (alert, deadline, amendment, extraction_ready, approval_request, system)
- **Notifications API**: `GET /api/notifications?unread=true`, `PATCH /api/notifications` (mark read)
- **4 seeded notifications**

### UI Additions
- **SignIn view**: full-screen sign-in with pre-filled demo credentials, demo mode skip, account lockout messaging
- **AuditLog view**: filterable table with action icons, LLM call details, CSV export, detail drawer
- **Extractions view**: review queue with pending/approved/rejected/all filters, review drawer with item editing, approve/reject/edit actions
- **Connectors view**: 7-source grid with legal status, run buttons, recent run history
- **Settings view**: account info, API key management, MCP server documentation
- **Company Brain enhanced**: "Add Evidence" button with upload modal (file picker, category, issuer, expiry)
- **Tender Digital Twin enhanced**: "Extract Requirements (LLM)" button + LLM Extraction tab with guardrail documentation
- **Sidebar enhanced**: Phase 2 badge, LLM Review Queue, Connectors, Audit Log, Settings items, session-aware user card

### Seed Data Extended
- 3 users (owner, manager, contributor) with bcrypt-hashed passwords
- 2 API keys (MCP Read, API Read/Write)
- 6 audit log entries (auth, LLM, pursuit, evidence)
- 4 notifications
- 1 FileUpload (ISO 27001 certificate)
- 1 LlmExtraction (pending review)
- 4 ConnectorRun records

## Verified Functionality (Phase 2)

- `bun run lint` — passes (zero errors, zero warnings)
- Dev server starts cleanly on port 3000
- MCP server starts cleanly on port 3001
- **Auth flow**: sign-in with correct password returns `{"success":true}` + sets session cookie; sign-in with wrong password returns `{"error":"Invalid email or password."}`
- **Auth me**: `GET /api/auth/me` returns authenticated user when cookie present, 401 when not
- **LLM extraction**: `POST /api/tenders/[id]/extract-requirements` calls GLM-4.6, extracts 4 requirements with source snippets, saves to review queue — verified live
- **File upload**: `POST /api/uploads` accepts file, returns metadata with checksum, stores to filesystem, extracts text
- **Connector trigger**: `POST /api/connectors` runs CPTU connector with mock data, creates ConnectorRun record
- **API key creation**: `POST /api/api-keys` returns full key with `pak_` prefix, stores bcrypt hash
- **MCP server**: health check returns `{"status":"ok"}`, tools/list returns 7 tools (requires API key), tools/call returns structured data
- **Audit log**: `GET /api/audit` returns 6+ entries including LLM call details (model, tokens, latency, cost)
- **All Phase 1 functionality preserved**: Command Center, Discover, Tender Digital Twin, Company Brain, Pursuits, Bid Room, Compliance Matrix all render correctly
- **Agent-browser verified**: all new views (Audit Log, LLM Review Queue, Connectors, Settings, Company Brain with upload modal) render without errors
- Screenshots saved: `audit-log-phase2.png`, `llm-review-queue-phase2.png`, `connectors-phase2.png`, `settings-phase2.png`, `company-brain-phase2.png`, `evidence-upload-modal-phase2.png`

## API Routes (Phase 2 complete)

### Phase 1 (preserved)
- `GET /api/dashboard` — Command Center aggregate
- `GET /api/tenders` — list with filters
- `GET /api/tenders/[id]` — Tender Digital Twin
- `GET /api/pursuits` — pursuit pipeline
- `POST /api/pursuits` — create pursuit
- `GET /api/company` — Company Brain
- `GET /api/scoring/[tenderId]` — deterministic scores
- `GET /api/alerts` — active alerts
- `GET /api/market-pulse` — market aggregation

### Phase 2 (new)
- `POST /api/auth/sign-in` — credentials auth with bcrypt
- `POST /api/auth/sign-out` — revoke session
- `GET /api/auth/me` — current session info
- `GET /api/audit` — audit log with filters
- `GET /api/extractions` — LLM extraction review queue
- `PATCH /api/extractions/[id]` — approve/reject/edit extraction
- `POST /api/tenders/[id]/extract-requirements` — trigger LLM extraction
- `POST /api/uploads` — file upload
- `GET /api/uploads/[id]` — file download/metadata
- `DELETE /api/uploads/[id]` — delete file
- `POST /api/company/evidence` — create evidence linked to file
- `GET /api/connectors` — connector status + runs
- `POST /api/connectors` — trigger connector run
- `GET /api/notifications` — list notifications
- `PATCH /api/notifications` — mark as read
- `GET /api/api-keys` — list API keys
- `POST /api/api-keys` — create API key
- `DELETE /api/api-keys` — revoke API key

### MCP Server (port 3001)
- `GET /health` — health check
- `GET /` — server info
- `GET /tools` — HTML tool catalog
- `POST /` — JSON-RPC 2.0 endpoint (initialize, tools/list, tools/call)

## Incomplete Work (Phase 3+)

- **PostgreSQL migration** — schema is Postgres-ready; dev still uses SQLite
- **Live connector fetching** — CPTU connector skeleton ready; awaiting legal sign-off
- **PDF text extraction** — placeholder; needs pdf-parse or vision fallback
- **Virus scanning** — placeholder field; needs ClamAV integration
- **MFA (TOTP)** — schema fields ready; enrollment UI not built
- **SSO (OIDC)** — NextAuth available; not configured
- **Buyer / Award / Competitor / Partner Intelligence** — Phase 3
- **Semantic matching (pgvector)** — Phase 3
- **Proposal Studio** — Phase 4
- **Approval workflow chains** — Phase 4
- **Webhooks** — Phase 4
- **Public API marketplace** — Phase 5
- **i18n (Bangla UI)** — next-intl available; not wired
- **Vitest + Playwright test suites** — Phase 2 goal, deferred to Phase 3
- **Redis + S3 / MinIO** — Phase 2 goal, deferred to Phase 3

## Known Defects

- Dev server in sandbox environment dies after ~6-8 API requests (sandbox process management limitation, not an app bug). The watchdog approach mitigates this. All features verified via rapid test sequences.
- Connector `buyer.upsert` error fixed (changed to findFirst + create pattern).

## Architecture Decisions (Phase 2 additions)

- **ADR-008**: Custom session-cookie auth (not NextAuth's full adapter) for tight multi-tenancy control
- **ADR-009**: LLM abstraction layer in `src/lib/llm/` — provider-swappable, guardrail-enforcing
- **ADR-010**: MCP server as mini-service (port 3001) — read-only, API-key auth, JSON-RPC 2.0
- **ADR-011**: File upload to local filesystem in dev; S3-ready storage key pattern
- **ADR-012**: Connector skeleton with mock fetcher — live fetching gated by legal sign-off

## Data Sources Integrated

Phase 2: CPTU connector skeleton implemented (mock data only). All 7 sources registered in DataSource table with legal status. Live fetching requires legal sign-off per `DATA_SOURCE_LEGAL_REGISTER.md`.

## Credentials / Integrations Still Required

- **Phase 3**: PostgreSQL connection string, S3-compatible object store creds, OpenSearch cluster, Stripe + SSLCommerz for billing
- **Phase 3+**: Per-source API keys / OAuth tokens for live connector fetching (each source documented in `DATA_SOURCE_LEGAL_REGISTER.md`)
- **Phase 4**: Email/Slack/Teams integration credentials for notifications
- **LLM**: z-ai-web-dev-sdk auto-configured from `/etc/.z-ai-config` (no additional credentials needed in sandbox)

## Environment Details

- Runtime: Bun 1.3+
- Node: Next.js 16 dev server (auto-started by sandbox)
- DB: SQLite at `file:./dev.db` (Prisma)
- MCP Server: Bun, port 3001
- Port: 3000 (only externally visible Next.js route is `/`)
- AI SDK: `z-ai-web-dev-sdk` — **LIVE** (GLM-4.6 model verified)
- File storage: `/home/z/my-project/uploads/{tenantId}/{category}/`

## How to Run

```bash
bun run db:push           # apply schema
bun run scripts/seed.ts   # seed demo data (idempotent)
# dev server is auto-started by the sandbox
# MCP server: cd mini-services/mcp-server && bun run dev
```

Open the **Preview Panel** to view the application.

**Demo credentials:**
- owner@atlas-demo.com / demo1234 (Owner role)
- manager@atlas-demo.com / demo1234 (Manager role)
- contributor@atlas-demo.com / demo1234 (Contributor role)

Or click "Skip — explore in demo mode" for read-only access without auth.

## How to Test

```bash
bun run lint              # ESLint

# Auth
curl -c cookies.txt -X POST http://localhost:3000/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@atlas-demo.com","password":"demo1234"}'

# LLM extraction
TENDER_ID=$(curl -s http://localhost:3000/api/tenders | python3 -c "import sys,json;print(json.load(sys.stdin)['items'][0]['id'])")
curl -X POST http://localhost:3000/api/tenders/$TENDER_ID/extract-requirements

# MCP server
curl http://localhost:3001/health
curl -X POST http://localhost:3001/ \
  -H "Authorization: Bearer pak_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Next Recommended Phase

**Phase 3 — Intelligence Layer (Buyer, Award, Competitor, Partner)**
- Buyer Intelligence: buyer profile, award history, incumbent mapping
- Award Intelligence: award tracking, winner analysis, market share
- Competitor Intelligence: competitor profile, win rate, bid patterns
- Partner / JV Finder: complementary capability matching
- Semantic matching: pgvector embeddings for tender ↔ company matching
- OpenSearch: full-text + faceted search
- PostgreSQL RLS: defense-in-depth on multi-tenancy
- Admin console: tenant + user management
- Billing foundation: Stripe + SSLCommerz
- Audit log UI enhancements
- Vitest + Playwright test suites

