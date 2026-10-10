import { withApiErrors } from '@/lib/api-errors'
import { requireApiScope } from '@/lib/api-scopes'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'

// GET /api/v1/company — public API: get tenant's company brain
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  requireApiScope(authResult, 'api:read')
  if (!authResult.valid || !authResult.tenantId) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(authResult.identifier!, 'api:v1:company', authResult.tier)
  if (!rateLimit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, rateLimit)
    return res
  }

  const company = await db.company.findFirst({
    where: { tenantId: authResult.tenantId },
    include: {
      certifications: { select: { name: true, issuer: true, expiresAt: true, verified: true } },
      projectRefs: { select: { title: true, client: true, clientType: true, valueUSD: true, role: true } },
      evidence: { select: { id: true, category: true, title: true, verified: true } },
    },
  })

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const res = NextResponse.json({
    id: company.id,
    name: company.name,
    legalName: company.legalName,
    country: company.country,
    city: company.city,
    foundedYear: company.foundedYear,
    employeeCount: company.employeeCount,
    annualTurnoverUSD: company.annualTurnoverUSD,
    description: company.description,
    certifications: company.certifications,
    projectReferences: company.projectRefs,
    evidenceCount: company.evidence.length,
    evidence: company.evidence,
  })
  setRateLimitHeaders(res, rateLimit)
  return res
})
