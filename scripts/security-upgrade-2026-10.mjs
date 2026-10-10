// Non-destructive, repeatable SQLite upgrade. Default mode reports changes only.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
try { process.loadEnvFile(path.join(root, '.env')) }
catch (error) { if (error.code !== 'ENOENT') throw error }
const index = process.argv.indexOf('--database')
const configured = process.env.DATABASE_URL
const database = index >= 0 ? path.resolve(process.argv[index + 1]) :
  configured?.startsWith('file:') ? path.resolve(root, 'prisma', configured.slice(5)) : null
if (!database || !fs.existsSync(database)) throw new Error('Existing SQLite database required; use --database <path>')
const db = new PrismaClient({ datasources: { db: { url: 'file:' + database.replaceAll('\\', '/') } } })

try {
  const webhookColumns = await db.$queryRawUnsafe('PRAGMA table_info("InboundWebhook")')
  const embeddingIndexes = await db.$queryRawUnsafe('PRAGMA index_list("Embedding")')
  if (!webhookColumns.length || !embeddingIndexes.length) throw new Error('Database does not contain the expected application schema')
  const tables = await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name='TenantRequirementReview'")
  const statements = []
  if (!webhookColumns.some(column => column.name === 'eventId')) statements.push('ALTER TABLE "InboundWebhook" ADD COLUMN "eventId" TEXT')
  statements.push('CREATE UNIQUE INDEX IF NOT EXISTS "InboundWebhook_source_eventId_key" ON "InboundWebhook"("source", "eventId")')
  statements.push('CREATE UNIQUE INDEX IF NOT EXISTS "Embedding_tenantId_entityType_entityId_key" ON "Embedding"("tenantId", "entityType", "entityId")')
  statements.push('DROP INDEX IF EXISTS "Embedding_entityType_entityId_key"')
  if (!tables.length) statements.push(`CREATE TABLE "TenantRequirementReview" (
    "id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "extractionId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL, "itemsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TenantRequirementReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TenantRequirementReview_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "LlmExtraction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TenantRequirementReview_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`)
  statements.push('CREATE UNIQUE INDEX IF NOT EXISTS "TenantRequirementReview_extractionId_key" ON "TenantRequirementReview"("extractionId")')
  statements.push('CREATE INDEX IF NOT EXISTS "TenantRequirementReview_tenantId_tenderId_idx" ON "TenantRequirementReview"("tenantId", "tenderId")')
  if (!process.argv.includes('--apply')) {
    console.log('Dry run. No database changes. Run with --apply after stopping application writers. Planned statements:')
    statements.forEach(statement => console.log(statement))
  } else {
    const backup = database + '.security-' + new Date().toISOString().replaceAll(/[:.]/g, '-') + '.bak'
    // SQLite creates a consistent snapshot, including committed WAL pages.
    await db.$executeRawUnsafe('VACUUM INTO ?', backup)
    await db.$transaction(async tx => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement)
    })
    console.log('Security schema upgrade applied. Backup: ' + backup)
  }
} finally { await db.$disconnect() }
