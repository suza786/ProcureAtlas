import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/buyers/[id] — detailed buyer profile with award history + incumbent mapping
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const org = await db.organization.findUnique({
    where: { id },
    include: {
      buyers: true,
      buyerProfile: true,
    },
  })

  if (!org || !org.buyers[0]) {
    return NextResponse.json({ error: 'Buyer not found' }, { status: 404 })
  }

  const buyerId = org.buyers[0].id

  const [tenders, awards] = await Promise.all([
    db.tender.findMany({
      where: { buyerId },
      include: {
        _count: { select: { requirements: true, amendments: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    }),
    db.award.findMany({
      where: { tender: { buyerId } },
      include: {
        supplier: { select: { id: true, name: true, country: true } },
        tender: { select: { id: true, title: true, sector: true, market: true } },
      },
      orderBy: { awardedAt: 'desc' },
    }),
  ])

  // Aggregate: incumbent mapping
  const incumbentMap: Record<string, { name: string; country: string | null; awardCount: number; totalValue: number; lastAwardAt: Date | null }> = {}
  for (const a of awards) {
    const sid = a.supplierOrgId
    if (!incumbentMap[sid]) {
      incumbentMap[sid] = { name: a.supplier.name, country: a.supplier.country, awardCount: 0, totalValue: 0, lastAwardAt: null }
    }
    incumbentMap[sid].awardCount++
    incumbentMap[sid].totalValue += a.contractValue ?? 0
    if (!incumbentMap[sid].lastAwardAt || a.awardedAt > incumbentMap[sid].lastAwardAt!) {
      incumbentMap[sid].lastAwardAt = a.awardedAt
    }
  }
  const incumbents = Object.entries(incumbentMap)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.totalValue - a.totalValue)

  // Aggregate: sector preferences
  const sectorCounts: Record<string, number> = {}
  tenders.forEach(t => { sectorCounts[t.sector] = (sectorCounts[t.sector] ?? 0) + 1 })

  // Aggregate: spend analytics
  const totalAwardValue = awards.reduce((acc, a) => acc + (a.contractValue ?? 0), 0)
  const avgAwardValue = awards.length > 0 ? totalAwardValue / awards.length : 0
  const totalTenderValue = tenders.reduce((acc, t) => acc + (t.valueUSD ?? 0), 0)
  const avgTenderValue = tenders.length > 0 ? totalTenderValue / tenders.length : 0

  return NextResponse.json({
    id: org.id,
    name: org.name,
    country: org.country,
    city: org.city,
    website: org.website,
    sourcePortal: org.sourcePortal,
    externalId: org.externalId,
    stats: {
      totalTenders: tenders.length,
      totalAwards: awards.length,
      totalAwardValueUSD: totalAwardValue,
      averageAwardValueUSD: avgAwardValue,
      totalTenderValueUSD: totalTenderValue,
      averageTenderValueUSD: avgTenderValue,
      incumbentCount: incumbents.length,
    },
    sectorPreferences: Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]),
    incumbents: incumbents.slice(0, 10),
    recentTenders: tenders.slice(0, 10).map(t => ({
      id: t.id,
      title: t.title,
      sector: t.sector,
      market: t.market,
      valueUSD: t.valueUSD,
      status: t.status,
      publishedAt: t.publishedAt,
      submissionDeadline: t.submissionDeadline,
      requirementCount: t._count.requirements,
      amendmentCount: t._count.amendments,
    })),
    awardHistory: awards.slice(0, 15).map(a => ({
      id: a.id,
      supplier: a.supplier,
      tender: a.tender,
      contractValue: a.contractValue,
      currency: a.currency,
      awardedAt: a.awardedAt,
      contractNo: a.contractNo,
    })),
  })
}
