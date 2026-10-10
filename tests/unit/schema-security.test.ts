import { describe, it, expect } from 'vitest'
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

describe('non-destructive security schema upgrade', () => {
  it('preserves rows, isolates embeddings, deduplicates events and can run twice', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'procureatlas-security-'))
    const filename = path.join(directory, 'test.db')
    const db = new PrismaClient({ datasources: { db: { url: 'file:' + filename.replaceAll('\\', '/') } } })
    try {
      for (const ddl of [
        'CREATE TABLE "Tenant" ("id" TEXT PRIMARY KEY)',
        'CREATE TABLE "Tender" ("id" TEXT PRIMARY KEY)',
        'CREATE TABLE "LlmExtraction" ("id" TEXT PRIMARY KEY)',
        'CREATE TABLE "Embedding" ("id" TEXT PRIMARY KEY, "tenantId" TEXT, "entityType" TEXT, "entityId" TEXT)',
        'CREATE UNIQUE INDEX "Embedding_entityType_entityId_key" ON "Embedding"("entityType", "entityId")',
        'CREATE TABLE "InboundWebhook" ("id" TEXT PRIMARY KEY, "source" TEXT, "eventType" TEXT)',
        'INSERT INTO "Embedding" VALUES (\'old\', \'a\', \'tender\', \'tender-1\')',
        'INSERT INTO "InboundWebhook" VALUES (\'old\', \'custom\', \'example\')',
        'INSERT INTO "Tenant" VALUES (\'a\')', 'INSERT INTO "Tender" VALUES (\'tender-1\')',
        'INSERT INTO "LlmExtraction" VALUES (\'extract-1\')',
      ]) await db.$executeRawUnsafe(ddl)
      const args = ['scripts/security-upgrade-2026-10.mjs', '--database', filename, '--apply']
      execFileSync(process.execPath, args, { cwd: process.cwd(), stdio: 'pipe' })
      execFileSync(process.execPath, args, { cwd: process.cwd(), stdio: 'pipe' })
      expect(await db.$queryRawUnsafe('SELECT id FROM "Embedding"')).toEqual([{ id: 'old' }])
      await db.$executeRawUnsafe('INSERT INTO "Embedding" VALUES (\'new\', \'b\', \'tender\', \'tender-1\')')
      await expect(db.$executeRawUnsafe('INSERT INTO "Embedding" VALUES (\'duplicate\', \'a\', \'tender\', \'tender-1\')')).rejects.toThrow()
      await db.$executeRawUnsafe('INSERT INTO "InboundWebhook" VALUES (\'signed\', \'custom\', \'example\', \'event-1\')')
      await expect(db.$executeRawUnsafe('INSERT INTO "InboundWebhook" VALUES (\'replay\', \'custom\', \'example\', \'event-1\')')).rejects.toThrow()
      await db.tenantRequirementReview.create({ data: { tenantId: 'a', tenderId: 'tender-1', extractionId: 'extract-1', itemsJson: '[]' } })
      expect(await db.tenantRequirementReview.count()).toBe(1)
      expect(fs.readdirSync(directory).filter(name => name.endsWith('.bak')).length).toBe(2)
    } finally {
      await db.$disconnect()
      // Only delete files created inside this test's verified temporary directory.
      if (!directory.startsWith(path.join(os.tmpdir(), 'procureatlas-security-'))) throw new Error('Unexpected test directory')
      for (const entry of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, entry))
      fs.rmdirSync(directory)
    }
  }, 30000)
})
