import { withApiErrors } from '@/lib/api-errors'
import { parseIds } from '@/lib/api-validation'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import {
  computeEligibilityScore,
  computeOpportunityFitScore,
  computeSubmissionReadinessScore,
} from '@/lib/scoring'

// GET /api/scoring/[tenderId] — deterministic scores for a tender + tenant's company
export const GET = withApiErrors(async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const { tenderId } = parseIds(await params)
  const ctx = await getCurrentTenant()
  if (!ctx.tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const company = await db.company.findFirst({ where: { tenantId: ctx.tenantId } })
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const tender = await db.tender.findUnique({
    where: { id: tenderId },
    select: { id: true, title: true },
  })
  if (!tender) return NextResponse.json({ error: 'Tender not found' }, { status: 404 })

  // Find pursuit if exists
  const pursuit = await db.pursuit.findFirst({
    where: { tenderId, companyId: company.id },
  })

  const [eligibility, opportunityFit] = await Promise.all([
    computeEligibilityScore(tenderId, company.id),
    computeOpportunityFitScore(tenderId, company.id),
  ])

  let submissionReadiness: Awaited<ReturnType<typeof computeSubmissionReadinessScore>> | null = null
  if (pursuit) {
    submissionReadiness = await computeSubmissionReadinessScore(pursuit.id)
  }

  return NextResponse.json({
    tenderId: tender.id,
    tenderTitle: tender.title,
    eligibility,
    opportunityFit,
    submissionReadiness,
    pursuitId: pursuit?.id ?? null,
    generatedAt: new Date().toISOString(),
    engine: 'deterministic-v1',
    note: 'All scores are deterministic and explainable. LLM features are scaffolded in Phase 1 and not invoked for scoring.',
  })
})
