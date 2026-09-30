import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/competitors — list supplier organizations flagged as competitors
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')

  const where: Record<string, unknown> = { orgType: 'supplier' }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { country: { contains: search } },
    ]
  }

  const suppliers = await db.organization.findMany({
    where,
    include: {
      supplierProfile: true,
      awards: {
        include: {
          tender: { select: { title: true, sector: true, market: true, valueUSD: true } },
        },
        orderBy: { awardedAt: 'desc' },
        take: 5,
      },
    },
    take: 50,
    orderBy: { name: 'asc' },
  })

  const competitors = await Promise.all(
    suppliers.map(async (s) => {
      const allAwards = await db.award.findMany({
        where: { supplierOrgId: s.id },
        include: { tender: { select: { sector: true, market: true, buyer: { include: { organization: { select: { name: true } } } } } } },
      })
      const totalValue = allAwards.reduce((acc, a) => acc + (a.contractValue ?? 0), 0)
      const avgValue = allAwards.length > 0 ? totalValue / allAwards.length : 0

      // Top buyers
      const buyerMap: Record<string, number> = {}
      allAwards.forEach(a => {
        const bname = a.tender.buyer?.organization?.name ?? 'Unknown'
        buyerMap[bname] = (buyerMap[bname] ?? 0) + 1
      })
      const topBuyers = Object.entries(buyerMap).sort((a, b) => b[1] - a[1]).slice(0, 3)

      // Sectors won
      const sectorMap: Record<string, number> = {}
      allAwards.forEach(a => { sectorMap[a.tender.sector] = (sectorMap[a.tender.sector] ?? 0) + 1 })

      return {
        id: s.id,
        name: s.name,
        country: s.country,
        city: s.city,
        website: s.website,
        isCompetitor: s.supplierProfile?.isCompetitor ?? false,
        isPartner: s.supplierProfile?.isPartner ?? false,
        stats: {
          totalAwards: allAwards.length,
          totalAwardValueUSD: totalValue,
          averageAwardValueUSD: avgValue,
          sectorsWon: Object.entries(sectorMap).sort((a, b) => b[1] - a[1]),
          topBuyers,
        },
        recentAwards: s.awards.slice(0, 3).map(a => ({
          id: a.id,
          tender: a.tender,
          contractValue: a.contractValue,
          awardedAt: a.awardedAt,
        })),
      }
    })
  )

  return NextResponse.json({
    items: competitors.sort((a, b) => b.stats.totalAwardValueUSD - a.stats.totalAwardValueUSD),
  })
}
