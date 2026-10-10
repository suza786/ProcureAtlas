# Steps 51 to 57: client and release readiness

## Implemented

- All 29 module/detail views use dynamic imports. Recharts panels are deferred until their containers approach the viewport; chart dimensions remain reserved while loading.
- Catalog queries debounce searches, abort superseded requests, reject stale completions, and use a bounded 30-second in-memory cache. Authentication changes and successful mutations invalidate cached results. Operational pursuit/Bid Room responses remain uncached.
- Validated URL state supports module/detail links, Discover filters, refresh and browser Back/Forward. Mobile navigation uses a keyboard-accessible Radix sheet. Navigation moves focus to the main content.
- Global search returns actual catalog and tenant-owned company/pursuit records and opens their detail views. It supports cancellation, keyboard selection and retry states. Authentication changes discard pending search results.
- English/Bangla preferences are reactive and persisted. Shared translations cover module headings, common actions, forms, metrics and workflow screens; locale changes update the document language. Deadline formatting uses an explicit selected timezone. Raw customer/catalog content, API identifiers and some dynamic narrative summaries retain their original language.
- Analytics uses tenant-owned aggregates and durable daily UTC observations, with a latest 180-day window. Legacy seed history is excluded. Delayed snapshot jobs do not label today's values as yesterday's observations. Provider cost stays unknown rather than presenting a fabricated zero.
- Evidence, proposal and approval dialogs use accessible Radix dialogs with titles/descriptions, focus trapping/restoration, Escape handling and associated controls. Busy operations prevent accidental dismissal.
- Build, development, standalone start and client generation use portable Node commands. Runtime requires Node 22.13+, with Node 24 recommended. Versioned SQL deployment uses strict schema/history preflight, checksums, consistent backups and one atomic writer transaction. Schema push/reset commands were removed from the default package scripts.
- The release gate runs TypeScript, bounded full tests, production build, disposable two-tenant HTTP workflows, headless browser checks and platform smoke checks. Deployment preparation runs that gate before database changes.

## Release verification

Verified on 2026-10-10 using Node 24.15.0 on Windows. `node scripts/release-verify.mjs` exited zero.

- TypeScript passed both the explicit `--noEmit` check and Next.js build enforcement.
- Vitest passed all 468 tests across 65 files.
- The optimized production build and standalone asset copy passed.
- The disposable production server passed 90 real HTTP checks across two tenants: verified compliance, completed tasks, 18 reviewed proposal sections, assigned ordered approvals and atomic submission. Foreign reads/writes, private alert/search leakage, stale edits, approval bypasses and post-submission task changes were rejected.
- The headless browser passed real analytics rendering, mobile keyboard navigation, refresh and Back/Forward, reactive Bangla, labeled dialogs, focus trapping/restoration, global search, shareable tender details and tenant switching. No runtime/hydration errors were reported.
- Platform smoke checks passed authentication, private supplier annotations, quarantined uploads, CSV escaping, authenticated/tenant-bound/expiring export downloads, disabled-user credential rejection and worker startup.
- Scoped ESLint checks passed for the new core helpers, migration/runtime scripts, browser harness and tender-detail contract fix.

Release checks also found and repaired two response-contract bugs: unknown analytics costs were rejected by the browser validator, and tender details omitted their queried tenant-filtered alerts. Both have regression tests.

The workspace database `prisma/db/custom.db` was migrated after the gate passed. All 61 application tables retained their row counts, totaling 322 rows, and no migrations remain pending. Backup: `prisma/db/custom.db.backup-2026-10-09T19-28-39.313Z-219affb6-57bb-482e-935c-7d6a32afc210.sqlite`. The private verification receipt is `.private/release-migration-verification.json`.

## Operations

1. Install dependencies using `npm ci` on Node 24.
2. Configure production secrets and persistent SQLite/upload/export volumes. Disable demo authentication and demo billing switching for production.
3. Ensure Chrome/Edge is installed for the gate, or set `CHROME_PATH`.
4. Run `npm run db:check` to inspect the target database without writes.
5. Run `npm run deploy:prepare` to verify the release and apply reviewed migrations. Preserve the printed database backup.
6. Run `npm start` and `npm run worker` as separate supervised services. The worker captures daily snapshots and processes durable jobs.

The release fixtures use disposable databases and private browser profiles. They do not send provider requests or use production sessions. These checks do not measure real-world load or replace deployment-specific billing, email, scanner and webhook configuration checks. No application publication or persistent service start is part of this change.
