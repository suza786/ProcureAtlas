import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/buyers — list buyer organizations with aggregated stats
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  const where: Record<string, unknown> = { orgType: 'buyer' }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { city: { contains: search } },
      { country: { contains: search } },
    ]
  }

  const buyers = await db.organization.findMany({
    where,
    include: {
      buyers: {
        include: {
          _count: { select: { tenders: true } },
        },
      },
      buyerProfile: true,
    },
    take: limit,
    orderBy: { name: 'asc' },
  })

  // Aggregate award stats per buyer
  const buyerStats = await Promise.all(
    buyers.map(async (b) => {
      const buyerRecord = b.buyers[0]
      if (!buyerRecord) return null
      const tenders = await db.tender.findMany({
        where: { buyerId: buyerRecord.id },
        select: { id: true, valueUSD: true, sector: true, status: true },
      })
      const awards = await db.award.findMany({
        where: { tender: { buyerId: buyerRecord.id } },
        include: { supplier: { select: { name: true, country: true } } },
      })
      const totalAwardValue = awards.reduce((acc, a) => acc + (a.contractValue ?? 0), 0)
      const distinctSuppliers = new Set(awards.map(a => a.supplierOrgId)).size
      const sectorCounts: Record<string, number> = {}
      tenders.forEach(t => { sectorCounts[t.sector] = (sectorCounts[t.sector] ?? 0) + 1 })
      const topSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

      return {
        id: b.id,
        name: b.name,
        country: b.country,
        city: b.city,
        website: b.website,
        totalTenders: tenders.length,
        totalAwards: awards.length,
        totalAwardValueUSD: totalAwardValue,
        incumbentCount: distinctSuppliers,
        topSectors,
        recentAwards: awards.slice(0, 3).map(a => ({
          supplier: a.supplier.name,
          supplierCountry: a.supplier.country,
          contractValue: a.contractValue,
          awardedAt: a.awardedAt,
        })),
      }
    })
  )

  return NextResponse.json({
    items: buyerStats.filter(Boolean),
  })
}
