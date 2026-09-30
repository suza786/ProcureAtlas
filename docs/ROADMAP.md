# Phased Roadmap — ProcureAtlas AI

**Status:** Phase 1 (Foundation MVP) is runnable. Phases 2–6 are planned.
**Last updated:** 2026-09-30

This document describes the phased delivery plan. Each phase has scope, exit criteria, and dependencies. Phases are not strictly sequential — small overlap is allowed where dependencies permit.

---

## Phase 1 — Foundation & Command Center MVP (CURRENT)

**Status:** Runnable. Sandbox dev environment with seeded demo data.

### Scope

- Next.js 16 single-page app (single route `/`, module switching via Zustand).
- 7 module views: Command Center, Discover, Tender Digital Twin, Company Brain, Pursuits, Bid Rooms, Compliance Matrix.
- 5 API routes: tenders, tenders/[id], pursuits, company, scoring/[tenderId], alerts.
- OCDS-inspired Prisma schema (SQLite dev, Postgres-ready).
- Deterministic scoring engine: eligibility, opportunity fit, submission readiness — fully explainable, no LLM.
- Seeded demo data: 1 tenant, 1 company, 12 tenders across 7 markets, 8 evidence items, 4 pursuits, 6 alerts.
- Documentation suite: PRD, market research, competitor matrix, data sources, legal register, architecture, data model, API spec, AI architecture, UX spec, security, threat model, QA plan, deployment, roadmap, pricing, GTM, ADRs, known risks, handoff format.

### Exit criteria

- ✅ `bun run lint` passes.
- ✅ Dev server starts cleanly.
- ✅ All 7 module views render without runtime errors.
- ✅ All API routes return seeded JSON.
- ✅ Scoring engine produces deterministic, explainable scores.
- ✅ All 20 documentation files written and committed.
- ✅ PROJECT_STATE.md reflects Phase 1 final state.
- ✅ Worklog entry appended.

### Dependencies

- None — Phase 1 is self-contained.

---

## Phase 2 — Authentication, Real Data Connectors, Live Scoring

**Status:** Planned. Prerequisite for any production deploy.

### Scope

- **Authentication enforcement:** NextAuth with MFA-ready RBAC; OIDC SSO (Google, Microsoft Entra); session management; account lockout.
- **PostgreSQL migration:** Prisma migrate from SQLite to PostgreSQL; backup + restore tested.
- **First live connector:** Bangladesh CPTU eTender, per `DATA_SOURCE_LEGAL_REGISTER.md` (legal sign-off required before implementation).
- **LLM extraction:** `z-ai-web-dev-sdk` integration for requirement extraction + classification + summarization — all evidence-gated, all source-cited, all human-reviewable.
- **File upload + document processing pipeline:** signed-URL upload, type validation, virus scan, text extraction, section identification.
- **MCP server skeleton:** spec defined; transport (HTTP+SSE) stubbed.
- **Vitest + Playwright + axe-core test suites wired; CI pipeline configured.**
- **Redis + S3 / MinIO added.**
- **URL routing:** migrate from Zustand view-state to Next.js App Router URL routing (deep-linkable modules).
- **i18n foundation:** next-intl wired; Bangla UI strings externalized.

### Exit criteria

- All Phase 1 functionality preserved.
- Auth enforced on every tenant-scoped route; MFA available for privileged roles.
- PostgreSQL in production; SQLite only in dev.
- Bangladesh CPTU connector live; ≥ 100 tenders ingested and normalized.
- LLM extraction produces source-cited, evidence-gated, human-reviewable output; ≥ 90% extraction confidence on test fixture.
- File upload working for evidence documents; virus scan enforced.
- MCP server skeleton responds to `tools/list` and `tools/call` for read-only tools.
- Test coverage ≥ 80% lines; CI pipeline green on main.
- Multi-tenancy isolation tests passing.
- Security: SAST + dependency scan in CI; no critical vulnerabilities.

### Dependencies

- Legal sign-off on `DATA_SOURCE_LEGAL_REGISTER.md` for Bangladesh CPTU.
- PostgreSQL instance provisioned.
- LLM API key procured; token budget agreed.
- S3 / MinIO bucket provisioned.

---

## Phase 3 — Intelligence Layer (Buyer, Award, Competitor, Partner)

**Status:** Planned. Builds on Phase 2 foundations.

### Scope

- **Buyer Intelligence:** buyer profile, award history, incumbent mapping, spend analytics, buyer preferences. Buyer profile page linked from Tender Digital Twin.
- **Award Intelligence:** award tracking across covered markets; winner analysis; contract value benchmarking; market share visualization.
- **Competitor Intelligence:** competitor profile; win rate; bid patterns; partnership graph; price benchmarking (where data permits).
- **Partner / JV Finder:** match companies by complementary capabilities, geography, prior JV history; suggestion surfaced with confidence and evidence.
- **Semantic matching:** pgvector embeddings for tender ↔ company capability matching; semantic search in Discover.
- **OpenSearch:** full-text + faceted search across tenders, awards, buyers, suppliers.
- **PostgreSQL RLS:** defense-in-depth layer on top of service-layer enforcement.
- **Admin console:** tenant management; user management; connector status; system health.
- **Billing foundation:** Stripe + SSLCommerz integration; tier-based quotas; usage metering.
- **Audit log UI:** tenant admins can view and export their audit log.
- **Approval workflow foundation:** model defined; basic UI.

### Exit criteria

- Buyer / Award / Competitor / Partner modules shipped and accessible from sidebar.
- Semantic matching produces results with measurable precision/recall on test fixture.
- OpenSearch indexes all tenders + awards; query p95 ≤ 200 ms.
- PostgreSQL RLS policies in place; integration tests verify isolation.
- Admin console functional; tenant admins can manage users + view audit log.
- Billing integration live for paid tiers (Bangladesh + International).
- Approval workflow UI for bid / no-bid decisions.

### Dependencies

- Phase 2 complete.
- OpenSearch cluster provisioned.
- pgvector extension enabled on PostgreSQL.
- Payment gateway accounts (Stripe + SSLCommerz) provisioned.

---

## Phase 4 — Proposal Studio, Approval Workflows, Webhooks

**Status:** Planned.

### Scope

- **Proposal Studio:** AI-assisted proposal drafting grounded in approved evidence; version control; section review / approval workflow; export to DOCX / PDF.
- **Approval workflows:** configurable approval chains for bid / no-bid, submission, pricing, legal sign-off; SLA tracking; escalation.
- **Webhooks:** outbound event delivery (tender.published, tender.amended, award.published, pursuit.stage_changed, evidence.expiring); per-tenant subscriptions; signed payloads; retry with exponential backoff.
- **Assisted submission (Phase 4 pilot):** platform prepares submission package for manual portal upload; no autonomous submission.
- **Multi-currency financial modeling:** bid cost estimation; margin analysis; currency hedging notes.
- **Notifications:** in-app + email + (optional) Slack / Teams integration.
- **Temporal / Celery workflow orchestration** for long-running bid-prep pipelines.

### Exit criteria

- Proposal Studio produces drafts clearly labeled "AI-assisted — verify before submission"; every section links to evidence.
- Approval workflows configurable per tenant; SLA tracking; audit log.
- Webhooks deliver events with ≥ 99.9% delivery rate; signed payloads; retry queue.
- Notification preferences per user.
- Workflow orchestration handles long-running pipelines (multi-day bid prep) without data loss.

### Dependencies

- Phase 3 complete.
- LLM token budget increased for drafting use cases.
- Email / Slack / Teams integration credentials.

---

## Phase 5 — MCP Server, Public API Marketplace

**Status:** Planned.

### Scope

- **MCP server (production):** HTTP+SSE transport; full tool surface (`tenders.search`, `tenders.get`, `tenders.requirements`, `tenders.eligibility`, `company.brain`, `company.capability_map`, `pursuits.list`, `compliance.matrix`, `alerts.list`); per-API-key authorization; rate-limited; audit-logged.
- **Public API marketplace:** versioned REST API (`/api/v1/*`); API key management; tiered rate limits; usage metering for billing; developer documentation portal.
- **Embeddings API:** programmatic access to semantic search; capability map embeddings.
- **Webhook ingestion (inbound):** accept signed webhooks from select sources (e.g., World Bank) where available.
- **Data export API:** tenant data export (CSV / JSON) for compliance / backup.

### Exit criteria

- MCP server passes conformance tests; accessible from Claude Desktop and custom agents.
- Public API has ≥ 10 design partners using it in production.
- API marketplace billing integrated; usage-based invoicing working.
- API documentation portal live; SDK examples in TypeScript / Python.
- Rate limits enforced; quota overage handled gracefully.

### Dependencies

- Phase 4 complete.
- API gateway / rate-limiting infrastructure.
- Developer documentation tooling (Mintlify or equivalent).
- API key management infrastructure.

---

## Phase 6 — Expansion Markets, i18n, Mobile

**Status:** Planned.

### Scope

- **Expansion markets:** Malaysia, Indonesia, Philippines, India, Australia, UK (Find a Tender), Canada (buyandsell), Middle East, Africa.
- **i18n:** Bangla UI live; Malay, Bahasa Indonesia, Vietnamese, Arabic (RTL), French, Spanish.
- **Mobile-responsive QA:** full mobile QA pass; PWA support (installable, offline Command Center).
- **Multi-region deployment:** Bangladesh tenant data stored in-region (data residency).
- **SCIM provisioning:** enterprise SSO with automated user provisioning / deprovisioning.
- **Advanced analytics:** tenant-level analytics dashboard; cohort retention; win-rate trends.
- **Mobile app (optional, if validated):** React Native app for Command Center + alerts.

### Exit criteria

- ≥ 4 expansion markets live with connectors and legal sign-off.
- Bangla UI live; ≥ 2 additional languages live.
- Mobile-responsive across all modules; PWA installable.
- Bangladesh data residency compliant.
- SCIM provisioning working with ≥ 1 enterprise IdP.

### Dependencies

- Phase 5 complete.
- Legal review per expansion market.
- Multi-region cloud infrastructure.
- Localization vendor (for non-English UI strings beyond Bangla).

---

## Cross-Phase Principles

1. **No phase ships AI features without evidence gating.** Every LLM feature is gated by the controls in `AI_ARCHITECTURE.md` before customer rollout.
2. **No phase ships consequential autonomous actions.** Human-in-the-loop is permanent (ADR-007).
3. **Every phase ends with a handoff appended to `PROJECT_STATE.md`** per `HANDOFF.md`.
4. **Every phase gate includes a security review** against `SECURITY.md` and `THREAT_MODEL.md`.
5. **Every phase gate includes a threat-model refresh** — new threats discovered during the phase are added to `THREAT_MODEL.md`.

---

## Indicative Timeline

| Phase | Duration (indicative) | Notes |
|---|---|---|
| Phase 1 | Complete | Runnable MVP |
| Phase 2 | 8–12 weeks | Auth + first connector + LLM extraction |
| Phase 3 | 10–14 weeks | Intelligence layer + billing + admin |
| Phase 4 | 10–14 weeks | Proposal Studio + approvals + webhooks |
| Phase 5 | 8–12 weeks | MCP + public API |
| Phase 6 | Ongoing | Market-by-market expansion |

These are planning estimates, not commitments. Each phase plan is finalized at the prior phase's gate.
