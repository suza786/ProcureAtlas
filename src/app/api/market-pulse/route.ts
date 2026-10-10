import { withApiErrors } from '@/lib/api-errors'
import { getCurrentTenant } from '@/lib/tenant'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/market-pulse — aggregated market intelligence for the dashboard
export const GET = withApiErrors(async function GET() {
  const ctx = await getCurrentTenant()
  const tenders = await db.tender.findMany({
    select: {
      id: true,
      market: true,
      sector: true,
      status: true,
      valueUSD: true,
      publishedAt: true,
      submissionDeadline: true,
    },
  })

  // By market
  const byMarket: Record<string, { count: number; totalValueUSD: number }> = {}
  // By sector
  const bySector: Record<string, { count: number; totalValueUSD: number }> = {}
  // By status
  const byStatus: Record<string, number> = {}
  // Deadline timeline (next 60 days)
  const now = new Date()
  const deadlines: { date: string; market: string; title: string; days: number }[] = []

  for (const t of tenders) {
    byMarket[t.market] = byMarket[t.market] ?? { count: 0, totalValueUSD: 0 }
    byMarket[t.market].count++
    byMarket[t.market].totalValueUSD += t.valueUSD ?? 0

    bySector[t.sector] = bySector[t.sector] ?? { count: 0, totalValueUSD: 0 }
    bySector[t.sector].count++
    bySector[t.sector].totalValueUSD += t.valueUSD ?? 0

    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1

    if (t.submissionDeadline && t.status === 'active') {
      const days = Math.floor((t.submissionDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (days >= 0 && days <= 60) {
        deadlines.push({
          date: t.submissionDeadline.toISOString().slice(0, 10),
          market: t.market,
          title: '', // caller will join with tender title
          days,
        })
      }
    }
  }

  return NextResponse.json({
    total: tenders.length,
    byMarket,
    bySector,
    byStatus,
    upcomingDeadlines: deadlines.sort((a, b) => a.days - b.days),
    totalPipelineValueUSD: tenders.reduce((acc, t) => acc + (t.valueUSD ?? 0), 0),
  })
})
