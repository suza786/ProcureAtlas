# PROJECT_STATE.md

> Authoritative current state of ProcureAtlas AI. Update at the end of every phase. Do not remove useful history.

## Current Phase

**Phase 4 — Proposal Studio, Approval Workflows, Webhooks, Notifications, Financial Modeling** (complete, verified)

## Phase 3 → Phase 4 Summary

Phase 3 delivered the intelligence layer (Buyer, Award, Competitor, Partner) + Admin + Billing. Phase 4 added the bid operations layer: AI-assisted Proposal Studio with evidence gating, configurable approval workflows with SLA tracking, outbound webhooks with HMAC-signed payloads and retry, notification preferences, and multi-currency bid cost estimation.

---

## Phase 4 Completed Work

### Proposal Studio
- **Models**: Proposal, ProposalSection (9 default section types), ProposalVersion (snapshots)
- **API**: CRUD proposals, PATCH sections (auto-saves on blur), POST draft-section (AI-assisted), POST versions
- **UI**: Proposal list with status/version/coverage stats; Proposal editor with section sidebar, content textarea, AI Draft button, version saving
- **AI-assisted drafting**: `POST /api/proposals/[id]/draft-section` calls GLM-4.6 with full evidence gating — builds evidence graph from company certifications/projects/employees, LLM may ONLY cite evidence IDs, gaps are surfaced not invented, Zod schema validation, audit logged
- **Default sections**: Executive Summary, Technical Approach, Methodology, Team & Key Personnel, Past Performance, Pricing, Compliance Matrix, Risk Management, Timeline & Milestones
- **Evidence coverage tracking**: Each section tracks evidenceCount and hasGaps; proposal-level evidenceCoverage percentage auto-computed

### Approval Workflows
- **Models**: ApprovalChain (configurable chains), Approval (extended with tenantId, proposalId, triggerType, stepOrder, approverRole, slaDueAt, escalatedAt)
- **API**: GET /api/approvals (filter by status/triggerType), PATCH /api/approvals/[id] (approve/reject/changes_requested), GET/POST/PATCH /api/approval-chains
- **UI**: Approvals dashboard with pending/approved/rejected/all filters, SLA tracking with overdue indicators, approve/reject/changes buttons, Approval Chains configuration modal
- **Trigger types**: bid_decision, submission, pricing, legal, evidence_verification
- **SLA tracking**: slaDueAt on each approval, isOverdue computed, escalation field ready
- **Workflow integration**: approved submission → pursuit stage = 'submitted'; rejected bid_decision → pursuit stage = 'no_bid'

### Webhooks
- **Models**: WebhookEndpoint (with HMAC secret, event subscriptions, failure tracking), WebhookDelivery (with signature, attempt count, retry scheduling, response logging)
- **API**: GET/POST/DELETE /api/webhooks (endpoint CRUD), GET /api/webhooks/deliveries (delivery log), POST /api/webhooks/deliveries (manual test delivery)
- **HMAC-SHA256 signing**: Every delivery signed with endpoint secret; signature in `X-ProcureAtlas-Signature: sha256=...` header
- **Retry with exponential backoff**: maxAttempts=5, nextRetryAt scheduled on failure, consecutiveFailures tracked on endpoint
- **7 event types**: tender.published, tender.amended, award.published, pursuit.stage_changed, evidence.expiring, approval.requested, proposal.submitted
- **UI**: Endpoint cards with status/event subscriptions/delivery stats/test button; Delivery log table with status/attempts/HTTP response; Create modal with event selection; One-time secret reveal with copy button

### Notifications
- **Models**: NotificationPreference (per-user, per-channel, per-event-type with minSeverity)
- **API**: GET/PATCH /api/notifications/preferences
- **UI**: Notification center with mark-all-read, type icons, unread indicators; Preferences modal with channel × event matrix (in_app, email, slack, teams × 7 event types)
- **Channels**: in_app (live), email/slack/teams (scaffolded for production)

### Financial Modeling
- **Models**: CurrencyRate (base/quote/rate/source), BidCostEstimate (5 cost components, contingency, margin, computed totals)
- **API**: GET/POST /api/currency-rates, GET/POST /api/bid-cost-estimates
- **UI**: Cost estimate cards with proposed price, total cost, profit, margin, contingency, vs-tender-value percentage; Cost breakdown bar chart (Labor/Materials/Subcontractor/Overhead/Travel); Hedging notes; Currency rates table; Create estimate modal with live total/profit/price preview

### Prisma Schema Extensions
- 10 new models: Proposal, ProposalSection, ProposalVersion, ApprovalChain, WebhookEndpoint, WebhookDelivery, NotificationPreference, CurrencyRate, BidCostEstimate
- Approval model extended with tenantId, proposalId, chainId, triggerType, stepOrder, approverRole, slaDueAt, escalatedAt
- Pursuit model extended with proposals, bidCostEstimates relations

### Seed Data Extended
- 1 sample proposal with 9 sections (5 with content, 4 with gaps flagged) and 2 versions
- 4 approval chains (Bid Submission, Bid/No-Bid, Pricing, Legal)
- 3 webhook endpoints (Slack, Zapier, Internal) with 5 delivery records
- 12 notification preferences (2 channels × 6 event types for owner)
- 5 currency rates (BDT, SGD, EUR, GBP, INR)
- 1 bid cost estimate ($791K proposed price, 18% margin, with hedging notes)

## Verified Functionality (Phase 4)

- `bun run lint` — passes (zero errors)
- `bun run build` — passes (all routes compiled)
- Dev server starts cleanly on port 3000
- **Proposals API**: 1 proposal with 9 sections, 2 versions, 1 approval ✅
- **Approvals API**: 3 approvals (including 1 pending with SLA) ✅
- **Approval Chains API**: 4 chains ✅
- **Webhooks API**: 3 endpoints, 5 deliveries ✅
- **Currency Rates API**: 5 rates ✅
- **Bid Cost Estimates API**: 1 estimate ($791K) ✅
- **Agent-browser verified**: Proposal Studio (list + editor), Financial Modeling (cost breakdown + rates), Webhooks (endpoints + delivery log), Approvals all render with real data
- 5 screenshots saved: `proposal-studio-phase4.png`, `proposal-editor-phase4.png`, `financials-phase4.png`, `webhooks-phase4.png`, `approvals-phase4.png`

## API Routes (Phase 4 complete)

### Phase 4 (new — 14 routes)
- `GET /api/proposals` — list proposals
- `POST /api/proposals` — create proposal with 9 default sections
- `GET /api/proposals/[id]` — full proposal with sections + versions
- `PATCH /api/proposals/[id]` — update status
- `DELETE /api/proposals/[id]` — delete
- `PATCH /api/proposals/[id]/sections/[sectionId]` — update section content
- `POST /api/proposals/[id]/draft-section` — AI-assisted drafting (GLM-4.6 with evidence gating)
- `GET/POST /api/proposals/[id]/versions` — version snapshots
- `GET /api/approvals` — list approvals
- `PATCH /api/approvals/[id]` — approve/reject/changes_requested
- `GET/POST/PATCH /api/approval-chains` — chain configuration
- `GET/POST/DELETE /api/webhooks` — endpoint CRUD
- `GET/POST /api/webhooks/deliveries` — delivery log + test
- `GET/PATCH /api/notifications/preferences` — notification preferences
- `GET/POST /api/currency-rates` — currency rate management
- `GET/POST /api/bid-cost-estimates` — bid cost estimation

## Architecture Decisions (Phase 4 additions)

- **ADR-018**: Proposal Studio uses evidence-gated LLM drafting — same guardrails as requirement extraction
- **ADR-019**: Approval workflows with configurable chains; SLA tracked per step; escalation field ready
- **ADR-020**: Webhook delivery with HMAC-SHA256 signatures and exponential backoff retry (max 5 attempts)
- **ADR-021**: Bid cost estimation with 5 cost components + contingency + margin; multi-currency via CurrencyRate table
- **ADR-022**: Notification preferences as per-user, per-channel, per-event-type matrix with minSeverity filter

## Incomplete Work (Phase 5+)

- **PostgreSQL + pgvector migration** — schema is Postgres-ready; dev still uses SQLite
- **OpenSearch** — faceted search uses SQLite; prod will use OpenSearch
- **Live connector fetching** — CPTU skeleton ready; awaiting legal sign-off
- **Stripe/SSLCommerz payment processing** — scaffolded; needs API keys + webhooks
- **Email/Slack/Teams delivery** — notification preferences configured; delivery channels need integration
- **Temporal/Celery workflow orchestration** — webhook delivery is synchronous in dev; prod needs async worker
- **Proposal export to DOCX/PDF** — exportFormat/exportUrl fields ready; export pipeline not built
- **Public API marketplace** — Phase 5
- **i18n (Bangla UI)** — next-intl available; not wired
- **Vitest + Playwright test suites** — deferred

## Next Recommended Phase

**Phase 5 — MCP Server (production) + Public API Marketplace**
- MCP server with full tool surface, SSE transport, per-API-key authorization, rate limiting
- Versioned REST API (`/api/v1/*`), API key management, tiered rate limits, usage metering
- Embeddings API for programmatic semantic search
- Inbound webhook ingestion from select sources
- Data export API (CSV/JSON)
- Developer documentation portal
