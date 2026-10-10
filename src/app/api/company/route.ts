import { withApiErrors } from '@/lib/api-errors'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'

// GET /api/company — Company Brain payload for the current tenant
export const GET = withApiErrors(async function GET() {
  const ctx = await getCurrentTenant()
  if (!ctx.tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const company = await db.company.findFirst({
    where: { tenantId: ctx.tenantId },
    include: {
      evidence: { orderBy: { expiresAt: 'asc' } },
      certifications: { orderBy: { expiresAt: 'asc' } },
      projectRefs: { orderBy: { endDate: 'desc' } },
      employees: true,
    },
  })

  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  // Compute expiry alerts
  const now = new Date()
  const expiryBuckets = { expired: 0, thirtyDays: 0, ninetyDays: 0, safe: 0 }
  for (const c of company.certifications) {
    if (!c.expiresAt) { expiryBuckets.safe++; continue }
    const days = Math.floor((c.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (days < 0) expiryBuckets.expired++
    else if (days <= 30) expiryBuckets.thirtyDays++
    else if (days <= 90) expiryBuckets.ninetyDays++
    else expiryBuckets.safe++
  }

  // Capability map (heuristic derived from evidence categories)
  const evidenceByCategory: Record<string, number> = {}
  for (const e of company.evidence) {
    evidenceByCategory[e.category] = (evidenceByCategory[e.category] ?? 0) + 1
  }

  return NextResponse.json({
    id: company.id,
    name: company.name,
    legalName: company.legalName,
    country: company.country,
    city: company.city,
    registrationNo: company.registrationNo,
    taxId: company.taxId,
    website: company.website,
    foundedYear: company.foundedYear,
    employeeCount: company.employeeCount,
    annualTurnoverUSD: company.annualTurnoverUSD,
    description: company.description,
    evidence: company.evidence,
    certifications: company.certifications.map(c => ({
      id: c.id,
      name: c.name,
      issuer: c.issuer,
      issuedAt: c.issuedAt,
      expiresAt: c.expiresAt,
      certificateNo: c.certificateNo,
      verified: c.verified,
      daysToExpiry: c.expiresAt ? Math.floor((c.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null,
    })),
    projectReferences: company.projectRefs,
    employees: company.employees,
    capabilityMap: evidenceByCategory,
    expiryBuckets,
    stats: {
      evidenceCount: company.evidence.length,
      certificationCount: company.certifications.length,
      projectReferenceCount: company.projectRefs.length,
      employeeCount: company.employees.length,
      verifiedEvidenceCount: company.evidence.filter(e => e.verified).length,
    },
  })
})
