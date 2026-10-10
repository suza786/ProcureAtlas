import { withApiErrors } from '@/lib/api-errors'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { computePartnerMatch } from '@/lib/matching'
import { capabilitySummary, currentCapabilityFactsForOrganizations } from '@/lib/capability-facts'

export const GET = withApiErrors(async function GET() {
  const ctx = await getCurrentTenant()
  const company = await db.company.findFirst({ where: { tenantId: ctx.tenantId } })
  if (!company) return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
  const suppliers = await db.organization.findMany({ where: { orgType: 'supplier' }, orderBy: { id: 'asc' }, take: 30 })
  const facts = await currentCapabilityFactsForOrganizations(ctx.tenantId, company.id, [null, ...suppliers.map(supplier => supplier.id)])
  const own = capabilitySummary(facts.filter(fact => fact.organizationId === null))
  const tenantInput = { companyId: company.id, name: company.name, country: company.country, description: company.description, ...own, projectReferences: own.projectSectors.map(sector => ({ title: sector, clientType: null, sector })) }
  const suggestions = suppliers.map(supplier => {
    const supplierFacts = capabilitySummary(facts.filter(fact => fact.organizationId === supplier.id))
    const match = computePartnerMatch(tenantInput, { id: supplier.id, name: supplier.name, country: supplier.country, description: null, ...supplierFacts })
    return { id: supplier.id, name: supplier.name, country: supplier.country, city: supplier.city, website: supplier.website, matchScore: match.total, band: match.band, dimensions: match.dimensions, complementaryCapabilities: match.complementaryCapabilities, geographicOverlap: match.geographicOverlap, derivedSectors: supplierFacts.sectors }
  })
  suggestions.sort((a, b) => b.matchScore - a.matchScore)
  return NextResponse.json({ tenantCompany: { id: company.id, name: company.name, country: company.country, sectors: own.sectors }, suggestions: suggestions.slice(0, 15), total: suggestions.length, candidateLimit: 30, note: 'Capability gaps remain unknown until current evidence-backed facts are recorded.' })
})
