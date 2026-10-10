import { describe, it, expect } from 'vitest'
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { manageTenantUser } from '@/lib/user-management'
import { deployDatabase } from '../../scripts/database-deploy.mjs'

describe('full demo seed', () => {
  it('can run twice while preserving another tenant and its newer tables', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'procureatlas-seed-'))
    const file = path.join(directory, 'demo.db')
    const url = 'file:' + file.replaceAll('\\', '/')
    const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: url, SEED_DEMO_DATABASE_URL: url, NODE_ENV: 'test' }
    const db = new PrismaClient({ datasources: { db: { url } } })
    try {
      await deployDatabase(file)
      const tenant = await db.tenant.create({ data: { id: 'other-tenant', name: 'Other tenant', slug: 'other-tenant' } })
      const firstOwner = await db.user.create({ data: { tenantId: tenant.id, email: 'other@example.com', role: 'owner' } })
      await db.embedding.create({ data: { tenantId: tenant.id, entityType: 'custom', entityId: 'other-id', embeddingJson: '[]', textHash: 'preserve' } })
      await db.marketConfig.create({ data: { code: 'XX', name: 'Other fixture', region: 'other', primaryLanguage: 'en', currency: 'USD' } })
      const run = () => execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/seed.ts'], { env, stdio: 'pipe', timeout: 60000 })
      run()
      const counts = async () => {
        const tables = await db.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        return Promise.all(tables.map(async ({ name }) => ({ name, count: String((await db.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*) AS count FROM "' + name.replaceAll('"', '""') + '"'))[0].count) })))
      }
      const before = await counts()
      run()
      expect(await counts()).toEqual(before)
      expect(await db.user.count({ where: { tenantId: tenant.id } })).toBe(1)
      expect(await db.embedding.count({ where: { tenantId: tenant.id } })).toBe(1)
      expect(await db.marketConfig.findUnique({ where: { code: 'XX' } })).not.toBeNull()
      expect(await db.tenant.count({ where: { slug: 'atlas-demo' } })).toBe(1)
      const secondOwner = await db.user.create({ data: { tenantId: tenant.id, email: 'second@example.com', role: 'owner' } })
      const outcomes = await Promise.allSettled([firstOwner, secondOwner].map(owner => manageTenantUser(
        { tenantId: tenant.id, userId: owner.id, role: 'owner' }, owner.id, { role: 'manager' }, db)))
      expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1)
      expect(await db.user.count({ where: { tenantId: tenant.id, role: 'owner' } })).toBe(1)
    } finally {
      await db.$disconnect()
      if (!directory.startsWith(path.join(os.tmpdir(), 'procureatlas-seed-'))) throw new Error('Unexpected seed test directory')
      for (const entry of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, entry))
      fs.rmdirSync(directory)
    }
  }, 120000)
})
