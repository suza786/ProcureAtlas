# QA Plan — ProcureAtlas AI

**Status:** Phase 1 — manual verification only. Phase 2 introduces automated test suites.
**Frameworks:** Vitest (unit + integration), Playwright (e2e), axe-core (accessibility), k6 (load). All Phase 2 unless noted.
**Last updated:** 2026-09-30

---

## 1. Testing Pyramid

```
        ┌──────────┐
        │   E2E    │  ~5% — Playwright; full user journeys
        ├──────────┤
        │ Integr.  │  ~25% — API routes + DB (test DB); service-layer flows
        ├──────────┤
        │  Unit    │  ~70% — pure functions; scoring engine; normalizers
        └──────────┘
```

| Layer | Framework | Scope | Phase |
|---|---|---|---|
| Unit | Vitest | Pure functions, scoring engine, normalizers, RBAC helpers, audit-log builders | Phase 2 |
| Integration | Vitest + Test DB | API routes against a fresh test DB; service-layer flows; multi-tenant isolation | Phase 2 |
| E2E | Playwright | Full user journeys (signup → discovery → pursuit → compliance → approval) | Phase 2 |
| Accessibility | axe-core (via Playwright) | WCAG 2.1 AA on every page | Phase 2 |
| Performance | Lighthouse CI + k6 | Performance budgets; load tests | Phase 3 |
| Security | SAST (Semgrep), DAST (ZAP), dependency scan (Snyk/Dependabot) | See `SECURITY.md` §19 | Phase 2 (SAST), Phase 3 (DAST) |

---

## 2. Frameworks + Setup

### 2.1 Unit + integration (Vitest)

- `vitest.config.ts` — configures test environment, coverage thresholds (≥ 80% lines / ≥ 70% branches).
- Tests live alongside source: `src/lib/scoring/__tests__/eligibility.test.ts`.
- Integration tests use a fresh SQLite test DB per test file (Prisma test schema); teardown drops all tables.
- Snapshot testing used sparingly (API response shapes only, not content).

### 2.2 E2E (Playwright)

- `playwright.config.ts` — Chromium, Firefox, WebKit; desktop + mobile viewports.
- Tests in `/e2e` directory; one test file per user journey.
- Test fixtures: demo tenant seeded before each test run; teardown clears tenant.
- CI: runs on every PR against staging build.

### 2.3 Accessibility (axe-core)

- Integrated into Playwright; runs axe-core on every page after navigation.
- Violations fail the build (Phase 2). Critical violations only fail in Phase 2; full WCAG AA gate in Phase 3.

---

## 3. Test Fixtures

### 3.1 Seed data

- `scripts/seed.ts` is idempotent and used both for dev and for test DB seeding.
- Test fixture: 1 tenant, 1 company, 12 tenders across all 7 markets, 8 evidence items, 4 pursuits, 6 alerts.
- Additional fixtures per test scenario: `__fixtures__/eligibility_edge_cases.ts` (companies with / without specific certifications), `__fixtures__/amendment_chains.ts` (tenders with multiple amendments), `__fixtures__/cross_portal_duplicates.ts` (same tender on World Bank + borrower portal).

### 3.2 Test DB

- SQLite test DB at `file:./test.db` (Phase 1–2); PostgreSQL test container (Phase 3+ via Testcontainers).
- Each test file gets a fresh DB; setup + teardown in `beforeEach` / `afterEach`.

---

## 4. CI Expectations

Every PR must pass:

1. **Lint** — `bun run lint` (ESLint).
2. **Type check** — `tsc --noEmit`.
3. **Unit tests** — `vitest run` (with coverage report).
4. **Integration tests** — `vitest run --config vitest.integration.config.ts`.
5. **Build** — `bun run build` (catches Next.js build errors).
6. **SAST** — Semgrep security rules.
7. **Dependency scan** — Dependabot / Snyk.

E2E runs on merge to `main` (not per-PR, for cost).

---

## 5. Deterministic Scoring Tests

The scoring engine is the most business-critical deterministic component. It must be exhaustively tested.

### 5.1 Eligibility engine tests

- Each criterion type (`TURNOVER`, `YEARS_IN_BUSINESS`, `SIMILAR_PROJECTS`, `CERTIFICATION`, `REGISTRATION`, `PERSONNEL`) tested with: pass case, conditional case, fail case, not-applicable case.
- Threshold edge cases (exact match, off-by-one).
- Currency conversion edge cases (FX rate snapshot).
- Multi-currency evidence (BDT financial statement vs. USD tender threshold).

### 5.2 Opportunity Fit tests

- Capability tag matching (exact, partial, none).
- Sector tag matching.
- Geographic coverage matching.
- Weighted component aggregation.

### 5.3 Submission Readiness tests

- Compliance matrix coverage (0%, 50%, 100%).
- Document completeness (cover letter / technical / financial / declarations).
- Approval workflow status.
- Days-to-deadline factor.

### 5.4 Snapshot stability

- `(tenderId, companyId, evidenceSnapshotHash)` → score is a pure function. Tests verify that the same inputs always produce the same outputs (snapshot tests on score breakdowns).
- Any change to the scoring formula triggers a snapshot review.

---

## 6. Evidence-Gating Tests

These tests verify that the AI cannot make claims without evidence.

- LLM output asserting a company fact with no matching Evidence ID is rejected.
- LLM output asserting a company fact with a matching Evidence ID is accepted and the Evidence ID is recorded with the claim.
- Compliance matrix item marked Compliant without an Evidence ID is rejected unless the user has Manager+ role AND provides a documented reason.
- Evidence append-only chain: superseding an Evidence record creates a new record; the old record is preserved with `supersededById`; the old record's data cannot be modified.
- Evidence verification: only Manager+ can verify; verification writes an audit log entry.

---

## 7. Multi-Tenancy Isolation Tests

These tests verify that no tenant can read or write another tenant's data.

- Tenant A user requests Tenant B's tender → 404 (not 403, to avoid leaking existence).
- Tenant A user POSTs to create a pursuit for Tenant B's tender → rejected at service layer.
- Tenant A user requests Tenant B's evidence via signed URL → rejected.
- Tenant A user requests Tenant B's data via API with `tenantId` parameter → `tenantId` ignored (derived from session).
- Cache key isolation: Tenant A's cached Tender Digital Twin is not returned to Tenant B's request.
- Search index isolation: Tenant A's documents do not appear in Tenant B's search results.

---

## 8. Security Tests

- **SAST** — Semgrep rules for: SQL injection (no raw queries), XSS (no `dangerouslySetInnerHTML` without sanitization), hardcoded secrets, insecure crypto.
- **Auth tests** — every API route tested with: no auth (401), wrong tenant (404), insufficient role (403), valid auth (200).
- **Object-level authorization** — IDOR tests for every entity type.
- **Input validation** — every API input tested with: valid, missing, malformed, oversized, malicious (SQLi / XSS / NoSQLi / prompt-injection markers).
- **Rate limiting** — verify 429 response after limit; verify `Retry-After` header.
- **File upload** (Phase 2) — magic-byte validation; MIME type allowlist; size limit; virus-scan rejection.
- **Dependency scan** — Dependabot / Snyk on every PR; critical vulnerabilities block merge.
- **Container scan** — Trivy on every image build; critical vulnerabilities block deploy.
- **DAST** (Phase 3) — OWASP ZAP baseline scan on staging weekly; new findings ticketed.

---

## 9. Performance Budgets

| Metric | Budget | Enforcement |
|---|---|---|
| First Contentful Paint | ≤ 1.8s (cold) | Lighthouse CI in PR build |
| Largest Contentful Paint | ≤ 2.5s (cold) | Lighthouse CI |
| Cumulative Layout Shift | ≤ 0.1 | Lighthouse CI |
| Total Bundle Size (JS) | ≤ 350 KB gzipped | webpack-bundle-analyzer in CI |
| API p50 (list) | ≤ 150 ms | k6 load test |
| API p95 (list) | ≤ 300 ms | k6 load test |
| API p95 (Tender Digital Twin) | ≤ 800 ms | k6 load test |
| API p95 (scoring) | ≤ 500 ms | k6 load test |
| Scoring engine compute | ≤ 100 ms per tender | Vitest benchmark |

Performance budget violations trigger a non-blocking warning in Phase 2; blocking in Phase 3.

---

## 10. Accessibility Tests

- **axe-core** integrated into Playwright; runs on every page after navigation.
- Violations: critical fail build in Phase 2; full WCAG AA fail build in Phase 3.
- **Manual keyboard test** — every interactive element reachable via keyboard; visible focus ring; logical tab order.
- **Screen reader test** — NVDA + VoiceOver spot checks on critical journeys (signup, pursuit creation, compliance matrix edit).
- **Color contrast** — automated via axe-core; manual spot checks on status colors.
- **Reduced motion** — verify `prefers-reduced-motion` disables Framer Motion transitions.

---

## 11. Load Test Plan

### 11.1 Tool: k6

### 11.2 Scenarios

| Scenario | Profile | Target |
|---|---|---|
| Normal read load | 50 concurrent users, mixed API reads | p95 ≤ 300 ms; error rate ≤ 0.1% |
| Peak read load | 200 concurrent users, mixed API reads | p95 ≤ 800 ms; error rate ≤ 0.5% |
| Burst traffic | 1000 requests in 10 seconds to `/api/tenders` | No 5xx; 429 above rate limit |
| Scoring load | 20 concurrent scoring computations | p95 ≤ 500 ms |
| Document upload (Phase 2) | 10 concurrent 10 MB uploads | All succeed within 30s |
| LLM extraction (Phase 2) | 5 concurrent document extractions | All complete within 60s |

### 11.3 Cadence

- Normal + peak read load: weekly against staging.
- Burst / scoring / upload: monthly.
- LLM extraction: pre-release.
- Annual full load test before each major release.

---

## 12. Test Data Management

- Test DB seeded fresh per test run (no shared state).
- PII: test fixtures use synthetic data only; no real supplier / buyer / tender data in fixtures.
- LLM test fixtures: pre-recorded LLM responses (no live LLM calls in CI); live LLM tests run nightly against staging with a small token budget.
- Cleanup: every test file tears down its own data; CI fails on leftover data.

---

## 13. Test Reporting

- Unit + integration: JUnit XML → CI dashboard; coverage report → Codecov.
- E2E: Playwright HTML report; screenshots + video on failure.
- Accessibility: axe-core report; violations listed with WCAG criterion.
- Performance: Lighthouse report; k6 summary.
- All reports published to CI dashboard; trends tracked over time.

---

## 14. Phase 1 Deviations

- **No automated tests wired in Phase 1** — manual verification only (lint + dev server + agent-browser smoke).
- **No CI pipeline configured** — local verification only.
- **No coverage threshold** — manual review of test coverage during Phase 2 planning.

Phase 2 priority: wire Vitest + Playwright + axe-core; establish CI pipeline; write scoring engine + multi-tenancy + evidence-gating tests first.
