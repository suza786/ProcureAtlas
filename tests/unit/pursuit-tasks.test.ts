import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ pursuit: vi.fn(), task: vi.fn(), update: vi.fn(), transaction: vi.fn(), invalidate: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { $transaction: mocks.transaction } }))
vi.mock('@/lib/tenant', () => ({ requireTenantWithRole: async () => ({ ctx: { tenantId: 'tenant', userId: 'contributor' } }) }))
vi.mock('@/lib/auth', () => ({ logAction: vi.fn() }))
vi.mock('@/lib/pursuit-workflow', () => ({ invalidatePursuitReview: mocks.invalidate }))
import { PATCH } from '@/app/api/pursuits/[id]/tasks/[taskId]/route'
const request = () => PATCH(new NextRequest('http://localhost/api/pursuits/p/tasks/task', { method: 'PATCH', body: JSON.stringify({ status: 'done' }) }), { params: Promise.resolve({ id: 'p', taskId: 'task' }) })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.pursuit.mockResolvedValue({ stage: 'bidding' })
  mocks.task.mockResolvedValue({ id: 'task', status: 'todo' })
  mocks.update.mockResolvedValue({ id: 'task', status: 'done' })
  mocks.transaction.mockImplementation(fn => fn({ pursuit: { findFirst: mocks.pursuit }, task: { findFirst: mocks.task, update: mocks.update } }))
})
describe('pursuit tasks', () => {
  it('updates tasks only within an owned pursuit and invalidates old approvals', async () => {
    expect((await request()).status).toBe(200)
    expect(mocks.pursuit).toHaveBeenCalledWith({ where: { id: 'p', tenantId: 'tenant' }, select: { stage: true } })
    expect(mocks.task).toHaveBeenCalledWith({ where: { id: 'task', pursuitId: 'p' } })
    expect(mocks.invalidate).toHaveBeenCalledWith(expect.anything(), 'tenant', 'p')
  })
  it('does not accept tasks from a different pursuit', async () => {
    mocks.task.mockResolvedValue(null)
    expect((await request()).status).toBe(404)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('does not expose foreign pursuit tasks', async () => {
    mocks.pursuit.mockResolvedValue(null)
    expect((await request()).status).toBe(404)
    expect(mocks.task).not.toHaveBeenCalled()
  })
  it('locks task mutation after submission', async () => {
    mocks.pursuit.mockResolvedValue({ stage: 'submitted' })
    expect((await request()).status).toBe(409)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
