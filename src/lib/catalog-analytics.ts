import { Prisma } from '@prisma/client'
import { db } from './db'

const cache = new Map<string, { expires: number; value: unknown }>()
export async function cachedCatalog<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value as T
  const value = await compute()
  if (cache.size >= 256) cache.delete(cache.keys().next().value!)
  cache.set(key, { expires: Date.now() + 30_000, value })
  return value
}

// Public summaries only use persisted normalization or original USD, never tenant FX.
export const awardUSD = Prisma.sql`CASE WHEN a."valueUSD" >= 0 THEN a."valueUSD" WHEN a."currency" = 'USD' AND a."contractValue" >= 0 THEN a."contractValue" ELSE NULL END`
export function numericRows<T>(rows: T[]): T[] {
  return rows.map(row => Object.fromEntries(Object.entries(row as object).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value])) as T)
}
export type AwardSummary = { totalAwards: number; totalValueUSD: number; averageValueUSD: number | null; normalizedCount: number; unnormalizedCount: number; distinctWinnerCount: number; firstAwardAt: number | null; lastAwardAt: number | null }
export async function awardSummary(where: Prisma.Sql = Prisma.sql`1=1`): Promise<AwardSummary> {
  const rows = await db.$queryRaw<AwardSummary[]>(Prisma.sql`SELECT COUNT(*) AS totalAwards, COALESCE(SUM(${awardUSD}),0) AS totalValueUSD,
    AVG(${awardUSD}) AS averageValueUSD, COUNT(${awardUSD}) AS normalizedCount, COUNT(*)-COUNT(${awardUSD}) AS unnormalizedCount,
    COUNT(DISTINCT a."supplierOrgId") AS distinctWinnerCount, MIN(a."awardedAt") AS firstAwardAt, MAX(a."awardedAt") AS lastAwardAt
    FROM "Award" a JOIN "Tender" t ON t.id=a."tenderId" WHERE ${where}`)
  return numericRows(rows)[0]
}
export type AwardGroup = { id: string; name?: string; country?: string | null; count: number; totalValue: number; normalizedCount: number; lastAwardAt?: number | null }
export async function awardGroups(dimension: 'supplier' | 'buyer' | 'market' | 'sector' | 'year', where: Prisma.Sql, limit = 100) {
  const columns = {
    supplier: Prisma.sql`a."supplierOrgId"`, buyer: Prisma.sql`t."buyerId"`, market: Prisma.sql`t.market`, sector: Prisma.sql`t.sector`,
    year: Prisma.sql`strftime('%Y', CASE WHEN typeof(a."awardedAt") IN ('integer','real') THEN a."awardedAt"/1000 ELSE a."awardedAt" END, CASE WHEN typeof(a."awardedAt") IN ('integer','real') THEN 'unixepoch' ELSE '+0 seconds' END)`,
  }
  const column = columns[dimension]
  const join = dimension === 'supplier' ? Prisma.sql`LEFT JOIN "Organization" o ON o.id=a."supplierOrgId"` : dimension === 'buyer' ? Prisma.sql`LEFT JOIN "Buyer" b ON b.id=t."buyerId" LEFT JOIN "Organization" o ON o.id=b."organizationId"` : Prisma.empty
  const orgFields = ['supplier', 'buyer'].includes(dimension) ? Prisma.sql`, o.name AS name, o.country AS country` : Prisma.empty
  const rows = await db.$queryRaw<AwardGroup[]>(Prisma.sql`SELECT ${column} AS id ${orgFields}, COUNT(*) AS count, COALESCE(SUM(${awardUSD}),0) AS totalValue, COUNT(${awardUSD}) AS normalizedCount, MAX(a."awardedAt") AS lastAwardAt
    FROM "Award" a JOIN "Tender" t ON t.id=a."tenderId" ${join} WHERE ${where} GROUP BY ${column} ORDER BY totalValue DESC, id ASC LIMIT ${limit}`)
  return numericRows(rows)
}
export async function organizationAwardStats(ids: string[], mode: 'supplier' | 'buyer') {
  if (!ids.length) return []
  const column = mode === 'supplier' ? Prisma.sql`a."supplierOrgId"` : Prisma.sql`t."buyerId"`
  const rows = await db.$queryRaw<Array<AwardSummary & { id: string }>>(Prisma.sql`SELECT ${column} AS id, COUNT(*) AS totalAwards, COALESCE(SUM(${awardUSD}),0) AS totalValueUSD,
    AVG(${awardUSD}) AS averageValueUSD, COUNT(${awardUSD}) AS normalizedCount, COUNT(*)-COUNT(${awardUSD}) AS unnormalizedCount,
    COUNT(DISTINCT a."supplierOrgId") AS distinctWinnerCount, MIN(a."awardedAt") AS firstAwardAt, MAX(a."awardedAt") AS lastAwardAt
    FROM "Award" a JOIN "Tender" t ON t.id=a."tenderId" WHERE ${column} IN (${Prisma.join(ids)}) GROUP BY ${column}`)
  return numericRows(rows)
}

export function summaryStats(summary?: AwardSummary) {
  return { totalAwards: summary?.totalAwards ?? 0, totalAwardValueUSD: summary?.totalValueUSD ?? 0, normalizedCount: summary?.normalizedCount ?? 0, unnormalizedCount: summary?.unnormalizedCount ?? 0, averageAwardValueUSD: summary?.averageValueUSD ?? null }
}

export async function supplierFacets(ids: string[]) {
  if (!ids.length) return []
  return numericRows(await db.$queryRaw<Array<{ ownerId: string; dimension: string; name: string; count: number }>>(Prisma.sql`
    WITH facets AS (
      SELECT a."supplierOrgId" AS ownerId, 'sector' AS dimension, t.sector AS name, COUNT(*) AS count FROM "Award" a JOIN "Tender" t ON t.id=a."tenderId" WHERE a."supplierOrgId" IN (${Prisma.join(ids)}) GROUP BY a."supplierOrgId", t.sector
      UNION ALL
      SELECT a."supplierOrgId", 'buyer', COALESCE(o.name,'Unknown'), COUNT(*) FROM "Award" a JOIN "Tender" t ON t.id=a."tenderId" LEFT JOIN "Buyer" b ON b.id=t."buyerId" LEFT JOIN "Organization" o ON o.id=b."organizationId" WHERE a."supplierOrgId" IN (${Prisma.join(ids)}) GROUP BY a."supplierOrgId", t."buyerId"
    ), ranked AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY ownerId, dimension ORDER BY count DESC, name ASC) AS rank FROM facets)
    SELECT ownerId, dimension, name, count FROM ranked WHERE rank <= 3 ORDER BY ownerId, dimension, rank`))
}
