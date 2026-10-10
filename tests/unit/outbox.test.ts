import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), deliveryFirst: vi.fn(), deliveryUpdate: vi.fn(), endpointUpdate: vi.fn(), send: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { outboxJob: { findFirst: mocks.findFirst, updateMany: mocks.updateMany, findUnique: mocks.findUnique, create: mocks.create }, webhookDelivery: { findFirst: mocks.deliveryFirst, update: mocks.deliveryUpdate }, webhookEndpoint: { update: mocks.endpointUpdate } } }))
vi.mock('@/lib/webhook-delivery', () => ({ sendPublicWebhook: mocks.send }))
import { claimJob, runNextJob, retryDelay, parseRetryAfter, JobFailure, builtinHandlers } from '@/lib/outbox'
const job = { id: 'job1', tenantId: 'tenant1', kind: 'test', payloadJson: '{}', status: 'pending', attempts: 0, maxAttempts: 2, availableAt: new Date(0), createdAt: new Date(), lockedAt: null, lockedBy: null, error: null, completedAt: null, updatedAt: new Date() }
describe('durable worker', () => {
  beforeEach(() => vi.resetAllMocks())
  it('loses a competing lease without dispatching the row', async () => {
    mocks.findFirst.mockResolvedValueOnce(job).mockResolvedValue(null)
    mocks.updateMany.mockResolvedValue({ count: 0 })
    expect(await claimJob('worker')).toBeNull()
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })
  it('claims stale work atomically and increments attempts before executing', async () => {
    mocks.findFirst.mockResolvedValue(job)
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.findUnique.mockResolvedValue({ ...job, attempts: 1, status: 'running', lockedBy: 'worker' })
    const handler = vi.fn().mockResolvedValue(undefined)
    expect(await runNextJob({ test: handler }, 'worker')).toBe(true)
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1 }))
    expect(mocks.updateMany.mock.calls[0][0]).toMatchObject({ where: { attempts: 0 }, data: { attempts: { increment: 1 } } })
    expect(mocks.updateMany.mock.calls[1][0]).toMatchObject({ where: { lockedBy: 'worker', attempts: 1 }, data: { status: 'completed' } })
  })
  it('schedules transient failures and terminates at the attempt limit', async () => {
    mocks.findFirst.mockResolvedValue(job)
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.findUnique.mockResolvedValueOnce({ ...job, attempts: 1 }).mockResolvedValueOnce({ ...job, attempts: 2 })
    const handler = vi.fn().mockRejectedValue(new JobFailure('provider down', false, 60_000))
    await runNextJob({ test: handler }, 'worker')
    expect(mocks.updateMany.mock.calls[1][0].data).toMatchObject({ status: 'retrying', error: 'provider down', lockedAt: null, lockedBy: null })
    expect(mocks.updateMany.mock.calls[1][0].data.availableAt.getTime()).toBeGreaterThan(Date.now() + 59_000)
    await runNextJob({ test: handler }, 'worker')
    expect(mocks.updateMany.mock.calls[3][0].data.status).toBe('failed')
  })
  it('permanent failures stop immediately', async () => {
    mocks.findFirst.mockResolvedValue(job); mocks.updateMany.mockResolvedValue({ count: 1 }); mocks.findUnique.mockResolvedValue({ ...job, attempts: 1 })
    await runNextJob({ test: vi.fn().mockRejectedValue(new JobFailure('invalid destination', true)) }, 'worker')
    expect(mocks.updateMany.mock.calls[1][0].data.status).toBe('failed')
  })
  it('keeps webhook event identity and signature stable across HTTP retries', async () => {
    mocks.deliveryFirst.mockResolvedValue({ id: 'd1', eventId: 'event1', tenantId: 'tenant1', status: 'retrying', endpointId: 'e1', eventType: 'proposal.submitted', signature: 'signed', payloadJson: '{"id":"event1"}', endpoint: { isActive: true, url: 'https://hooks.example.com' } })
    mocks.send.mockResolvedValueOnce({ status: 429, ok: false, body: 'busy', retryAfter: '60' }).mockResolvedValueOnce({ status: 200, ok: true, body: 'ok' })
    const deliveryJob = { ...job, kind: 'webhook.deliver', payloadJson: '{"deliveryId":"d1"}', attempts: 1 }
    await expect(builtinHandlers['webhook.deliver'](deliveryJob)).rejects.toMatchObject({ retryAfterMs: 60_000, permanent: false })
    await builtinHandlers['webhook.deliver']({ ...deliveryJob, attempts: 2 })
    expect(mocks.send.mock.calls[0]).toEqual(mocks.send.mock.calls[1])
    expect(mocks.send.mock.calls[0][1].headers['X-ProcureAtlas-Event-Id']).toBe('event1')
    expect(mocks.deliveryUpdate.mock.calls.at(-1)?.[0].data.status).toBe('delivered')
  })
  it('uses bounded exponential jitter and honors Retry-After dates', () => {
    expect(retryDelay(1, undefined, () => 0)).toBe(1000)
    expect(retryDelay(3, undefined, () => 1)).toBe(5000)
    expect(retryDelay(100, 99_999_999, () => 0)).toBe(86_400_000)
    expect(parseRetryAfter('60')).toBe(60_000)
    expect(parseRetryAfter(new Date(61_000).toUTCString(), 1000)).toBe(60_000)
    expect(parseRetryAfter('invalid')).toBeUndefined()
  })
})
