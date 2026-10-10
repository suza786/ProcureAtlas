import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), transaction: vi.fn(), session: vi.fn(), audit: vi.fn(), cookie: vi.fn(), rate: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: mocks.find, update: mocks.update }, $transaction: mocks.transaction, auditLog: { create: mocks.audit }, session: { create: mocks.session } } }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.rate }))
vi.mock('next/headers', () => ({ cookies: async () => ({ set: mocks.cookie }) }))
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn().mockResolvedValue(false) } }))
import { signIn } from '@/lib/auth'

describe('login concurrency and throttling', () => {
  let failures: number
  beforeEach(() => {
    vi.clearAllMocks(); failures = 0
    mocks.find.mockImplementation(async () => ({ id: 'user', active: true, mfaEnabled: false, tenantId: 'tenant', passwordHash: 'hash', failedLoginCount: failures, lockedUntil: null }))
    mocks.update.mockImplementation(async ({ data }) => {
      if (data.failedLoginCount?.increment) failures += data.failedLoginCount.increment
      else if (typeof data.failedLoginCount === 'number') failures = data.failedLoginCount
      return { id: 'user', tenantId: 'tenant', failedLoginCount: failures }
    })
    let queue = Promise.resolve()
    mocks.transaction.mockImplementation(fn => {
      const next = queue.then(() => fn({ user: { findUnique: mocks.find, update: mocks.update }, session: { create: mocks.session } }))
      queue = next.catch(() => undefined); return next
    })
    mocks.rate.mockResolvedValue({ allowed: true })
  })
  it('does not lose concurrent failure increments', async () => {
    await Promise.all([signIn('a@example.com', 'wrong'), signIn('a@example.com', 'wrong')])
    expect(failures).toBe(2)
    expect(mocks.session).not.toHaveBeenCalled()
  })
  it('rejects throttled accounts before password verification and user queries', async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 })
    await expect(signIn('a@example.com', 'wrong')).rejects.toMatchObject({ status: 429 })
    expect(mocks.find).not.toHaveBeenCalled()
  })
})
