# Known Risks Register — ProcureAtlas AI

**Status:** Living document. Updated at every phase gate and whenever a new risk is identified.
**Last updated:** 2026-09-30

This register tracks systemic risks that could affect the project's success. Each risk has an owner, a likelihood, an impact, and a mitigation plan. Risks are reviewed at every phase gate.

**Likelihood scale:** Low (≤ 25%), Medium (25–60%), High (> 60%).
**Impact scale:** Low (minor delay / minor cost), Medium (phase delay / customer impact), High (project failure / regulatory / safety).

---

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Live scraping of procurement portals requires legal review and may be prohibited for some sources | High | High | No live connectors in Phase 1. Legal sign-off on `DATA_SOURCE_LEGAL_REGISTER.md` is Phase 2 prerequisite per source. Prefer official APIs / open data over HTML scraping. | Legal + Engineering |
| R-002 | SQLite → PostgreSQL migration introduces schema drift or data loss | Medium | High | Schema is Postgres-ready from Phase 1. Phase 2 migration is a `prisma migrate` against a fresh Postgres instance + data backfill. Migration tested in staging before production. CI runs against Postgres test container from Phase 2. | Engineering |
| R-003 | AI hallucination produces false company claims surfaced to users as fact | High | High | Evidence gating (`AI_ARCHITECTURE.md` §4) — LLM may not output a company factual claim without an Evidence ID. Output validation against evidence graph. Hallucination prevention controls. UI clearly distinguishes AI output from deterministic data. | AI + Product |
| R-004 | Multi-tenancy enforcement bug causes cross-tenant data leak | Medium | Critical | Service-layer tenant-scope enforcement on every query. ESLint rule flagging missing `where: { tenantId }`. Integration tests for cross-tenant isolation (`QA_PLAN.md` §7). Phase 3 adds Postgres RLS as defense-in-depth. | Engineering + Security |
| R-005 | Single-route MVP constraint forces non-deep-linkable UX in Phase 1 | High (Phase 1) | Medium | Accepted for Phase 1. Phase 2 migrates to URL routing. Mitigation: Zustand view-state is ergonomic; module switching is fast; deep-linking deferred to Phase 2. | Engineering |
| R-006 | Seeded demo data insufficiently realistic to validate UX hypotheses | Medium | Medium | Seeded data covers 7 markets, 12 tenders, 8 evidence items, 4 pursuits, 6 alerts. Phase 2 design partners will validate against their real data. Demo data clearly labeled as "demo mode" in sticky footer. | Product |
| R-007 | No authentication enforcement in Phase 1 — any caller can hit any API | High (Phase 1) | Medium (Phase 1) | Accepted for Phase 1 (sandbox only, no real customer data). Phase 2 enforces NextAuth + RBAC. No production deploy before Phase 2 auth enforcement. | Engineering + Security |
| R-008 | Per-source API availability changes or rate limits tighten | Medium | High | Each source has a documented access method + rate limit in `DATA_SOURCE_LEGAL_REGISTER.md`. Graceful degradation per source (one source's outage does not break the product). Quarterly review of per-source API status. | Engineering |
| R-009 | Bangladesh Taka currency volatility affects international cost-of-goods (LLM API, cloud infra) | Medium | Medium | Quarterly FX review. Pricing reviewed annually. Bangladesh tier priced in BDT; international tier in USD — natural hedge. Cost-of-goods tracked in USD; revenue split by currency. | Finance |
| R-010 | Data retention compliance (GDPR for EU customers, Bangladesh Digital Security Act / Data Protection Act when enacted) | High | High | Data retention policy in `SECURITY.md` §16. Tenant deletion two-phase (soft + hard). Audit log retention 7 years (procurement regulatory). GDPR DPA available for EU customers. Bangladesh DPA monitoring — adjust policy when enacted. | Legal + Security |
| R-011 | LLM provider (z-ai-web-dev-sdk) availability / pricing changes | Medium | Medium | Provider abstraction (`src/lib/llm/`); graceful degradation on provider failure. Token budget per tenant; cost monitoring. Quarterly provider review. | AI + Engineering |
| R-012 | Prompt injection via tender documents causes data tampering or unauthorized action | High | High | Prompt-injection resistance controls (`AI_ARCHITECTURE.md` §3): untrusted text wrapping, control char stripping, length caps, no tool invocation from untrusted text, output validation, source-text verification. Evidence gating rejects injected claims. | AI + Security |
| R-013 | Competitor (GovWin, Beroe, or new entrant) launches MCP server or API before Phase 5 | Medium | Medium | Phase 5 priority for MCP. Differentiation via multi-market canonical model + bid operations layer (not just MCP). Track competitor moves quarterly. | Product + Strategy |
| R-014 | Customer discovery reveals pricing is set wrong | High (pre-launch) | High | Customer discovery interviews (≥ 10 per region) before launch (`PRICING.md` §9). Competitive pricing benchmark refresh. Pilot pricing with design partners before public launch. | Product + GTM |
| R-015 | Bangladesh beachhead market too small to sustain business | Medium | High | Expand to Singapore + multilateral banks in Year 2 (`GO_TO_MARKET.md` §5). Beachhead target 20 paying customers Year 1, 50 Year 2; expand if not met. | GTM |
| R-016 | Document processing pipeline (PDF / DOCX / OCR) underperforms on multilingual non-English documents | High | Medium | Original tender language preserved. LLM-assisted extraction with confidence scoring; low-confidence routed to human review. Phase 6 adds Bangla / Malay / Bahasa Indonesia / Arabic OCR. | AI + Engineering |
| R-017 | World Bank / ADB SPNs reference borrower-side portals we cannot legally scrape | High | Medium | ProcureAtlas AI links World Bank / ADB SPNs to borrower-portal Tenders via `TenderLink` entity (Phase 3) without scraping borrower portals. Borrower-portal detail is sourced only from the borrower's own open data or via tenant's own bidder-account access (with explicit tenant authorization). | Legal + Engineering |
| R-018 | Evidence verification becomes a bottleneck (Manager+ role required, single point of failure) | Medium | Medium | Phase 3 RBAC allows tenant-configurable verification roles. Delegation: Owner can grant verification to specific Contributors. Verification queue with SLA. Audit log of verifications. | Product |
| R-019 | Approval workflow latency causes missed bid deadlines | Medium | High | SLA tracking on approval chains; escalation rules; in-app + email + Slack notifications. Configurable approval chains (single-approver fast path for small teams). | Product |
| R-020 | Backups not tested — restore fails when needed | Medium | Critical | Quarterly restore test (`DEPLOYMENT.md` §7.2). Restore test documented; failure escalates to SEV1. Backup integrity check (hash verification) weekly. | Engineering + Ops |
| R-021 | Audit log tampering by privileged insider | Low | Critical | Audit log append-only at DB layer (Phase 3+ WORM storage). Hash chain (Phase 3+). Off-site replication. Quarterly integrity check. Owner / Admin actions also logged. | Security |
| R-022 | File upload pipeline used to exfiltrate data or upload malicious content | Medium | High | Type validation (magic byte), MIME allowlist, size limit, ClamAV scan, signed-URL access only. Per-tenant storage quota. Filename sanitized. Stored filename is UUID. | Security + Engineering |
| R-023 | SSO IdP misconfiguration grants unauthorized access | Low | High | IdP configuration requires Owner role + MFA re-authentication. OIDC discovery document verified. Configuration change audit-logged. Tenant admin training. | Security |
| R-024 | LLM token budget exhausted mid-bid for a paying customer | Medium | Medium | Per-tenant daily token budget; alerting at 80%. Graceful degradation (extraction → manual review; drafting → template prompt). Optional token-budget top-up for Enterprise. | AI + Product |
| R-025 | Bangladesh DPA (Digital Security Act / Data Protection Act) enacted with stricter requirements than current baseline | Medium | High | Legal monitoring of Bangladesh DPA evolution. Architecture supports data residency (Phase 6 Bangladesh region). Policy adjustment when DPA enacted. | Legal |

---

## Top Risks (Executive Summary)

The following risks are the highest-priority items requiring active management:

1. **R-001 (Live scraping legal review)** — gates Phase 2. Without legal sign-off per source, no live connectors ship.
2. **R-003 (AI hallucination)** — addressed by evidence gating, but residual risk remains; continuous monitoring required.
3. **R-004 (Multi-tenancy enforcement)** — single most important security control; bug here is a SEV1.
4. **R-010 (Data retention compliance)** — regulatory; requires ongoing legal monitoring.
5. **R-014 (Pricing validation)** — gates commercial launch; requires customer discovery before paid tiers go live.

---

## Risk Review Cadence

- **Weekly:** top 5 risks reviewed in product / engineering sync.
- **Phase gate:** full register reviewed; new risks added; closed risks archived.
- **Quarterly:** executive risk review with founder + Legal + Security + Engineering.
- **Ad-hoc:** any SEV1 or SEV2 incident triggers a risk-review entry; root cause analysis may surface a new systemic risk.
