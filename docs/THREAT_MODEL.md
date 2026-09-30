# Threat Model — ProcureAtlas AI

**Method:** STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) plus a dedicated LLM-specific threat section.
**Scope:** Multi-tenant procurement SaaS with AI features.
**Last updated:** 2026-09-30

This document enumerates threats relevant to ProcureAtlas AI and the mitigations in place (or planned). It complements `SECURITY.md` (baseline controls) and `AI_ARCHITECTURE.md` (LLM-specific controls). Threats are reviewed at every phase gate.

---

## 1. Spoofing

### S1. Credential compromise (password)

- **Threat:** Attacker obtains a user password via phishing / breach reuse and accesses the tenant.
- **Mitigations:** Argon2id hashing; breached-password check; MFA required for privileged roles; account lockout; session revocation on suspicious activity.

### S2. Session hijacking

- **Threat:** Attacker steals a session cookie via XSS / network sniffing / malware.
- **Mitigations:** HTTP-only, Secure, SameSite cookies; TLS 1.2+; CSP headers; short session TTL; idle timeout; session pinning to user-agent + IP (Phase 3+).

### S3. API key theft (Phase 5)

- **Threat:** API key leaked via git commit, logs, or shoulder-surfing; attacker uses it to exfiltrate tenant data.
- **Mitigations:** API keys hashed at rest (only hash compared); scoped per-tenant; revocable; rate-limited; logged; alerting on anomalous usage; short-lived keys default (≤ 90 days).

### S4. SSO IdP spoofing

- **Threat:** Attacker registers a malicious IdP and tricks a tenant admin into configuring it.
- **Mitigations:** IdP configuration requires Owner role + MFA re-authentication; OIDC discovery document verified; tenant admin training; configuration change audit-logged.

### S5. Tenant impersonation via parameter tampering

- **Threat:** Attacker modifies a request parameter (`tenantId`) to access another tenant's data.
- **Mitigations:** `tenantId` is never accepted from the client — always derived from the authenticated session at the service layer. See `SECURITY.md` §1.

---

## 2. Tampering

### T1. Tender data tampering via ingestion poisoning

- **Threat:** A compromised source connector (or a man-in-the-middle on a non-HTTPS source) injects tampered tender data (e.g., shifted deadline, altered value).
- **Mitigations:** Source connectors verify HTTPS + certificate pinning where applicable; ingestion preserves source hash + source URL + ingested-at timestamp; tamper-evident audit log; diff alerts on amendment ingestion.

### T2. Evidence tampering

- **Threat:** A user modifies an Evidence record to claim a certification they don't hold.
- **Mitigations:** Evidence is append-only with `supersededById` chain; verification requires Manager+ role; verification writes an audit log entry; file content hash stored; signed URL access only.

### T3. Compliance matrix tampering

- **Threat:** A user marks a GAP requirement as "Compliant" without evidence to inflate submission readiness.
- **Mitigations:** Compliance status changes require either an Evidence ID or a documented reason; Manager+ role to mark Compliant without evidence; audit log entry on every change.

### T4. Audit log tampering

- **Threat:** Attacker modifies the audit log to hide unauthorized actions.
- **Mitigations:** Audit log is append-only at the database layer (Phase 3+ WORM storage); hash chain (Phase 3+); off-site replication; quarterly integrity check.

### T5. Prompt-injection-driven data tampering

- **Threat:** Malicious text in a tender document injects instructions into an extraction LLM that causes it to write tampered values (deadline, value) to the database.
- **Mitigations:** Untrusted text wrapped, never as instructions; LLM output validated against source text (fuzzy match on snippet); extracted values flagged `extractionConfidence`; below threshold → human review; no LLM-emitted value persisted as truth without deterministic validation. See `AI_ARCHITECTURE.md` §3–4.

---

## 3. Repudiation

### R1. User denies performing an action

- **Threat:** A user claims they did not submit a tender / approve a bid / modify a compliance item.
- **Mitigations:** Every action audit-logged with actor, IP, user-agent, timestamp, before / after; session ID; request ID. MFA required for consequential actions.

### R2. Submitter denies submission

- **Threat:** A bid was submitted to a portal via the platform (Phase 4+ assisted submission); the user denies authorizing it.
- **Mitigations:** Submission requires explicit Approval workflow with named approver + MFA re-authentication; submission receipt stored with portal-side confirmation ID + timestamp.

### R3. Tenant denies API usage for billing

- **Threat:** Tenant disputes API call counts at billing time.
- **Mitigations:** Every API call logged with API key, tenant, endpoint, timestamp, response code; logs retained for 7 years; usage reports available to tenant admins.

---

## 4. Information Disclosure

### I1. Cross-tenant data leak via query

- **Threat:** A bug in the service layer causes a query to return another tenant's data.
- **Mitigations:** Service-layer tenant-scope enforcement on every query; ESLint rule flagging missing `where: { tenantId }`; integration tests verifying cross-tenant isolation; Phase 3+ PostgreSQL RLS as defense-in-depth.

### I2. Cross-tenant data leak via cache

- **Threat:** Redis cache key collision returns another tenant's data.
- **Mitigations:** Cache keys namespaced by `tenantId`; cache reads validate tenant scope; integration tests for cache isolation.

### I3. Cross-tenant data leak via object storage

- **Threat:** A signed URL for one tenant's document is shared with / leaked to another tenant.
- **Mitigations:** Signed URLs short-TTL (≤ 15 min); signed URL issuance validates tenant scope; object metadata includes tenant ID; cross-tenant access rejected.

### I4. Cross-tenant data leak via error messages

- **Threat:** An error message reveals the existence of another tenant's data (e.g., "Tender tend_X belongs to tenant Y").
- **Mitigations:** Generic error responses; no tenant-identifying info in errors; production error pages without stack traces.

### I5. PII leak via LLM prompt

- **Threat:** PII from tenant documents leaks into an LLM prompt that is logged and exposed to operators.
- **Mitigations:** PII scrubbing before LLM invocation (Phase 3+); LLM logs redact PII; tenant data minimization (only necessary fields in prompt); no training on tenant data.

### I6. PII leak via URL parameters

- **Threat:** Sensitive data (tender title, company name) appears in URL parameters logged by CDNs / proxies.
- **Mitigations:** Sensitive identifiers passed via request body or path parameters (not query string); URL parameters limited to non-sensitive filters.

### I7. Source data leak to other tenants

- **Threat:** Tenant A uploads a confidential bid document; the document text ends up in Tenant B's search index.
- **Mitigations:** Search index tenant-scoped; document processing pipeline runs in isolated worker per tenant; extracted text cached tenant-scoped; cross-tenant cache reads rejected.

---

## 5. Denial of Service

### D1. API flood

- **Threat:** Attacker floods the API with requests to degrade service.
- **Mitigations:** Per-IP, per-user, per-tenant rate limits (§7 of `SECURITY.md`); edge WAF; autoscaling; circuit breakers on downstream services.

### D2. LLM cost / latency DoS

- **Threat:** Attacker (or buggy client) triggers expensive LLM operations repeatedly, exhausting token budget and degrading latency.
- **Mitigations:** Per-tenant daily token budget; per-user LLM request rate limit; async execution for long-running tasks; graceful degradation when budget exhausted.

### D3. Document upload DoS

- **Threat:** Attacker uploads many large files to exhaust object storage.
- **Mitigations:** Per-tenant storage quota; per-upload size limit; per-upload session limit; ClamAV scan rate-limited.

### D4. Search index bloat

- **Threat:** Attacker creates millions of dummy tenders / pursuits to bloat the search index and degrade query latency.
- **Mitigations:** Per-tenant entity quotas (tenders tracked, pursuits created); rate limit on create operations; admin alerting on quota approach.

### D5. Connector backpressure

- **Threat:** A source connector is overwhelmed by a large amendment batch, blocking the ingestion queue.
- **Mitigations:** Connector rate-limited per source; ingestion queue has per-tenant fairness; backpressure propagation; circuit breaker on source failure.

---

## 6. Elevation of Privilege

### E1. Role escalation via parameter tampering

- **Threat:** A Contributor sends a request with `role: "Owner"` to elevate themselves.
- **Mitigations:** Role changes require Owner role + MFA re-authentication; role never accepted from client; audit log entry on role change.

### E2. Insecure direct object reference (IDOR)

- **Threat:** A user accesses another tenant's pursuit / tender / evidence by guessing the ID.
- **Mitigations:** Object-level authorization on every read; `getEntityForTenant(entityId, tenantId)` pattern; integration tests for IDOR.

### E3. Privilege escalation via LLM tool abuse

- **Threat:** A prompt-injected LLM agent invokes a privileged tool (e.g., `deleteEvidence`, `submitBid`) it should not be able to invoke.
- **Mitigations:** Per-task tool surface (an extraction agent cannot invoke submission tools); tool calls authorized against RBAC + tenant scope; tool calls audit-logged; **no autonomous consequential actions** (see ADR-007) — the LLM can never invoke a tool that performs a consequential action without explicit human approval.

### E4. Admin console access via stale role

- **Threat:** A former Admin's role was not revoked when they left the company; they access admin console.
- **Mitigations:** Session invalidation on role change; periodic access review (quarterly) for Owner / Admin roles; SSO JIT provisioning / deprovisioning (Phase 3+ SCIM).

### E5. API key scope escalation

- **Threat:** An API key with `mcp:read` scope attempts a write operation.
- **Mitigations:** API keys scoped per operation class; scope checked on every request; key revocation immediate; audit log on scope violation.

---

## 7. LLM-Specific Threats

### L1. Prompt injection

- **Threat:** Malicious text in a tender document, clarification question, or supplier-submitted material injects instructions into the LLM, causing it to leak data, perform unauthorized actions, or produce tampered output.
- **Mitigations:** See `AI_ARCHITECTURE.md` §3 — untrusted text wrapped, control chars stripped, no tool invocation from untrusted text, output validation, source-text verification.
- **Residual risk:** Sophisticated semantic injection may evade syntactic defenses; mitigated by evidence gating (§4 of `AI_ARCHITECTURE.md`) — the LLM cannot output a company factual claim without an Evidence ID, so injected "claims" are rejected at validation time.

### L2. Training data leakage

- **Threat:** Tenant data used to train the LLM is later exposed in another tenant's session (membership inference).
- **Mitigations:** Provider contract prohibits training on API inputs; verified at procurement; tenant data isolation in prompts; no shared prompt context across tenants.

### L3. Hallucinated claims

- **Threat:** LLM produces a plausible but false claim about a company (e.g., "Atlas Demo Co. holds ISO 27001") and the claim surfaces to the user as fact.
- **Mitigations:** Evidence gating (§4 of `AI_ARCHITECTURE.md`); LLM-emitted claims validated against the evidence graph; rejected if no matching Evidence ID; UI clearly distinguishes AI output from deterministic data.

### L4. Tool abuse / excessive agency

- **Threat:** LLM agent invokes tools in unintended ways (e.g., creating hundreds of dummy pursuits, modifying evidence verification, sending external emails).
- **Mitigations:** Minimal per-task tool surface; every tool call authorized against RBAC + tenant scope; **no autonomous consequential actions** (ADR-007); tool call rate limits; audit log on every tool call.

### L5. Model supply chain compromise

- **Threat:** A compromised model update introduces backdoor behavior.
- **Mitigations:** Provider reputation + SOC 2 / ISO 27001 verification; output validation independent of model; gradual rollout of model updates with monitoring; rollback capability.

### L6. Sensitive info in prompts

- **Threat:** PII or commercial-sensitive data from tenant documents enters the LLM prompt and is later exposed in logs / provider-side caching.
- **Mitigations:** PII scrubbing before LLM invocation (Phase 3+); LLM logs redact PII; tenant data minimization in prompts; provider contract prohibits prompt logging (verified).

### L7. Overreliance on AI output

- **Threat:** Users trust AI-suggested compliance mappings or eligibility verdicts without verification, leading to bid-quality failures.
- **Mitigations:** AI outputs visually distinct from deterministic data; "AI suggestion — verify before submission" labels; deterministic scores always shown alongside AI narratives; human review required for compliance matrix sign-off (Phase 4 approval workflow).

---

## 8. Threat-Tracking + Review

This threat model is reviewed at every phase gate. New threats discovered during development are appended with a date and an owner. Mitigations are tracked to completion; residual risks are documented in `KNOWN_RISKS.md`.

| Threat | Severity | Mitigation status | Owner | Review date |
|---|---|---|---|---|
| S1 | High | MFA in place (Phase 2) | Security | 2026-09-30 |
| I1 | Critical | Service-layer enforcement (Phase 1); RLS (Phase 3) | Engineering | 2026-09-30 |
| L1 | High | Defense in place (Phase 2); residual risk accepted | AI | 2026-09-30 |
| L4 | Critical | No autonomous consequential actions (ADR-007) | AI + Product | 2026-09-30 |
| All others | Medium | Per phase plan | Various | 2026-09-30 |
