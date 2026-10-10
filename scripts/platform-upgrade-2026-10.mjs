// Additive upgrade only. Default dry-run; --apply creates a SQLite-consistent backup.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
try { process.loadEnvFile(path.join(root, '.env')) } catch (e) { if (e.code !== 'ENOENT') throw e }
const index = process.argv.indexOf('--database')
const database = index >= 0 ? path.resolve(process.argv[index + 1]) : path.resolve(root, 'prisma', (process.env.DATABASE_URL ?? '').replace(/^file:/, ''))
if (!fs.existsSync(database) || !database.endsWith('.db')) throw new Error('An existing SQLite .db database is required')
const db = new PrismaClient({ datasources: { db: { url: 'file:' + database.replaceAll('\\', '/') } } })
try {
  const statements = []
  const additions = { User: { active: 'BOOLEAN NOT NULL DEFAULT true', mfaLastStep: 'INTEGER' }, Session: { mfaVerifiedAt: 'DATETIME' }, FileUpload: { virusScannedAt: 'DATETIME' }, WebhookDelivery: { eventId: 'TEXT' } }
  for (const [table, columns] of Object.entries(additions)) {
    const existing = await db.$queryRawUnsafe(`PRAGMA table_info("${table}")`)
    if (!existing.length) throw new Error('Missing table ' + table)
    for (const [name, type] of Object.entries(columns)) if (!existing.some(c => c.name === name)) statements.push(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${type}`)
  }
  const diff = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(root, 'prisma/schema.prisma'), '--script'], { encoding: 'utf8', windowsHide: true })
  if (diff.status !== 0) throw new Error('Cannot generate upgrade DDL: ' + diff.stderr)
  const newTables = new Set(['OutboxJob', 'AccountToken', 'TenantSupplierAnnotation', 'CapabilityFact'])
  for (const statement of diff.stdout.split(';')) {
    const clean = statement.replace(/^\s*--[^\n]*\n/gm, '').trim()
    const table = clean.match(/^CREATE TABLE "([^"]+)"/)
    if (table && newTables.has(table[1])) statements.push(clean.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS '))
    if (/^CREATE (UNIQUE )?INDEX /.test(clean)) statements.push(clean.replace(/^(CREATE (?:UNIQUE )?INDEX) /, '$1 IF NOT EXISTS '))
  }
  if (!process.argv.includes('--apply')) console.log('Dry run. No database changes.\n' + statements.join(';\n'))
  else {
    const backup = database + '.platform-' + new Date().toISOString().replaceAll(/[:.]/g, '-') + '.bak'
    await db.$executeRawUnsafe('VACUUM INTO ?', backup)
    await db.$transaction(async tx => { for (const sql of statements) await tx.$executeRawUnsafe(sql) })
    console.log('Platform upgrade applied. Backup: ' + backup)
  }
  if (process.argv.includes('--plans')) {
    for (const sql of ['SELECT id FROM Tender WHERE buyerId = ?','SELECT id FROM ApiKey WHERE keyPrefix = ? AND revokedAt IS NULL','SELECT id FROM AuditLog WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 50','SELECT id FROM OutboxJob WHERE status = ? AND availableAt <= ?']) {
      const values = sql.includes('availableAt') ? ['pending', Date.now()] : ['verification-placeholder']
      console.log(sql, await db.$queryRawUnsafe('EXPLAIN QUERY PLAN ' + sql, ...values))
    }
  }
} finally { await db.$disconnect() }
