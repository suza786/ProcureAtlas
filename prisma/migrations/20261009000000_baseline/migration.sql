-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "region" TEXT NOT NULL DEFAULT 'BD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "passwordHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaLastStep" INTEGER,
    "mfaSecret" TEXT,
    "mfaBackupCodes" TEXT,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastLoginAt" DATETIME,
    "lastLoginIp" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "mfaVerifiedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" DATETIME,
    "revokedAt" DATETIME,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "sourcePortal" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "website" TEXT,
    "orgType" TEXT NOT NULL DEFAULT 'buyer',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "department" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Buyer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcurementAuthority" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "regulatoryScope" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcurementAuthority_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "sourcePortal" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleLocal" TEXT,
    "description" TEXT,
    "country" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "procurementMethod" TEXT,
    "noticeType" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "estimatedValue" REAL,
    "valueUSD" REAL,
    "publishedAt" DATETIME,
    "submissionDeadline" DATETIME,
    "questionDeadline" DATETIME,
    "bidValidityDays" INTEGER,
    "tenderSecurityPct" REAL,
    "performanceSecurityPct" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "awardStatus" TEXT,
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "preBidMeetingAt" DATETIME,
    "siteVisitAt" DATETIME,
    "rawJson" TEXT,
    "extractedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" REAL NOT NULL DEFAULT 0.8,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "buyerId" TEXT,
    "supplierOrgId" TEXT,
    CONSTRAINT "Tender_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Tender_supplierOrgId_fkey" FOREIGN KEY ("supplierOrgId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenderId" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" REAL,
    "unit" TEXT,
    "estimatedValue" REAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lot_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenderId" TEXT NOT NULL,
    "lotId" TEXT,
    "category" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "operator" TEXT,
    "threshold" TEXT,
    "thresholdAmount" REAL,
    "thresholdCurrency" TEXT,
    "thresholdUnit" TEXT,
    "evaluationMetric" TEXT,
    "thresholdStatus" TEXT NOT NULL DEFAULT 'unreviewed',
    "description" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "sourceDoc" TEXT,
    "sourcePage" INTEGER,
    "sourceClause" TEXT,
    "extractedText" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.85,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Requirement_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Requirement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TenderDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "docType" TEXT,
    "sourceUrl" TEXT,
    "fileSizeKb" INTEGER,
    "checksum" TEXT,
    "uploadedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenderDocument_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Amendment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenderId" TEXT NOT NULL,
    "amendmentNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "affectsDeadline" BOOLEAN NOT NULL DEFAULT false,
    "affectsScope" BOOLEAN NOT NULL DEFAULT false,
    "newDeadline" DATETIME,
    "sourceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Amendment_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenderId" TEXT NOT NULL,
    "supplierOrgId" TEXT NOT NULL,
    "contractValue" REAL,
    "valueUSD" REAL,
    "normalizationRate" REAL,
    "normalizationDate" DATETIME,
    "normalizationSource" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "awardedAt" DATETIME NOT NULL,
    "contractNo" TEXT,
    "sourceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Award_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Award_supplierOrgId_fkey" FOREIGN KEY ("supplierOrgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "registrationNo" TEXT,
    "taxId" TEXT,
    "website" TEXT,
    "foundedYear" INTEGER,
    "employeeCount" INTEGER,
    "annualTurnoverUSD" REAL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "issuer" TEXT,
    "issuedAt" DATETIME,
    "expiresAt" DATETIME,
    "docUrl" TEXT,
    "checksum" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" DATETIME,
    "factMetric" TEXT,
    "factAmount" REAL,
    "factCurrency" TEXT,
    "factUnit" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.9,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Evidence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standard" TEXT,
    "issuer" TEXT,
    "issuedAt" DATETIME,
    "expiresAt" DATETIME,
    "certificateNo" TEXT,
    "docUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Certification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "clientType" TEXT,
    "country" TEXT,
    "valueUSD" REAL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "role" TEXT,
    "description" TEXT,
    "evidenceUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectReference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "qualifications" TEXT,
    "yearsExperience" INTEGER,
    "securityClearance" TEXT,
    "cvUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pursuit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'discovering',
    "bidDecision" TEXT,
    "decisionReason" TEXT,
    "decisionBy" TEXT,
    "decidedAt" DATETIME,
    "ownerId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "estimatedValueUSD" REAL,
    "winProbability" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pursuit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pursuit_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pursuit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pursuitId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "technicalScore" REAL,
    "commercialScore" REAL,
    "totalScore" REAL,
    "submissionReady" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bid_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pursuitId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'gap',
    "notes" TEXT,
    "evidenceText" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0,
    "owner" TEXT,
    "dueAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ComplianceItem_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ComplianceItem_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ComplianceItem_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pursuitId" TEXT NOT NULL,
    "bidId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignee" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "pursuitId" TEXT NOT NULL,
    "proposalId" TEXT,
    "chainId" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'bid_decision',
    "stepOrder" INTEGER NOT NULL DEFAULT 0,
    "requestedBy" TEXT NOT NULL,
    "approverId" TEXT,
    "approverRole" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "slaDueAt" DATETIME,
    "decidedAt" DATETIME,
    "escalatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Approval_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Approval_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "tenderId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dueAt" DATETIME,
    "acknowledgedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Alert_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Outcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pursuitId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "awardValueUSD" REAL,
    "lossReason" TEXT,
    "lessonsLearned" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "accessMethod" TEXT NOT NULL,
    "legalStatus" TEXT NOT NULL DEFAULT 'verified',
    "lastReviewedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'system',
    "apiKeyId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "llmModel" TEXT,
    "llmPromptHash" TEXT,
    "llmInputTokens" INTEGER,
    "llmOutputTokens" INTEGER,
    "llmLatencyMs" INTEGER,
    "llmCostUsd" REAL,
    "requestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileUpload" (
    "virusScannedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSizeKb" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageUrl" TEXT,
    "category" TEXT NOT NULL,
    "evidenceId" TEXT,
    "virusScanResult" TEXT DEFAULT 'pending',
    "textExtracted" TEXT,
    "textExtractedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FileUpload_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FileUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FileUpload_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LlmExtraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "tenderId" TEXT,
    "fileUploadId" TEXT,
    "requestedById" TEXT,
    "taskType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "inputHash" TEXT,
    "promptHash" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "costUsd" REAL,
    "outputJson" TEXT,
    "extractedItemsJson" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewNotes" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LlmExtraction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LlmExtraction_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LlmExtraction_fileUploadId_fkey" FOREIGN KEY ("fileUploadId") REFERENCES "FileUpload" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LlmExtraction_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LlmExtraction_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConnectorRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceCode" TEXT NOT NULL,
    "runType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "itemsFetched" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "logJson" TEXT,
    "triggeredById" TEXT
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuyerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "totalTendersPosted" INTEGER NOT NULL DEFAULT 0,
    "totalAwardValueUSD" REAL NOT NULL DEFAULT 0,
    "averageAwardValueUSD" REAL NOT NULL DEFAULT 0,
    "topSuppliers" TEXT,
    "preferredSectors" TEXT,
    "averageTenderValueUSD" REAL NOT NULL DEFAULT 0,
    "incumbentCount" INTEGER NOT NULL DEFAULT 0,
    "firstTenderAt" DATETIME,
    "lastTenderAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BuyerProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "totalAwards" INTEGER NOT NULL DEFAULT 0,
    "totalAwardValueUSD" REAL NOT NULL DEFAULT 0,
    "averageAwardValueUSD" REAL NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "topBuyers" TEXT,
    "sectorsWon" TEXT,
    "countriesWon" TEXT,
    "firstAwardAt" DATETIME,
    "lastAwardAt" DATETIME,
    "isCompetitor" BOOLEAN NOT NULL DEFAULT false,
    "isPartner" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupplierProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartnerSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matchScore" REAL NOT NULL,
    "matchReasons" TEXT,
    "complementaryCapabilities" TEXT,
    "geographicOverlap" TEXT,
    "priorJVHistory" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartnerSuggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartnerSuggestion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "seatsIncluded" INTEGER NOT NULL DEFAULT 1,
    "tendersTrackedLimit" INTEGER NOT NULL DEFAULT 50,
    "pursuitsLimit" INTEGER NOT NULL DEFAULT 5,
    "apiCallsLimit" INTEGER NOT NULL DEFAULT 1000,
    "llmTokensLimit" INTEGER NOT NULL DEFAULT 50000,
    "currentPeriodStart" DATETIME,
    "currentPeriodEnd" DATETIME,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "sslcommerzStoreId" TEXT,
    "billingVerifiedAt" DATETIME,
    "billingEventCreatedAt" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "reservedCount" INTEGER NOT NULL DEFAULT 0,
    "limit" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UsageMetric_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "endpoint" TEXT,
    "userId" TEXT,
    "apiKeyId" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "reservedTokens" INTEGER NOT NULL DEFAULT 0,
    "tokenSource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "paidAt" DATETIME,
    "pdfUrl" TEXT,
    "lineItemsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "pursuitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "totalSections" INTEGER NOT NULL DEFAULT 0,
    "completedSections" INTEGER NOT NULL DEFAULT 0,
    "evidenceCoverage" REAL NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "lastEditedAt" DATETIME,
    "lastEditedBy" TEXT,
    "submittedAt" DATETIME,
    "exportFormat" TEXT,
    "exportUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proposal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Proposal_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProposalSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "evidenceIds" TEXT,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "hasGaps" BOOLEAN NOT NULL DEFAULT false,
    "assignedTo" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "aiAssisted" BOOLEAN NOT NULL DEFAULT false,
    "aiModel" TEXT,
    "lastEditedAt" DATETIME,
    "lastEditedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProposalSection_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProposalVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "sectionCount" INTEGER NOT NULL,
    "changeSummary" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProposalVersion_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalChain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "slaHours" INTEGER NOT NULL DEFAULT 48,
    "stepsJson" TEXT,
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApprovalChain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" DATETIME,
    "lastResponseCode" INTEGER,
    "lastSuccessAt" DATETIME,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebhookEndpoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT,
    "tenantId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" DATETIME,
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minSeverity" TEXT NOT NULL DEFAULT 'low',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "quoteCurrency" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "rateDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CurrencyRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BidCostEstimate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "pursuitId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "laborCost" REAL NOT NULL DEFAULT 0,
    "materialsCost" REAL NOT NULL DEFAULT 0,
    "subcontractorCost" REAL NOT NULL DEFAULT 0,
    "overheadCost" REAL NOT NULL DEFAULT 0,
    "travelCost" REAL NOT NULL DEFAULT 0,
    "contingencyPct" REAL NOT NULL DEFAULT 10,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "marginPct" REAL NOT NULL DEFAULT 20,
    "proposedPrice" REAL NOT NULL DEFAULT 0,
    "profitAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "hedgingNotes" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BidCostEstimate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BidCostEstimate_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "apiKeyId" TEXT,
    "identifier" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "tokens" REAL NOT NULL DEFAULT 100,
    "lastRefilledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Embedding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "embeddingJson" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'deterministic-v1',
    "dimensions" INTEGER NOT NULL DEFAULT 256,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InboundWebhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT,
    "signature" TEXT,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "payloadJson" TEXT NOT NULL,
    "processedStatus" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" DATETIME,
    "errorMessage" TEXT,
    "createdEntities" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TenantRequirementReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TenantRequirementReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TenantRequirementReview_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "LlmExtraction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TenantRequirementReview_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "requestedById" TEXT,
    "requestedByApiKeyId" TEXT,
    "exportType" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'json',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "fileSizeKb" INTEGER NOT NULL DEFAULT 0,
    "downloadUrl" TEXT,
    "expiresAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "MarketConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "primaryLanguage" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "portalUrl" TEXT,
    "portalName" TEXT,
    "connectorStatus" TEXT NOT NULL DEFAULT 'planned',
    "legalStatus" TEXT NOT NULL DEFAULT 'under_review',
    "dataResidency" TEXT NOT NULL DEFAULT 'global',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastReviewedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScimConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tenantUrl" TEXT,
    "bearerToken" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" DATETIME,
    "lastSyncStatus" TEXT,
    "lastSyncCount" INTEGER NOT NULL DEFAULT 0,
    "userProvisioningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "userDeprovisioningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "groupSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "snapshotDate" DATETIME NOT NULL,
    "activePursuits" INTEGER NOT NULL DEFAULT 0,
    "biddingPursuits" INTEGER NOT NULL DEFAULT 0,
    "submittedPursuits" INTEGER NOT NULL DEFAULT 0,
    "wonPursuits" INTEGER NOT NULL DEFAULT 0,
    "lostPursuits" INTEGER NOT NULL DEFAULT 0,
    "pipelineValueUSD" REAL NOT NULL DEFAULT 0,
    "wonValueUSD" REAL NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "avgBidCycleDays" REAL NOT NULL DEFAULT 0,
    "avgProposalWordCount" INTEGER NOT NULL DEFAULT 0,
    "llmCallsCount" INTEGER NOT NULL DEFAULT 0,
    "llmCostUsd" REAL NOT NULL DEFAULT 0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "evidenceCoverage" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PwaSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "appName" TEXT NOT NULL DEFAULT 'ProcureAtlas AI',
    "shortName" TEXT NOT NULL DEFAULT 'ProcureAtlas',
    "themeColor" TEXT NOT NULL DEFAULT '#0f172a',
    "backgroundColor" TEXT NOT NULL DEFAULT '#f8fafc',
    "displayMode" TEXT NOT NULL DEFAULT 'standalone',
    "iconUrl" TEXT,
    "offlineEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OutboxJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME,
    "lockedBy" TEXT,
    "error" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AccountToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "credentialHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TenantSupplierAnnotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isCompetitor" BOOLEAN NOT NULL DEFAULT false,
    "isPartner" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CapabilityFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "organizationId" TEXT,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "amount" REAL,
    "currency" TEXT,
    "evidenceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_active_idx" ON "User"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Organization_sourcePortal_idx" ON "Organization"("sourcePortal");

-- CreateIndex
CREATE INDEX "Organization_orgType_idx" ON "Organization"("orgType");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_sourcePortal_externalId_key" ON "Organization"("sourcePortal", "externalId");

-- CreateIndex
CREATE INDEX "Tender_sourcePortal_idx" ON "Tender"("sourcePortal");

-- CreateIndex
CREATE INDEX "Tender_market_idx" ON "Tender"("market");

-- CreateIndex
CREATE INDEX "Tender_sector_idx" ON "Tender"("sector");

-- CreateIndex
CREATE INDEX "Tender_status_idx" ON "Tender"("status");

-- CreateIndex
CREATE INDEX "Tender_submissionDeadline_idx" ON "Tender"("submissionDeadline");

-- CreateIndex
CREATE INDEX "Tender_buyerId_idx" ON "Tender"("buyerId");

-- CreateIndex
CREATE INDEX "Tender_status_submissionDeadline_idx" ON "Tender"("status", "submissionDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "Tender_sourcePortal_externalId_key" ON "Tender"("sourcePortal", "externalId");

-- CreateIndex
CREATE INDEX "Lot_tenderId_idx" ON "Lot"("tenderId");

-- CreateIndex
CREATE INDEX "Requirement_tenderId_idx" ON "Requirement"("tenderId");

-- CreateIndex
CREATE INDEX "Requirement_category_idx" ON "Requirement"("category");

-- CreateIndex
CREATE INDEX "TenderDocument_tenderId_idx" ON "TenderDocument"("tenderId");

-- CreateIndex
CREATE INDEX "Amendment_tenderId_idx" ON "Amendment"("tenderId");

-- CreateIndex
CREATE INDEX "Award_tenderId_idx" ON "Award"("tenderId");

-- CreateIndex
CREATE INDEX "Award_supplierOrgId_idx" ON "Award"("supplierOrgId");

-- CreateIndex
CREATE INDEX "Company_tenantId_idx" ON "Company"("tenantId");

-- CreateIndex
CREATE INDEX "Evidence_companyId_idx" ON "Evidence"("companyId");

-- CreateIndex
CREATE INDEX "Evidence_category_idx" ON "Evidence"("category");

-- CreateIndex
CREATE INDEX "Evidence_expiresAt_idx" ON "Evidence"("expiresAt");

-- CreateIndex
CREATE INDEX "Certification_companyId_idx" ON "Certification"("companyId");

-- CreateIndex
CREATE INDEX "Certification_expiresAt_idx" ON "Certification"("expiresAt");

-- CreateIndex
CREATE INDEX "ProjectReference_companyId_idx" ON "ProjectReference"("companyId");

-- CreateIndex
CREATE INDEX "ProjectReference_clientType_idx" ON "ProjectReference"("clientType");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE INDEX "Pursuit_tenantId_idx" ON "Pursuit"("tenantId");

-- CreateIndex
CREATE INDEX "Pursuit_stage_idx" ON "Pursuit"("stage");

-- CreateIndex
CREATE INDEX "Pursuit_companyId_idx" ON "Pursuit"("companyId");

-- CreateIndex
CREATE INDEX "Pursuit_tenantId_stage_updatedAt_idx" ON "Pursuit"("tenantId", "stage", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pursuit_tenantId_companyId_tenderId_key" ON "Pursuit"("tenantId", "companyId", "tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_pursuitId_key" ON "Bid"("pursuitId");

-- CreateIndex
CREATE INDEX "Bid_pursuitId_idx" ON "Bid"("pursuitId");

-- CreateIndex
CREATE INDEX "ComplianceItem_pursuitId_idx" ON "ComplianceItem"("pursuitId");

-- CreateIndex
CREATE INDEX "ComplianceItem_status_idx" ON "ComplianceItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceItem_pursuitId_requirementId_key" ON "ComplianceItem"("pursuitId", "requirementId");

-- CreateIndex
CREATE INDEX "Task_pursuitId_idx" ON "Task"("pursuitId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Approval_pursuitId_idx" ON "Approval"("pursuitId");

-- CreateIndex
CREATE INDEX "Approval_proposalId_idx" ON "Approval"("proposalId");

-- CreateIndex
CREATE INDEX "Approval_decision_idx" ON "Approval"("decision");

-- CreateIndex
CREATE INDEX "Approval_triggerType_idx" ON "Approval"("triggerType");

-- CreateIndex
CREATE INDEX "Alert_tenantId_idx" ON "Alert"("tenantId");

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "Outcome_pursuitId_key" ON "Outcome"("pursuitId");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_code_key" ON "DataSource"("code");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "FileUpload_tenantId_idx" ON "FileUpload"("tenantId");

-- CreateIndex
CREATE INDEX "FileUpload_category_idx" ON "FileUpload"("category");

-- CreateIndex
CREATE INDEX "FileUpload_evidenceId_idx" ON "FileUpload"("evidenceId");

-- CreateIndex
CREATE INDEX "FileUpload_tenantId_createdAt_idx" ON "FileUpload"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "LlmExtraction_tenantId_idx" ON "LlmExtraction"("tenantId");

-- CreateIndex
CREATE INDEX "LlmExtraction_tenderId_idx" ON "LlmExtraction"("tenderId");

-- CreateIndex
CREATE INDEX "LlmExtraction_status_idx" ON "LlmExtraction"("status");

-- CreateIndex
CREATE INDEX "LlmExtraction_reviewStatus_idx" ON "LlmExtraction"("reviewStatus");

-- CreateIndex
CREATE INDEX "LlmExtraction_tenantId_status_createdAt_idx" ON "LlmExtraction"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ConnectorRun_sourceCode_idx" ON "ConnectorRun"("sourceCode");

-- CreateIndex
CREATE INDEX "ConnectorRun_status_idx" ON "ConnectorRun"("status");

-- CreateIndex
CREATE INDEX "ConnectorRun_startedAt_idx" ON "ConnectorRun"("startedAt");

-- CreateIndex
CREATE INDEX "ApiKey_tenantId_idx" ON "ApiKey"("tenantId");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_keyPrefix_revokedAt_idx" ON "ApiKey"("keyPrefix", "revokedAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_createdAt_idx" ON "Notification"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerProfile_organizationId_key" ON "BuyerProfile"("organizationId");

-- CreateIndex
CREATE INDEX "BuyerProfile_organizationId_idx" ON "BuyerProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProfile_organizationId_key" ON "SupplierProfile"("organizationId");

-- CreateIndex
CREATE INDEX "SupplierProfile_organizationId_idx" ON "SupplierProfile"("organizationId");

-- CreateIndex
CREATE INDEX "SupplierProfile_isCompetitor_idx" ON "SupplierProfile"("isCompetitor");

-- CreateIndex
CREATE INDEX "SupplierProfile_isPartner_idx" ON "SupplierProfile"("isPartner");

-- CreateIndex
CREATE INDEX "PartnerSuggestion_tenantId_idx" ON "PartnerSuggestion"("tenantId");

-- CreateIndex
CREATE INDEX "PartnerSuggestion_organizationId_idx" ON "PartnerSuggestion"("organizationId");

-- CreateIndex
CREATE INDEX "PartnerSuggestion_matchScore_idx" ON "PartnerSuggestion"("matchScore");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "UsageMetric_tenantId_idx" ON "UsageMetric"("tenantId");

-- CreateIndex
CREATE INDEX "UsageMetric_metricType_idx" ON "UsageMetric"("metricType");

-- CreateIndex
CREATE UNIQUE INDEX "UsageMetric_subscriptionId_metricType_periodStart_key" ON "UsageMetric"("subscriptionId", "metricType", "periodStart");

-- CreateIndex
CREATE INDEX "UsageEvent_tenantId_kind_createdAt_idx" ON "UsageEvent"("tenantId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "BillingEvent_tenantId_idx" ON "BillingEvent"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_provider_eventId_key" ON "BillingEvent"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Proposal_tenantId_idx" ON "Proposal"("tenantId");

-- CreateIndex
CREATE INDEX "Proposal_pursuitId_idx" ON "Proposal"("pursuitId");

-- CreateIndex
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");

-- CreateIndex
CREATE INDEX "Proposal_tenantId_status_updatedAt_idx" ON "Proposal"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ProposalSection_proposalId_idx" ON "ProposalSection"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalSection_sectionType_idx" ON "ProposalSection"("sectionType");

-- CreateIndex
CREATE INDEX "ProposalSection_status_idx" ON "ProposalSection"("status");

-- CreateIndex
CREATE INDEX "ProposalVersion_proposalId_idx" ON "ProposalVersion"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalVersion_versionNumber_idx" ON "ProposalVersion"("versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalVersion_proposalId_versionNumber_key" ON "ProposalVersion"("proposalId", "versionNumber");

-- CreateIndex
CREATE INDEX "ApprovalChain_tenantId_idx" ON "ApprovalChain"("tenantId");

-- CreateIndex
CREATE INDEX "ApprovalChain_triggerType_idx" ON "ApprovalChain"("triggerType");

-- CreateIndex
CREATE INDEX "ApprovalChain_isActive_idx" ON "ApprovalChain"("isActive");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_tenantId_idx" ON "WebhookEndpoint"("tenantId");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_isActive_idx" ON "WebhookEndpoint"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_eventId_key" ON "WebhookDelivery"("eventId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_tenantId_idx" ON "WebhookDelivery"("tenantId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_idx" ON "WebhookDelivery"("endpointId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_idx" ON "WebhookDelivery"("status");

-- CreateIndex
CREATE INDEX "WebhookDelivery_nextRetryAt_idx" ON "WebhookDelivery"("nextRetryAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_tenantId_status_createdAt_idx" ON "WebhookDelivery"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationPreference_tenantId_idx" ON "NotificationPreference"("tenantId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_tenantId_userId_channel_eventType_key" ON "NotificationPreference"("tenantId", "userId", "channel", "eventType");

-- CreateIndex
CREATE INDEX "CurrencyRate_tenantId_idx" ON "CurrencyRate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyRate_tenantId_baseCurrency_quoteCurrency_rateDate_key" ON "CurrencyRate"("tenantId", "baseCurrency", "quoteCurrency", "rateDate");

-- CreateIndex
CREATE INDEX "BidCostEstimate_tenantId_idx" ON "BidCostEstimate"("tenantId");

-- CreateIndex
CREATE INDEX "BidCostEstimate_pursuitId_idx" ON "BidCostEstimate"("pursuitId");

-- CreateIndex
CREATE INDEX "RateLimitBucket_apiKeyId_idx" ON "RateLimitBucket"("apiKeyId");

-- CreateIndex
CREATE INDEX "RateLimitBucket_tenantId_idx" ON "RateLimitBucket"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_identifier_bucketKey_key" ON "RateLimitBucket"("identifier", "bucketKey");

-- CreateIndex
CREATE INDEX "Embedding_tenantId_idx" ON "Embedding"("tenantId");

-- CreateIndex
CREATE INDEX "Embedding_entityType_idx" ON "Embedding"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "Embedding_tenantId_entityType_entityId_key" ON "Embedding"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "InboundWebhook_tenantId_idx" ON "InboundWebhook"("tenantId");

-- CreateIndex
CREATE INDEX "InboundWebhook_source_idx" ON "InboundWebhook"("source");

-- CreateIndex
CREATE INDEX "InboundWebhook_processedStatus_idx" ON "InboundWebhook"("processedStatus");

-- CreateIndex
CREATE UNIQUE INDEX "InboundWebhook_source_eventId_key" ON "InboundWebhook"("source", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantRequirementReview_extractionId_key" ON "TenantRequirementReview"("extractionId");

-- CreateIndex
CREATE INDEX "TenantRequirementReview_tenantId_tenderId_idx" ON "TenantRequirementReview"("tenantId", "tenderId");

-- CreateIndex
CREATE INDEX "DataExport_tenantId_idx" ON "DataExport"("tenantId");

-- CreateIndex
CREATE INDEX "DataExport_status_idx" ON "DataExport"("status");

-- CreateIndex
CREATE INDEX "DataExport_tenantId_createdAt_idx" ON "DataExport"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketConfig_code_key" ON "MarketConfig"("code");

-- CreateIndex
CREATE INDEX "MarketConfig_region_idx" ON "MarketConfig"("region");

-- CreateIndex
CREATE INDEX "MarketConfig_connectorStatus_idx" ON "MarketConfig"("connectorStatus");

-- CreateIndex
CREATE INDEX "MarketConfig_legalStatus_idx" ON "MarketConfig"("legalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ScimConfig_tenantId_key" ON "ScimConfig"("tenantId");

-- CreateIndex
CREATE INDEX "ScimConfig_tenantId_idx" ON "ScimConfig"("tenantId");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_tenantId_idx" ON "AnalyticsSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_snapshotDate_idx" ON "AnalyticsSnapshot"("snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsSnapshot_tenantId_snapshotDate_key" ON "AnalyticsSnapshot"("tenantId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "PwaSettings_tenantId_key" ON "PwaSettings"("tenantId");

-- CreateIndex
CREATE INDEX "PwaSettings_tenantId_idx" ON "PwaSettings"("tenantId");

-- CreateIndex
CREATE INDEX "OutboxJob_status_availableAt_idx" ON "OutboxJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "OutboxJob_tenantId_status_createdAt_idx" ON "OutboxJob"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountToken_tokenHash_key" ON "AccountToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountToken_userId_kind_idx" ON "AccountToken"("userId", "kind");

-- CreateIndex
CREATE INDEX "AccountToken_tenantId_expiresAt_idx" ON "AccountToken"("tenantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSupplierAnnotation_tenantId_organizationId_key" ON "TenantSupplierAnnotation"("tenantId", "organizationId");

-- CreateIndex
CREATE INDEX "CapabilityFact_tenantId_companyId_kind_idx" ON "CapabilityFact"("tenantId", "companyId", "kind");

-- CreateIndex
CREATE INDEX "CapabilityFact_tenantId_organizationId_kind_idx" ON "CapabilityFact"("tenantId", "organizationId", "kind");

