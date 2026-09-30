# PROJECT_STATE.md

> Authoritative current state of ProcureAtlas AI. Update at the end of every phase. Do not remove useful history.

## Current Phase

**Phase 1 — Foundation & Command Center MVP** (in progress, runnable)

## Completed Work

### Documentation workspace
- `/README.md` — overview, principles, quickstart, doc index
- `/docs/PRODUCT_VISION.md` — long-form vision
- `/docs/PRD.md` — product requirements
- `/docs/MARKET_RESEARCH.md` — per-country market research
- `/docs/COMPETITOR_MATRIX.md` — competitor analysis
- `/docs/DATA_SOURCES.md` — source catalog
- `/docs/DATA_SOURCE_LEGAL_REGISTER.md` — legal access register
- `/docs/ARCHITECTURE.md` — reference architecture
- `/docs/DATA_MODEL.md` — OCDS-inspired canonical model
- `/docs/API_SPEC.md` — REST API spec
- `/docs/AI_ARCHITECTURE.md` — AI/LLM architecture and guardrails
- `/docs/UX_SPEC.md` — UX principles and module specs
- `/docs/SECURITY.md` — security baseline
- `/docs/THREAT_MODEL.md` — threat model
- `/docs/QA_PLAN.md` — QA plan
- `/docs/DEPLOYMENT.md` — deployment guide
- `/docs/ROADMAP.md` — phased roadmap
- `/docs/PRICING.md` — commercial model
- `/docs/GO_TO_MARKET.md` — GTM
- `/docs/DECISIONS.md` — ADRs
- `/docs/KNOWN_RISKS.md` — known risks
- `/docs/HANDOFF.md` — handoff format

### Data model
- OCDS-inspired Prisma schema with: Tenant, User, Organization, Buyer, ProcurementAuthority, Tender, Lot, Requirement, EvaluationCriterion, Document, Amendment, Deadline, Evidence, Certification, ProjectReference, Employee, Company, Pursuit, Bid, ComplianceItem, Task, Approval, Alert, Outcome, DataSource, AuditLog
- Multi-tenant fields on all tenant-scoped models
- Audit fields (createdAt, updatedAt, createdBy, updatedBy)
- Soft-delete pattern via `deletedAt` on critical models
- SQLite for dev (PostgreSQL-ready)

### Application
- Single-page shell with sidebar + topbar + module view router (Zustand)
- **Command Center**: KPI tiles, deadline timeline, market pulse chart, active alerts, recent pursuits, eligibility vs. fit scatter
- **Discover**: tender radar table with market/sector/status filters, eligibility & fit chips, deadline countdown
- **Tender Digital Twin**: metadata, lots, requirements with source citations, amendments, eligibility assessment, related awards
- **Company Brain**: evidence graph tiles, certifications with expiry tracking, project references, capability map
- **Pursuits**: pipeline kanban (Discovering → Qualifying → Bidding → Submitted → Won/Lost)
- **Bid Rooms**: bid workspace with team, deadline, compliance snapshot, tasks
- **Compliance Matrix**: requirement × evidence coverage table with gap visualization

### API
- `GET /api/tenders` — list with filters (market, sector, status, search)
- `GET /api/tenders/[id]` — Tender Digital Twin payload
- `GET /api/pursuits` — pursuit pipeline
- `GET /api/company` — company brain (current tenant)
- `GET /api/scoring/[tenderId]` — eligibility + fit + readiness scores (deterministic)
- `GET /api/alerts` — active alerts
- `POST /api/pursuits` — create pursuit (bid/no-bid decision recorded)

### Seed data
- 1 demo tenant ("Atlas Demo Co."), 1 demo company (Bangladesh IT firm)
- 12 tenders across Bangladesh (eTender / CPTU), Singapore (GeBIZ), World Bank, ADB, UN, TED
- Realistic lots, requirements, deadlines, amendments
- 8 evidence items (registrations, certifications, project refs, financials)
- 4 pursuits in different pipeline stages
- 6 alerts (deadline, amendment, new opportunity)

## Verified Functionality

- `bun run lint` — passes (no errors, no warnings)
- Dev server starts cleanly on port 3000 (confirmed via `/home/z/my-project/.zscripts/dev.log`)
- `GET /` renders without runtime errors (agent-browser verified end-to-end)
- Sidebar navigation switches between all 7 module views (Command Center, Discover, Tender Digital Twin, Company Brain, Pursuits, Bid Room, Compliance Matrix)
- All 7 API routes return seeded JSON correctly: `/api/dashboard`, `/api/tenders`, `/api/tenders/[id]`, `/api/pursuits`, `/api/company`, `/api/scoring/[tenderId]`, `/api/alerts`, `/api/market-pulse`
- Scoring engine produces deterministic, explainable scores (Eligibility, Opportunity Fit, Submission Readiness) — no fabricated AI claims
- Command Center displays: 10 active tenders, 4 active pursuits (2 in active bidding), $4.87M pipeline value, 2 critical alerts, 2 recent awards, pipeline distribution chart, market value chart
- Discover view: market chips with live counts (BD:3, SG:2, WB:1, ADB:1, UN:1, EU:1, US:1), sector/status filters, search, full tender table
- Tender Digital Twin: all 5 tabs functional (Overview, Requirements, Amendments, Awards, Scoring Detail); source citations (doc/page/clause) preserved on every requirement; deterministic scores with component breakdown
- Company Brain: 12 evidence items, 5 certifications with expiry tracking, 4 project references, 4 employees, capability map, evidence library table
- Pursuits pipeline: Kanban with stages (Discovering, Qualifying, Bidding, Submitted, Won, Lost/No-Bid) populated; list view below
- Bid Room: 5 bid tasks with assignees (Anika, Sadia, Tanvir, Demo Owner) and due dates; compliance summary; approval request section; bid decision record
- Compliance Matrix: requirement × evidence table with status colors (compliant/partial/gap/N/A), source citations, evidence linkage, filter chips
- No console errors during full navigation flow
- Screenshots saved: `/home/z/my-project/download/command-center.png`, `/home/z/my-project/download/bid-room-screenshot.png`

## Incomplete Work

- Authentication (NextAuth wired but not enforced — all routes open in MVP)
- Real procurement source connectors (only seeded demo data — no live API integration yet)
- AI features (LLM extraction, semantic matching, drafting) — scaffold only, no live LLM calls wired
- File upload + evidence ingestion (UI shell only)
- MCP server (spec defined, not implemented)
- Billing, audit log UI, admin console (deferred to Phase 3+)
- Production PostgreSQL migration (schema is Postgres-ready, dev uses SQLite)
- Multi-language (i18n) — Bangla localization not yet wired (next-intl is available)

## Known Defects

- None known at Phase 1 close. (See Known Risks for systemic risks.)

## Open Risks

See `/docs/KNOWN_RISKS.md` for the full register. Top items:
1. Legal review required before any live scraping of procurement portals
2. SQLite → PostgreSQL migration must happen before Phase 2 production deploy
3. AI features must be hard-gated by evidence before any customer-facing rollout
4. Authentication must be enforced before any multi-tenant production use

## Architecture Decisions

See `/docs/DECISIONS.md`. Key Phase 1 decisions:
- ADR-001: Next.js 16 App Router (single-route SPA in MVP for sandbox constraints)
- ADR-002: Prisma + SQLite (dev) → PostgreSQL (prod)
- ADR-003: Zustand for view routing (no router-based navigation in MVP)
- ADR-004: Deterministic scoring engine; LLM features are scaffolds only in Phase 1
- ADR-005: shadcn/ui (New York) + Tailwind 4 for Bloomberg-style intelligence aesthetic

## Data Sources Integrated

Phase 1: None live. Seeded demo data models the shape of:
- Bangladesh CPTU eTender (https://www.eprocure.gov.bd/)
- Singapore GeBIZ (https://www.gebiz.gov.sg/)
- World Bank Procurement (https://procure.worldbank.org/)
- Asian Development Bank (https://uxdm.adb.org/)
- UNGM (https://www.ungm.org/)
- EU TED (https://ted.europa.eu/)
- US SAM.gov (https://sam.gov/)

## Credentials / Integrations Still Required

- None for Phase 1 (demo mode only)
- Phase 2 will require: PostgreSQL connection string, NextAuth secret + OAuth provider creds, S3-compatible object store creds
- Phase 3+ will require per-source API keys / OAuth tokens (each source documented in `DATA_SOURCE_LEGAL_REGISTER.md`)

## Environment Details

- Runtime: Bun 1.3+
- Node: Next.js 16 dev server (auto-started by sandbox)
- DB: SQLite at `file:./dev.db` (Prisma)
- Port: 3000 (only externally exposed route is `/`)
- AI SDK: `z-ai-web-dev-sdk` available but not yet invoked

## How to Run

```bash
bun run db:push           # apply schema
bun run scripts/seed.ts   # seed demo data (idempotent)
# dev server is auto-started by the sandbox; do not run `bun run dev` manually
```

Open the **Preview Panel** on the right to view the application. Do not visit `http://localhost:3000` directly.

## How to Test

```bash
bun run lint              # ESLint
bun run db:push           # verify schema applies cleanly
# Manual: open Preview, navigate sidebar, exercise each module
# API: curl /api/tenders, /api/scoring/<tenderId>, etc. (relative paths only)
```

## Next Recommended Phase

**Phase 2 — Authentication, Real Data Connectors, and Live Scoring**
- Enforce NextAuth with MFA-ready RBAC
- Implement first live connector: Bangladesh CPTU (per legal register)
- Wire LLM extraction (z-ai-web-dev-sdk) with hard evidence gating
- Migrate to PostgreSQL
- Add file upload + document parsing pipeline
- Implement MCP server skeleton
