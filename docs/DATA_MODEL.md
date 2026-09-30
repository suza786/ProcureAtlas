# Canonical Data Model — ProcureAtlas AI

**Status:** Phase 1 schema is OCDS-inspired. Multi-tenant fields on all tenant-scoped entities. Audit fields (createdAt, updatedAt, createdBy, updatedBy) and soft-delete (`deletedAt`) on critical entities.
**Database:** SQLite (dev) → PostgreSQL (prod, Phase 2+). pgvector extension added Phase 3+.
**Last updated:** 2026-09-30

This document describes the canonical entity model used across the platform. The model is OCDS-inspired (Open Contracting Data Standard) with extensions for bid operations, evidence, and procurement intelligence. Every tenant-scoped entity carries a `tenantId` for row-level isolation.

---

## 1. Core Entities

### 1.1 Tenant
The top-level isolation boundary. Every tenant-scoped entity references a Tenant.
- **Key fields:** `id`, `name`, `slug`, `plan` (Free / Solo / Professional / Team / Enterprise / International equivalents), `region`, `createdAt`, `updatedAt`, `deletedAt`.
- **Relationships:** has many Users, Companies, Pursuits, Tenders (via ownership / watch).

### 1.2 User
A human user within a tenant. Phase 2+ adds authentication, roles, MFA, SSO.
- **Key fields:** `id`, `tenantId`, `email`, `name`, `role` (Owner / Admin / Manager / Contributor / Viewer), `status`, `lastLoginAt`, `mfaEnabled`, `createdAt`, `updatedAt`.
- **Relationships:** belongs to Tenant; has many Approvals (as approver); has many Tasks (as assignee).

### 1.3 Organization
A canonical legal entity (buyer, supplier, authority, partner, OEM). Entity-resolved across portals.
- **Key fields:** `id`, `tenantId?`, `canonicalId` (cross-tenant stable ID), `name`, `legalName`, `country`, `registrationNumber`, `vatId`, `dunsNumber`, `website`, `type` (Buyer / Supplier / Authority / Partner / OEM), `aliases[]`, `sourcePortals[]`.
- **Relationships:** has many Buyer / Supplier / Partner profiles; has many Awards (as winner); has many Tenders (as buyer).

### 1.4 Buyer
A specific buying unit (ministry, department, agency, project team) within an Organization.
- **Key fields:** `id`, `organizationId`, `name`, `department`, `address`, `contactName`, `contactEmail`, `contactPhone`, `preferredLanguage`, `sourcePortal`.
- **Relationships:** belongs to Organization; has many Tenders.

### 1.5 ProcurementAuthority
The authority that owns a portal or regulates procurement in a jurisdiction.
- **Key fields:** `id`, `name`, `country`, `portalUrl`, `legalFramework`, `defaultCurrency`, `defaultTimezone`, `primaryLanguage`.
- **Relationships:** has many Tenders (via portal); has many ProcurementPlans.

---

## 2. Procurement Entities

### 2.1 Tender
The canonical tender notice. OCID-aware.
- **Key fields:** `id`, `tenantId`, `ocid?`, `sourcePortal`, `sourceUrl`, `sourceId`, `title`, `description`, `buyerId`, `procurementAuthorityId?`, `country`, `region`, `cpvCodes[]`, `nutsCode?`, `naicsCodes[]`, `unspscCodes[]`, `currency`, `estimatedValue`, `estimatedValueUsd`, `publicationDate`, `deadlineDate`, `deadlineTz`, `status` (Planned / Active / Cancelled / Closed / Awarded), `procedureType` (Open / Restricted / Negotiated / RFP / RFQ / EOI), `language`, `fundingSource?` (World Bank / ADB / UN / National / EU), `amendmentCount`, `versionHash`, `ingestionSource`, `ingestedAt`, `createdAt`, `updatedAt`, `deletedAt`.
- **Relationships:** belongs to Buyer; has many Lots; has many Requirements; has many Documents; has many Amendments; has many Deadlines; has many Awards; has many Pursuits; has many Alerts.

### 2.2 Lot
A sub-tender lot. A Tender may have one or many Lots.
- **Key fields:** `id`, `tenderId`, `lotNumber`, `title`, `description`, `estimatedValue`, `estimatedValueUsd`, `currency`, `cpvCodes[]`, `deliveryLocation`, `deliveryStartDate`, `deliveryEndDate`, `status`.
- **Relationships:** belongs to Tender; has many Requirements; has many Awards.

### 2.3 ProcurementPlan
A multi-year indicative procurement plan published by an authority. Tenders may derive from a plan.
- **Key fields:** `id`, `authorityId`, `title`, `fiscalYear`, `publishDate`, `reviewDate`, `status`, `sourceUrl`, `rawJson`.
- **Relationships:** belongs to ProcurementAuthority; has many Tenders (planned).

### 2.4 Award
The award of a Tender or Lot to a Supplier.
- **Key fields:** `id`, `tenderId`, `lotId?`, `supplierId`, `awardDate`, `contractValue`, `contractValueUsd`, `currency`, `awardStatus` (Pending / Active / Cancelled), `sourceUrl`, `sourceId`, `ingestedAt`.
- **Relationships:** belongs to Tender / Lot; belongs to Supplier (Organization); has one Contract.

### 2.5 Contract
The executed contract following an Award.
- **Key fields:** `id`, `awardId`, `contractNumber`, `signingDate`, `startDate`, `endDate`, `contractValue`, `currency`, `status` (Active / Completed / Terminated), `amendments[]`.
- **Relationships:** belongs to Award.

### 2.6 Supplier
A supplier profile (a tenant's view of a competitor or partner).
- **Key fields:** `id`, `organizationId`, `tenantId`, `capabilities[]`, `geographies[]`, `certifications[]`, `wonAwardsCount`, `totalAwardValueUsd`, `lastAwardDate`.
- **Relationships:** belongs to Organization; has many Awards; has many Partnerships.

### 2.7 Partner
A partner / JV / OEM relationship relevant to a tenant.
- **Key fields:** `id`, `tenantId`, `organizationId`, `partnerType` (JV / Subcontractor / OEM / Consortium), `agreementDate`, `expiryDate`, `status`, `evidenceId?`.
- **Relationships:** belongs to Tenant; belongs to Organization; optionally linked to Evidence.

---

## 3. Requirement + Evidence Entities

### 3.1 Requirement
A single requirement extracted from a tender document. Always source-cited.
- **Key fields:** `id`, `tenderId`, `lotId?`, `section`, `clause`, `text`, `type` (Mandatory / Preferred / Scoring), `category` (Eligibility / Technical / Financial / Legal / Past Performance / Compliance / Other), `sourceDocumentId`, `sourcePage`, `sourceSnippet`, `extractionMethod` (Manual / LLM), `extractionConfidence`, `reviewStatus` (Pending / Approved / Rejected), `reviewedBy`, `reviewedAt`, `createdAt`, `updatedAt`.
- **Relationships:** belongs to Tender / Lot; has many ComplianceItems; linked to Source Document.

### 3.2 EvaluationCriterion
A scoring criterion for the tender evaluation.
- **Key fields:** `id`, `tenderId`, `criterionName`, `criterionType` (Technical / Financial / Past Performance / Methodology), `weightPercent`, `passMark?`, `scoringMethod`.
- **Relationships:** belongs to Tender.

### 3.3 QualificationCriterion
A specific qualification gate (turnover, years in business, similar project count, certification).
- **Key fields:** `id`, `tenderId`, `criterionName`, `criterionType` (Turnover / YearsInBusiness / SimilarProjects / Certification / Registration / Personnel), `threshold`, `thresholdCurrency?`, `thresholdUnit?`, `appliesTo` (Prime / Consortium / Subcontractor), `mandatory`.
- **Relationships:** belongs to Tender; evaluated by Eligibility Engine.

### 3.4 Document
A source document associated with a Tender.
- **Key fields:** `id`, `tenderId`, `fileName`, `documentType` (Notice / Specification / Addendum / BOQ / Drawing / Sample Contract / Clarification / Award Notice), `sourceUrl`, `storageKey` (S3 key, Phase 2+), `mimeType`, `sizeBytes`, `ingestedAt`, `textExtracted`, `textExtractedAt`.
- **Relationships:** belongs to Tender; has many Requirements (as source).

### 3.5 Amendment
A versioned amendment to a Tender. Linked back to the prior version.
- **Key fields:** `id`, `tenderId`, `amendmentNumber`, `publishedDate`, `summary`, `changesJson`, `sourceUrl`, `sourceDocumentId?`, `ingestedAt`.
- **Relationships:** belongs to Tender; optionally linked to Document.

### 3.6 Question
A clarification question raised by a bidder, and the buyer's published answer.
- **Key fields:** `id`, `tenderId`, `questionText`, `questionBy?`, `questionDate`, `answerText`, `answerDate`, `sourceUrl`, `status` (Asked / Answered / Closed).
- **Relationships:** belongs to Tender.

### 3.7 Deadline
A structured deadline for a Tender (submission, clarification window, site visit, bid opening).
- **Key fields:** `id`, `tenderId`, `deadlineType` (Submission / Clarification / SiteVisit / BidOpening / Validity), `date`, `timezone`, `utcDate`, `isExtended`, `extendedFrom?`.
- **Relationships:** belongs to Tender; feeds Alerting Engine.

### 3.8 Evidence
A tenant's evidence item — the foundation of the Company Brain.
- **Key fields:** `id`, `tenantId`, `evidenceType` (Registration / Certification / ProjectReference / FinancialStatement / PersonnelRecord / OEMAuthorization / PartnershipAgreement / Insurance / AuditReport), `title`, `description`, `issuer`, `issueDate`, `expiryDate?`, `value?`, `currency?`, `fileStorageKey?`, `fileMimeType?`, `fileSizeBytes?`, `verified`, `verifiedBy?`, `verifiedAt?`, `sourceUrl?`, `tags[]`, `createdAt`, `updatedAt`, `deletedAt`.
- **Relationships:** belongs to Tenant; has many ComplianceItems; linked to Certification / ProjectReference / Employee as appropriate.

### 3.9 Certification
A specific certification derived from Evidence.
- **Key fields:** `id`, `evidenceId`, `name` (ISO 27001 / ISO 9001 / CMMI / SOC 2 / ISO 20000 / etc.), `issuer`, `issueDate`, `expiryDate`, `scope`, `status`.
- **Relationships:** belongs to Evidence.

### 3.10 ProjectReference
A past project reference derived from Evidence.
- **Key fields:** `id`, `evidenceId`, `projectName`, `client`, `clientOrganizationId?`, `startDate`, `endDate`, `contractValue`, `currency`, `role` (Prime / Subcontractor / JV / OEM), `description`, `technologies[]`, `sectors[]`.
- **Relationships:** belongs to Evidence; optionally linked to Organization (client).

### 3.11 Employee
A personnel record derived from Evidence (CV, certification, employment proof).
- **Key fields:** `id`, `tenantId`, `evidenceId?`, `name`, `role`, `qualifications[]`, `certifications[]`, `yearsOfExperience`, `startDate`, `endDate?`.
- **Relationships:** belongs to Tenant; optionally linked to Evidence.

### 3.12 Company
The tenant's own company profile — the top of the Company Brain.
- **Key fields:** `id`, `tenantId`, `organizationId?`, `legalName`, `tradingName`, `country`, `registrationNumber`, `vatId`, `dunsNumber`, `yearFounded`, `employeeCount`, `annualRevenueUsd?`, `capabilityTags[]`, `sectorTags[]`, `geographicCoverage[]`, `summary`.
- **Relationships:** belongs to Tenant; has many Evidence, Employees, Partners; has many Pursuits.

---

## 4. Pursuit + Bid Operations Entities

### 4.1 Pursuit
A bid / no-bid decision unit linked to a Tender.
- **Key fields:** `id`, `tenantId`, `tenderId`, `companyId`, `name`, `stage` (Discovering / Qualifying / Bidding / Submitted / Won / Lost / Withdrawn), `bidNoBidDecision`, `decisionRationale`, `decisionBy`, `decisionDate`, `estimatedWinProbability`, `estimatedContractValue`, `estimatedContractValueUsd`, `currency`, `ownerId`, `teamUserIds[]`, `deadlineDate`, `priority`, `createdAt`, `updatedAt`.
- **Relationships:** belongs to Tenant, Tender, Company, Owner (User); has one Bid; has many Tasks, Approvals, Alerts.

### 4.2 Bid
The bid response being prepared for a Pursuit.
- **Key fields:** `id`, `pursuitId`, `submissionDeadline`, `submissionMethod`, `submissionStatus` (NotStarted / InProgress / Submitted / Accepted / Rejected), `submittedAt?`, `submittedBy?`, `finalDocumentStorageKey?`.
- **Relationships:** belongs to Pursuit; has many Proposals; has many ComplianceItems.

### 4.3 Proposal
A drafted section / document within a Bid.
- **Key fields:** `id`, `bidId`, `sectionName`, `content`, `contentFormat` (Markdown / DOCX / PDF), `version`, `authorId`, `status` (Draft / InReview / Approved / Final), `createdAt`, `updatedAt`.
- **Relationships:** belongs to Bid, Author (User).

### 4.4 ComplianceItem
A mapping of a Requirement to Evidence (or gap).
- **Key fields:** `id`, `bidId`, `pursuitId`, `requirementId`, `evidenceId?`, `status` (Compliant / PartiallyCompliant / Gap / NotApplicable), `notes`, `lastUpdatedBy`, `lastUpdatedAt`.
- **Relationships:** belongs to Bid / Pursuit / Requirement; optionally linked to Evidence. **Core of the Compliance Matrix.**

### 4.5 Task
A bid-prep task within a Pursuit.
- **Key fields:** `id`, `pursuitId`, `assigneeId`, `title`, `description`, `dueDate`, `status` (Todo / InProgress / Done / Blocked), `priority`.
- **Relationships:** belongs to Pursuit, Assignee (User).

### 4.6 Approval
A human approval required for a consequential action.
- **Key fields:** `id`, `pursuitId?`, `approvalType` (BidNoBid / Submission / PricingChange / LegalSignOff / PartnerEngagement), `requestedBy`, `requestedAt`, `approverId`, `decision` (Pending / Approved / Rejected), `decisionAt?`, `decisionRationale?`, `evidenceId?`.
- **Relationships:** belongs to Pursuit; belongs to User (approver).

### 4.7 Alert
A deadline / amendment / opportunity alert for a tenant.
- **Key fields:** `id`, `tenantId`, `alertType` (Deadline / Amendment / NewOpportunity / EligibilityGap / EvidenceExpiry / Award), `severity` (Info / Warning / Critical), `title`, `description`, `entityType`, `entityId`, `dueAt?`, `acknowledged`, `acknowledgedBy?`, `acknowledgedAt?`, `createdAt`.
- **Relationships:** belongs to Tenant.

### 4.8 Outcome
A recorded outcome for a Pursuit (won / lost / withdrawn, with reasons).
- **Key fields:** `id`, `pursuitId`, `outcome` (Won / Lost / Withdrawn / Disqualified), `outcomeDate`, `winningSupplierId?`, `winningContractValueUsd?`, `lossReason?`, `lessonsLearned`.
- **Relationships:** belongs to Pursuit; optionally linked to Supplier (winner).

---

## 5. Platform Entities

### 5.1 DataSource
A registered source connector.
- **Key fields:** `id`, `name`, `portal`, `legalReviewStatus`, `lastReviewedAt`, `connectorStatus` (Planned / InDevelopment / Active / Disabled), `updateFrequency`.
- **Relationships:** has many Tenders (via sourcePortal).

### 5.2 AuditLog
Append-only audit trail.
- **Key fields:** `id`, `tenantId`, `actorType` (User / System / Agent), `actorId`, `action`, `entityType`, `entityId`, `beforeJson`, `afterJson`, `requestId`, `ipAddress`, `userAgent`, `timestamp`.
- **Relationships:** belongs to Tenant.

---

## 6. Entity-Resolution Strategy

### 6.1 Stable IDs

- Each `Organization` has a `canonicalId` (cross-tenant, cross-portal) that is stable across sources. Once an Organization is identified, all references (buyer of a Tender, winner of an Award, partner of a Tenant) resolve to the same `canonicalId`.
- Tenders carry `ocid` where the source provides it (Open Contracting ID). Where the source provides only a portal-specific ID, ProcureAtlas AI generates an internal `canonicalTenderId` derived from `sourcePortal + sourceId` hash.

### 6.2 Cross-portal deduplication

- World Bank / ADB SPNs often appear both on the donor portal and on the borrower's national e-GP. ProcureAtlas AI links these via a `TenderLink` entity (planned Phase 3) — same logical Tender, multiple `Tender` records, one canonical reference.
- Buyers are deduplicated using a normalized name + country + registration number heuristic, with LLM-assisted alias suggestion and human confirmation (Phase 3+).

### 6.3 Source traceability

- Every extracted field (`Requirement.text`, `Award.contractValue`, `Deadline.date`, `Amendment.summary`) carries `sourceUrl`, `sourceDocumentId`, `sourcePage`, `sourceSnippet`, `extractionMethod`, `extractionConfidence`, `ingestedAt`. Source traceability is a hard constraint, not optional.

---

## 7. Migration Notes

- **SQLite → PostgreSQL (Phase 2):** Prisma schema is Postgres-ready. Migration is a `prisma migrate` operation plus connection string change. No schema changes required.
- **pgvector (Phase 3+):** Add extension; new `TenderEmbedding` and `EvidenceEmbedding` tables for semantic matching.
- **OpenSearch (Phase 3+):** Out-of-band indexer; PostgreSQL remains source of truth.
- **Multi-region (Phase 3+):** Tenant `region` field drives database / object storage placement.

---

## 8. Open Modeling Questions

- Should `Partner` be a tenant-scoped profile of a global `Organization`, or a fully tenant-owned entity? (Leaning: tenant-scoped profile of Organization.)
- Should `Evidence` be append-only (versions) or mutable? (Leaning: append-only with `supersededById`.)
- Should `ComplianceItem` store a snapshot of the Evidence at compliance-mapping time, or always reference the live Evidence? (Leaning: snapshot for audit, reference for live view.)

These will be settled in Phase 2 design review.
