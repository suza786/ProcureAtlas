# Architecture Decision Records — ProcureAtlas AI

**Format:** Each ADR has Context, Decision, Consequences. ADRs are append-only; superseded ADRs retain their content with a "Superseded by ADR-XXX" notice.
**Last updated:** 2026-09-30

---

## ADR-001: Next.js 16 App Router with single-route SPA in MVP

**Status:** Accepted (Phase 1)

### Context

The dev sandbox environment exposes only a single externally-visible route (`/`). Next.js App Router supports server components, route handlers, and fine-grained layout / loading boundaries — ideal for a module-rich intelligence platform. The product needs seven module views (Command Center, Discover, Tender Digital Twin, Company Brain, Pursuits, Bid Rooms, Compliance Matrix) but cannot expose them as separate URL routes in the sandbox.

### Decision

Build on Next.js 16 App Router. In Phase 1, expose only the `/` route. Implement module switching via Zustand view-state (client-side) rather than URL routing. Plan migration to full URL routing in Phase 2 when the deployment environment supports it.

### Consequences

**Positive:**
- Leverages Next.js 16's full feature set (server components, route handlers, App Router layouts).
- Allows rapid Phase 1 development within sandbox constraints.
- Zustand view-state gives clean, fast module switching without page reloads.

**Negative:**
- No deep-linking to specific modules or entities in Phase 1 (e.g., cannot share a Tender Digital Twin URL).
- Browser back button does not navigate between modules.
- SEO for individual modules is not possible in Phase 1 (acceptable for an enterprise SaaS).

**Mitigation:** Phase 2 migrates to URL routing (`/discover`, `/tenders/[id]`, `/pursuits/[id]`, etc.) with Zustand retained only for ephemeral UI state (modal open / closed, filter state).

---

## ADR-002: Prisma + SQLite for dev, PostgreSQL for production

**Status:** Accepted (Phase 1)

### Context

The dev sandbox is single-process and benefits from a zero-administration database. SQLite is file-based, fast, and requires no separate server. However, production requires a managed relational database with WAL archiving, RLS, extensions (pgvector), and concurrent write throughput. Prisma is a TypeScript-first ORM with a declarative schema and migration tooling.

### Decision

Use Prisma as the ORM with SQLite in dev (`file:./dev.db`) and PostgreSQL in production. Author the Prisma schema to be PostgreSQL-compatible from day one — no SQLite-specific types or pragmas in tenant-scoped models. Plan the SQLite → PostgreSQL migration as a Phase 2 prerequisite.

### Consequences

**Positive:**
- Zero-administration dev database (no Docker, no separate server).
- Single declarative schema source-of-truth.
- TypeScript type safety end-to-end (Prisma → service layer → API → client).
- PostgreSQL readiness from day one.

**Negative:**
- SQLite lacks row-level security (RLS) — service-layer enforcement only in dev (acceptable since dev is single-tenant).
- SQLite lacks advanced Postgres features (jsonb operators, arrays, full-text search) — use generic types in dev, add Postgres-specific optimizations in Phase 3.
- Migration risk: schema drift between dev and prod if not disciplined.

**Mitigation:** Phase 2 migration is a `prisma migrate` against a fresh Postgres instance; CI runs against Postgres test container from Phase 2 (no SQLite in CI).

---

## ADR-003: Zustand for view routing in MVP

**Status:** Accepted (Phase 1). Superseded by URL routing in Phase 2.

### Context

The single-route constraint (ADR-001) requires client-side module switching. Options: React Context, Zustand, Redux Toolkit, Jotai. The app needs: a single source of truth for "current module" + module parameters (e.g., selected tender ID), fast re-renders on module switch, and ergonomic DevTools.

### Decision

Use Zustand for module view-state. A single `useModuleStore` holds `currentModule`, `selectedTenderId`, `selectedPursuitId`, `selectedBidId`, and `filterState`. Module components subscribe to relevant slices.

### Consequences

**Positive:**
- Minimal boilerplate; ergonomic API.
- Fine-grained subscriptions prevent unnecessary re-renders.
- DevTools integration for debugging.

**Negative:**
- No URL → state sync (no deep-linking, no back button).
- State lost on full page reload unless persisted (acceptable for Phase 1).

**Mitigation:** Zustand is retained in Phase 2 for ephemeral UI state (modals, filters, drawer open). URL params become the source of truth for "which entity am I viewing."

---

## ADR-004: Deterministic scoring engine; LLM as scaffold only in Phase 1

**Status:** Accepted (Phase 1). Endures as a permanent principle.

### Context

The product's third principle is "AI is not the source of truth." Scoring (Eligibility, Opportunity Fit, Submission Readiness) is the most consequential output the platform produces — it drives bid / no-bid decisions. If scores are probabilistic (LLM-driven), they cannot be reproduced, audited, or trusted. Phase 1 also lacks production-grade LLM guardrails (prompt-injection resistance, evidence gating, output validation).

### Decision

Implement the scoring engine as a deterministic, pure function of `(tenderId, companyId, evidenceSnapshotHash)`. The engine uses weights, thresholds, and boolean logic — no LLM in the loop. Every score comes with a component breakdown explaining *why*. In Phase 1, all AI features (requirement extraction, summaries, compliance suggestions, semantic search, drafting) are UI scaffolds only — no live LLM calls. Live LLM features ship only in Phase 2+ after the guardrails in `AI_ARCHITECTURE.md` are implemented and tested.

### Consequences

**Positive:**
- Scores are reproducible, auditable, explainable.
- Phase 1 product makes no live AI claims — honest with users.
- Scoring engine can be unit-tested exhaustively (see `QA_PLAN.md` §5).
- No LLM cost or latency risk in Phase 1.

**Negative:**
- Requirement extraction is manual / seeded in Phase 1 (slower to populate).
- No semantic search in Phase 1 (keyword + tag matching only).
- Phase 2 has more work to ship LLM features.

**Mitigation:** Phase 2 LLM extraction is built on top of the deterministic engine — extracted requirements feed into the same scoring logic; the LLM never produces scores directly.

---

## ADR-005: shadcn/ui (New York) + Tailwind 4 for Bloomberg-style intelligence aesthetic

**Status:** Accepted (Phase 1)

### Context

The product aesthetic combines Bloomberg-style intelligence terminal density, modern AI workflow clarity, and enterprise bid-management professionalism. Tailwind 4 brings the new oxide-based engine, faster builds, and CSS-first configuration. shadcn/ui offers copy-paste components with full ownership of the code; the "New York" style variant matches the dense, professional target aesthetic.

### Decision

Use Tailwind CSS 4 with shadcn/ui (New York variant) as the component foundation. Customize design tokens per `UX_SPEC.md` (dark sidebar, light canvas, monospace numerics, status color palette). Recharts for charts. Framer Motion for transitions.

### Consequences

**Positive:**
- Full ownership of component code (no opaque dependency).
- Tailwind 4 performance + CSS-first config.
- New York variant aligns with the dense aesthetic out of the box.
- Recharts + Framer Motion are well-supported and TypeScript-friendly.

**Negative:**
- shadcn/ui components must be maintained (security patches, bug fixes) in our codebase.
- Tailwind 4 is newer — some ecosystem libraries may lag.

**Mitigation:** Keep shadcn components in a dedicated `/src/components/ui` directory; periodically re-sync via `npx shadcn-ui@latest diff` to surface upstream fixes.

---

## ADR-006: Multi-tenancy via tenant_id row-level + service-layer enforcement, not Postgres RLS in MVP

**Status:** Accepted (Phase 1). RLS added as defense-in-depth in Phase 3.

### Context

Multi-tenancy options: (a) separate database per tenant (expensive, operational overhead), (b) separate schema per tenant (Prisma-unfriendly), (c) row-level isolation with `tenantId` column (simple, scales), (d) Postgres RLS on top of row-level. The dev sandbox uses SQLite (no RLS). Production will use Postgres (RLS available).

### Decision

Use row-level isolation with `tenantId` on every tenant-scoped entity. Enforce tenant scope at the **service layer** — every database query passes through a wrapper that injects `tenantId` from the authenticated session. No controller-level raw query bypasses the wrapper. Postgres RLS is added in Phase 3 as a defense-in-depth layer on top of service-layer enforcement — not a replacement for it.

### Consequences

**Positive:**
- Works on SQLite (dev) and Postgres (prod) uniformly.
- Service-layer enforcement is auditable (one place to look for tenant scoping).
- No reliance on database-level RLS for correctness (RLS is hard to test and debug).
- Simpler Phase 1 — no RLS policy authoring.

**Negative:**
- A bug in the service layer can leak cross-tenant data (no database-level backstop in Phase 1–2).
- Requires discipline (every query must use the wrapper).

**Mitigation:** ESLint rule (Phase 2) flags any Prisma query missing `where: { tenantId }`. Integration tests verify cross-tenant isolation (see `QA_PLAN.md` §7). Phase 3 adds RLS policies as defense-in-depth; both layers must pass for a query to return data.

---

## ADR-007: No autonomous consequential actions; human-in-the-loop for all submissions

**Status:** Accepted (Phase 1). Endures as a permanent principle.

### Context

The product's fourth principle is "Human approval for consequential actions." Consequential actions include: tender submission, contractual commitment, signed declaration, partner engagement, financial offer change, external communication of sensitive commercial information, evidence verification status change. An LLM agent with autonomous capability in any of these areas creates unacceptable legal, financial, and reputational risk.

### Decision

The platform never autonomously performs consequential actions. LLM agents can *prepare drafts* and *suggest mappings* but cannot *submit*, *sign*, *commit*, *engage*, *change financial offers*, or *communicate externally*. Every consequential action requires explicit human authorization via the Approval workflow. This is enforced at multiple layers: (1) LLM tool surface does not include consequential tools, (2) service layer rejects consequential actions without an Approval record, (3) UI never renders a one-click consequential action without an explicit confirmation modal.

### Consequences

**Positive:**
- Legal and contractual safety — no autonomous submission to government portals.
- Auditability — every consequential action has a named approver + timestamp.
- Customer trust — customers know the AI cannot submit a bid on its own.
- Aligns with regulatory expectations for government procurement.

**Negative:**
- Higher friction for power users who want automation.
- Phase 4 "assisted submission" must be carefully scoped (platform prepares the package; human uploads to portal manually).

**Mitigation:** Approval workflow is configurable per tenant — a small team can have a single-approver fast path; an enterprise can require multi-approver chains. Phase 4 introduces optional "assisted submission preparation" (platform assembles the package; human uploads to portal) — never autonomous submission.
