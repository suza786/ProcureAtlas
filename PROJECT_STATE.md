# PROJECT_STATE.md

> Authoritative current state of ProcureAtlas AI. Update at the end of every phase. Do not remove useful history.

## Current Phase

**Phase 3 — Intelligence Layer (Buyer, Award, Competitor, Partner) + Admin + Billing** (complete, verified)

## Phase 2 → Phase 3 Summary

Phase 2 delivered authentication, LLM extraction, file uploads, connectors, and the MCP server. Phase 3 layered on the intelligence layer: Buyer Intelligence, Award Intelligence, Competitor Intelligence, Partner/JV Finder, semantic matching, faceted search, an Admin Console, and a Billing foundation with usage metering and plan management.

---

## Phase 3 Completed Work

### Buyer Intelligence
- **API**: `GET /api/buyers` (list with aggregated stats), `GET /api/buyers/[id]` (detailed profile)
- **UI**: Buyer list table with search, tender/award counts, total award value, incumbent count, top sectors; Buyer detail page with stats grid, incumbent supplier mapping, sector preferences, recent tenders, award history
- **Data**: 8 buyer organizations with aggregated award stats (BCC, GovTech Singapore, EU DG DIGIT, etc.)

### Award Intelligence
- **API**: `GET /api/awards` with market/sector filters, market share aggregation, by-market and by-sector breakdowns
- **UI**: KPI tiles (total awards, total value, avg value, distinct winners), Awards by Market bar chart, Market Share pie chart, Top Suppliers table with percentage bars, Recent Awards table
- **Data**: 14 awards totaling $37.95M across 10 distinct winners, 6 markets

### Competitor Intelligence
- **API**: `GET /api/competitors` (list with stats), `GET /api/competitors/[id]` (detailed profile with win trend)
- **UI**: Competitor cards with award counts, total/avg values, sector breakdowns, top buyers; Competitor detail page with stats grid, Win Trend by Year chart, Top Buyers, Sector Breakdown, Market Breakdown, Award History table
- **Data**: 13 suppliers with profiles (competitor/partner flags), including CyberNet, DataSoft, NCS Group, Deloitte, Booz Allen, Leidos, Wipro

### Partner / JV Finder
- **API**: `GET /api/partners` — computes match scores for all suppliers against tenant's company
- **UI**: Tenant company card, partner suggestion grid with match scores, complementary capabilities, geographic overlap, top match reasons; Detail drawer with all 5 match dimensions (complementary capabilities, geographic alignment, certification complementarity, combined capacity, prior JV history)
- **Matching engine**: `src/lib/matching.ts` — deterministic tag + keyword + capability scoring (pgvector-ready)

### Semantic Matching Engine
- **Library**: `src/lib/matching.ts` with `computeTenderCompanyMatch()` and `computePartnerMatch()`
- **5 dimensions for tender matching**: sector match, capability depth, geography, contract size fit, keyword overlap
- **5 dimensions for partner matching**: complementary capabilities, geographic alignment, certification complementarity, combined capacity, prior JV history
- **API**: `GET /api/match/tender/[tenderId]` — semantic match score for a tender vs tenant's company
- **pgvector-ready**: Same interface will use cosine similarity over embeddings in production with PostgreSQL

### Faceted Search
- **API**: `GET /api/search?q=...&types=tender,award,buyer,supplier&market=...&sector=...`
- Full-text search across tenders, buyers, suppliers, and awards with faceted counts
- **Phase 3 note**: SQLite-backed (deterministic). Production will use OpenSearch for p95 ≤ 200ms.

### Admin Console
- **API**: `GET /api/admin/users` (manager+ only), `PATCH /api/admin/users/[id]` (role update, password reset, account unlock — admin+ only), `DELETE /api/admin/users/[id]` (deactivate — admin+ only), `GET /api/admin/system` (system health)
- **UI**: Tabbed interface — User Management (table with role/MFA/status, unlock/delete actions) + System Health (stats grid, LLM usage 30-day, storage, recent connector runs)
- **RBAC enforced**: Manager+ for user list, Admin+ for user modifications

### Billing Foundation
- **API**: `GET /api/billing/usage` (current period usage with limits), `GET /api/billing/subscription`, `PATCH /api/billing/subscription` (plan change — owner only)
- **UI**: Current plan card, usage meters with percentage bars (API calls, LLM tokens, tenders tracked, pursuits, file uploads), plan selection grid (5 plans: Free/Solo/Professional/Bid Team/Enterprise), invoice history
- **Models**: Subscription (with plan limits), UsageMetric (per-period tracking), Invoice
- **Plan limits**: Free (10 tenders, 1 pursuit, 100 API calls), Solo (50/5/1K), Professional (200/20/5K), Bid Team (1K/100/25K), Enterprise (10K/1K/100K)
- **Stripe/SSLCommerz**: Scaffolded — `stripeCustomerId`, `sslcommerzStoreId` fields ready; payment processing deferred to production deploy

### Prisma Schema Extensions
- 7 new models: `BuyerProfile`, `SupplierProfile`, `PartnerSuggestion`, `Subscription`, `UsageMetric`, `Invoice`
- Organization model extended with `buyerProfile`, `supplierProfile`, `partnerSuggestions` relations
- Tenant model extended with `partnerSuggestions`, `subscription` relations

### Seed Data Extended
- 10 additional supplier organizations (DataSoft, LEADS, NCS Group, ST Engineering, Deloitte, PwC, Atos, Booz Allen, Leidos, Wipro)
- 13 SupplierProfile records (competitor/partner flags, award stats)
- 3 BuyerProfile records (BCC, GovTech, EU DG DIGIT)
- 12 additional Award records across multiple buyers/suppliers/time periods
- 4 PartnerSuggestion records with match scores and reasons
- 1 Subscription record (Professional plan, monthly)
- 1 Invoice record (paid, $149)

## Verified Functionality (Phase 3)

- `bun run lint` — passes (zero errors)
- Dev server starts cleanly on port 3000
- **Buyers API**: 8 buyers with aggregated stats ✅
- **Awards API**: 14 awards, $37.95M total, 10 distinct winners, 6 markets ✅
- **Competitors API**: 13 suppliers with profiles ✅
- **Partners API**: 13 partner suggestions with match scores ✅
- **Search API**: 15 results for "cyber" across tenders/buyers/suppliers/awards ✅
- **Billing API**: Professional plan, 5 usage metrics, 1 invoice ✅
- **Admin System API**: 3 users, 12 tenders, 4 pursuits, 4 connector runs ✅
- **Agent-browser verified**: Award Intelligence (14 awards, $37.95M, charts), Partner Finder (13 suggestions, match scores), Competitor Intelligence (13 suppliers, profiles), Billing (Professional plan, usage meters), Admin Console (RBAC-enforced) all render with real data
- 7 screenshots saved: `award-intel-phase3.png`, `partner-finder-phase3.png`, `competitor-intel-phase3.png`, `billing-phase3.png`, `admin-phase3.png`, `admin-system-phase3.png`, `buyer-intel-phase3.png`

## API Routes (Phase 3 complete)

### Phase 3 (new — 12 routes)
- `GET /api/buyers` — buyer list with aggregated stats
- `GET /api/buyers/[id]` — buyer detail with incumbents + award history
- `GET /api/awards` — award tracking with market share
- `GET /api/competitors` — competitor list with profiles
- `GET /api/competitors/[id]` — competitor detail with win trend
- `GET /api/partners` — partner/JV suggestions with match scores
- `GET /api/search` — faceted search across all entities
- `GET /api/match/tender/[tenderId]` — semantic tender ↔ company match
- `GET /api/admin/users` — user management (manager+)
- `PATCH /api/admin/users/[id]` — update user (admin+)
- `DELETE /api/admin/users/[id]` — deactivate user (admin+)
- `GET /api/admin/system` — system health overview
- `GET /api/billing/usage` — current period usage
- `GET /api/billing/subscription` — subscription details
- `PATCH /api/billing/subscription` — change plan (owner)

## Incomplete Work (Phase 4+)

- **PostgreSQL + pgvector migration** — schema is Postgres-ready; dev still uses SQLite
- **OpenSearch** — faceted search uses SQLite; prod will use OpenSearch for p95 ≤ 200ms
- **PostgreSQL RLS** — documented; not implementable on SQLite
- **Live connector fetching** — CPTU skeleton ready; awaiting legal sign-off
- **Stripe/SSLCommerz payment processing** — scaffolded; needs API keys + webhooks
- **Proposal Studio** — Phase 4
- **Approval workflow chains** — Phase 4
- **Webhooks** — Phase 4
- **Public API marketplace** — Phase 5
- **i18n (Bangla UI)** — next-intl available; not wired
- **Vitest + Playwright test suites** — deferred

## Architecture Decisions (Phase 3 additions)

- **ADR-013**: Deterministic matching engine (tag + keyword + capability) as pgvector-ready interface
- **ADR-014**: Faceted search via SQLite in dev; OpenSearch in prod (same API shape)
- **ADR-015**: Billing scaffold with plan limits + usage metering; Stripe/SSLCommerz deferred
- **ADR-016**: Admin Console with RBAC enforcement (manager+ for user list, admin+ for modifications)
- **ADR-017**: BuyerProfile/SupplierProfile as denormalized aggregation tables (computed from Awards + Tenders)

## Environment Details

- Runtime: Bun 1.3+
- DB: SQLite at `file:./dev.db` (Prisma) — PostgreSQL-ready
- MCP Server: Bun, port 3001
- Port: 3000 (only externally visible Next.js route is `/`)
- AI SDK: `z-ai-web-dev-sdk` — LIVE (GLM-4.6)
- File storage: `/home/z/my-project/uploads/{tenantId}/{category}/`

## How to Run

```bash
bun run db:push           # apply schema
bun run scripts/seed.ts   # seed demo data (idempotent)
# dev server is auto-started by the sandbox
# MCP server: cd mini-services/mcp-server && bun run dev
```

**Demo credentials:**
- owner@atlas-demo.com / demo1234 (Owner role)
- manager@atlas-demo.com / demo1234 (Manager role)
- contributor@atlas-demo.com / demo1234 (Contributor role)

## Next Recommended Phase

**Phase 4 — Proposal Studio, Approval Workflows, Webhooks**
- Proposal Studio: AI-assisted proposal drafting grounded in approved evidence
- Approval workflows: configurable chains for bid/no-bid, submission, pricing, legal
- Webhooks: outbound event delivery with signed payloads + retry
- Assisted submission preparation (no autonomous submission)
- Multi-currency financial modeling
- Notifications: in-app + email + Slack/Teams
- Temporal/Celery workflow orchestration for long-running bid prep
