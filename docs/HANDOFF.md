# Phase Handoff Format — ProcureAtlas AI

**Status:** Mandatory protocol. Every phase must end with a handoff appended to `PROJECT_STATE.md`.
**Last updated:** 2026-09-30

This document defines the required handoff template and the protocol for using it. The handoff is the authoritative record of what was accomplished in a phase, what was verified, what remains open, and what the next phase needs as input.

---

## 1. Protocol

### 1.1 When a handoff is required

A handoff is required at the end of **every phase**, before any work on the next phase begins. The handoff is appended to `/home/z/my-project/PROJECT_STATE.md` under a new `## Phase N Handoff — [date]` heading.

### 1.2 Who writes the handoff

The agent (or human) that completes the phase writes the handoff. The handoff is written in the same session that completes the phase — not retroactively.

### 1.3 Review

The next agent (or human) picking up the next phase must read the handoff before starting work. If the handoff is incomplete or unclear, the next agent flags it back before proceeding.

### 1.4 Immutability

Once a handoff is appended to `PROJECT_STATE.md`, it is immutable. Corrections are made via a subsequent "Handoff Correction" entry, not by editing the original. This preserves the audit trail.

### 1.5 Worklog entry

In addition to the `PROJECT_STATE.md` handoff, the agent appends a brief entry to `/home/z/my-project/worklog.md` per the worklog template. The worklog entry is the public-facing summary; the `PROJECT_STATE.md` handoff is the detailed record.

---

## 2. Handoff Template

```markdown
## Phase N Handoff — YYYY-MM-DD

### Phase Summary
- Phase name: [e.g., Phase 2 — Authentication, Real Data Connectors, Live Scoring]
- Phase status: [Complete | Complete-with-caveats | Partial — see Remaining Issues]
- Phase duration: [start date] → [end date]
- One-paragraph narrative of what was accomplished.

### Files Created
- /path/to/file1 — purpose
- /path/to/file2 — purpose
- (list every new file created in the phase)

### Files Modified
- /path/to/file1 — what changed
- /path/to/file2 — what changed
- (list every existing file modified, with a one-line description of the change)

### Functionality Verified
- [x] lint passes
- [x] dev server starts on :3000
- [x] (list every verification performed, with the actual result)
- (any verification that failed is listed under Remaining Issues)

### Tests Executed
- [x] unit tests — N tests, all passing
- [x] integration tests — N tests, all passing
- [x] e2e tests — N tests, all passing
- [x] (list every test suite run, with pass / fail count)
- (if no automated tests in this phase, state "manual verification only — see Functionality Verified")

### Remaining Issues
- (list every known defect, gap, or uncompleted item)
- (each item should have an owner and a target phase for resolution)
- (if none, state "None known at phase close.")

### Decisions Made
- ADR-XXX: [title] — [one-line summary] — see /docs/DECISIONS.md
- (list every ADR created in this phase, plus any informal decisions worth recording)

### Assumptions
- (list every assumption made during the phase that the next phase should be aware of)
- (e.g., "Assumed World Bank STEP bulk extract updates daily; verify in Phase 3.")

### Credentials Needed
- (list every credential / API key / integration access needed for the next phase)
- (if none, state "None — next phase is self-contained.")

### Next Phase Input
- (list every dependency, prerequisite, or input the next phase needs)
- (e.g., "Phase 3 requires PostgreSQL instance provisioned and OpenSearch cluster available.")
- (e.g., "Phase 3 requires legal sign-off on DATA_SOURCE_LEGAL_REGISTER.md for Singapore GeBIZ.")
- (e.g., "Phase 3 assumes the Phase 2 LLM extraction confidence is ≥ 90% on test fixture.")

### Open Questions for Next Phase
- (list every open question that the next phase should resolve)
- (e.g., "Should Partner be a tenant-scoped profile of a global Organization, or fully tenant-owned?")

### Sign-off
- Agent: [agent identifier]
- Date: YYYY-MM-DD
- Project state file: /home/z/my-project/PROJECT_STATE.md
```

---

## 3. Field-by-Field Guidance

### 3.1 Phase Summary

One paragraph, 3–5 sentences. State the phase name, whether it's complete, the duration, and a narrative. Avoid hype; state facts. If the phase is partial, say so plainly.

### 3.2 Files Created

Absolute paths. Every new file. If a directory was created with many files (e.g., `src/components/ui/`), list the directory and the file count. Documentation files are listed here too.

### 3.3 Files Modified

Absolute paths with a one-line description of what changed. Be specific — "fixed bug" is not useful; "fixed tenant-scope bug in /api/tenders that allowed cross-tenant reads" is.

### 3.4 Functionality Verified

A checklist. Every item that was actually verified, with the result. Verification methods include: `bun run lint`, dev server start, agent-browser smoke test, manual API call, manual UI walkthrough. Be honest — if you did not verify something, do not check the box.

### 3.5 Tests Executed

If automated tests exist, list them with pass / fail counts. If no automated tests in this phase, state "manual verification only — see Functionality Verified" and reference the manual verification checklist.

### 3.6 Remaining Issues

Every known defect, gap, or uncompleted item. Each item must have an owner (role, not name) and a target phase for resolution. If none, state "None known at phase close." — do not leave the section empty.

### 3.7 Decisions Made

Every ADR created in this phase, plus any informal decisions worth recording (e.g., "Decided to use Recharts instead of visx for the Command Center charts — see ADR-005."). Reference the ADR by number.

### 3.8 Assumptions

Every assumption made during the phase. The next phase agent must be able to read these and know what they can rely on. If an assumption proves wrong, the next phase flags it back.

### 3.9 Credentials Needed

Every credential, API key, or integration access needed for the next phase. If the next phase is self-contained, state "None — next phase is self-contained." Do not list credentials themselves — list what is needed, not the values.

### 3.10 Next Phase Input

Every dependency, prerequisite, or input the next phase needs. This is the bridge between phases — the next phase cannot start without these. Be specific: "PostgreSQL instance provisioned" not "database ready."

### 3.11 Open Questions for Next Phase

Every open question that the next phase should resolve. These are not blockers — they are questions the next phase should answer as part of its work.

### 3.12 Sign-off

Agent identifier (e.g., "main", "1-docs", "agent:docs-writer"), date, and reference to the project state file. This makes the handoff attributable.

---

## 4. Example (Phase 1 — abbreviated)

```markdown
## Phase 1 Handoff — 2026-09-30

### Phase Summary
- Phase name: Phase 1 — Foundation & Command Center MVP
- Phase status: Complete
- Phase duration: 2026-09-25 → 2026-09-30
- Phase 1 delivered a runnable Next.js 16 single-page application with 7 module views (Command Center, Discover, Tender Digital Twin, Company Brain, Pursuits, Bid Rooms, Compliance Matrix), 5 API routes, an OCDS-inspired Prisma schema (SQLite dev, Postgres-ready), a deterministic scoring engine, and seeded demo data across 7 markets. All AI features are scaffolds; no live LLM calls. A 20-file documentation suite was written. Lint passes; dev server is healthy; all module views render without runtime errors.

### Files Created
- /README.md — overview, principles, quickstart, doc index
- /docs/PRODUCT_VISION.md — long-form vision
- /docs/PRD.md — product requirements
- (… 18 more documentation files …)
- /prisma/schema.prisma — OCDS-inspired schema
- /src/app/page.tsx — single-route SPA shell
- (… application source files …)

### Files Modified
- (none — Phase 1 was greenfield)

### Functionality Verified
- [x] bun run lint passes
- [x] dev server starts on :3000
- [x] / renders without runtime errors (agent-browser verified)
- [x] all 7 module views render via Zustand view-state
- [x] all API routes return seeded JSON
- [x] scoring engine produces deterministic, explainable scores

### Tests Executed
- manual verification only — see Functionality Verified (Phase 2 wires automated tests)

### Remaining Issues
- None known at phase close. (See /docs/KNOWN_RISKS.md for systemic risks.)

### Decisions Made
- ADR-001: Next.js 16 App Router, single-route SPA in MVP — see /docs/DECISIONS.md
- ADR-002: Prisma + SQLite dev, Postgres prod
- ADR-003: Zustand for view routing in MVP
- ADR-004: Deterministic scoring engine; LLM as scaffold only in Phase 1
- ADR-005: shadcn/ui New York + Tailwind 4 for Bloomberg aesthetic
- ADR-006: Multi-tenancy via tenant_id row-level + service-layer enforcement, not Postgres RLS in MVP
- ADR-007: No autonomous consequential actions; human-in-the-loop for all submissions

### Assumptions
- Seeded demo data is sufficiently realistic for UX validation in Phase 2 design-partner onboarding.
- SQLite → PostgreSQL migration will be a clean `prisma migrate` (schema is Postgres-ready).
- Bangladesh CPTU public listing pages can be legally accessed via conservative-rate HTML retrieval (Phase 2 legal review required).

### Credentials Needed
- None for Phase 1 (demo mode only).
- Phase 2 will require: PostgreSQL connection string, NextAuth secret + OAuth provider creds, S3-compatible object store creds, LLM API key (z-ai-web-dev-sdk).

### Next Phase Input
- Phase 2 requires legal sign-off on /docs/DATA_SOURCE_LEGAL_REGISTER.md for Bangladesh CPTU before any connector implementation.
- Phase 2 requires PostgreSQL instance provisioned.
- Phase 2 requires LLM API key procured; token budget agreed.
- Phase 2 assumes Phase 1 documentation suite is read in full by the Phase 2 agent.

### Open Questions for Next Phase
- Should Partner be a tenant-scoped profile of a global Organization, or fully tenant-owned? (DATA_MODEL.md §8)
- Should Evidence be append-only (versions) or mutable? (DATA_MODEL.md §8)
- Should ComplianceItem store a snapshot of the Evidence at compliance-mapping time, or always reference the live Evidence? (DATA_MODEL.md §8)

### Sign-off
- Agent: main + 1-docs
- Date: 2026-09-30
- Project state file: /home/z/my-project/PROJECT_STATE.md
```

---

## 5. Anti-Patterns

Avoid the following:

- **Vague summaries** — "Phase 1 went well" is not a phase summary.
- **Missing files** — every file created or modified must be listed.
- **Optimistic verification** — do not check a box unless you actually verified it.
- **Empty "Remaining Issues"** — if you have no remaining issues, state "None known at phase close." Do not leave the section empty.
- **No sign-off** — every handoff must be attributable.
- **Editing prior handoffs** — corrections are made via a subsequent "Handoff Correction" entry, not by editing the original.

---

## 6. Cross-References

- `PROJECT_STATE.md` — where handoffs are appended.
- `worklog.md` — where the brief worklog entry is appended.
- `DECISIONS.md` — where ADRs are recorded.
- `KNOWN_RISKS.md` — where systemic risks are tracked.
