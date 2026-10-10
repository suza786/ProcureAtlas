import path from 'node:path'
import type { Prisma } from '@prisma/client'

export function requireDemoSeedDatabase(url: string | undefined, environment: string | undefined): string {
  if (environment === 'production' || !url?.startsWith('file:')) throw new Error('Seeding requires SEED_DEMO_DATABASE_URL and a non-production environment')
  const filename = url.slice(5).replaceAll('\\', '/')
  if (!path.isAbsolute(filename) || !/(?:^|\/)(?:[a-zA-Z0-9_-]+\.)?demo\.db$/.test(filename)) {
    throw new Error('Seed target must be an absolute SQLite path ending in demo.db; application DATABASE_URL is never used')
  }
  return url
}

/** All fixture delegates remain typed as Prisma; only this seed adapter dispatches dynamically. */
export function fixtureClient(tx: Prisma.TransactionClient): Prisma.TransactionClient {
  const shared = new Set(['dataSource', 'organization', 'procurementAuthority', 'buyer', 'tender', 'lot', 'requirement', 'amendment', 'award', 'tenderDocument', 'supplierProfile', 'buyerProfile', 'marketConfig', 'connectorRun'])
  const counters = new Map<string, number>()
  return new Proxy(tx, {
    get(target, property, receiver) {
      const delegate = Reflect.get(target, property, receiver)
      if (typeof property !== 'string' || !shared.has(property)) return delegate
      const model = property
      async function upsertFixture(data: Record<string, unknown>) {
        const ordinal = (counters.get(model) ?? 0) + 1; counters.set(model, ordinal)
        const id = `demo-fixture-${model}-${ordinal}`
        let where: Record<string, unknown> = { id }
        if (model === 'dataSource' || model === 'marketConfig') where = { code: data.code }
        if (model === 'supplierProfile' || model === 'buyerProfile') where = { organizationId: data.organizationId }
        if (model === 'tender' || model === 'organization') where = { sourcePortal_externalId: { sourcePortal: data.sourcePortal, externalId: data.externalId } }
        return delegate.upsert({ where, create: { ...data, id }, update: {} })
      }
      return new Proxy(delegate, {
        get(delegateTarget, method) {
          if (method === 'create') return (args: { data: Record<string, unknown> }) => upsertFixture(args.data)
          if (method === 'createMany') return async (args: { data: Record<string, unknown>[] }) => {
            for (const row of args.data) await upsertFixture(row)
            return { count: args.data.length }
          }
          return Reflect.get(delegateTarget, method)
        },
      })
    },
  })
}

export async function clearDemoTenant(tx: Prisma.TransactionClient) {
  const tenant = await tx.tenant.findUnique({ where: { slug: 'atlas-demo' } })
  if (!tenant) return
  const tenantId = tenant.id
  // Tables without tenant foreign keys must be cleared explicitly, including newer phases.
  await tx.embedding.deleteMany({ where: { tenantId } })
  await tx.rateLimitBucket.deleteMany({ where: { tenantId } })
  await tx.inboundWebhook.deleteMany({ where: { tenantId } })
  await tx.dataExport.deleteMany({ where: { tenantId } })
  await tx.scimConfig.deleteMany({ where: { tenantId } })
  await tx.pwaSettings.deleteMany({ where: { tenantId } })
  await tx.analyticsSnapshot.deleteMany({ where: { tenantId } })
  await tx.apiKey.deleteMany({ where: { tenantId } })
  await tx.approval.deleteMany({ where: { tenantId } })
  await tx.tenantRequirementReview.deleteMany({ where: { tenantId } })
  await tx.llmExtraction.deleteMany({ where: { tenantId } })
  await tx.fileUpload.deleteMany({ where: { tenantId } })
  // Schema cascades remove only this tenant's users, companies, pursuits and their children.
  await tx.tenant.delete({ where: { id: tenantId } })
}
