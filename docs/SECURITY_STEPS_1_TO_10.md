# Security steps 1–10

Internal mutations require a real session, including when DEMO_MODE is enabled. Contributors can edit evidence, uploads, pursuits, proposals and drafts. Managers review extractions and approvals and update financial rates. Administrators manage API keys, approval chains, connectors and webhooks and view audit/system data. Owners retain billing and owner-account control. Viewers may update their own notification state and preferences.

Every API-key `/api/v1` read requires `api:read`; writes require `api:write`. Keys must belong to a tenant. Grant both scopes when an integration needs both. Inbound ingestion uses independent source authentication.

## Schema upgrade

Deployment databases require this upgrade (Node 20.12 or later). Stop application writers and back up deployment data. Preview with `node scripts/security-upgrade-2026-10.mjs`, then apply with `node scripts/security-upgrade-2026-10.mjs --apply`. An explicit database can be supplied with `--database <absolute-path>`. The upgrade creates an additional consistent SQLite backup, runs schema changes transactionally and preserves all existing rows. It can be run again safely. Run `npx prisma generate` when installing the updated schema. The local workspace database was upgraded after disposable-database verification; its pre-upgrade backup is stored alongside it with a `.security-*.bak` suffix.

Historical null-tenant embeddings remain inaccessible to tenant API searches. Existing inbound records receive null event IDs; new requests require durable unique `(source, eventId)` IDs.

Extraction approvals now upsert a private `TenantRequirementReview` annotation and never create global `Requirement` rows. Rejection removes the private annotation. The tenant review queue exposes the reviewed items from its own extraction. Shared canonical requirements remain under trusted source ingestion and platform operator control. Past tenant-created canonical rows cannot safely be reassigned automatically: operators should compare rows whose `sourceDoc` starts with `LLM extraction` against source documents and remove or republish them after review.

## Inbound webhook signing

Configure `INBOUND_WEBHOOK_SECRETS` as a JSON object mapping source codes to random, source-specific secrets. Empty or invalid configuration rejects all inbound requests. A tenant integration must never receive a trusted global ingestion source's secret.

Send `x-webhook-source`, `x-webhook-event`, `x-webhook-id`, `x-webhook-timestamp` and `x-webhook-signature`. The timestamp is Unix seconds and must be within five minutes. Event IDs may contain letters, digits, underscores, colons and hyphens, and must remain stable across retries. Sign the exact UTF-8 request body using:

```js
const signature = 'sha256=' + createHmac('sha256', sourceSecret)
  .update(`${source}.${eventType}.${eventId}.${timestamp}.${body}`)
  .digest('hex')
```

Authentication and JSON validation happen before database writes. Bodies are limited to 1 MiB. A duplicate accepted event returns 409 and never creates another tender; failed events must be retried through an operator-controlled recovery process.

Outbound deliveries reject private IP literals and DNS answers, pin the checked address, keep the original TLS hostname, never follow redirects and retain at most 2,000 response bytes. Upload categories are limited to `evidence`, `tender_document`, `bid_document` and `proposal`. Evidence links require records belonging to the tenant; proposal citations also require the proposal's company.
