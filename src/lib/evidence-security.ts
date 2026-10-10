import { db } from './db'
import type { Prisma } from '@prisma/client'
import { isCurrentVerified } from './evidence-validity'

/** Proposal citations may refer to any of the four records in its company evidence graph. */
export async function requireProposalEvidence(ids: unknown, tenantId: string, companyId: string, client: Pick<Prisma.TransactionClient, 'company'> = db): Promise<string[]> {
  if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string' || !id)) {
    throw new Response('evidenceIds must contain at most 100 nonempty IDs', { status: 400 })
  }
  const uniqueIds = [...new Set(ids as string[])]
  if (!uniqueIds.length) return []
  const company = await client.company.findFirst({
    where: { id: companyId, tenantId },
    select: {
      evidence: { where: { id: { in: uniqueIds } } },
      certifications: { where: { id: { in: uniqueIds } } },
      projectRefs: { where: { id: { in: uniqueIds } } },
    },
  })
  const allowed = new Set(company ? [...company.evidence, ...company.certifications, ...company.projectRefs].filter(record => isCurrentVerified(record)).map(e => e.id) : [])
  if (uniqueIds.some(id => !allowed.has(id))) throw new Response('Evidence not found', { status: 404 })
  return uniqueIds
}
