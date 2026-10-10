import { db } from './db'

export async function requireEmbeddingEntity(entityType: unknown, entityId: unknown, tenantId: string): Promise<void> {
  if (typeof entityId !== 'string' || !entityId || typeof entityType !== 'string') throw new Response('Invalid embedding entity', { status: 400 })
  let found: { id: string } | null
  switch (entityType) {
    case 'company': found = await db.company.findFirst({ where: { id: entityId, tenantId }, select: { id: true } }); break
    case 'evidence': found = await db.evidence.findFirst({ where: { id: entityId, company: { tenantId } }, select: { id: true } }); break
    // Canonical procurement records are shared, but each tenant owns its embedding cache.
    case 'tender': found = await db.tender.findUnique({ where: { id: entityId }, select: { id: true } }); break
    case 'requirement': found = await db.requirement.findUnique({ where: { id: entityId }, select: { id: true } }); break
    default: throw new Response('Unsupported embedding entity type', { status: 400 })
  }
  if (!found) throw new Response('Entity not found', { status: 404 })
}
