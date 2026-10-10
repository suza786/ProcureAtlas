# Security fixes: steps 1–10

Implement the ten authorized tasks in the current workspace, preserving existing changes.

1. Test and repair the role hierarchy; protect internal mutations and administrative reads with authenticated role checks. Return guard responses through a shared route wrapper.
2. Test and enforce explicit public API read/write scopes.
3. Authenticate inbound webhook bodies with source-specific HMAC secrets, timestamp freshness, bounded bodies and durable event deduplication.
4. Repair IP range validation; resolve and pin outbound webhook DNS, reject private answers and never follow redirects.
5. Validate upload categories and resolved paths before filesystem writes.
6. Scope embedding uniqueness, queries and entity ownership to the API key tenant.
7. Validate evidence ownership before upload and proposal section writes.
8. Store extraction review results as private tenant annotations, transactionally and idempotently; keep shared canonical requirements under trusted ingestion/operator control.
9. Supply a non-destructive schema upgrade and configuration documentation. Validate against a disposable database before applying to the workspace with a consistent backup.
10. Run targeted regression tests, the full unit suite and TypeScript checks; distinguish pre-existing failures.

Existing baseline: 15 TypeScript errors; 11 unit tests passed and 4 failed. Preserve existing data and secrets; never reset the database.
