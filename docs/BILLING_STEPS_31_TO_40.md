# Audit, billing, usage, analytics and frontend fixes

## Implemented

1. Audit records distinguish user, API-key and system actors. API keys never occupy user-ID fields; exports retain their own API-key requester field. Logout resolves the session user's actual tenant. The upgrade repairs recoverable legacy identities without inventing missing events.
2. Direct plan switching requires both `DEMO_MODE=true` and `DEMO_BILLING_SWITCHING=true`. Production changes use signed Stripe snapshot events with trusted customer bindings and configured price-to-plan mappings. Receipts, subscription limits and tenant plans update transactionally. Duplicate, stale and mismatched events cannot grant access; revocation wins equal-second event races.
3. All eight plans share one definition in `src/lib/plans.ts`, including billing quotas and rate tiers. Billing UI and initialization use it; paid legacy plan names no longer fall back to free request rates. Existing advertised prices are preserved; unspecified legacy prices require a quote.
4. Tenant API requests use a request context and usage ledger rather than selected audit action names. Repeated or concurrent tenant lookups share one quota decision. Provider attempts and token usage include drafting and unsuccessful output validation. Provider-reported tokens are preferred; missing usage is explicitly estimated. Unknown failures retain separately visible reservations, never fabricated consumed-token values. Quotas are checked before provider work and pursuit creation. Tracked tenders mean distinct tenders in that tenant's pursuits, not the shared catalog. SCIM provisioning checks seat capacity.
5. Subscription initialization uses one transactional upsert service with canonical limits. Unverified, expired or delinquent production subscriptions receive free entitlements; explicit demo switching remains available with both flags. Billing and logout remain accessible when API quotas are exhausted.
6. Dashboard counts and pipeline totals use uncapped database aggregates. Deadline previews exclude expired and inactive tenders; completed/no-bid pursuits are excluded from pipeline. Alerts rank critical, high, medium, low explicitly, independently of preview caps.
7. Awards preserve original amount/currency and support normalized USD with rate/date/source provenance. Existing USD awards receive safe identity normalization; other currencies use dated tenant FX at award date or remain unknown. Award/buyer/competitor summaries aggregate complete filtered datasets, report conversion coverage and average only known values.
8. Selling price uses `cost / (1 - margin)`; margin and markup are distinct. Margin must be below 100%, contingency is bounded and amounts must be finite/nonnegative. Bid-to-tender comparisons convert bid currency to USD with dated rates; missing conversions display unknown.
9. Frontend API requests check HTTP status, JSON and required response containers. Shared notices distinguish sign-in, permission, not-found, malformed responses and retryable failures. Failed mutations retain forms instead of displaying success. Billing/Developer screens show actual usage and token accounting, not synthetic history or costs.
10. Discover sends `status=all`, uses bounded limit/offset pagination with previous/next controls, resets pages on filters and clears recovered errors.

## Billing configuration

- Set `STRIPE_WEBHOOK_SECRET` to the signing secret for `/api/billing/events`.
- Set `STRIPE_PRICE_PLANS` to a server-controlled JSON mapping such as `{"price_actual":"professional"}`.
- Establish `Subscription.stripeCustomerId` through trusted server-side administration. Browser metadata cannot establish tenant ownership. Bind `stripeSubscriptionId` when known; subsequent events must match it.
- Register snapshot events `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. Production rejects test-mode events; verified trials may grant access within their valid period. See [Stripe webhook verification](https://docs.stripe.com/webhooks).
- Production checkout/customer-binding setup still requires deployment credentials and provider configuration. Direct browser changes stay disabled until verified events arrive; no live charge or billing account change was performed.

## Metering boundaries

- Quotas apply to the current subscription period. A request with a resolved authenticated tenant is counted even when it subsequently fails validation, permission or rate checks. Anonymous requests cannot be assigned fictitious tenant usage.
- Provider responses lacking token metadata are marked `estimated`; calls without a response retain `reserved_upper_bound` reservations pending reconciliation. Billing exposes reported, estimated and unsettled counts. Reservations protect capacity but are not consumed-token totals.
- Accurate request history starts with the usage ledger. Historical audit logs cannot recover calls that were never recorded, so no guessed backfill is performed.
- API call counts include billing recovery reads, but exhaustion does not lock users out of billing or logout. Pursuit/tracked-tender limits count tenant-owned records, including historical pursuits.

## Database and verification

`node scripts/billing-upgrade-2026-10.mjs` is a dry run. Stop application writers and use `--apply` to create a consistent SQLite backup and apply additive changes transactionally. `--database <absolute path>` selects another existing database. The workspace upgrade preserved row counts in all 55 existing tables and created two new ledger tables.

Workspace backup: `prisma/db/custom.db.billing-2026-10-09T15-52-38-298Z.bak`.

Windows generation helper `node scripts/generate-client-windows.mjs` regenerates Prisma without stopping a dev server that locks the installed engine DLL; it reuses the installed engine under a temporary name and cleans up its workspace copy.

Regression coverage includes audit actors/logout tenancy, signed billing/state races, canonical limits, quota concurrency/reservations, subscription trust, migration backups/preservation, dashboard caps, currency conversion/margin, API failures and Discover paging. Provider calls and billing events are mocked; no paid provider request is needed for tests.

Verified: 339 tests across 38 files pass; TypeScript, Prisma validation, targeted ESLint and the production Next.js build pass. Local production-server checks returned 200 for dashboard, Discover page two with all statuses, awards and billing usage, and confirmed that the usage ledger counted those requests. The checks required workspace SQLite write access for metering and made no provider or payment calls.
