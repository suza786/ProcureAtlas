import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { computePartnerMatch } from '@/lib/matching'

// GET /api/partners/suggest — compute partner/JV suggestions for the current tenant
export async function GET() {
  const ctx = await getCurrentTenant()

  const [company, suppliers] = await Promise.all([
    db.company.findFirst({
      where: { tenantId: ctx.tenantId },
      include: { certifications: true, projectRefs: true, evidence: true },
    }),
    db.organization.findMany({
      where: { orgType: 'supplier' },
      take: 30,
    }),
  ])

  if (!company) {
    return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
  }

  // Derive tenant company input for matching
  const tenantSectors = new Set<string>(['IT', 'Cyber', 'Consulting'])
  if (company.projectRefs.some(p => p.title.toLowerCase().includes('cyber') || p.title.toLowerCase().includes('security'))) {
    tenantSectors.add('Cyber')
  }

  const tenantInput = {
    companyId: company.id,
    name: company.name,
    country: company.country,
    annualTurnoverUSD: company.annualTurnoverUSD,
    description: company.description,
    certifications: company.certifications.map(c => c.name),
    projectReferences: company.projectRefs.map(p => ({ title: p.title, clientType: p.clientType, sector: 'IT' })),
    sectors: [...tenantSectors],
  }

  // Score each potential partner
  const suggestions = suppliers
    .filter(s => s.id !== company.id) // exclude self
    .map(supplier => {
      // Derive supplier sectors (heuristic from name + would use evidence in prod)
      const supplierSectors: string[] = []
      const sname = supplier.name.toLowerCase()
      if (sname.includes('cyber') || sname.includes('security')) supplierSectors.push('Cyber')
      if (sname.includes('tech') || sname.includes('net') || sname.includes('system')) supplierSectors.push('IT')
      if (sname.includes('infra') || sname.includes('construction')) supplierSectors.push('Construction')
      if (sname.includes('consult') || sname.includes('advisory')) supplierSectors.push('Consulting')
      if (supplierSectors.length === 0) supplierSectors.push('IT')

      const match = computePartnerMatch(tenantInput, {
        id: supplier.id,
        name: supplier.name,
        country: supplier.country,
        sectors: supplierSectors,
        certifications: [], // would populate from supplier profile in prod
        description: null,
      })

      return {
        id: supplier.id,
        name: supplier.name,
        country: supplier.country,
        city: supplier.city,
        website: supplier.website,
        matchScore: match.total,
        band: match.band,
        dimensions: match.dimensions,
        complementaryCapabilities: match.complementaryCapabilities,
        geographicOverlap: match.geographicOverlap,
        derivedSectors: supplierSectors,
      }
    })
    .sort((a, b) => b.matchScore - a.matchScore)

  return NextResponse.json({
    tenantCompany: { id: company.id, name: company.name, country: company.country, sectors: [...tenantSectors] },
    suggestions: suggestions.slice(0, 15),
    total: suggestions.length,
  })
}
