import { DatabaseSync } from 'node:sqlite'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { requireRuntime, runtimeEnvironment, sqliteLocation, workspaceRoot } from './runtime-helper.mjs'

export const migrations = readdirSync(resolve(workspaceRoot, 'prisma/migrations'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
if (migrations[0] !== '20261009000000_baseline' || migrations.some(name => !/^\d{14}_[a-zA-Z0-9_-]+$/.test(name))) throw new Error('Versioned migrations must start with the reviewed baseline and use timestamped directory names')
const migrationSqlCache = new Map()
const migrationSql = name => {
  if (!migrationSqlCache.has(name)) migrationSqlCache.set(name, readFileSync(resolve(workspaceRoot, 'prisma/migrations', name, 'migration.sql'), 'utf8'))
  return migrationSqlCache.get(name)
}
// Prisma SQLite migration receipt schema (see upstream connector referenced below).
const migrationTableSql = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" TEXT PRIMARY KEY NOT NULL, "checksum" TEXT NOT NULL, "finished_at" DATETIME,
  "migration_name" TEXT NOT NULL, "logs" TEXT, "rolled_back_at" DATETIME,
  "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
  "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
)`
function tables(db) { return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations' ORDER BY name").all().map(row => row.name) }
function schemaShape(db) {
  const result = new Map(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => [row.name, { columns: [], indexes: [], foreignKeys: [] }]))
  for (const row of db.prepare(`SELECT m.name AS owner,p.name,p.type,p."notnull",p.pk FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type='table' AND m.name NOT LIKE 'sqlite_%' ORDER BY m.name,p.name`).all()) {
    result.get(row.owner).columns.push({ name: row.name, type: row.type.toUpperCase(), notnull: row.notnull, pk: row.pk })
  }
  const grouped = new Map()
  for (const row of db.prepare(`SELECT m.name AS owner,l.name,l.partial,i.name AS columnName,i.seqno FROM sqlite_master m JOIN pragma_index_list(m.name) l JOIN pragma_index_info(l.name) i WHERE m.type='table' AND m.name NOT LIKE 'sqlite_%' AND l."unique"=1 ORDER BY m.name,l.name,i.seqno`).all()) {
    const key = JSON.stringify([row.owner, row.name])
    if (!grouped.has(key)) grouped.set(key, { owner: row.owner, columns: [], partial: row.partial })
    grouped.get(key).columns.push(row.columnName)
  }
  for (const index of grouped.values()) result.get(index.owner).indexes.push(JSON.stringify({ columns: index.columns, partial: index.partial }))
  for (const row of db.prepare(`SELECT m.name AS owner,f."table" AS target,f."from",f."to",f.on_update,f.on_delete FROM sqlite_master m JOIN pragma_foreign_key_list(m.name) f WHERE m.type='table' AND m.name NOT LIKE 'sqlite_%'`).all()) {
    const { owner, ...key } = row
    result.get(owner).foreignKeys.push(JSON.stringify(key))
  }
  for (const shape of result.values()) { shape.indexes.sort(); shape.foreignKeys.sort() }
  return result
}

/** Compare the entire known schema before adopting a database with no migration history. */
function inspectConnection(actual) {
  const expected = new DatabaseSync(':memory:')
  try {
    const actualTables = tables(actual)
    const hasHistory = Boolean(actual.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'").get())
    if (actual.prepare("SELECT name FROM sqlite_master WHERE type IN ('view','trigger')").all().length) throw new Error('Unknown database views or triggers require review before deployment')
    if (hasHistory) {
      expected.exec(migrationTableSql)
      if (JSON.stringify(schemaShape(actual).get('_prisma_migrations')) !== JSON.stringify(schemaShape(expected).get('_prisma_migrations'))) throw new Error('Migration receipt table schema differs from the supported Prisma format')
    }
    const history = hasHistory ? actual.prepare('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations').all().filter(row => !row.rolled_back_at) : []
    if (history.some(row => !row.finished_at || !migrations.includes(row.migration_name))) throw new Error('Unknown or unfinished migration history; inspect and repair it before deployment')
    if (history.some(row => row.checksum !== createHash('sha256').update(migrationSql(row.migration_name)).digest('hex'))) throw new Error('Applied migration checksum differs from the versioned migration file')
    const applied = history.map(row => row.migration_name).sort()
    if (new Set(applied).size !== applied.length) throw new Error('Duplicate completed migration receipts require review')
    if (JSON.stringify(applied) !== JSON.stringify(migrations.slice(0, applied.length))) throw new Error('Migration history has gaps or is missing the baseline')
    if (!actualTables.length && !applied.length) return { state: 'empty', pending: [...migrations], adopt: false }
    // No-history adoption supports the complete baseline only, never a partial schema.
    for (const name of applied.length ? applied : [migrations[0]]) expected.exec(migrationSql(name))
    const expectedTables = tables(expected)
    if (JSON.stringify(actualTables) !== JSON.stringify(expectedTables)) throw new Error('Database tables do not match the known baseline/migration state')
    const actualShape = schemaShape(actual), expectedShape = schemaShape(expected)
    for (const table of expectedTables) {
      if (JSON.stringify(actualShape.get(table).columns) !== JSON.stringify(expectedShape.get(table).columns)) throw new Error(`Database columns/types/nullability/primary keys differ: ${table}`)
      if (JSON.stringify(actualShape.get(table).indexes) !== JSON.stringify(expectedShape.get(table).indexes)) throw new Error(`Database unique indexes differ: ${table}`)
      if (JSON.stringify(actualShape.get(table).foreignKeys) !== JSON.stringify(expectedShape.get(table).foreignKeys)) throw new Error(`Database foreign keys differ: ${table}`)
    }
    if (actual.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign-key violations must be repaired before deployment')
    if (actual.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('SQLite integrity check failed')
    return { state: applied.length ? 'versioned' : 'baseline', adopt: !applied.length, pending: migrations.filter(name => !applied.includes(name)) }
  } finally { expected.close() }
}
export function inspectDatabase(database) {
  if (!existsSync(database)) return { state: 'empty', pending: [...migrations], adopt: false }
  const actual = new DatabaseSync(database, { readOnly: true })
  try { return inspectConnection(actual) } finally { actual.close() }
}

/** DDL and completed receipts are one transaction; any SQL/verification failure rolls back all changes. */
export function applyVersionedMigrationTransaction(connection, backupVersion) {
  connection.exec('BEGIN IMMEDIATE')
  try {
    const locked = inspectConnection(connection)
    if (backupVersion !== undefined && connection.prepare('PRAGMA data_version').get().data_version !== backupVersion) {
      connection.exec('ROLLBACK')
      return false
    }
    // https://github.com/prisma/prisma-engines/blob/main/schema-engine/connectors/sql-schema-connector/src/flavour/sqlite.rs
    connection.exec(migrationTableSql)
    for (const name of locked.pending) {
      const sql = migrationSql(name)
      const started = new Date().toISOString()
      const adopted = locked.adopt && name === migrations[0]
      if (!adopted) connection.exec(sql)
      connection.prepare('INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES (?,?,?,?,?,?)').run(randomUUID(), createHash('sha256').update(sql).digest('hex'), new Date().toISOString(), name, started, adopted ? 0 : 1)
    }
    if (inspectConnection(connection).pending.length) throw new Error('Deployment did not apply all known migrations')
    connection.exec('COMMIT')
    return true
  } catch (error) {
    connection.exec('ROLLBACK')
    throw error
  }
}

export async function deployDatabase(database, { check = false } = {}) {
  const inspected = inspectDatabase(database)
  console.log(`Database preflight: ${inspected.state}; pending migrations: ${inspected.pending.join(', ') || 'none'}`)
  if (check || !inspected.pending.length) return { ...inspected, backup: undefined }
  await mkdir(dirname(database), { recursive: true })
  let backup
  const connection = new DatabaseSync(database)
  connection.exec('PRAGMA busy_timeout=10000; PRAGMA foreign_keys=ON')
  try {
    let applied = false
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = inspectConnection(connection)
      if (!before.pending.length) { applied = true; break }
      const version = connection.prepare('PRAGMA data_version').get().data_version
      if (before.state !== 'empty') {
        backup = `${database}.backup-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.sqlite`
        connection.prepare('VACUUM INTO ?').run(backup)
        console.log(`Database backup: ${backup}`)
      }
      // Re-check after the writer lock; changed data requires a fresh backup.
      if (applyVersionedMigrationTransaction(connection, version)) { applied = true; break }
    }
    if (!applied) throw new Error('Database changed repeatedly while preparing a migration backup; retry deployment')
  } finally { connection.close() }
  const result = inspectDatabase(database)
  if (result.pending.length) throw new Error('Deployment did not apply all known migrations')
  return { ...result, backup }
}

export async function main(args = process.argv.slice(2)) {
  requireRuntime()
  runtimeEnvironment()
  let database
  let check = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') check = true
    else if (args[i] === '--database' && args[i + 1]) database = resolve(args[++i])
    else throw new Error(`Unknown or incomplete argument: ${args[i]}`)
  }
  database ??= sqliteLocation(process.env.DATABASE_URL).database
  return deployDatabase(database, { check })
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error('Database deployment refused:', error.message); process.exitCode = 1 })
}
