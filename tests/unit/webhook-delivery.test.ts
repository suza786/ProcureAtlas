import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }))
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }))
vi.mock('node:http', () => ({ request: mocks.request }))
vi.mock('node:https', () => ({ request: mocks.request }))
import { sendPublicWebhook } from '@/lib/webhook-delivery'

describe('outbound webhook transport', () => {
  beforeEach(() => vi.resetAllMocks())
  it('rejects a mixed public/private DNS answer before sending', async () => {
    mocks.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '192.168.1.1', family: 4 }])
    await expect(sendPublicWebhook('https://hooks.example.com', { headers: {}, body: '{}' })).rejects.toThrow('Non-public')
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('pins the checked address and returns redirects without following them', async () => {
    mocks.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }])
    mocks.request.mockImplementation((_url, options, callback) => {
      expect(options.agent).toBe(false)
      options.lookup('hooks.example.com', {}, (error: unknown, address: string, family: number) => {
        expect(error).toBeNull(); expect(address).toBe('8.8.8.8'); expect(family).toBe(4)
      })
      const req = new EventEmitter() as EventEmitter & { end: () => void }
      req.end = () => {
        const res = new EventEmitter() as EventEmitter & { statusCode: number; headers: object }
        res.statusCode = 302; res.headers = { location: 'http://169.254.169.254/' }
        callback(res); res.emit('data', Buffer.from('redirect')); res.emit('end')
      }
      return req
    })
    expect(await sendPublicWebhook('https://hooks.example.com', { headers: {}, body: '{}' })).toMatchObject({ status: 302, ok: false, body: 'redirect' })
    expect(mocks.lookup).toHaveBeenCalledTimes(1)
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })
})
