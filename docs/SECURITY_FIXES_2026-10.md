# Security & Robustness Fixes — 2026-10-07

Applied on top of Phase 6. Run `bun install && bun run db:push` after pulling
(schema changed: `Session.lastActivityAt`).

## Auth & tenancy
- **Demo-tenant fallback is now opt-in** via `DEMO_MODE=true`. Default (production)
  behavior: unauthenticated requests receive **401 on all routes**. New helper
  `requireAuthenticatedTenant()` for mutating handlers (`src/lib/tenant.ts`).
- **`requireTenantOwnership()` implemented** — fail-closed entity→model map;
  returns 404 for cross-tenant access (no existence leak).
- **Session idle timeout fixed** — sliding 12 h window based on new
  `Session.lastActivityAt` (updated on use, throttled to 1 write/minute). Previously
  sessions were killed 12 h after creation regardless of activity.

## SCIM
- `/api/scim/Users` now **requires the tenant's SCIM bearer token**
  (constant-time comparison). The token is never read from body/query.
- Provisioned users get a `crypto.randomBytes` temp password (was `Math.random`).

## Webhooks / SSRF
- New `src/lib/url-guard.ts` blocks non-http(s) schemes, localhost, and
  private/loopback/link-local/CGNAT IPs at endpoint creation **and** at delivery time.
- Note: DNS is not resolved at check time; use an egress proxy for full
  DNS-rebinding protection.

## Rate limiting
- Token bucket read-modify-write is now wrapped in a Prisma transaction —
  concurrent requests can no longer overspend tokens.

## Infra hygiene
- Uploads use `UPLOAD_DIR` env (default `<cwd>/uploads`) — no more hardcoded
  `/home/z/my-project` paths. `.env` uses relative `DATABASE_URL`.
- Added `.env.example`, `.gitignore`; `db/`, `uploads/`, `.env` excluded from VCS.
- `package.json` renamed to `procureatlas-ai`, dropped deprecated
  `@types/bcryptjs`, added `vitest` + `bun run test`.
- Security headers (CSP, HSTS, nosniff, frame-deny, Permissions-Policy) in
  `next.config.ts`; `reactStrictMode` re-enabled.

## Tests (scaffold)
- `tests/unit/url-guard.test.ts` — SSRF guard cases incl. cloud metadata IP
- `tests/unit/i18n.test.ts` — locale lookup/fallback
- `tests/unit/llm-sanitize.test.ts` — prompt-injection sanitization + hashing

## Still open (follow-up)
- Purge `db/custom.db` / `.env` / `uploads/` from git history (`git filter-repo`)
- Virus scanning + real PDF extraction in the upload pipeline
- Redis-backed rate limiting for multi-instance deployments
- URL routing (deep links) per original roadmap
