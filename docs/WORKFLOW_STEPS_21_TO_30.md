# Pursuit, compliance and proposal reliability

## Implemented behavior

1. Approval no longer submits a pursuit implicitly. Final approval verifies readiness and sets proposal/Bid approved in the approval transaction. The manager's **Record submission** action verifies readiness again and atomically sets proposal, Bid and pursuit submitted. Invalid transitions are rejected; submitted work is locked.
2. Compliance Matrix reads tenant-scoped persisted ComplianceItem rows and linked evidence through `/api/pursuits/:id/compliance`. Stored unverified/expired links are flagged, never synthesized.
3. Eligibility only credits fully satisfied mandatory checks supported by verified, current structured facts. Failures block eligibility; unknown checks remain visible and block submission.
4. Requirements carry `evaluationMetric`, `thresholdAmount`, `thresholdCurrency`, `thresholdUnit`, operator and review status. Legacy text stays unreviewed instead of receiving inferred currency conversions. Approved private extraction reviews refine canonical checks without changing shared requirements or removing mandatory gates. Currency rates retain dated tenant snapshots and scoring uses the latest applicable direct/inverse rate on or before evaluation.
5. Pursuit creation resolves the tenant's company, validates the tender, initializes draft Bid and gap compliance in a transaction, copies estimated USD value, and handles existing pursuits without duplication. Company selection is required when a tenant has several companies. Manager progression uses allowed stages and an expected-stage check.
6. Bid Room loads individual pursuit records, actual tasks/approvals/compliance and deterministic scoring. Managers advance stages; contributors complete/reopen tasks. Compliance/task edits invalidate approvals and readiness; submitted work is locked.
7. Extraction review conditionally claims pending reviews inside a transaction. Approval replay creates no duplicate private annotations or audit event; conflicting final decisions return 409.
8. AI prompts contain only current verified company evidence, certifications and references. Employees require separate verified evidence. Generated citations must use approved IDs inline, counts are computed from stored content and unique references, mandatory gaps are derived server-side, and warnings remain `[gap: ...]` markers. Generated sections require human review; citation validation alone does not establish factual truth.
9. Editor saves are serialized, errors and unsaved text remain visible, and pending saves finish before drafting, review or versioning. Section and proposal revisions reject concurrent edits with 409. Reload retains local text for deliberate reconciliation. Background responses cannot overwrite another editor instance.
10. Versions have a unique proposal/version key. A transaction claims the proposal revision, allocates after the persisted maximum and snapshots section content, citation IDs and referenced records. Missing/invalid legacy citations remain explicitly marked in historical snapshots.

## Preparing existing data

- Do not silently promote legacy thresholds or evidence. Review thresholds in the extraction review screen using structured fields. Use identical metric and unit names on requirements and evidence; binary proofs use amount 1, unit `boolean`, and operator `==`.
- Evidence creation accepts optional `factMetric`, `factAmount`, `factCurrency` and `factUnit`. Manager `PATCH /api/company/evidence` accepts `id`, `verified` and those optional fact fields, recording reviewer/time and revoking editable approvals. Money requires explicit currency on both threshold and evidence.
- `POST /api/currency-rates` requires `rateDate` in YYYY-MM-DD form. Rates are tenant-scoped; no fixed BDT/SGD/EUR conversions remain in eligibility scoring.
- Existing pursuits retain their original records; new creation initializes missing workflow data only for new pursuits. Historical proposal snapshots are preserved, with no fabricated evidence backfill.

## Database upgrade

`node scripts/workflow-upgrade-2026-10.mjs` is a dry run. Stop application writers, then run with `--apply`; use `--database <absolute path>` for a specific SQLite file. Duplicate keys cause preflight failure before changes. The script backs up with SQLite VACUUM INTO and applies additive columns and indexes transactionally. It can run repeatedly.

The workspace upgrade preserved row counts in all 55 existing tables and created `prisma/db/custom.db.workflows-2026-10-09T15-08-26-474Z.bak`.

## API concurrency contracts

- Section PATCH: `expectedRevision` is the section revision; success returns the new section and proposal revision/aggregates.
- Draft POST: `sectionId` and `expectedRevision`; changes during generation cause 409 without saving generated content.
- Proposal PATCH and version POST: `expectedRevision` is the proposal revision.
- Pursuit PATCH: `expectedStage` and allowed target `stage`; direct submission is rejected.

Tests cover tenant boundaries, review replay, stale/concurrent writes, atomic workflow updates, evidence/threshold validity, immutable versions, and disposable SQLite upgrades. AI provider calls are mocked in tests; no paid provider call is required for verification.

Verified: 241 tests in 27 files pass; TypeScript, Prisma schema validation and targeted ESLint pass. Production Next.js build passes. Read-only production-server checks returned 200 for actual pursuit details, compliance records and proposal details using the workspace SQLite database.
