# Product Requirements Document — ProcureAtlas AI

**Status:** Phase 1 (Foundation MVP) delivered as a runnable Next.js 16 single-page application with seeded demo data.
**Owner:** Product
**Last updated:** 2026-09-30

---

## 1. Problem Statement

Public procurement is a $13-trillion-per-year global market, yet the workflows around it remain analog, fragmented, and opaque. Companies that sell to governments must monitor dozens of national and multilateral portals, each with different formats, languages, eligibility rules, deadline conventions, and amendment protocols. Bid managers reconstruct requirements manually from PDFs, build compliance matrices in spreadsheets, track certifications by hand, and make bid / no-bid decisions on intuition rather than evidence. The result is missed deadlines, wasted pursuit effort on ineligible tenders, qualification gaps discovered too late, and proposal quality that depends on a handful of senior individuals.

ProcureAtlas AI replaces this fog with a structured intelligence and operations layer: one canonical model of every covered procurement market, a continuously updated Tender Digital Twin for each opportunity, and a bid operations workspace grounded in verifiable evidence.

---

## 2. Personas

ProcureAtlas AI is built for the people who live inside the bid cycle. Primary personas include:

1. **Bid Manager** — owns the end-to-end bid calendar, compliance matrices, and submission readiness.
2. **Business Development Lead** — scouts new opportunities, runs bid / no-bid, and owns the pursuit pipeline.
3. **Proposal Writer** — drafts responses, reuses approved evidence, and assembles the final proposal.
4. **Compliance / Qualifications Analyst** — maintains certifications, registrations, and project references; tracks expiry.
5. **Subject Matter Expert (SME) Contributor** — contributes technical content to a specific bid section.
6. **BD / Capture Manager (Enterprise)** — runs capture on strategic accounts, tracks buyer intelligence and incumbents.
7. **Procurement Intelligence Analyst** — builds market reports, tracks awards, competitor activity, and buyer spend.
8. **Partner / JV Manager** — finds and qualifies consortium partners and OEM relationships.
9. **Tender Consultant** — multi-client advisor who runs bids on behalf of several customers.
10. **CFO / Finance Approver** — approves bid budgets, financial commitments, and bid bonds.
11. **Legal Approver** — signs declarations, reviews terms, authorizes submissions.
12. **IT / Security Admin (Tenant Owner)** — manages users, roles, SSO, integrations, and audit.
13. **SME Owner / Founder** — small firm entering government contracting for the first time; needs simple discover + eligibility.
14. **International Market Entrant** — company entering a new country who needs local partner matching.

---

## 3. MVP Scope (Phase 1 — Must-Haves)

The Phase 1 MVP is a runnable single-page application demonstrating the full workflow with deterministic scoring and seeded demo data. The ten must-haves are:

1. **Opportunity aggregation** — a unified Discover view that lists tenders across Bangladesh (CPTU eTender), Singapore (GeBIZ), World Bank, ADB, UN, EU TED, and US SAM.gov, normalized into a single schema with market / sector / status filters and free-text search.
2. **Company Profile + Evidence Ingestion (UI shell)** — a Company Brain view that organizes the tenant's company as an evidence graph: registrations, certifications, project references, financials, employees, OEM relationships. Phase 1 includes the shell and seeded data; file upload and ingestion are Phase 2.
3. **Opportunity Matching** — eligibility and opportunity-fit scoring computed deterministically from company evidence vs. tender requirements, surfaced as chips and scores in Discover.
4. **Tender Package Analysis** — Tender Digital Twin view with metadata, lots, requirements, amendments, eligibility, and related awards. Source citations are preserved per requirement.
5. **Qualification Extraction (UI shell)** — requirements are listed with type (mandatory / preferred / scoring), source citation, and category. LLM extraction is scaffolded for Phase 2.
6. **Eligibility Checking** — deterministic eligibility gate that compares company evidence to mandatory tender requirements and produces a clear pass / conditional / fail status with reason codes.
7. **Tender Digital Twin** — the canonical tender record with versioned amendments, deadline timeline, lot-level structure, and award linkage.
8. **Evidence-Backed Compliance Matrix** — requirement × evidence coverage table with gap visualization; every claim links to an evidence ID.
9. **Deadline + Amendment Tracking** — alerts and timeline for submission deadlines, clarification windows, site-visit dates, and amendments, with countdown and notification scaffolding.
10. **Pursuit Management** — pipeline kanban (Discovering → Qualifying → Bidding → Submitted → Won / Lost) with bid / no-bid decision recording, bid rooms, tasks, and compliance snapshot.

---

## 4. Post-MVP Modules (Phase 2+)

| Module | Phase | Purpose |
|---|---|---|
| **Command Center** | P1 (basic) → P2 (live) | Executive dashboard: KPIs, deadline timeline, market pulse, alerts, recent pursuits. |
| **Buyer Intelligence** | P3 | Buyer profile, award history, incumbent mapping, spend analytics, buyer preferences. |
| **Award Intelligence** | P3 | Award tracking, winner analysis, contract value benchmarking, market share. |
| **Competitor Intelligence** | P3 | Competitor profile, win rate, bid patterns, partnership graph, price benchmarking. |
| **Partner / JV Finder** | P3 | Match companies by complementary capabilities, geography, prior JV history. |
| **Proposal Studio** | P4 | AI-assisted drafting grounded in approved evidence; version control; review / approval workflow. |
| **Approval Workflows** | P4 | Configurable approval chains for bid / no-bid, submission, pricing, legal sign-off. |
| **Webhooks** | P4 | Outbound event delivery for deadline, amendment, award, and pursuit state changes. |
| **MCP Server** | P5 | Model Context Protocol server exposing the procurement graph to external AI clients. |
| **Public API Marketplace** | P5 | Versioned, metered REST API for intelligence teams, partners, and embedders. |
| **Billing** | P3+ | Stripe / SSLCommerz integration; tier-based quotas; usage metering. |
| **i18n (Bangla first)** | P6 | next-intl wiring; Bangla UI; original tender language preserved. |
| **Expansion Markets** | P6+ | Malaysia, Indonesia, Philippines, India, Australia, UK, Canada, Middle East, Africa. |

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Multi-tenancy** | Every tenant-scoped row carries `tenantId`; service-layer enforcement; Phase 1 uses SQLite, Phase 2+ migrates to PostgreSQL. |
| **Performance** | First Contentful Paint < 1.8s on a cold load; API p95 < 300ms for list endpoints, < 800ms for Tender Digital Twin payload; Command Center render < 1.2s. |
| **Scalability** | Single-tenant MVP; designed for horizontal scale at Phase 2 (stateless API, externalized cache, object storage for documents). |
| **Security** | OWASP ASVS Level 2 baseline; OWASP API Top-10 controls; LLM/agent security controls; MFA-ready; SSO-ready (OIDC). See `SECURITY.md`. |
| **Audit** | Every create / update / delete on a tenant-scoped entity writes an audit log entry with actor, action, before / after, timestamp, request ID. |
| **Reliability** | Phase 1: best-effort single-instance. Phase 2+: 99.5% target with health checks, graceful degradation, and queue-based retries. |
| **Accessibility** | WCAG 2.1 AA target; axe-core checks in CI from Phase 2. |
| **Observability** | Structured logs (JSON), OpenTelemetry traces (planned Phase 2), metrics via Prometheus (planned Phase 3). |
| **Data residency** | Bangladesh tenant data stored in-region from Phase 3; multilateral bank data stays in EU/US per donor policy. |
| **Internationalization** | English + Bangla at launch; architecture supports Malay, Bahasa Indonesia, Vietnamese, Arabic, French, Spanish. |

---

## 6. Success Metrics

### Activation
- A new tenant completes Company Brain setup (≥ 5 evidence items) within 1 session.
- A new tenant saves their first pursuit within 24 hours of sign-up.
- A new tenant views ≥ 3 Tender Digital Twins in their first session.

### Engagement
- Weekly Active Users / Monthly Active Users ≥ 0.4.
- Median sessions per week per active user ≥ 3.
- Median pursuits per active tenant ≥ 4.

### Value
- Paid tenants win ≥ 1 bid within 6 months of subscription (self-reported).
- Median time from tender publication to pursuit creation ≤ 3 days (vs. industry baseline of 7–14 days).
- Compliance matrix completion rate ≥ 90% of mandatory requirements at submission.

### Retention
- Monthly logo retention ≥ 95% for paid tenants.
- Net Revenue Retention ≥ 110% by end of Year 2.

### Advocacy
- NPS ≥ 40 within 6 months of paid launch.

---

## 7. Out of Scope for Phase 1

- Live procurement source connectors (only seeded demo data).
- Live LLM calls (all AI features are UI scaffolds).
- Authentication enforcement (NextAuth wired-ready but open in MVP).
- File upload and document parsing (UI shell only).
- Billing, MCP server, public API marketplace, webhooks.
- Production PostgreSQL migration (schema is Postgres-ready).
- Multi-language UI (next-intl available, not yet wired).
- Approval workflow engine (model defined; UI deferred).
