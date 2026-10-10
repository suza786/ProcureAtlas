import { describe, it, expect } from 'vitest'
import { groundedDraft, evidenceIdsFromJson } from '../../src/lib/proposal-integrity'
import { isCurrentVerified } from '../../src/lib/evidence-validity'
import { SaveQueue } from '../../src/lib/proposal-save-queue'

describe('proposal evidence and saves', () => {
  it('rejects unverified, future and expired evidence', () => {
    const now = new Date('2026-10-09')
    expect(isCurrentVerified({ verified: false }, now)).toBe(false)
    expect(isCurrentVerified({ verified: true, issuedAt: '2027-01-01' }, now)).toBe(false)
    expect(isCurrentVerified({ verified: true, expiresAt: '2026-10-09' }, now)).toBe(false)
    expect(isCurrentVerified({ verified: true }, now)).toBe(true)
  })
  it('rejects fabricated and undeclared inline citation IDs', () => {
    expect(() => groundedDraft('claim [evidence:fake]', ['fake'], new Set(['real']))).toThrow()
    expect(() => groundedDraft('claim [evidence:fake]', ['real'], new Set(['real']))).toThrow()
    expect(() => groundedDraft('claim without inline source', ['real'], new Set(['real']))).toThrow()
  })
  it('derives counts from unique actual citations and content', () => {
    const draft = groundedDraft('Verified claim [evidence:real]', ['real', 'real'], new Set(['real']))
    expect(draft.evidenceIds).toEqual(['real'])
    expect(draft.wordCount).toBe(3)
    expect(draft.reviewRequired).toBe(true)
  })
  it('does not silently accept corrupt stored references', () => {
    expect(() => evidenceIdsFromJson('{broken')).toThrow()
    expect(() => evidenceIdsFromJson('[123]')).toThrow()
  })
  it('waits for queued saves and keeps failures visible until a successful retry', async () => {
    const queue = new SaveQueue()
    let release!: () => void
    const first = queue.enqueue(() => new Promise<void>(resolve => { release = resolve }))
    let ran = false
    const second = queue.enqueue(async () => { ran = true })
    await Promise.resolve(); expect(ran).toBe(false)
    release(); await first; await second; await queue.flush(); expect(ran).toBe(true)
    await expect(queue.enqueue(async () => { throw new Error('save failed') })).rejects.toThrow('save failed')
    await expect(queue.flush()).rejects.toThrow('save failed')
    await queue.enqueue(async () => {}); await expect(queue.flush()).resolves.toBeUndefined()
  })
})
