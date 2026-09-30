# API Specification — ProcureAtlas AI

**Status:** Phase 1 endpoints are implemented (runnable with seeded demo data). Phase 2+ endpoints are planned and documented for design visibility.
**Base URL:** Same-origin (e.g., `https://app.procureatlas.ai`). Phase 1 sandbox exposes only `/` route; API is reachable via same-origin relative paths from the SPA.
**Authentication:** Phase 1 — none enforced (MVP). Phase 2 — NextAuth session + tenant scope. All tenant-scoped endpoints require an authenticated session and resolve `tenantId` from the session.
**Content type:** `application/json` for request and response bodies unless noted (file upload uses `multipart/form-data`).
**Errors:** Standard problem-detail shape — `{ error: { code: string, message: string, details?: object, requestId: string } }` with appropriate HTTP status code.

---

## 1. Phase 1 Endpoints (Implemented)

### 1.1 GET /api/tenders

List tenders with filters. Returns a paginated list of tenders normalized to the canonical model. Phase 1 returns seeded demo data.

**Query parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `market` | string | no | Filter by source market (`BD` / `SG` / `WORLD_BANK` / `ADB` / `UN` / `TED` / `SAM_GOV`). Comma-separated for multi-select. |
| `sector` | string | no | Filter by sector tag (e.g., `IT`, `Cybersecurity`, `Construction`). Comma-separated. |
| `status` | string | no | Filter by tender status (`PLANNED` / `ACTIVE` / `CLOSED` / `AWARDED` / `CANCELLED`). |
| `search` | string | no | Free-text search on title + description + buyer name. |
| `deadlineFrom` | ISO date | no | Inclusive lower bound on submission deadline (UTC). |
| `deadlineTo` | ISO date | no | Inclusive upper bound on submission deadline (UTC). |
| `minValueUsd` | number | no | Inclusive lower bound on `estimatedValueUsd`. |
| `maxValueUsd` | number | no | Inclusive upper bound on `estimatedValueUsd`. |
| `limit` | int | no | Default 50, max 200. |
| `offset` | int | no | Default 0. |

**Response shape**

```ts
interface TendersListResponse {
  items: TenderSummary[];
  total: number;
  limit: number;
  offset: number;
}

interface TenderSummary {
  id: string;
  sourcePortal: string;
  sourceUrl: string;
  title: string;
  buyerName: string;
  country: string;
  cpvCodes: string[];
  estimatedValueUsd: number | null;
  currency: string;
  publicationDate: string;       // ISO 8601
  deadlineDate: string;          // ISO 8601 (UTC)
  deadlineTz: string;
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED' | 'AWARDED' | 'CANCELLED';
  procedureType: string;
  fundingSource: string | null;
  amendmentCount: number;
  lotCount: number;
  scores: {
    eligibility: number | null;     // 0-100 deterministic
    opportunityFit: number | null;  // 0-100 deterministic
    submissionReadiness: number | null; // 0-100 deterministic
  } | null;
}
```

**Example response (abridged)**

```json
{
  "items": [
    {
      "id": "tend_01",
      "sourcePortal": "CPTU_EGP",
      "sourceUrl": "https://www.eprocure.gov.bd/...",
      "title": "Supply, Installation, and Maintenance of Network Security Appliances",
      "buyerName": "Bangladesh Computer Council",
      "country": "BD",
      "cpvCodes": ["48000000", "72500000"],
      "estimatedValueUsd": 420000,
      "currency": "BDT",
      "publicationDate": "2026-09-01T00:00:00.000Z",
      "deadlineDate": "2026-10-15T06:00:00.000Z",
      "deadlineTz": "Asia/Dhaka",
      "status": "ACTIVE",
      "procedureType": "OPEN",
      "fundingSource": "World Bank",
      "amendmentCount": 1,
      "lotCount": 2,
      "scores": {
        "eligibility": 80,
        "opportunityFit": 72,
        "submissionReadiness": 45
      }
    }
  ],
  "total": 12,
  "limit": 50,
  "offset": 0
}
```

---

### 1.2 GET /api/tenders/[id]

Returns the Tender Digital Twin payload — the canonical tender with lots, requirements, amendments, deadlines, eligibility assessment, and related awards.

**Path parameters**

| Param | Type | Description |
|---|---|---|
| `id` | string | Tender ID. |

**Response shape**

```ts
interface TenderDigitalTwin {
  tender: Tender;                 // full tender record
  lots: Lot[];
  requirements: Requirement[];    // each with source citation
  evaluationCriteria: EvaluationCriterion[];
  qualificationCriteria: QualificationCriterion[];
  documents: Document[];
  amendments: Amendment[];
  questions: Question[];
  deadlines: Deadline[];
  awards: Award[];
  eligibility: {
    status: 'PASS' | 'CONDITIONAL' | 'FAIL';
    gates: EligibilityGate[];
    overallScore: number;         // 0-100 deterministic
  };
  links: {
    pursuitId: string | null;     // if tenant is pursuing
    canonicalRelatedTenders: { id: string; sourcePortal: string }[];
  };
}

interface Tender {
  id: string;
  ocid: string | null;
  sourcePortal: string;
  sourceUrl: string;
  sourceId: string;
  title: string;
  description: string;
  buyer: { id: string; name: string; organizationId: string };
  procurementAuthority: { id: string; name: string; country: string } | null;
  country: string;
  region: string | null;
  cpvCodes: string[];
  nutsCode: string | null;
  naicsCodes: string[];
  unspscCodes: string[];
  currency: string;
  estimatedValue: number | null;
  estimatedValueUsd: number | null;
  publicationDate: string;
  deadlineDate: string;
  deadlineTz: string;
  status: string;
  procedureType: string;
  language: string;
  fundingSource: string | null;
  amendmentCount: number;
  versionHash: string;
  ingestedAt: string;
}

interface Requirement {
  id: string;
  lotId: string | null;
  section: string;
  clause: string;
  text: string;
  type: 'MANDATORY' | 'PREFERRED' | 'SCORING';
  category: 'ELIGIBILITY' | 'TECHNICAL' | 'FINANCIAL' | 'LEGAL' | 'PAST_PERFORMANCE' | 'COMPLIANCE' | 'OTHER';
  sourceDocumentId: string | null;
  sourcePage: number | null;
  sourceSnippet: string | null;
  extractionMethod: 'MANUAL' | 'LLM';
  extractionConfidence: number;   // 0-1
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface EligibilityGate {
  criterionId: string;
  name: string;
  type: string;                    // TURNOVER / YEARS_IN_BUSINESS / etc.
  threshold: string;
  mandatory: boolean;
  status: 'PASS' | 'CONDITIONAL' | 'FAIL' | 'NOT_APPLICABLE';
  matchedEvidenceId: string | null;
  reason: string;
}
```

---

### 1.3 GET /api/pursuits

Returns the tenant's pursuit pipeline.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `stage` | string | Filter by stage (`DISCOVERING` / `QUALIFYING` / `BIDDING` / `SUBMITTED` / `WON` / `LOST` / `WITHDRAWN`). |
| `ownerId` | string | Filter by owner. |

**Response shape**

```ts
interface PursuitsListResponse {
  items: Pursuit[];
}

interface Pursuit {
  id: string;
  tenderId: string;
  tender: { id: string; title: string; deadlineDate: string; buyerName: string; estimatedValueUsd: number | null };
  companyId: string;
  stage: 'DISCOVERING' | 'QUALIFYING' | 'BIDDING' | 'SUBMITTED' | 'WON' | 'LOST' | 'WITHDRAWN';
  bidNoBidDecision: 'BID' | 'NO_BID' | 'PENDING' | null;
  decisionRationale: string | null;
  estimatedWinProbability: number;  // 0-100
  estimatedContractValueUsd: number | null;
  ownerId: string;
  teamUserIds: string[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  deadlineDate: string;
  complianceSnapshot: {
    total: number;
    compliant: number;
    partial: number;
    gaps: number;
  };
  createdAt: string;
  updatedAt: string;
}
```

---

### 1.4 POST /api/pursuits

Create a new pursuit (records bid / no-bid decision). Phase 1 — no auth; Phase 2 — auth + tenant scope.

**Request body**

```ts
interface CreatePursuitRequest {
  tenderId: string;
  companyId: string;
  stage?: 'DISCOVERING' | 'QUALIFYING' | 'BIDDING' | 'SUBMITTED' | 'WON' | 'LOST' | 'WITHDRAWN';
  bidNoBidDecision?: 'BID' | 'NO_BID' | 'PENDING';
  decisionRationale?: string;
  ownerId: string;
  teamUserIds?: string[];
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedWinProbability?: number;
  estimatedContractValueUsd?: number;
  currency?: string;
}
```

**Response shape** — `Pursuit` (see 1.3).

**Example request**

```json
{
  "tenderId": "tend_01",
  "companyId": "comp_atlas_demo",
  "stage": "QUALIFYING",
  "bidNoBidDecision": "BID",
  "decisionRationale": "Strong capability match; ISO 27001 in place; prior BCC engagement.",
  "ownerId": "user_pm",
  "teamUserIds": ["user_pm", "user_sm"],
  "priority": "HIGH",
  "estimatedWinProbability": 55,
  "estimatedContractValueUsd": 420000,
  "currency": "USD"
}
```

---

### 1.5 GET /api/company

Returns the tenant's Company Brain — the company profile + evidence graph.

**Response shape**

```ts
interface CompanyBrainResponse {
  company: Company;
  evidence: Evidence[];
  certifications: Certification[];
  projectReferences: ProjectReference[];
  employees: Employee[];
  partners: Partner[];
  capabilityMap: {
    sector: string;
    capabilities: string[];
    evidenceCount: number;
    strengthScore: number;       // 0-100 deterministic
  }[];
  expiryTimeline: {
    evidenceId: string;
    title: string;
    type: string;
    expiryDate: string;
    daysToExpiry: number;
  }[];
}

interface Company {
  id: string;
  legalName: string;
  tradingName: string;
  country: string;
  registrationNumber: string;
  yearFounded: number;
  employeeCount: number;
  annualRevenueUsd: number | null;
  capabilityTags: string[];
  sectorTags: string[];
  geographicCoverage: string[];
  summary: string;
}

interface Evidence {
  id: string;
  evidenceType: 'REGISTRATION' | 'CERTIFICATION' | 'PROJECT_REFERENCE' | 'FINANCIAL_STATEMENT' | 'PERSONNEL_RECORD' | 'OEM_AUTHORIZATION' | 'PARTNERSHIP_AGREEMENT' | 'INSURANCE' | 'AUDIT_REPORT';
  title: string;
  description: string;
  issuer: string;
  issueDate: string;
  expiryDate: string | null;
  value: number | null;
  currency: string | null;
  verified: boolean;
  tags: string[];
}
```

---

### 1.6 GET /api/scoring/[tenderId]

Returns the deterministic scoring breakdown for a tender against the tenant's company profile. Three independent scores: Eligibility, Opportunity Fit, Submission Readiness. Each score comes with a component breakdown so the user can see *why* the score is what it is.

**Path parameters**

| Param | Type | Description |
|---|---|---|
| `tenderId` | string | Tender ID. |

**Response shape**

```ts
interface ScoringResponse {
  tenderId: string;
  companyId: string;
  computedAt: string;
  eligibility: {
    score: number;                // 0-100
    status: 'PASS' | 'CONDITIONAL' | 'FAIL';
    components: ScoreComponent[];
  };
  opportunityFit: {
    score: number;                // 0-100
    components: ScoreComponent[];
  };
  submissionReadiness: {
    score: number;                // 0-100
    components: ScoreComponent[];
  };
  method: 'DETERMINISTIC_V1';
  evidenceSnapshotHash: string;   // hash of evidence used
}

interface ScoreComponent {
  id: string;
  label: string;
  category: string;
  weight: number;                 // 0-1
  rawScore: number;               // 0-100
  weightedScore: number;          // rawScore * weight
  evidenceIds: string[];
  reason: string;
}
```

**Important:** This endpoint is **deterministic**. The same `(tenderId, companyId, evidenceSnapshotHash)` always returns the same scores. No LLM, no probabilistic component. The breakdown is fully explainable and reproducible.

---

### 1.7 GET /api/alerts

Returns the tenant's active alerts (deadlines, amendments, evidence expiry, new opportunities, awards).

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `severity` | string | `INFO` / `WARNING` / `CRITICAL`. |
| `acknowledged` | boolean | Default false (unacknowledged only). |
| `entityType` | string | `TENDER` / `PURSUIT` / `EVIDENCE` / `AWARD`. |

**Response shape**

```ts
interface AlertsListResponse {
  items: Alert[];
}

interface Alert {
  id: string;
  alertType: 'DEADLINE' | 'AMENDMENT' | 'NEW_OPPORTUNITY' | 'ELIGIBILITY_GAP' | 'EVIDENCE_EXPIRY' | 'AWARD';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  dueAt: string | null;
  acknowledged: boolean;
  createdAt: string;
}
```

---

## 2. Phase 2+ Endpoints (Planned — not yet implemented)

### 2.1 Authentication

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Tenant + first user signup |
| POST | `/api/auth/login` | Email + password login (MFA-aware) |
| POST | `/api/auth/mfa/verify` | MFA verification |
| GET | `/api/auth/session` | Current session |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/sso/callback` | OIDC SSO callback |

### 2.2 Users + RBAC

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/users` | List tenant users |
| POST | `/api/users` | Invite user |
| PATCH | `/api/users/[id]` | Update role / status |
| DELETE | `/api/users/[id]` | Remove user |

### 2.3 Evidence + file upload

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/evidence` | Create evidence record |
| POST | `/api/evidence/[id]/upload` | Multipart file upload (signed URL flow Phase 2+) |
| GET | `/api/evidence` | List tenant evidence |
| PATCH | `/api/evidence/[id]` | Update evidence |
| DELETE | `/api/evidence/[id]` | Soft-delete evidence |
| POST | `/api/evidence/[id]/verify` | Mark evidence verified (Manager+ role) |

### 2.4 Compliance matrix

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/pursuits/[id]/compliance` | Get compliance matrix for a pursuit |
| POST | `/api/pursuits/[id]/compliance` | Map requirement → evidence (or mark gap) |
| PATCH | `/api/pursuits/[id]/compliance/[requirementId]` | Update compliance item |

### 2.5 Webhooks (Phase 4)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/webhooks` | List webhook subscriptions |
| POST | `/api/webhooks` | Create webhook subscription |
| DELETE | `/api/webhooks/[id]` | Delete webhook |
| POST | `/api/webhooks/[id]/test` | Send test event |

Webhook events: `tender.published`, `tender.amended`, `tender.deadline_changed`, `award.published`, `pursuit.stage_changed`, `evidence.expiring`, `alert.created`.

### 2.6 MCP (Phase 5)

| Method | Path | Purpose |
|---|---|---|
| ANY | `/api/mcp/sse` | MCP HTTP+SSE transport endpoint |
| ANY | `/api/mcp/stdio` (internal) | MCP stdio transport (internal bridge) |

Tools exposed via MCP: `tenders.search`, `tenders.get`, `tenders.requirements`, `tenders.eligibility`, `company.brain`, `company.capability_map`, `pursuits.list`, `compliance.matrix`, `alerts.list`. MCP access requires an API key with MCP scope (Phase 5).

### 2.7 Public API marketplace (Phase 5)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/api-keys` | Create API key |
| GET | `/api/v1/api-keys` | List API keys |
| DELETE | `/api/v1/api-keys/[id]` | Revoke API key |
| GET | `/api/v1/usage` | Usage metrics for billing |
| GET | `/api/v1/tenders` | Public API (versioned, metered) |
| GET | `/api/v1/tenders/[id]` | Public API |
| GET | `/api/v1/buyers/[id]` | Public API |
| GET | `/api/v1/awards` | Public API |

All public API endpoints require `Authorization: Bearer <api_key>` and are rate-limited per the API key's tier.

---

## 3. Cross-Cutting Concerns

### 3.1 Tenant scoping

Every tenant-scoped endpoint resolves `tenantId` from the authenticated session (Phase 2+) and injects it into every database query. Cross-tenant queries are rejected. The only legitimate cross-tenant endpoint is the platform admin API (Phase 3+, separate auth scope).

### 3.2 Rate limiting

Phase 2+: per-IP + per-user + per-tenant rate limits enforced at the API gateway layer (Redis-backed token bucket). Defaults: 100 req/min per user, 1000 req/min per tenant.

### 3.3 Versioning

Phase 1 endpoints are unversioned (under `/api/*`). Public API (Phase 5) is versioned under `/api/v1/*`. Breaking changes ship under `/api/v2/*` with overlapping support for at least 12 months.

### 3.4 Pagination

List endpoints use `limit` + `offset` for Phase 1; Phase 3+ will migrate high-volume endpoints to cursor-based pagination (`after` cursor).

### 3.5 Idempotency

Write endpoints accept an `Idempotency-Key` header (Phase 2+); the same key returns the original response rather than creating a duplicate.

### 3.6 ETag + Last-Modified

All GET endpoints emit `ETag` and `Last-Modified` headers (Phase 2+) and honor `If-None-Match` / `If-Modified-Since` for 304 responses.
