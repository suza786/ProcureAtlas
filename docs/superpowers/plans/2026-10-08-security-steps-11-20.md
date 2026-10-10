# Security and robustness: original steps 11–20

Implement the ten supplied fixes in place, preserving prior work and tenant data. Use debugging, test-first development and verification before completion. Execute inline; no commits or database resets.

1. Authenticate all internal catalog reads using the existing demo-aware tenant policy; isolate tender alerts to the caller tenant.
2. Add shared JSON errors and Zod validation for every JSON body, route ID, state/date/currency/number and bounded pagination. Wrap all handlers consistently.
3. Make owner administration transactional: preserve an owner, restrict owner operations, revoke sessions and API keys on password reset or role changes/deactivation.
4. Bound login credentials, throttle account and trusted proxy IP identities, and transact atomic failure increments and session creation.
5. Repair compiler errors with Prisma query types and distinct proposal list/detail types; enable build enforcement.
6. Repair translation assertions and expand tests for authentication, validation, owner invariants, throttling and approvals, including concurrent requests.
7. Restrict seed execution to an explicitly named demo database, scope tenant cleanup, upsert shared fixtures and run database changes in one transaction. Verify twice on a disposable database containing another tenant.
8. Give connector samples stable IDs. Keep mock results in preview only, with no shared catalog writes; reject mock execution in production.
9. Transact approval decisions, enforce assignment/role/pending/prior-step checks, and gate submission on all configured steps. Prevent direct state bypasses.
10. Run full unit suite, compiler, Prisma validation and production build; document deployment/configuration changes and limits.
