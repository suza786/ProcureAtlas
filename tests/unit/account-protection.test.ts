import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), find: vi.fn(), count: vi.fn(), update: vi.fn(), sessions: vi.fn(), keys: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { $transaction: mocks.transaction } }))
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('new-hash') } }))
import { manageTenantUser } from '@/lib/user-management'
const actor = { tenantId: 'a', userId: 'actor', role: 'owner' }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.find.mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve(where.id === 'actor' ? { id: 'actor', role: actor.role } : { id: 'target', role: 'owner' }))
  mocks.count.mockResolvedValue(1)
  mocks.update.mockResolvedValue({ id: 'target' })
  mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({ user: { findFirst: mocks.find, count: mocks.count, update: mocks.update }, session: { updateMany: mocks.sessions }, apiKey: { updateMany: mocks.keys } }))
})
describe('owner protection', () => {
  it('denies administrators owner password resets', async () => {
    actor.role = 'admin'
    await expect(manageTenantUser(actor, 'target', { resetPassword: 'a-long-password' })).rejects.toMatchObject({ status: 403 })
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('preserves the last owner', async () => {
    actor.role = 'owner'
    await expect(manageTenantUser(actor, 'target', { role: 'manager' })).rejects.toMatchObject({ status: 409 })
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('revokes sessions and keys transactionally on a password reset', async () => {
    actor.role = 'owner'
    await manageTenantUser(actor, 'target', { resetPassword: 'a-long-password' })
    expect(mocks.sessions).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'target', revokedAt: null } }))
    expect(mocks.keys).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'a', userId: 'target', revokedAt: null } }))
  })
})
