import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/competitors/[id] — detailed competitor profile
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const org = await db.organization.findUnique({
    where: { id },
    include: { supplierProfile: true },
  })

  if (!org) {
    return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
  }

  const awards = await db.award.findMany({
    where: { supplierOrgId: id },
    include: {
      tender: {
        select: {
          id: true, title: true, sector: true, market: true, country: true,
          valueUSD: true, publishedAt: true,
          buyer: { include: { organization: { select: { name: true, country: true } } } },
        },
      },
    },
    orderBy: { awardedAt: 'desc' },
  })

  const totalValue = awards.reduce((acc, a) => acc + (a.contractValue ?? 0), 0)

  // Buyer breakdown
  const buyerMap: Record<string, { name: string; country: string | null; awardCount: number; totalValue: number }> = {}
  awards.forEach(a => {
    const bname = a.tender.buyer?.organization?.name ?? 'Unknown'
    if (!buyerMap[bname]) buyerMap[bname] = { name: bname, country: a.tender.buyer?.organization?.country ?? null, awardCount: 0, totalValue: 0 }
    buyerMap[bname].awardCount++
    buyerMap[bname].totalValue += a.contractValue ?? 0
  })
  const topBuyers = Object.values(buyerMap).sort((a, b) => b.totalValue - a.totalValue)

  // Sector breakdown
  const sectorMap: Record<string, { count: number; totalValue: number }> = {}
  awards.forEach(a => {
    const s = a.tender.sector
    if (!sectorMap[s]) sectorMap[s] = { count: 0, totalValue: 0 }
    sectorMap[s].count++
    sectorMap[s].totalValue += a.contractValue ?? 0
  })

  // Market breakdown
  const marketMap: Record<string, { count: number; totalValue: number }> = {}
  awards.forEach(a => {
    const m = a.tender.market
    if (!marketMap[m]) marketMap[m] = { count: 0, totalValue: 0 }
    marketMap[m].count++
    marketMap[m].totalValue += a.contractValue ?? 0
  })

  // Win rate trend (by year)
  const yearMap: Record<string, { count: number; totalValue: number }> = {}
  awards.forEach(a => {
    const y = a.awardedAt.getFullYear().toString()
    if (!yearMap[y]) yearMap[y] = { count: 0, totalValue: 0 }
    yearMap[y].count++
    yearMap[y].totalValue += a.contractValue ?? 0
  })
  const winTrend = Object.entries(yearMap).sort((a, b) => a[0].localeCompare(b[0]))

  return NextResponse.json({
    id: org.id,
    name: org.name,
    country: org.country,
    city: org.city,
    website: org.website,
    sourcePortal: org.sourcePortal,
    isCompetitor: org.supplierProfile?.isCompetitor ?? false,
    isPartner: org.supplierProfile?.isPartner ?? false,
    stats: {
      totalAwards: awards.length,
      totalAwardValueUSD: totalValue,
      averageAwardValueUSD: awards.length > 0 ? totalValue / awards.length : 0,
      firstAwardAt: awards.length > 0 ? awards[awards.length - 1].awardedAt : null,
      lastAwardAt: awards.length > 0 ? awards[0].awardedAt : null,
    },
    topBuyers: topBuyers.slice(0, 10),
    sectorBreakdown: Object.entries(sectorMap).map(([sector, data]) => ({ sector, ...data })),
    marketBreakdown: Object.entries(marketMap).map(([market, data]) => ({ market, ...data })),
    winTrend: winTrend.map(([year, data]) => ({ year, ...data })),
    awardHistory: awards.slice(0, 20).map(a => ({
      id: a.id,
      tender: a.tender,
      contractValue: a.contractValue,
      currency: a.currency,
      awardedAt: a.awardedAt,
      contractNo: a.contractNo,
    })),
  })
}
