import { afterEach, describe, it, expect, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ create: vi.fn(), tender: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { connectorRun: { create: mocks.create }, tender: { create: mocks.tender } } }))
vi.mock('@/lib/auth', () => ({ logAction: vi.fn() }))
import { cptuBdConnector, runConnector } from '@/lib/connectors/cptu_bd'
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
describe('mock connector isolation', () => {
  it('uses stable sample IDs across fetches', async () => {
    const first = await cptuBdConnector.fetch()
    await new Promise(resolve => setTimeout(resolve, 5))
    expect((await cptuBdConnector.fetch()).map(row => row.externalId)).toEqual(first.map(row => row.externalId))
  })
  it('previews samples without any catalog or run writes', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const result = await runConnector(cptuBdConnector, { tenantId: 'a' })
    expect(result.mode).toBe('preview'); expect(result.itemsCreated).toBe(0)
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.tender).not.toHaveBeenCalled()
  })
  it('rejects mock execution in production before writing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(runConnector(cptuBdConnector, { tenantId: 'a' })).rejects.toMatchObject({ status: 403 })
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
