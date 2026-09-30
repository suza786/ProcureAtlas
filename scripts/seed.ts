// ProcureAtlas AI — Deterministic seed script (Phase 2)
// Run: bun run scripts/seed.ts
// Idempotent: wipes tenant-scoped tables, then inserts fresh demo data.
// All data is FICTIONAL but realistic — designed to exercise every module.

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

const NOW = new Date()
const DAY = 24 * 60 * 60 * 1000
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY)
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY)

async function main() {
  console.log('🌱 Seeding ProcureAtlas AI demo data...')

  // Clean (order matters for FK constraints)
  await prisma.notification.deleteMany()
  await prisma.apiKey.deleteMany()
  await prisma.connectorRun.deleteMany()
  await prisma.llmExtraction.deleteMany()
  await prisma.fileUpload.deleteMany()
  await prisma.session.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.alert.deleteMany()
  await prisma.outcome.deleteMany()
  await prisma.approval.deleteMany()
  await prisma.task.deleteMany()
  await prisma.complianceItem.deleteMany()
  await prisma.bid.deleteMany()
  await prisma.pursuit.deleteMany()
  await prisma.employee.deleteMany()
  await prisma.projectReference.deleteMany()
  await prisma.certification.deleteMany()
  await prisma.evidence.deleteMany()
  await prisma.company.deleteMany()
  await prisma.award.deleteMany()
  await prisma.amendment.deleteMany()
  await prisma.tenderDocument.deleteMany()
  await prisma.requirement.deleteMany()
  await prisma.lot.deleteMany()
  await prisma.tender.deleteMany()
  await prisma.buyer.deleteMany()
  await prisma.procurementAuthority.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.user.deleteMany()
  await prisma.tenant.deleteMany()
  await prisma.dataSource.deleteMany()

  // ---------- Data Source Registry ----------
  const sources = [
    { code: 'cptu_bd', name: 'Bangladesh CPTU eTender', country: 'BD', url: 'https://www.eprocure.gov.bd/', accessMethod: 'public_feed', legalStatus: 'verified', lastReviewedAt: NOW, notes: 'Central Procurement Technical Unit. Public notices accessible without login.' },
    { code: 'gebiz_sg', name: 'Singapore GeBIZ', country: 'SG', url: 'https://www.gebiz.gov.sg/', accessMethod: 'public_feed', legalStatus: 'verified', lastReviewedAt: NOW, notes: 'Public business opportunities feed.' },
    { code: 'worldbank', name: 'World Bank Procurement', country: 'GLOBAL', url: 'https://projects.worldbank.org/en/projects-operations/procurement', accessMethod: 'official_api', legalStatus: 'verified', lastReviewedAt: NOW, notes: 'API available via Corporate Procurement.' },
    { code: 'adb', name: 'Asian Development Bank', country: 'GLOBAL', url: 'https://uxdm.adb.org/', accessMethod: 'public_feed', legalStatus: 'verified', lastReviewedAt: NOW, notes: 'ADB Procurement Notices via UXDM.' },
    { code: 'ungm', name: 'United Nations Global Marketplace', country: 'GLOBAL', url: 'https://www.ungm.org/', accessMethod: 'public_feed', legalStatus: 'verified', lastReviewedAt: NOW, notes: 'UNGM Public Tenders.' },
    { code: 'ted', name: 'EU TED (Tenders Electronic Daily)', country: 'EU', url: 'https://ted.europa.eu/', accessMethod: 'official_api', legalStatus: 'verified', lastReviewedAt: NOW, notes: 'TED API + daily XML supplement.' },
    { code: 'sam_gov', name: 'U.S. SAM.gov Contract Opportunities', country: 'US', url: 'https://sam.gov/', accessMethod: 'official_api', legalStatus: 'verified', lastReviewedAt: NOW, notes: 'Public API requires free API key.' },
  ]
  for (const s of sources) {
    await prisma.dataSource.create({ data: s })
  }

  // ---------- Tenant & Users (Phase 2: password-hashed credentials) ----------
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Atlas Demo Co.',
      slug: 'atlas-demo',
      plan: 'professional',
      region: 'BD',
    },
  })

  const passwordHash = await bcrypt.hash('demo1234', 12)
  const ownerUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'owner@atlas-demo.com',
      name: 'Demo Owner',
      role: 'owner',
      passwordHash,
      mfaEnabled: false,
      lastLoginAt: daysAgo(0),
    },
  })

  const managerUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'manager@atlas-demo.com',
      name: 'Sadia Karim',
      role: 'manager',
      passwordHash: await bcrypt.hash('demo1234', 12),
      mfaEnabled: false,
    },
  })

  const contributorUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'contributor@atlas-demo.com',
      name: 'Tanvir Hasan',
      role: 'contributor',
      passwordHash: await bcrypt.hash('demo1234', 12),
    },
  })

  // Phase 2: Demo API keys for MCP / public API
  const apiKey1 = crypto.randomBytes(24).toString('hex')
  const apiKey2 = crypto.randomBytes(24).toString('hex')
  await prisma.apiKey.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: ownerUser.id,
        name: 'MCP Read Key',
        keyPrefix: apiKey1.slice(0, 8),
        keyHash: bcrypt.hashSync(apiKey1, 10),
        scopes: 'mcp:read api:read',
        expiresAt: daysFromNow(365),
      },
      {
        tenantId: tenant.id,
        userId: managerUser.id,
        name: 'API Read/Write Key',
        keyPrefix: apiKey2.slice(0, 8),
        keyHash: bcrypt.hashSync(apiKey2, 10),
        scopes: 'api:read api:write',
        expiresAt: daysFromNow(180),
      },
    ],
  })

  // Phase 2: Sample audit log entries (auth + LLM calls)
  await prisma.auditLog.createMany({
    data: [
      { tenantId: tenant.id, userId: ownerUser.id, action: 'login_success', entityType: 'auth', entityId: ownerUser.id, ipHash: 'demo_hash_1', userAgent: 'Mozilla/5.0', createdAt: daysAgo(0) },
      { tenantId: tenant.id, userId: ownerUser.id, action: 'login_success', entityType: 'auth', entityId: ownerUser.id, ipHash: 'demo_hash_1', userAgent: 'Mozilla/5.0', createdAt: daysAgo(1) },
      { tenantId: tenant.id, userId: managerUser.id, action: 'login_success', entityType: 'auth', entityId: managerUser.id, createdAt: daysAgo(2) },
      { tenantId: tenant.id, userId: ownerUser.id, action: 'pursuit_created', entityType: 'pursuit', entityId: 'demo', afterJson: JSON.stringify({ stage: 'qualifying' }), createdAt: daysAgo(2) },
      { tenantId: tenant.id, userId: ownerUser.id, action: 'llm_extraction_completed', entityType: 'tender', entityId: 'demo', llmModel: 'glm-4.6', llmInputTokens: 1240, llmOutputTokens: 580, llmLatencyMs: 2300, llmCostUsd: 0.0085, createdAt: daysAgo(3) },
      { tenantId: tenant.id, userId: ownerUser.id, action: 'evidence_uploaded', entityType: 'evidence', entityId: 'demo', afterJson: JSON.stringify({ category: 'certification', fileName: 'ISO27001.pdf' }), createdAt: daysAgo(4) },
    ],
  })

  // Phase 2: Sample notifications
  await prisma.notification.createMany({
    data: [
      { tenantId: tenant.id, userId: ownerUser.id, type: 'extraction_ready', title: 'Requirements extracted for SOC Platform tender', message: '8 requirements extracted — review pending.', link: '/tenders/demo', createdAt: daysAgo(1) },
      { tenantId: tenant.id, userId: ownerUser.id, type: 'deadline', title: 'Submission deadline in 21 days', message: 'BCC SOC Platform tender closing soon.', createdAt: daysAgo(0) },
      { tenantId: tenant.id, userId: managerUser.id, type: 'approval_request', title: 'Bid submission approval requested', message: 'Nationwide Police Network pursuit needs approval.', createdAt: daysAgo(2) },
      { tenantId: tenant.id, type: 'system', title: 'Phase 2 update available', message: 'LLM extraction, file uploads, and MCP server are now available.', createdAt: daysAgo(0) },
    ],
  })

  // ---------- Organizations (buyers + suppliers) ----------
  const orgs = await Promise.all([
    prisma.organization.create({ data: { sourcePortal: 'cptu_bd', externalId: 'BCC-001', name: 'Bangladesh Computer Council', country: 'BD', city: 'Dhaka', website: 'https://bcc.gov.bd/', orgType: 'buyer' } }),
    prisma.organization.create({ data: { sourcePortal: 'cptu_bd', externalId: 'MOHA-001', name: 'Ministry of Home Affairs', country: 'BD', city: 'Dhaka', orgType: 'buyer' } }),
    prisma.organization.create({ data: { sourcePortal: 'cptu_bd', externalId: 'BRTA-001', name: 'Bangladesh Road Transport Authority', country: 'BD', city: 'Dhaka', orgType: 'buyer' } }),
    prisma.organization.create({ data: { sourcePortal: 'gebiz_sg', externalId: 'GOVTECH-001', name: 'GovTech Singapore', country: 'SG', city: 'Singapore', orgType: 'buyer' } }),
    prisma.organization.create({ data: { sourcePortal: 'gebiz_sg', externalId: 'MOH-SG', name: 'Ministry of Health Singapore', country: 'SG', city: 'Singapore', orgType: 'buyer' } }),
    prisma.organization.create({ data: { sourcePortal: 'worldbank', externalId: 'WB-BD-TRANS', name: 'World Bank — Bangladesh Transport Unit', country: 'GLOBAL', orgType: 'authority' } }),
    prisma.organization.create({ data: { sourcePortal: 'adb', externalId: 'ADB-BD-ENERGY', name: 'Asian Development Bank — Energy Division', country: 'GLOBAL', orgType: 'authority' } }),
    prisma.organization.create({ data: { sourcePortal: 'ungm', externalId: 'UNDP-BD', name: 'UNDP Bangladesh Country Office', country: 'GLOBAL', orgType: 'buyer' } }),
    prisma.organization.create({ data: { sourcePortal: 'ted', externalId: 'EU-DIGIT', name: 'European Commission DG DIGIT', country: 'EU', city: 'Brussels', orgType: 'buyer' } }),
    prisma.organization.create({ data: { sourcePortal: 'sam_gov', externalId: 'GSA-001', name: 'U.S. General Services Administration', country: 'US', city: 'Washington DC', orgType: 'buyer' } }),
    // Suppliers (incumbents / competitors)
    prisma.organization.create({ data: { sourcePortal: 'cptu_bd', externalId: 'SUP-001', name: 'CyberNet Bangladesh Ltd', country: 'BD', city: 'Dhaka', orgType: 'supplier' } }),
    prisma.organization.create({ data: { sourcePortal: 'cptu_bd', externalId: 'SUP-002', name: 'NexaTech Solutions', country: 'BD', city: 'Chattogram', orgType: 'supplier' } }),
    prisma.organization.create({ data: { sourcePortal: 'worldbank', externalId: 'SUP-003', name: 'InfraCo Asia', country: 'SG', city: 'Singapore', orgType: 'supplier' } }),
  ])

  const buyers = await Promise.all(orgs.slice(0, 10).map(o =>
    prisma.buyer.create({ data: { organizationId: o.id, department: o.name } })
  ))

  // ---------- Demo Company (tenant's own company) ----------
  const company = await prisma.company.create({
    data: {
      tenantId: tenant.id,
      name: 'Atlas Demo Co.',
      legalName: 'Atlas Demo Company Limited',
      country: 'BD',
      city: 'Dhaka',
      registrationNo: 'RJSC-1234567',
      taxId: 'TIN-987654321',
      website: 'https://atlas-demo.com',
      foundedYear: 2014,
      employeeCount: 85,
      annualTurnoverUSD: 4200000,
      description: 'Bangladesh-based IT & cybersecurity systems integrator serving government and financial sector.',
    },
  })

  // ---------- Evidence ----------
  const evidence = await Promise.all([
    prisma.evidence.create({ data: { companyId: company.id, category: 'registration', title: 'Trade License (Dhaka South City Corporation)', issuer: 'DSCC', issuedAt: daysAgo(120), expiresAt: daysFromNow(245), verified: true, verifiedBy: 'owner@atlas-demo.com', verifiedAt: daysAgo(100), confidence: 0.99 } }),
    prisma.evidence.create({ data: { companyId: company.id, category: 'registration', title: 'RJSC Incorporation Certificate', issuer: 'RJSC Bangladesh', issuedAt: daysAgo(365 * 11), verified: true, verifiedBy: 'owner@atlas-demo.com', verifiedAt: daysAgo(365), confidence: 0.99 } }),
    prisma.evidence.create({ data: { companyId: company.id, category: 'financial', title: 'Audited Financial Statements FY2024', issuer: 'Hood & Associates Chartered Accountants', issuedAt: daysAgo(180), verified: true, verifiedBy: 'owner@atlas-demo.com', verifiedAt: daysAgo(170), confidence: 0.95 } }),
    prisma.evidence.create({ data: { companyId: company.id, category: 'financial', title: 'Bank Solvency Certificate — City Bank PLC', issuer: 'The City Bank Limited', issuedAt: daysAgo(45), expiresAt: daysFromNow(90), verified: true, confidence: 0.95 } }),
    prisma.evidence.create({ data: { companyId: company.id, category: 'certification', title: 'ISO 27001:2022 — Information Security Management', issuer: 'BSI', issuedAt: daysAgo(300), expiresAt: daysFromNow(65), verified: true, confidence: 0.99 } }),
    prisma.evidence.create({ data: { companyId: company.id, category: 'certification', title: 'ISO 9001:2015 — Quality Management', issuer: 'BSI', issuedAt: daysAgo(300), expiresAt: daysFromNow(65), verified: true, confidence: 0.99 } }),
    prisma.evidence.create({ data: { companyId: company.id, category: 'certification', title: 'CMMI Level 3 — Appraisal', issuer: 'ISACA', issuedAt: daysAgo(540), expiresAt: daysFromNow(180), verified: true, confidence: 0.95 } }),
    prisma.evidence.create({ data: { companyId: company.id, category: 'oem', title: 'Microsoft Authorized Services Partner — Security', issuer: 'Microsoft Corporation', issuedAt: daysAgo(200), expiresAt: daysFromNow(165), verified: true, confidence: 0.95 } }),
    prisma.evidence.create({ data: { companyId: company.id, category: 'oem', title: 'Cisco Gold Integrator — Bangladesh', issuer: 'Cisco Systems', issuedAt: daysAgo(150), expiresAt: daysFromNow(215), verified: true, confidence: 0.95 } }),
    prisma.evidence.create({ data: { companyId: company.id, category: 'project', title: 'National ID System — Cybersecurity Hardening (Bangladesh Election Commission)', issuer: 'Bangladesh Election Commission', issuedAt: daysAgo(720), verified: true, confidence: 0.95 } }),
    prisma.evidence.create({ data: { companyId: company.id, category: 'project', title: 'Sonali Bank Core Banking Firewall Upgrade', issuer: 'Sonali Bank Limited', issuedAt: daysAgo(450), verified: true, confidence: 0.9 } }),
    prisma.evidence.create({ data: { companyId: company.id, category: 'employee', title: 'Chief Security Architect — BSc, CISSP, CCSP', issuer: 'Internal HR', issuedAt: daysAgo(60), verified: true, confidence: 0.9 } }),
  ])

  await Promise.all([
    prisma.certification.create({ data: { companyId: company.id, name: 'ISO 27001:2022', standard: 'ISO/IEC 27001', issuer: 'BSI', issuedAt: daysAgo(300), expiresAt: daysFromNow(65), certificateNo: 'IS-7283901', verified: true } }),
    prisma.certification.create({ data: { companyId: company.id, name: 'ISO 9001:2015', standard: 'ISO 9001', issuer: 'BSI', issuedAt: daysAgo(300), expiresAt: daysFromNow(65), certificateNo: 'QM-1182734', verified: true } }),
    prisma.certification.create({ data: { companyId: company.id, name: 'CMMI Level 3', standard: 'CMMI V2.0', issuer: 'ISACA', issuedAt: daysAgo(540), expiresAt: daysFromNow(180), certificateNo: 'CMMI-3-44512', verified: true } }),
    prisma.certification.create({ data: { companyId: company.id, name: 'Cisco Gold Integrator', standard: 'Cisco Partner', issuer: 'Cisco', issuedAt: daysAgo(150), expiresAt: daysFromNow(215), verified: true } }),
    prisma.certification.create({ data: { companyId: company.id, name: 'Microsoft AOSP — Security', standard: 'Microsoft AOSP', issuer: 'Microsoft', issuedAt: daysAgo(200), expiresAt: daysFromNow(165), verified: true } }),
  ])

  await Promise.all([
    prisma.projectReference.create({ data: { companyId: company.id, title: 'National ID System Cybersecurity Hardening', client: 'Bangladesh Election Commission', clientType: 'government', country: 'BD', valueUSD: 850000, startDate: daysAgo(900), endDate: daysAgo(720), role: 'prime', verified: true } }),
    prisma.projectReference.create({ data: { companyId: company.id, title: 'Sonali Bank Core Banking Firewall Upgrade', client: 'Sonali Bank Limited', clientType: 'private', country: 'BD', valueUSD: 320000, startDate: daysAgo(600), endDate: daysAgo(450), role: 'prime', verified: true } }),
    prisma.projectReference.create({ data: { companyId: company.id, title: 'BRTA Vehicle Registration Portal — Security Audit', client: 'Bangladesh Road Transport Authority', clientType: 'government', country: 'BD', valueUSD: 120000, startDate: daysAgo(380), endDate: daysAgo(280), role: 'subcontractor', verified: true } }),
    prisma.projectReference.create({ data: { companyId: company.id, title: 'A2I GovTech Innovation Lab — DevSecOps', client: 'Aspire to Innovate (a2i) Programme', clientType: 'government', country: 'BD', valueUSD: 220000, startDate: daysAgo(200), endDate: daysAgo(30), role: 'prime', verified: true } }),
  ])

  await Promise.all([
    prisma.employee.create({ data: { companyId: company.id, name: 'Anika Rahman', role: 'Chief Security Architect', qualifications: 'CISSP, CCSP, CEH', yearsExperience: 14, securityClearance: 'Level-2' } }),
    prisma.employee.create({ data: { companyId: company.id, name: 'Tanvir Hasan', role: 'Lead Network Engineer', qualifications: 'CCIE, CCNP', yearsExperience: 11 } }),
    prisma.employee.create({ data: { companyId: company.id, name: 'Sadia Karim', role: 'Bid Manager', qualifications: 'APMP Practitioner', yearsExperience: 8 } }),
    prisma.employee.create({ data: { companyId: company.id, name: 'Rafiq Uddin', role: 'Senior Cloud Engineer', qualifications: 'AWS Solutions Architect Pro, Azure Solutions Architect Expert', yearsExperience: 9 } }),
  ])

  // ---------- Tenders ----------
  // Each tender: realistic, sourced, with requirements, lots, amendments, deadlines.

  const tenderInputs = [
    {
      externalId: 'CPTU-BCC-2026-001',
      sourcePortal: 'cptu_bd',
      sourceUrl: 'https://www.eprocure.gov.bd/tender/1006452',
      title: 'Supply, Installation & Commissioning of SOC Platform for Bangladesh Computer Council',
      titleLocal: 'বাংলাদেশ কম্পিউটার কাউন্সিলের জন্য SOC প্ল্যাটফর্ম সরবরাহ ও স্থাপন',
      description: 'Procurement of Security Operations Center (SOC) platform with SIEM, SOAR, and 24/7 monitoring capability for Bangladesh government critical infrastructure.',
      country: 'BD', market: 'BD', sector: 'Cyber', procurementMethod: 'open', noticeType: 'tender',
      currency: 'BDT', estimatedValue: 85000000, valueUSD: 770000,
      publishedAt: daysAgo(14), submissionDeadline: daysFromNow(21), questionDeadline: daysFromNow(7),
      bidValidityDays: 120, tenderSecurityPct: 2, performanceSecurityPct: 10,
      buyerIdx: 0, contactPerson: 'Md. Tariq Aziz', contactEmail: 'tender@bcc.gov.bd',
      preBidMeetingAt: daysFromNow(3),
      requirements: [
        { category: 'experience', criterion: 'Minimum average annual turnover', operator: '>=', threshold: '50000000 BDT (~455000 USD)', isMandatory: true, sourceDoc: 'Tender Document Section 4', sourcePage: 12, sourceClause: '4.2.1', extractedText: 'The bidder shall have a minimum average annual turnover of BDT 5 Crore (fifty million) over the last 3 financial years.', confidence: 0.95 },
        { category: 'experience', criterion: 'Minimum years in business', operator: '>=', threshold: '5 years', isMandatory: true, sourceDoc: 'Tender Document Section 4', sourcePage: 12, sourceClause: '4.2.2', extractedText: 'The bidder must be registered and operating for at least 5 years in the ICT sector.', confidence: 0.95 },
        { category: 'experience', criterion: 'Minimum similar project references', operator: '>=', threshold: '2 projects of similar scale', isMandatory: true, sourceDoc: 'Tender Document Section 4', sourcePage: 13, sourceClause: '4.2.3', extractedText: 'Bidder must have completed at least 2 SOC/SIEM implementations of similar scale in the last 5 years.', confidence: 0.92 },
        { category: 'certification', criterion: 'ISO 27001 certification', operator: '==', threshold: 'Valid ISO 27001', isMandatory: true, sourceDoc: 'Tender Document Section 4', sourcePage: 14, sourceClause: '4.3.1', extractedText: 'Bidder must hold a valid ISO 27001 certification.', confidence: 0.95 },
        { category: 'certification', criterion: 'OEM Authorization', operator: '==', threshold: 'Authorized partner of SOC platform vendor', isMandatory: true, sourceDoc: 'Tender Document Section 4', sourcePage: 14, sourceClause: '4.3.4', extractedText: 'Bidder must submit OEM authorization letter from the SOC platform principal vendor.', confidence: 0.95 },
        { category: 'financial', criterion: 'Tender Security', operator: '>=', threshold: '2% of bid value (Bank Guarantee)', isMandatory: true, sourceDoc: 'Tender Document Section 6', sourcePage: 22, sourceClause: '6.1', extractedText: 'A tender security of 2% of bid value in the form of bank guarantee/pay order must accompany the bid.', confidence: 0.98 },
        { category: 'document', criterion: 'Bid validity', operator: '>=', threshold: '120 days', isMandatory: true, sourceDoc: 'Tender Document Section 6', sourcePage: 23, sourceClause: '6.4', extractedText: 'Bids shall remain valid for 120 days from the submission deadline.', confidence: 0.98 },
        { category: 'legal', criterion: 'Up-to-date VAT registration', operator: '==', threshold: 'Valid VAT registration', isMandatory: true, sourceDoc: 'Tender Document Section 4', sourcePage: 11, sourceClause: '4.1.3', extractedText: 'Bidder must possess valid VAT registration certificate.', confidence: 0.95 },
      ],
      amendments: [
        { amendmentNo: 1, title: 'Deadline Extension', description: 'Submission deadline extended by 7 days due to vendor requests.', publishedAt: daysAgo(3), affectsDeadline: true, newDeadline: daysFromNow(21), sourceUrl: 'https://www.eprocure.gov.bd/tender/1006452/amendment/1' },
      ],
    },
    {
      externalId: 'CPTU-MOHA-2026-014',
      sourcePortal: 'cptu_bd',
      sourceUrl: 'https://www.eprocure.gov.bd/tender/1006488',
      title: 'Nationwide Police Communications Network — Phase II Equipment Supply',
      description: 'Supply and commissioning of encrypted radio communications equipment for Bangladesh Police nationwide rollout.',
      country: 'BD', market: 'BD', sector: 'IT', procurementMethod: 'open', noticeType: 'tender',
      currency: 'BDT', estimatedValue: 320000000, valueUSD: 2900000,
      publishedAt: daysAgo(7), submissionDeadline: daysFromNow(35), questionDeadline: daysFromNow(14),
      bidValidityDays: 180, tenderSecurityPct: 2, performanceSecurityPct: 10,
      buyerIdx: 1, contactPerson: 'Ayesha Siddiqua', contactEmail: 'procurement@moha.gov.bd',
      requirements: [
        { category: 'experience', criterion: 'Minimum annual turnover', operator: '>=', threshold: '150000000 BDT (~1.36M USD)', isMandatory: true, sourceDoc: 'Tender Document Section 5', sourcePage: 8, sourceClause: '5.2.1', extractedText: 'Minimum average annual turnover of BDT 15 Crore over the last 3 years.', confidence: 0.95 },
        { category: 'experience', criterion: 'Prior police/government communications project', operator: '==', threshold: 'At least 1 project of similar scale', isMandatory: true, sourceDoc: 'Tender Document Section 5', sourcePage: 9, sourceClause: '5.2.3', extractedText: 'Bidder must have completed at least 1 police/military communications deployment.', confidence: 0.92 },
        { category: 'certification', criterion: 'OEM Authorization (Motorola / Harris / Hytera)', operator: '==', threshold: 'Authorization letter', isMandatory: true, sourceDoc: 'Tender Document Section 5', sourcePage: 10, sourceClause: '5.3.1', extractedText: 'Bidder must be an authorized partner of the principal equipment vendor.', confidence: 0.95 },
        { category: 'legal', criterion: 'Local agent registration', operator: '==', threshold: 'Valid local agent registration', isMandatory: true, sourceDoc: 'Tender Document Section 4', sourcePage: 5, sourceClause: '4.1.5', extractedText: 'Foreign bidders must submit through a locally registered agent.', confidence: 0.95 },
      ],
      amendments: [],
    },
    {
      externalId: 'GEBIZ-GT-2026-2204',
      sourcePortal: 'gebiz_sg',
      sourceUrl: 'https://www.gebiz.gov.sg/ptn/opportunities/BO-detail?id=2026-2204',
      title: 'Singapore GovTech — Zero Trust Architecture Implementation',
      description: 'Implementation of Zero Trust Architecture across GovTech Singapore cloud and on-premises estate.',
      country: 'SG', market: 'SG', sector: 'Cyber', procurementMethod: 'open', noticeType: 'tender',
      currency: 'SGD', estimatedValue: 1800000, valueUSD: 1340000,
      publishedAt: daysAgo(10), submissionDeadline: daysFromNow(28), questionDeadline: daysFromNow(10),
      buyerIdx: 3, contactPerson: 'Lim Wei Ming', contactEmail: 'tender@govtech.gov.sg',
      preBidMeetingAt: daysFromNow(5),
      requirements: [
        { category: 'experience', criterion: 'Minimum track record in Singapore public sector', operator: '>=', threshold: '3 years', isMandatory: true, sourceDoc: 'Tender Specifications v2', sourcePage: 6, sourceClause: '3.1', extractedText: 'Tenderer must have a minimum of 3 years track record providing cybersecurity services in Singapore public sector.', confidence: 0.95 },
        { category: 'certification', criterion: 'CyberEssentials Plus or equivalent', operator: '==', threshold: 'Valid certification', isMandatory: true, sourceDoc: 'Tender Specifications v2', sourcePage: 7, sourceClause: '3.2.1', extractedText: 'Tenderer must hold CyberEssentials Plus or recognized equivalent.', confidence: 0.93 },
        { category: 'certification', criterion: 'ISO 27001', operator: '==', threshold: 'Valid ISO 27001', isMandatory: true, sourceDoc: 'Tender Specifications v2', sourcePage: 7, sourceClause: '3.2.2', extractedText: 'ISO 27001 certification required.', confidence: 0.98 },
        { category: 'experience', criterion: 'Local presence in Singapore', operator: '==', threshold: 'Registered Singapore entity', isMandatory: true, sourceDoc: 'Tender Specifications v2', sourcePage: 5, sourceClause: '2.1', extractedText: 'Tenderer must be a registered business in Singapore.', confidence: 0.95 },
      ],
      amendments: [],
    },
    {
      externalId: 'GEBIZ-MOH-2026-1180',
      sourcePortal: 'gebiz_sg',
      sourceUrl: 'https://www.gebiz.gov.sg/ptn/opportunities/BO-detail?id=2026-1180',
      title: 'MOH Singapore — National Health Data Platform Analytics Module',
      description: 'Procurement of analytics module for the National Health Data Platform.',
      country: 'SG', market: 'SG', sector: 'IT', procurementMethod: 'open', noticeType: 'rfp',
      currency: 'SGD', estimatedValue: 950000, valueUSD: 708000,
      publishedAt: daysAgo(5), submissionDeadline: daysFromNow(25), questionDeadline: daysFromNow(12),
      buyerIdx: 4, contactPerson: 'Dr. Ng Hui Ling', contactEmail: 'procurement@moh.gov.sg',
      requirements: [
        { category: 'experience', criterion: 'Minimum healthcare analytics experience', operator: '>=', threshold: '5 years', isMandatory: true, sourceDoc: 'RFP Document', sourcePage: 4, sourceClause: '2.2', extractedText: 'Minimum 5 years experience in healthcare data analytics.', confidence: 0.93 },
        { category: 'certification', criterion: 'ISO 9001', operator: '==', threshold: 'Valid ISO 9001', isMandatory: true, sourceDoc: 'RFP Document', sourcePage: 5, sourceClause: '2.3.1', extractedText: 'ISO 9001 certification required.', confidence: 0.95 },
        { category: 'experience', criterion: 'Local Singapore entity', operator: '==', threshold: 'Registered entity', isMandatory: true, sourceDoc: 'RFP Document', sourcePage: 3, sourceClause: '1.5', extractedText: 'Must be registered in Singapore.', confidence: 0.95 },
      ],
      amendments: [],
    },
    {
      externalId: 'WB-P173987-2026-003',
      sourcePortal: 'worldbank',
      sourceUrl: 'https://projects.worldbank.org/en/projects-operations/procurement/notice?id=OP0034-Y2026',
      title: 'Bangladesh — Digital Backbone Project (Consultancy: Cybersecurity Architecture)',
      description: 'Consultancy services for cybersecurity architecture under the Bangladesh Digital Backbone Project.',
      country: 'BD', market: 'WB', sector: 'Consulting', procurementMethod: 'open', noticeType: 'rfp',
      currency: 'USD', estimatedValue: 600000, valueUSD: 600000,
      publishedAt: daysAgo(20), submissionDeadline: daysFromNow(14), questionDeadline: daysFromNow(2),
      buyerIdx: 5, contactPerson: 'World Bank TTL', contactEmail: 'wb-bd-digital@worldbank.org',
      requirements: [
        { category: 'experience', criterion: 'Minimum years of consulting experience', operator: '>=', threshold: '10 years', isMandatory: true, sourceDoc: 'TOR Section V', sourcePage: 18, sourceClause: 'V.1', extractedText: 'The firm shall have at least 10 years of consulting experience in cybersecurity architecture.', confidence: 0.95 },
        { category: 'experience', criterion: 'Prior World Bank/ADB project experience', operator: '>=', threshold: '1 prior MDB project', isMandatory: true, sourceDoc: 'TOR Section V', sourcePage: 18, sourceClause: 'V.3', extractedText: 'Experience in at least one prior MDB-funded project is desirable (mandatory for shortlist).', confidence: 0.88 },
        { category: 'certification', criterion: 'ISO 27001 Lead Implementer (key personnel)', operator: '==', threshold: 'At least 1 certified', isMandatory: true, sourceDoc: 'TOR Section VI', sourcePage: 22, sourceClause: 'VI.2', extractedText: 'Key expert must be ISO 27001 Lead Implementer certified.', confidence: 0.95 },
        { category: 'experience', criterion: 'Average annual turnover (USD)', operator: '>=', threshold: '500000 USD', isMandatory: true, sourceDoc: 'TOR Section IV', sourcePage: 14, sourceClause: 'IV.1', extractedText: 'Average annual turnover of at least USD 500,000 over the last 3 years.', confidence: 0.95 },
      ],
      amendments: [],
    },
    {
      externalId: 'ADB-51032-001-CYBER',
      sourcePortal: 'adb',
      sourceUrl: 'https://uxdm.adb.org/notice/51032-001',
      title: 'ADB — Bangladesh Energy Sector Cybersecurity Roadmap Consulting',
      description: 'Consulting services for cybersecurity roadmap development in Bangladesh energy sector.',
      country: 'BD', market: 'ADB', sector: 'Consulting', procurementMethod: 'open', noticeType: 'rfp',
      currency: 'USD', estimatedValue: 450000, valueUSD: 450000,
      publishedAt: daysAgo(12), submissionDeadline: daysFromNow(18), questionDeadline: daysFromNow(4),
      buyerIdx: 6, contactPerson: 'ADB Energy Division', contactEmail: 'adbenergy@adb.org',
      requirements: [
        { category: 'experience', criterion: 'Energy sector cybersecurity experience', operator: '>=', threshold: '5 years', isMandatory: true, sourceDoc: 'TOR', sourcePage: 8, sourceClause: '3.2', extractedText: 'Minimum 5 years experience in energy sector cybersecurity.', confidence: 0.92 },
        { category: 'experience', criterion: 'Prior ADB project experience', operator: '==', threshold: 'Desirable', isMandatory: false, sourceDoc: 'TOR', sourcePage: 9, sourceClause: '3.4', extractedText: 'Prior ADB-funded project experience is desirable.', confidence: 0.88 },
      ],
      amendments: [],
    },
    {
      externalId: 'UNDP-BD-IC-2026-018',
      sourcePortal: 'ungm',
      sourceUrl: 'https://www.ungm.org/Public/Notice/1782942',
      title: 'UNDP Bangladesh — Digital Transformation Lead (Individual Contractor)',
      description: 'Individual contractor for digital transformation advisory services to Government of Bangladesh.',
      country: 'BD', market: 'UN', sector: 'Consulting', procurementMethod: 'open', noticeType: 'rfp',
      currency: 'USD', estimatedValue: 95000, valueUSD: 95000,
      publishedAt: daysAgo(9), submissionDeadline: daysFromNow(11), questionDeadline: daysFromNow(3),
      buyerIdx: 7, contactPerson: 'UNDP Procurement', contactEmail: 'ic@undp.org',
      requirements: [
        { category: 'experience', criterion: 'Minimum years experience', operator: '>=', threshold: '10 years', isMandatory: true, sourceDoc: 'Terms of Reference', sourcePage: 3, sourceClause: '2.1', extractedText: 'Minimum 10 years of relevant experience in digital transformation.', confidence: 0.95 },
        { category: 'experience', criterion: 'Advanced degree', operator: '==', threshold: 'Master degree in relevant field', isMandatory: true, sourceDoc: 'TOR', sourcePage: 3, sourceClause: '2.2', extractedText: 'Master degree in IT, public policy, or related field.', confidence: 0.95 },
      ],
      amendments: [],
    },
    {
      externalId: 'TED-2026/S-104-278934',
      sourcePortal: 'ted',
      sourceUrl: 'https://ted.europa.eu/udl?uri=TED:NOTICE:278934-2026:TEXT:EN:HTML',
      title: 'EU DG DIGIT — Cybersecurity Threat Intelligence Platform',
      description: 'Supply and operation of a centralized Cyber Threat Intelligence platform for European Commission services.',
      country: 'EU', market: 'EU', sector: 'Cyber', procurementMethod: 'open', noticeType: 'tender',
      currency: 'EUR', estimatedValue: 4500000, valueUSD: 4850000,
      publishedAt: daysAgo(18), submissionDeadline: daysFromNow(42), questionDeadline: daysFromNow(20),
      buyerIdx: 8, contactPerson: 'DG DIGIT Procurement', contactEmail: 'digit-procurement@ec.europa.eu',
      requirements: [
        { category: 'experience', criterion: 'Minimum EU public sector experience', operator: '>=', threshold: '5 years', isMandatory: true, sourceDoc: 'Specifications Document', sourcePage: 12, sourceClause: '4.1', extractedText: 'Minimum 5 years experience supplying cybersecurity to EU institutions.', confidence: 0.95 },
        { category: 'certification', criterion: 'ISO 27001 + ISO 22301', operator: '==', threshold: 'Both required', isMandatory: true, sourceDoc: 'Specifications', sourcePage: 13, sourceClause: '4.2', extractedText: 'ISO 27001 and ISO 22301 certifications required.', confidence: 0.95 },
        { category: 'certification', criterion: 'EU establishment', operator: '==', threshold: 'Established in EU', isMandatory: true, sourceDoc: 'Specifications', sourcePage: 10, sourceClause: '3.1', extractedText: 'Tenderer must be established in the European Union.', confidence: 0.98 },
      ],
      amendments: [],
    },
    {
      externalId: 'SAM-GSA-2026-Q-0098',
      sourcePortal: 'sam_gov',
      sourceUrl: 'https://sam.gov/opp/4f8e2a3b-0001-4a2b-9c1f-00aa11223344/view',
      title: 'GSA — Cybersecurity Assessment Services BPA Call 0098',
      description: 'Call order under GSA Multiple Award Schedule for cybersecurity assessment services to federal agency.',
      country: 'US', market: 'US', sector: 'Cyber', procurementMethod: 'selective', noticeType: 'rfq',
      currency: 'USD', estimatedValue: 850000, valueUSD: 850000,
      publishedAt: daysAgo(4), submissionDeadline: daysFromNow(10), questionDeadline: daysFromNow(2),
      buyerIdx: 9, contactPerson: 'GSA Contracting Officer', contactEmail: 'co@gsa.gov',
      requirements: [
        { category: 'certification', criterion: 'FedRAMP authorization', operator: '==', threshold: 'FedRAMP Moderate (minimum)', isMandatory: false, sourceDoc: 'Q&A attachment', sourcePage: 2, sourceClause: '1.3', extractedText: 'FedRAMP authorization preferred but not mandatory for this call order.', confidence: 0.88 },
        { category: 'certification', criterion: 'CMMI Level 3 minimum', operator: '>=', threshold: 'CMMI L3', isMandatory: true, sourceDoc: 'Solicitation', sourcePage: 6, sourceClause: '2.2', extractedText: 'CMMI Level 3 minimum required.', confidence: 0.95 },
        { category: 'certification', criterion: 'Dun & Bradstreet + SAM registration', operator: '==', threshold: 'Active', isMandatory: true, sourceDoc: 'Solicitation', sourcePage: 3, sourceClause: '1.1', extractedText: 'Active SAM.gov registration and valid UEI required.', confidence: 0.98 },
      ],
      amendments: [],
    },
    {
      externalId: 'CPTU-BRTA-2026-005',
      sourcePortal: 'cptu_bd',
      sourceUrl: 'https://www.eprocure.gov.bd/tender/1006510',
      title: 'BRTA — Vehicle Inspection IT System Upgrade',
      description: 'Upgrade of BRTA vehicle inspection IT system with automated testing equipment integration.',
      country: 'BD', market: 'BD', sector: 'IT', procurementMethod: 'open', noticeType: 'tender',
      currency: 'BDT', estimatedValue: 45000000, valueUSD: 408000,
      publishedAt: daysAgo(3), submissionDeadline: daysFromNow(28), questionDeadline: daysFromNow(10),
      buyerIdx: 2, contactPerson: 'BRTA Procurement', contactEmail: 'proc@brta.gov.bd',
      requirements: [
        { category: 'experience', criterion: 'Minimum annual turnover', operator: '>=', threshold: '30000000 BDT', isMandatory: true, sourceDoc: 'Tender Document Section 4', sourcePage: 10, sourceClause: '4.2.1', extractedText: 'Minimum annual turnover BDT 3 Crore.', confidence: 0.95 },
        { category: 'experience', criterion: 'Similar project experience', operator: '>=', threshold: '1 project', isMandatory: true, sourceDoc: 'Tender Document Section 4', sourcePage: 11, sourceClause: '4.2.3', extractedText: 'At least 1 similar IT system integration project.', confidence: 0.93 },
        { category: 'certification', criterion: 'ISO 9001', operator: '==', threshold: 'Valid', isMandatory: true, sourceDoc: 'Tender Document Section 4', sourcePage: 12, sourceClause: '4.3.1', extractedText: 'ISO 9001 required.', confidence: 0.95 },
      ],
      amendments: [],
    },
    {
      externalId: 'CPTU-BCC-2025-098',
      sourcePortal: 'cptu_bd',
      sourceUrl: 'https://www.eprocure.gov.bd/tender/1005980',
      title: 'BCC — GovCloud Migration Consulting (Closed/Awarded)',
      description: 'Consulting services for Bangladesh Government Cloud migration. (Closed — included for award intelligence.)',
      country: 'BD', market: 'BD', sector: 'Consulting', procurementMethod: 'open', noticeType: 'tender',
      currency: 'BDT', estimatedValue: 22000000, valueUSD: 200000,
      publishedAt: daysAgo(120), submissionDeadline: daysAgo(60),
      status: 'awarded', awardStatus: 'awarded',
      buyerIdx: 0, contactPerson: 'BCC Procurement', contactEmail: 'tender@bcc.gov.bd',
      requirements: [],
      amendments: [],
      awardSupplierIdx: 10, awardValue: 22000000, awardValueUSD: 200000, awardedAt: daysAgo(40),
    },
    {
      externalId: 'WB-P175012-2025-007',
      sourcePortal: 'worldbank',
      sourceUrl: 'https://projects.worldbank.org/en/projects-operations/procurement/notice?id=OP0021-Y2025',
      title: 'Bangladesh — Health Sector Cybersecurity Consulting (Closed/Awarded)',
      description: 'Cybersecurity consulting for Bangladesh health sector. (Closed — included for award intelligence.)',
      country: 'BD', market: 'WB', sector: 'Consulting', procurementMethod: 'open', noticeType: 'rfp',
      currency: 'USD', estimatedValue: 350000, valueUSD: 350000,
      publishedAt: daysAgo(220), submissionDeadline: daysAgo(150),
      status: 'awarded', awardStatus: 'awarded',
      buyerIdx: 5, contactPerson: 'World Bank TTL', contactEmail: 'wb@worldbank.org',
      requirements: [],
      amendments: [],
      awardSupplierIdx: 12, awardValue: 350000, awardValueUSD: 350000, awardedAt: daysAgo(110),
    },
  ]

  const createdTenders: { id: string; market: string; sector: string; title: string }[] = []

  for (const t of tenderInputs) {
    const buyer = buyers[t.buyerIdx]
    const created = await prisma.tender.create({
      data: {
        externalId: t.externalId,
        sourcePortal: t.sourcePortal,
        sourceUrl: t.sourceUrl,
        title: t.title,
        titleLocal: t.titleLocal ?? null,
        description: t.description,
        country: t.country,
        market: t.market,
        sector: t.sector,
        procurementMethod: t.procurementMethod,
        noticeType: t.noticeType,
        currency: t.currency,
        estimatedValue: t.estimatedValue,
        valueUSD: t.valueUSD,
        publishedAt: t.publishedAt,
        submissionDeadline: t.submissionDeadline,
        questionDeadline: t.questionDeadline,
        bidValidityDays: t.bidValidityDays ?? null,
        tenderSecurityPct: t.tenderSecurityPct ?? null,
        performanceSecurityPct: t.performanceSecurityPct ?? null,
        status: t.status ?? 'active',
        awardStatus: t.awardStatus ?? null,
        contactPerson: t.contactPerson,
        contactEmail: t.contactEmail,
        preBidMeetingAt: t.preBidMeetingAt ?? null,
        buyerId: buyer.id,
        confidence: 0.9,
      },
    })
    createdTenders.push({ id: created.id, market: t.market, sector: t.sector, title: t.title })

    // Lots (where applicable)
    if (t.sourcePortal === 'cptu_bd' && t.title.includes('SOC')) {
      await prisma.lot.createMany({
        data: [
          { tenderId: created.id, title: 'Lot 1 — SIEM Platform', description: 'SIEM platform license + implementation', estimatedValue: 45000000, currency: 'BDT' },
          { tenderId: created.id, title: 'Lot 2 — SOAR Platform', description: 'SOAR platform license + playbooks', estimatedValue: 25000000, currency: 'BDT' },
          { tenderId: created.id, title: 'Lot 3 — 24/7 Monitoring Setup', description: 'Monitoring operations setup', estimatedValue: 15000000, currency: 'BDT' },
        ],
      })
    }

    // Requirements
    for (const r of t.requirements) {
      await prisma.requirement.create({
        data: {
          tenderId: created.id,
          category: r.category,
          criterion: r.criterion,
          operator: r.operator,
          threshold: r.threshold,
          description: r.extractedText,
          isMandatory: r.isMandatory,
          sourceDoc: r.sourceDoc,
          sourcePage: r.sourcePage,
          sourceClause: r.sourceClause,
          extractedText: r.extractedText,
          confidence: r.confidence,
        },
      })
    }

    // Amendments
    for (const a of (t.amendments ?? [])) {
      await prisma.amendment.create({
        data: {
          tenderId: created.id,
          amendmentNo: a.amendmentNo,
          title: a.title,
          description: a.description,
          publishedAt: a.publishedAt,
          affectsDeadline: a.affectsDeadline,
          newDeadline: a.newDeadline ?? null,
          sourceUrl: a.sourceUrl,
        },
      })
    }

    // Award (for closed tenders)
    if (t.awardSupplierIdx !== undefined) {
      const supplier = orgs[t.awardSupplierIdx]
      await prisma.award.create({
        data: {
          tenderId: created.id,
          supplierOrgId: supplier.id,
          contractValue: t.awardValue,
          currency: t.currency,
          awardedAt: t.awardedAt,
          sourceUrl: t.sourceUrl,
        },
      })
    }

    // Tender documents
    await prisma.tenderDocument.create({
      data: { tenderId: created.id, name: 'Notice.pdf', docType: 'notice', sourceUrl: t.sourceUrl, uploadedAt: t.publishedAt },
    })
    if (t.requirements.length > 0) {
      await prisma.tenderDocument.create({
        data: { tenderId: created.id, name: 'Tender Specifications.pdf', docType: 'specification', sourceUrl: t.sourceUrl, uploadedAt: t.publishedAt },
      })
    }
  }

  // ---------- Pursuits ----------
  // Pick the first 4 active tenders for pursuits in different stages
  const activeTenders = await prisma.tender.findMany({
    where: { status: 'active' },
    take: 4,
    orderBy: { publishedAt: 'desc' },
  })

  const pursuitStages = ['qualifying', 'bidding', 'discovering', 'bidding'] as const
  const pursuitDecisions = ['bid', 'bid', 'pending', 'bid'] as const
  const pursuitPriorities = ['high', 'strategic', 'medium', 'high'] as const

  for (let i = 0; i < activeTenders.length; i++) {
    const tender = activeTenders[i]
    const pursuit = await prisma.pursuit.create({
      data: {
        tenantId: tenant.id,
        tenderId: tender.id,
        companyId: company.id,
        stage: pursuitStages[i],
        bidDecision: pursuitDecisions[i],
        decisionReason: pursuitDecisions[i] === 'bid' ? 'Eligibility score 8/8 mandatory requirements met; opportunity fit high.' : 'Pending eligibility review.',
        decisionBy: pursuitDecisions[i] === 'pending' ? null : 'owner@atlas-demo.com',
        decidedAt: pursuitDecisions[i] === 'pending' ? null : daysAgo(2),
        priority: pursuitPriorities[i],
        estimatedValueUSD: tender.valueUSD ?? null,
        winProbability: pursuitDecisions[i] === 'bid' ? 0.55 : null,
      },
    })

    // Bid for pursuits in 'bidding' stage
    if (pursuitStages[i] === 'bidding') {
      await prisma.bid.create({
        data: {
          pursuitId: pursuit.id,
          status: 'draft',
          submissionReady: false,
        },
      })
    }

    // Compliance items: link tender requirements to evidence
    const requirements = await prisma.requirement.findMany({ where: { tenderId: tender.id } })
    for (const req of requirements) {
      let status: 'compliant' | 'partial' | 'gap' | 'not_applicable' = 'gap'
      let evidenceId: string | null = null
      let evidenceText: string | null = null

      // Heuristic mapping
      if (req.criterion.includes('ISO 27001')) {
        const ev = evidence[4]
        evidenceId = ev.id
        evidenceText = ev.title
        status = 'compliant'
      } else if (req.criterion.includes('ISO 9001')) {
        const ev = evidence[5]
        evidenceId = ev.id
        evidenceText = ev.title
        status = 'compliant'
      } else if (req.criterion.includes('CMMI')) {
        const ev = evidence[6]
        evidenceId = ev.id
        evidenceText = ev.title
        status = 'compliant'
      } else if (req.criterion.includes('turnover') && tender.market === 'BD') {
        const ev = evidence[2] // Financial statements
        // For large BDT thresholds, partial if our 4.2M USD > 50M BDT (~455K USD) ✓
        evidenceId = ev.id
        evidenceText = ev.title
        status = 'compliant'
      } else if (req.criterion.includes('OEM Authorization') || req.criterion.includes('OEM')) {
        const ev = evidence[7] // Microsoft AOSP
        evidenceId = ev.id
        evidenceText = ev.title
        status = 'partial' // We have Microsoft but may need vendor-specific
      } else if (req.criterion.includes('similar project') || req.criterion.includes('project reference')) {
        const ev = evidence[9] // National ID project
        evidenceId = ev.id
        evidenceText = ev.title
        status = 'compliant'
      } else if (req.criterion.includes('years') && req.threshold?.includes('5 years')) {
        const ev = evidence[1] // Incorporation cert
        evidenceId = ev.id
        evidenceText = ev.title
        status = 'compliant' // Founded 2014 -> 11+ years
      } else if (req.criterion.includes('years') && req.threshold?.includes('10 years')) {
        const ev = evidence[1]
        evidenceId = ev.id
        evidenceText = ev.title
        status = 'compliant'
      } else if (req.criterion.includes('VAT registration')) {
        status = 'compliant'
        evidenceText = 'VAT registration on file (evidence pending upload)'
      } else if (req.criterion.includes('Bid validity') || req.criterion.includes('Tender Security')) {
        status = 'not_applicable' // operational, not evidence-backed
      } else if (req.criterion.includes('Local') || req.criterion.includes('local') || req.criterion.includes('EU establishment') || req.criterion.includes('Singapore')) {
        // For non-BD markets, we're a gap
        status = tender.market === 'BD' ? 'compliant' : 'gap'
      } else if (req.criterion.includes('Master degree') || req.criterion.includes('Advanced degree')) {
        status = 'compliant'
      } else {
        status = 'gap'
      }

      await prisma.complianceItem.create({
        data: {
          pursuitId: pursuit.id,
          requirementId: req.id,
          evidenceId,
          status,
          evidenceText,
          confidence: status === 'compliant' ? 0.95 : status === 'partial' ? 0.6 : 0,
          owner: 'owner@atlas-demo.com',
        },
      })
    }

    // Tasks for bidding pursuits
    if (pursuitStages[i] === 'bidding') {
      const bid = await prisma.bid.findUnique({ where: { pursuitId: pursuit.id } })
      if (bid) {
        await prisma.task.createMany({
          data: [
            { pursuitId: pursuit.id, bidId: bid.id, title: 'Draft Technical Proposal', assignee: 'Anika Rahman', status: 'in_progress', priority: 'high', dueAt: daysFromNow(7) },
            { pursuitId: pursuit.id, bidId: bid.id, title: 'Prepare Financial Proposal', assignee: 'Sadia Karim', status: 'todo', priority: 'high', dueAt: daysFromNow(10) },
            { pursuitId: pursuit.id, bidId: bid.id, title: 'OEM Authorization Letter — Cisco', assignee: 'Sadia Karim', status: 'todo', priority: 'high', dueAt: daysFromNow(5) },
            { pursuitId: pursuit.id, bidId: bid.id, title: 'Bank Guarantee — Tender Security', assignee: 'Tanvir Hasan', status: 'todo', priority: 'medium', dueAt: daysFromNow(12) },
            { pursuitId: pursuit.id, bidId: bid.id, title: 'Internal Review & Approval', assignee: 'Demo Owner', status: 'todo', priority: 'high', dueAt: daysFromNow(14) },
          ],
        })

        // Approval request
        await prisma.approval.create({
          data: {
            pursuitId: pursuit.id,
            requestedBy: 'owner@atlas-demo.com',
            decision: 'pending',
            reason: 'Bid submission authorization required before deadline.',
          },
        })
      }
    }
  }

  // ---------- Alerts ----------
  const firstActive = activeTenders[0]
  const secondActive = activeTenders[1]
  const thirdActive = activeTenders[2]

  await prisma.alert.createMany({
    data: [
      { tenantId: tenant.id, tenderId: firstActive?.id ?? null, type: 'deadline', severity: 'high', title: 'Submission deadline in 21 days', message: `${firstActive?.title ?? ''} — closing ${firstActive?.submissionDeadline?.toDateString() ?? ''}`, dueAt: firstActive?.submissionDeadline ?? null },
      { tenantId: tenant.id, tenderId: firstActive?.id ?? null, type: 'amendment', severity: 'medium', title: 'Amendment #1 published', message: 'Submission deadline extended by 7 days.' },
      { tenantId: tenant.id, tenderId: secondActive?.id ?? null, type: 'deadline', severity: 'medium', title: 'Question deadline in 2 days', message: `${secondActive?.title ?? ''} — question deadline approaching`, dueAt: secondActive?.questionDeadline ?? null },
      { tenantId: tenant.id, type: 'evidence_expiry', severity: 'medium', title: 'ISO 27001 expires in 65 days', message: 'Plan recertification audit before expiry to maintain compliance across 3 active pursuits.', dueAt: daysFromNow(65) },
      { tenantId: tenant.id, tenderId: thirdActive?.id ?? null, type: 'eligibility_gap', severity: 'high', title: 'Eligibility gap detected', message: `${thirdActive?.title ?? ''} — OEM authorization not yet on file for the principal vendor.` },
      { tenantId: tenant.id, type: 'new_opportunity', severity: 'low', title: '3 new opportunities matched your profile', message: 'New tenders in BD Cyber, WB Consulting, and SG IT markets.' },
    ],
  })

  // ---------- Phase 2: FileUploads + LlmExtractions + ConnectorRuns ----------
  // Sample FileUpload linked to one evidence
  const isoEvidence = evidence[4] // ISO 27001 evidence
  if (isoEvidence) {
    await prisma.fileUpload.create({
      data: {
        tenantId: tenant.id,
        uploadedById: ownerUser.id,
        fileName: 'ISO27001_Certificate.pdf',
        fileType: 'application/pdf',
        fileSizeKb: 248,
        checksum: crypto.createHash('sha256').update('iso27001-demo').digest('hex'),
        storageKey: `${tenant.id}/evidence/${isoEvidence.id}/ISO27001_Certificate.pdf`,
        storageUrl: null,
        category: 'evidence',
        evidenceId: isoEvidence.id,
        virusScanResult: 'clean',
        textExtracted: 'BSI Group hereby certifies that Atlas Demo Co. operates an Information Security Management System complying with ISO/IEC 27001:2022. Certificate number IS-7283901. Issue date 2024-12-03. Expiry date 2026-12-02.',
        textExtractedAt: daysAgo(60),
      },
    })
  }

  // Sample LLM extraction record for the first tender (pending review)
  const firstTender = activeTenders[0]
  if (firstTender) {
    await prisma.llmExtraction.create({
      data: {
        tenantId: tenant.id,
        tenderId: firstTender.id,
        requestedById: ownerUser.id,
        taskType: 'requirement_extraction',
        status: 'completed',
        reviewStatus: 'pending',
        model: 'glm-4.6',
        inputTokens: 1240,
        outputTokens: 580,
        latencyMs: 2300,
        costUsd: 0.0085,
        promptHash: crypto.createHash('sha256').update('req-extraction-v1').digest('hex').slice(0, 16),
        outputJson: JSON.stringify({
          items: [
            { category: 'experience', criterion: 'Minimum annual turnover', threshold: '50000000 BDT', confidence: 0.95 },
            { category: 'certification', criterion: 'ISO 27001', threshold: 'Valid', confidence: 0.98 },
            { category: 'experience', criterion: 'Years in business', threshold: '>= 5 years', confidence: 0.92 },
          ],
        }),
        extractedItemsJson: JSON.stringify([
          { category: 'experience', criterion: 'Minimum annual turnover', threshold: '50000000 BDT', confidence: 0.95 },
          { category: 'certification', criterion: 'ISO 27001', threshold: 'Valid', confidence: 0.98 },
          { category: 'experience', criterion: 'Years in business', threshold: '>= 5 years', confidence: 0.92 },
        ]),
      },
    })
  }

  // Sample connector runs
  await prisma.connectorRun.createMany({
    data: [
      { sourceCode: 'cptu_bd', runType: 'scheduled', status: 'success', startedAt: daysAgo(1), completedAt: daysAgo(1), itemsFetched: 47, itemsCreated: 3, itemsUpdated: 12, itemsSkipped: 32 },
      { sourceCode: 'gebiz_sg', runType: 'scheduled', status: 'success', startedAt: daysAgo(1), completedAt: daysAgo(1), itemsFetched: 23, itemsCreated: 2, itemsUpdated: 5, itemsSkipped: 16 },
      { sourceCode: 'worldbank', runType: 'scheduled', status: 'partial', startedAt: daysAgo(1), completedAt: daysAgo(1), itemsFetched: 89, itemsCreated: 1, itemsUpdated: 8, itemsSkipped: 80, errorMessage: '5 items skipped due to malformed XML' },
      { sourceCode: 'ungm', runType: 'manual', status: 'success', startedAt: daysAgo(2), completedAt: daysAgo(2), itemsFetched: 14, itemsCreated: 1, itemsUpdated: 3, itemsSkipped: 10 },
    ],
  })

  console.log('✅ Seed complete.')
  console.log(`   Tenant: ${tenant.id}`)
  console.log(`   Company: ${company.id}`)
  console.log(`   Tenders: ${createdTenders.length}`)
  console.log(`   Pursuits: ${activeTenders.length}`)
  console.log(`   Users: 3 (owner/manager/contributor) — password: demo1234`)
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
