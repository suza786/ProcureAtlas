import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/awards — award tracking across markets with winner analysis
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const market = searchParams.get('market')
  const sector = searchParams.get('sector')
  const supplierOrgId = searchParams.get('supplierOrgId')
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  const where: Record<string, unknown> = {}
  if (market || sector) {
    where.tender = {}
    if (market) where.tender.market = market
    if (sector) where.tender.sector = sector
  }
  if (supplierOrgId) where.supplierOrgId = supplierOrgId

  const awards = await db.award.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true, country: true } },
      tender: {
        select: {
          id: true, title: true, market: true, sector: true, country: true,
          valueUSD: true, buyer: { include: { organization: { select: { name: true } } } },
        },
      },
    },
    orderBy: { awardedAt: 'desc' },
    take: limit,
  })

  // Aggregate: market share by supplier
  const supplierStats: Record<string, { name: string; country: string | null; awardCount: number; totalValue: number }> = {}
  for (const a of awards) {
    const sid = a.supplierOrgId
    if (!supplierStats[sid]) {
      supplierStats[sid] = { name: a.supplier.name, country: a.supplier.country, awardCount: 0, totalValue: 0 }
    }
    supplierStats[sid].awardCount++
    supplierStats[sid].totalValue += a.contractValue ?? 0
  }
  const marketShare = Object.entries(supplierStats)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.totalValue - a.totalValue)

  // Aggregate: by market
  const byMarket: Record<string, { count: number; totalValue: number }> = {}
  for (const a of awards) {
    const m = a.tender.market
    if (!byMarket[m]) byMarket[m] = { count: 0, totalValue: 0 }
    byMarket[m].count++
    byMarket[m].totalValue += a.contractValue ?? 0
  }

  // Aggregate: by sector
  const bySector: Record<string, { count: number; totalValue: number }> = {}
  for (const a of awards) {
    const s = a.tender.sector
    if (!bySector[s]) bySector[s] = { count: 0, totalValue: 0 }
    bySector[s].count++
    bySector[s].totalValue += a.contractValue ?? 0
  }

  const totalValue = awards.reduce((acc, a) => acc + (a.contractValue ?? 0), 0)

  return NextResponse.json({
    total: awards.length,
    totalValueUSD: totalValue,
    byMarket: Object.entries(byMarket).map(([market, data]) => ({ market, ...data })),
    bySector: Object.entries(bySector).map(([sector, data]) => ({ sector, ...data })),
    marketShare: marketShare.slice(0, 10),
    items: awards.map(a => ({
      id: a.id,
      supplier: a.supplier,
      tender: a.tender,
      contractValue: a.contractValue,
      currency: a.currency,
      awardedAt: a.awardedAt,
      contractNo: a.contractNo,
      sourceUrl: a.sourceUrl,
    })),
  })
}
