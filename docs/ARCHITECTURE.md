# Reference Architecture — ProcureAtlas AI

**Status:** Phase 1 (Foundation MVP) — runnable. Phase 2+ components are planned.
**Last updated:** 2026-09-30

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT (browser)                                   │
│  Next.js 16 App Router (single route: /)  •  React 19  •  TypeScript 5       │
│  Tailwind 4  •  shadcn/ui (New York)  •  Recharts  •  Framer Motion          │
│  State: Zustand (view router) + TanStack Query (server cache)                │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │ HTTPS
┌──────────────────────────────────▼───────────────────────────────────────────┐
│                    NEXT.JS API ROUTES (App Router /api)                       │
│   /api/tenders  /api/tenders/[id]  /api/pursuits  /api/company               │
│   /api/scoring/[tenderId]  /api/alerts                                       │
│   Service-layer enforcement of tenant_id on every read/write                 │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
            ┌──────────────────────┼───────────────────────┐
            │                      │                       │
┌───────────▼─────────┐  ┌──────────▼──────────┐  ┌────────▼────────────┐
│   Prisma ORM         │  │  Scoring Engine     │  │  Alerting Engine    │
│   (SQLite dev /      │  │  (deterministic;    │  │  (deadline +        │
│    Postgres prod)    │  │   eligibility, fit, │  │   amendment tracker)│
│                      │  │   readiness)        │  │                     │
└───────────┬──────────┘  └─────────────────────┘  └─────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                             │
│   SQLite (Phase 1 dev)  →  PostgreSQL (Phase 2 prod)                         │
│   + pgvector (Phase 3+ for semantic matching)                                │
│   + OpenSearch (Phase 3+ for full-text + faceted search)                     │
│   + Redis (Phase 2+ for cache + queue)                                       │
│   + S3 / MinIO (Phase 2+ for documents)                                      │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                    ASYNC + INGESTION (Phase 2+)                              │
│   Source Connectors (per DATA_SOURCE_LEGAL_REGISTER.md)                      │
│   Document processing pipeline (PDF/DOCX → structured requirements)         │
│   LLM extraction service (z-ai-web-dev-sdk, evidence-gated)                 │
│   Temporal / Celery orchestration                                            │
│   MCP server (Phase 5)                                                       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY (Phase 2+)                                  │
│   OpenTelemetry traces  •  structured JSON logs  •  Prometheus metrics      │
│   Sentry (errors)  •  Grafana dashboards                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Components

### 2.1 Frontend (Next.js 16 App Router)

- **Single route in MVP** — only `/` is externally visible in the sandbox. Module switching (Command Center, Discover, Tender Digital Twin, Company Brain, Pursuits, Bid Rooms, Compliance Matrix) happens client-side via Zustand view-state, not via URL routing.
- **React 19** with server components for initial data fetch and client components for interactive module views.
- **TanStack Query** for server-state caching; queries keyed by tenant + entity.
- **shadcn/ui (New York style)** for the Bloomberg-style intelligence aesthetic.
- **Tailwind 4** for layout, typography, and design tokens.
- **Recharts** for the Command Center charts (deadline timeline, market pulse, eligibility-fit scatter).
- **Framer Motion** for subtle transitions on module switches and data refreshes.

### 2.2 API Layer (Next.js API routes / Phase 1; FastAPI / Phase 4+)

- Phase 1–3: Next.js App Router `/api` routes (TypeScript, same codebase as frontend).
- Phase 4+: planned extraction of heavy compute (LLM extraction, document parsing, semantic matching) into a **Python FastAPI** service tier, invoked from the Next.js API via internal authenticated calls. The Next.js tier remains the public-facing API.
- Service-layer enforcement of `tenantId` on every read and write — no controller-level query reaches the database without a tenant scope.

### 2.3 Data Layer

| Store | Phase | Purpose |
|---|---|---|
| SQLite | P1 (dev only) | Single-file dev database via Prisma. |
| PostgreSQL | P2+ (prod) | Primary OLTP database. Schema is Postgres-ready. |
| pgvector | P3+ | Embedding storage for semantic matching (tender ↔ company capability). |
| OpenSearch | P3+ | Full-text + faceted search across tenders, awards, buyers. |
| Redis | P2+ | Cache (Tender Digital Twin payloads, scoring breakdowns), rate-limit counters, queue backends. |
| S3 / MinIO | P2+ | Document storage (tender packages, evidence files, proposals). |

### 2.4 Async + Orchestration

| Component | Phase | Purpose |
|---|---|---|
| Source connectors | P2+ | Per-source scheduled + on-demand retrieval per `DATA_SOURCE_LEGAL_REGISTER.md`. |
| Document processing pipeline | P2+ | PDF / DOCX → text → requirement extraction (LLM-assisted, evidence-gated). |
| LLM extraction service | P2+ | `z-ai-web-dev-sdk` for classification, extraction, summarization. Every output is evidence-anchored. |
| Temporal / Celery | P3+ | Durable workflow orchestration for long-running ingestion and bid-prep pipelines. |
| MCP server | P5 | Model Context Protocol server exposing the procurement graph to external AI clients. |

---

## 3. Data Flow

### 3.1 Ingestion (Phase 2+)

1. Scheduled connector pulls source data via permitted method (API / RSS / open data).
2. Source payload enters ingestion queue.
3. Normalization worker maps source payload to canonical model (`DATA_MODEL.md`).
4. Entity resolution worker deduplicates (same tender across portals → linked `Tender` records).
5. LLM extraction worker extracts requirements, deadlines, eligibility criteria — every extraction carries source citation + confidence.
6. Deterministic post-processing computes eligibility gates, deadline calendar, amendment diffs.
7. Records written to PostgreSQL; document binaries to S3; embeddings to pgvector; search index to OpenSearch.

### 3.2 Read (Phase 1)

1. Browser requests `/` → Next.js server component prefetches tenant context + Command Center payload.
2. Client mounts Zustand store; TanStack Query hydrates from prefetched data.
3. User switches module → Zustand selector change → TanStack Query fetches module payload from `/api/*` → cached → rendered.
4. Scoring endpoint `/api/scoring/[tenderId]` computes deterministically on every call (no caching in Phase 1; cached in Phase 2+ with invalidation on evidence update).

### 3.3 Consequential Action (Phase 4+)

1. User initiates submission / declaration / partner engagement in UI.
2. Action enters approval queue (deterministic workflow state machine).
3. Required approvers (Manager / Legal / Finance) receive notification.
4. On explicit approval, action is executed by an authorized service account with audit log entry.
5. The platform never autonomously performs consequential actions. See `AI_ARCHITECTURE.md` and `SECURITY.md`.

---

## 4. Multi-Tenancy Strategy

- **Row-level isolation via `tenantId`** on every tenant-scoped entity. Phase 1 uses SQLite (no RLS); enforcement is at the **service layer** (Prisma query extensions / wrapper functions that always inject `tenantId` from the authenticated session).
- **No Postgres RLS in MVP** — see ADR-006 in `DECISIONS.md`. RLS is a Phase 3+ hardening layer on top of service-layer enforcement.
- **Tenant context** is derived from the authenticated session (Phase 2+) and validated on every request.
- **Object storage isolation** — documents stored under `s3://bucket/{tenantId}/{entityType}/{entityId}/...` with per-object signed URLs (Phase 2+).
- **Cross-tenant queries** are prohibited at the service-layer level; the only legitimate cross-tenant query is the platform-level aggregate (admin console, Phase 3+).

---

## 5. Caching Strategy

| Layer | Cache | TTL | Invalidation |
|---|---|---|---|
| Browser | TanStack Query | 60s (list), 5min (detail) | Manual invalidate on mutation |
| API | Redis (Phase 2+) | 60s (Tender Digital Twin), 300s (scoring) | Tag-based invalidation on Tender / Evidence / Requirement write |
| Database | Prisma query plan cache | Prisma-managed | Automatic |
| Search | OpenSearch (Phase 3+) | Near-real-time | Indexer on data write |

---

## 6. Async Task Orchestration (Phase 3+)

- **Temporal** is the planned durable workflow engine for long-running pipelines (multi-step ingestion, bid preparation, proposal assembly). Workflows are deterministic, replayable, and observable.
- **Celery** is the fallback / interim option for simpler cron-style tasks (scheduled connector runs, alerting, nightly scoring recomputation) — final choice deferred to Phase 3 design.
- All workflows emit structured events to the audit log; all workflows are tenant-scoped.

---

## 7. Document Processing Pipeline (Phase 2+)

1. **Ingest** — file uploaded via signed URL; type-validated; virus-scanned; stored under tenant-scoped S3 prefix.
2. **Extract** — text extraction (PDF → text, DOCX → text); table extraction; image OCR (Phase 3+).
3. **Section** — LLM-assisted section identification (eligibility, technical, financial, contractual).
4. **Classify** — requirement classification (mandatory / preferred / scoring) with confidence + source citation.
5. **Link** — each extracted requirement linked to source document + page + extracted text snippet.
6. **Review** — extracted requirements enter a human-review queue before becoming canonical (Phase 2+: review UI in Tender Digital Twin).
7. **Index** — full text → OpenSearch; embedding → pgvector (Phase 3+).

---

## 8. Observability (Phase 2+)

- **OpenTelemetry** — traces from browser → API → service → database, with tenant + user + request ID spans.
- **Structured JSON logs** — every log line carries `timestamp`, `level`, `tenantId`, `userId`, `requestId`, `module`, `message`, `context`.
- **Prometheus metrics** — request rate, latency, error rate per endpoint; queue depth; cache hit rate; connector success rate.
- **Sentry** — error tracking with PII scrubbing.
- **Grafana** dashboards — system health, tenant activity, connector status, LLM cost tracking.

---

## 9. Phase 1 Deviations (Documented)

| Deviation | Reason | Mitigation |
|---|---|---|
| SQLite instead of PostgreSQL | Sandbox environment; single-tenant dev | Schema is Postgres-ready; migration is Phase 2 prerequisite |
| Single route (`/`) — no URL routing | Sandbox constraint | Zustand view-state for module switching; URL routing deferred to Phase 2 |
| No live source connectors | Legal review required (`DATA_SOURCE_LEGAL_REGISTER.md`) | Seeded demo data models the shape of all 7 priority sources |
| No live LLM calls | Evidence-gating + prompt-injection controls must be in production first | All AI features are UI scaffolds; deterministic scoring only |
| No authentication enforcement | NextAuth wired-ready but open in MVP for demo | Service-layer tenant enforcement pattern is in place; auth enforcement is Phase 2 prerequisite |
| No file upload | Document pipeline not built | UI shell for upload; ingestion deferred to Phase 2 |
| No Redis / OpenSearch / pgvector | Not needed for single-tenant MVP | Architecture supports drop-in for Phase 2+ |

---

## 10. Future Architecture Decisions Pending

- **Postgres RLS vs service-layer only** — pending Phase 3 hardening review (see ADR-006).
- **Temporal vs Celery** — pending Phase 3 workflow complexity assessment.
- **MCP transport** — stdio vs HTTP+SSE for the Phase 5 MCP server.
- **Multi-region deployment** — pending Bangladesh data residency requirement (Phase 3+).

All major architectural decisions are recorded as ADRs in `DECISIONS.md`.
