# Workflow reliability implementation

Authorized scope: the user's ten workflow fixes. Preserve existing workspace changes and database rows.

1. Add explicit reviewed thresholds, evidence facts, dated rate history, revision counters and uniqueness constraints. Upgrade SQLite with preflight duplicate checks, backup, and one transaction.
2. Evaluate mandatory requirements from current verified facts; expose unknown outcomes without guessing currencies or thresholds.
3. Create pursuits, bids and compliance records atomically; expose tenant-scoped detail and compliance APIs and validated stage progression.
4. Claim extraction reviews once, with idempotent replay and private tenant requirement annotations.
5. Coordinate browser saves and reject stale section writes; invalidate approvals on edits.
6. Draft only from current verified records, validate inline citations, derive counts and readiness on the server, and require human review.
7. Allocate version numbers transactionally and snapshot cited records, including evidence IDs and validity.
8. Separate final approval from submission; enforce readiness and update proposal, bid and pursuit together.
9. Add regression coverage for evidence, ambiguity, tenancy, review replay and concurrency; run full tests, TypeScript, Prisma validation and production build.
