import { describe, it, expect, vi } from 'vitest'
import { requireDemoSeedDatabase, fixtureClient } from '@/lib/seed-safety'
import type { Prisma } from '@prisma/client'
import path from 'node:path'
import os from 'node:os'
describe('demo seed safety', () => {
  it('requires an explicit demo database and refuses production', () => {
    const demo = 'file:' + path.join(os.tmpdir(), 'demo.db').replaceAll('\\', '/')
    const production = 'file:' + path.join(os.tmpdir(), 'production.db').replaceAll('\\', '/')
    expect(() => requireDemoSeedDatabase(undefined, 'development')).toThrow()
    expect(() => requireDemoSeedDatabase(production, 'development')).toThrow()
    expect(() => requireDemoSeedDatabase(demo, 'production')).toThrow()
    expect(requireDemoSeedDatabase(demo, 'development')).toBe(demo)
  })
  it('upserts stable fixture IDs rather than duplicating shared records', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'fixture' })
    const tx = { requirement: { upsert }, user: { create: vi.fn() } } as unknown as Prisma.TransactionClient
    for (let run = 0; run < 2; run++) {
      const client = fixtureClient(tx)
      await client.requirement.create({ data: { tenderId: 't', criterion: 'Clause', category: 'technical' } })
    }
    expect(upsert.mock.calls[0][0].where).toEqual(upsert.mock.calls[1][0].where)
    expect(upsert.mock.calls[0][0].update).toEqual({})
  })
})
