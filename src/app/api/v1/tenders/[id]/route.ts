import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'

// GET /api/v1/tenders/[id] — public API: get tender by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(authResult.identifier!, 'api:v1:tenders', authResult.tier)
  if (!rateLimit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, rateLimit)
    return res
  }

  const { id } = await params

  const tender = await db.tender.findUnique({
    where: { id },
    include: {
      buyer: { include: { organization: true } },
      lots: true,
      requirements: { select: { id: true, category: true, criterion: true, threshold: true, isMandatory: true, sourceDoc: true, sourcePage: true, sourceClause: true, extractedText: true, confidence: true } },
      amendments: { orderBy: { amendmentNo: 'asc' } },
      awards: { include: { supplier: { select: { name: true, country: true } } } },
    },
  })

  if (!tender) {
    return NextResponse.json({ error: 'Tender not found' }, { status: 404 })
  }

  const res = NextResponse.json(tender)
  setRateLimitHeaders(res, rateLimit)
  return res
}
