# Security Baseline — ProcureAtlas AI

**Status:** Phase 1 — NextAuth wired-ready but not enforced (MVP open routes). All controls below are the baseline for production (Phase 2+). Items marked "Phase 2+" are not yet enforced in Phase 1.
**Standards alignment:** OWASP ASVS Level 2 (target), OWASP API Security Top 10, OWASP LLM Top 10.
**Last updated:** 2026-09-30

This document defines the security baseline for ProcureAtlas AI. It complements `THREAT_MODEL.md` (which enumerates threats and mitigations) and `AI_ARCHITECTURE.md` (which covers LLM-specific controls).

---

## 1. Multi-Tenancy

### 1.1 Isolation model

- Every tenant-scoped entity carries a non-null `tenantId` column.
- **Service-layer enforcement** — every database query passes through a service-layer wrapper that injects `tenantId` from the authenticated session. No controller-level raw query bypasses the wrapper. See ADR-006.
- Phase 3+ hardening: PostgreSQL Row-Level Security (RLS) policies layered on top of service-layer enforcement as defense-in-depth.
- Cross-tenant queries are prohibited at the service layer. The only legitimate cross-tenant query is the platform-admin API (separate auth scope, separate audit log, Phase 3+).

### 1.2 Object storage isolation (Phase 2+)

- Documents stored under `s3://bucket/{tenantId}/{entityType}/{entityId}/{fileId}`.
- Access via per-object signed URLs with short TTL (≤ 15 minutes).
- Cross-tenant object access rejected at signed-URL issuance time.

### 1.3 Cache isolation (Phase 2+)

- Redis cache keys are namespaced by `tenantId`. Cache reads validate tenant scope before returning data.
- No tenant's data is ever cached under a key readable by another tenant.

---

## 2. RBAC

### 2.1 Roles

| Role | Scope | Permissions |
|---|---|---|
| **Owner** | Tenant | All actions including billing, user management, integration management, tenant deletion. |
| **Admin** | Tenant | All actions except billing + tenant deletion. |
| **Manager** | Tenant | Manage pursuits, evidence, compliance, tasks, approvals; invite Contributors; cannot manage billing or integrations. |
| **Contributor** | Tenant (scoped) | Create / edit pursuits, evidence, compliance items, tasks; cannot approve consequential actions; cannot manage users. |
| **Viewer** | Tenant (read-only) | Read all tenant data; no writes. |

### 2.2 Enforcement

- Every API route declares required role(s); enforcement at API entry point.
- Every UI surface renders only actions the user's role can perform; hidden actions are also enforced server-side (never trust the client).
- Phase 2+: role-to-permission matrix externalized to a policy engine (Casbin or OPA) for auditability and runtime updates without redeploy.

---

## 3. Authentication

### 3.1 Password auth (Phase 2+)

- Argon2id password hashing (memory-hard, parameterized).
- Password policy: ≥ 12 chars, ≥ 1 letter, ≥ 1 digit, ≥ 1 symbol, breached-password check via HaveIBeenPwned API (k-anonymity).
- Account lockout: 5 failed attempts → 15-minute lockout; 10 failed → 1-hour lockout; alert tenant admins.

### 3.2 MFA (Phase 2+)

- TOTP-based MFA (RFC 6238) as default; backup codes mandatory at enrollment.
- SMS MFA offered only where TOTP is not feasible (e.g., regulated users without smartphones); WebAuthn / passkey support targeted for Phase 3.
- MFA required for Owner / Admin / Manager roles; optional for Contributor / Viewer.

### 3.3 SSO (Phase 2+)

- OIDC-based SSO (Google, Microsoft Entra, Okta, Auth0). Tenant Admin configures provider + claims mapping.
- SSO users may be exempt from MFA at the platform level if the IdP enforces MFA (verified via claims).
- SCIM provisioning (Phase 3+) for enterprise tenants.

### 3.4 Session management (Phase 2+)

- HTTP-only, Secure, SameSite=Lax cookies.
- Session TTL: 12 hours idle, 7 days absolute; refresh on activity.
- Session revocation list checked on every request.
- Concurrent session limit per user (configurable per tenant; default 5).

---

## 4. Encryption

### 4.1 In transit

- TLS 1.2+ enforced; TLS 1.3 preferred.
- HSTS preload with `max-age=63072000; includeSubDomains; preload`.
- Certificate pinning on mobile clients (Phase 6+, if any).
- Internal service-to-service: mTLS where applicable (Phase 3+).

### 4.2 At rest

- Database: PostgreSQL TDE or volume-level encryption (AWS RDS encryption / GCP disk encryption).
- Object storage: S3 server-side encryption (SSE-KMS) with tenant-specific KMS keys (Phase 3+).
- Secrets: AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault — never in env files committed to git.
- Backups: encrypted with separate key.

---

## 5. Secret Management

- `.env.example` checked in; real `.env` never committed.
- Production secrets in Secrets Manager; rotated quarterly (see `DEPLOYMENT.md` runbook).
- No secrets in client bundles; `NEXT_PUBLIC_*` prefix strictly limited to non-sensitive public values.
- Secret access logged; alerting on unusual access patterns.

---

## 6. Audit Trails

- Every create / update / delete on a tenant-scoped entity writes an `AuditLog` entry: `actorType`, `actorId`, `action`, `entityType`, `entityId`, `beforeJson`, `afterJson`, `requestId`, `ipAddress`, `userAgent`, `timestamp`.
- Audit log is append-only; tamper-evident (hash chain, Phase 3+).
- Audit log retention: 7 years (procurement regulatory requirement).
- Tenant Admins can export their tenant's audit log (Phase 3+).

---

## 7. Rate Limiting + DDoS

- Per-IP rate limit at edge (Cloudflare / WAF): 600 req/min/IP default.
- Per-user: 100 req/min.
- Per-tenant: 1000 req/min.
- Per-API-key (public API, Phase 5): tier-dependent.
- Login / signup endpoints: 5 req/min/IP (stricter).
- Exponential backoff on 429 responses; `Retry-After` header.

---

## 8. Session Security

- Cookies: HTTP-only, Secure, SameSite=Lax (Strict for sensitive flows).
- CSRF: SameSite cookies + double-submit token for state-changing forms.
- Session invalidation on password change, role change, MFA enrollment.
- Idle session timeout: 30 minutes for Owner / Admin; 12 hours for others.

---

## 9. API Authorization

- Every API route requires an authenticated session (Phase 2+) or a valid API key (Phase 5).
- Tenant scope resolved from session / API key and injected into every query.
- Object-level authorization: every read / write checks that the object belongs to the caller's tenant.
- Role-based authorization: every route declares required role(s); enforced at entry point.

---

## 10. Object-Level Authorization

- The pattern `getEntityForTenant(entityId, tenantId)` is the only authorized way to fetch a tenant-scoped entity. Direct `getEntity(entityId)` without tenant scope is prohibited at the service-layer level.
- ESLint rule (Phase 2+) flags any Prisma query missing a `where: { tenantId }` clause.

---

## 11. Secure File Upload (Phase 2+)

- **Type validation:** magic-byte check (not extension only); allowlist of MIME types (PDF, DOCX, XLSX, PNG, JPG); reject everything else.
- **Size limit:** per-tenant configurable; default 25 MB per file; 100 MB per upload session.
- **Virus scan:** ClamAV scan on every upload; reject on positive; quarantine for review.
- **Storage:** direct-to-S3 via presigned URL (file never transits the application server).
- **Signed URL access:** every download via short-TTL (≤ 15 min) signed URL; no public ACLs.
- **Filename sanitization:** original filename preserved as metadata; stored filename is a UUID.
- **Document isolation:** documents stored under tenant-scoped S3 prefix; cross-tenant access rejected.

---

## 12. LLM / Agent Security Controls

See `AI_ARCHITECTURE.md` for the full LLM security architecture. Summary:

- Backend-only LLM invocation; `z-ai-web-dev-sdk` never imported in client components.
- Input sanitization: untrusted text wrapped, control chars stripped, length caps.
- Output validation: strict schema parse; source-text verification; confidence thresholds.
- Tool-call authorization: per-task tool surface; RBAC + tenant scope; audit log.
- **No autonomous consequential actions** — see ADR-007. Human-in-the-loop for all submissions, declarations, partner engagement, financial commitments.
- Evidence gating: LLM may not output a company factual claim without an Evidence ID.
- Hallucination prevention: source-cited extraction; no LLM-only entity creation; translation labeling.
- No PII in prompts (Phase 3+ PII scrubbing); tenant data minimization.
- No training on tenant data — provider contract prohibits.

---

## 13. Prompt-Injection Resistance

- Untrusted text never enters a prompt as instructions.
- Tool-calling prompts constructed only from platform-controlled templates.
- LLM-emitted numbers / dates / IDs / statuses never persisted as truth.
- Every LLM output validated against source text and against the evidence graph.
- See `AI_ARCHITECTURE.md` §3 for the full control set.

---

## 14. Document Isolation (Phase 2+)

- Documents stored tenant-scoped; cross-tenant access rejected.
- Document processing pipeline runs in isolated worker (no shared in-memory state across tenants).
- LLM extraction over documents: each extraction request scoped to one tenant; no cross-tenant context in the prompt.
- Extracted text cached tenant-scoped; never reused across tenants.

---

## 15. LLM Output Validation

- Every LLM output parsed against strict schema (Zod / JSON Schema); invalid output rejected.
- Extracted entities verified against source text (fuzzy match on snippet).
- LLM-emitted entity attributes flagged `extractionConfidence`; below threshold → human review.
- LLM-emitted translations labeled as derived content with confidence score; original text preserved.
- LLM-emitted draft proposal sections clearly marked as drafts; require human review before submission.

---

## 16. Data Retention + Disposal

| Data type | Retention | Disposal |
|---|---|---|
| Tenant data (active) | While tenant is active | Soft-delete on request; hard-delete after 90 days |
| Audit log | 7 years | Crypto-shredded after retention |
| Documents (evidence / tender packages) | While tenant is active + 90 days | Hard-delete after retention |
| Backups | 35 days rolling | Auto-expire |
| LLM call logs | 90 days | Auto-expire |
| Tenant deletion | 90-day grace period | Then hard delete across primary + backups + cache |

Tenant deletion is a two-phase operation: soft-delete (tenant disabled, data preserved for 90 days), then hard-delete (data crypto-shredded across primary DB, backups, cache, object storage). Documented in the runbook in `DEPLOYMENT.md`.

---

## 17. Backups + DR

- **Database:** daily snapshot + continuous WAL archiving (PostgreSQL); 35-day retention; cross-region replica (Phase 3+).
- **Object storage:** S3 versioning + cross-region replication (Phase 3+).
- **RPO:** ≤ 15 minutes (PostgreSQL WAL).
- **RTO:** ≤ 4 hours for full recovery; ≤ 30 minutes for read replica promotion.
- **DR plan:** documented + tested quarterly (see `DEPLOYMENT.md` runbook).

---

## 18. OWASP Alignment

| Standard | Coverage |
|---|---|
| **OWASP ASVS Level 2** | Target. Controls in §1–§11 above map to ASVS V1–V14. |
| **OWASP API Top 10** | API1 (BOLA) → §10; API2 (Broken Auth) → §3; API3 (BOPLA) → §9; API4 (UFRA) → §7; API5 (BFLA) → §2; API6 (UCI) → §11; API7 (SSRF) → §11 (URL allowlist); API8 (SCI) → §11; API9 (IMA) → §3.4; API10 (UUA) → §6. |
| **OWASP LLM Top 10** | LLM01 (Prompt Injection) → §13; LLM02 (Insecure Output) → §15; LLM03 (Training Data Poisoning) → not applicable (we don't train); LLM04 (Model DoS) → §7 + token budget; LLM05 (Supply Chain) → §2.1; LLM06 (Sensitive Info Disclosure) → §14; LLM07 (Insecure Plugin Design) → §12 (tool surface); LLM08 (Excessive Agency) → §12 (no autonomous consequential actions); LLM09 (Overreliance) → §1.1 + §4; LLM10 (Model Theft) → provider-side; not our scope. |

---

## 19. Security Testing (Phase 2+)

- **SAST** — Semgrep + ESLint security rules in CI.
- **DAST** — OWASP ZAP baseline scan on staging weekly.
- **Dependency scan** — Dependabot / Snyk on every PR.
- **Container scan** — Trivy on every image build.
- **Penetration test** — annual third-party pen test before each major release.
- **Threat model review** — at every phase gate; see `THREAT_MODEL.md`.

---

## 20. Incident Response

- Incident response plan documented in `DEPLOYMENT.md` runbook.
- Severity levels: SEV1 (data breach / outage), SEV2 (degraded / partial breach), SEV3 (minor).
- SEV1: page on-call 24/7; customer notification within 24 hours; postmortem within 7 days.
- All incidents logged in the audit trail; postmortems published to tenants for transparency.
