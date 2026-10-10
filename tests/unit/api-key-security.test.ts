import { describe, it, expect } from 'vitest'
import bcrypt from 'bcryptjs'
import { digestApiKey, verifyApiKey } from '../../src/lib/api-key-security'
describe('random bearer credential storage', () => {
  const raw = 'pak_' + '9a'.repeat(24)
  it('verifies versioned token digests without exposing the credential', async () => {
    const stored = digestApiKey(raw)
    expect(stored).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(await verifyApiKey(raw, stored)).toBe(true)
    expect(await verifyApiKey(raw + '0', stored)).toBe(false)
    expect(await verifyApiKey(raw, 'sha256:garbage')).toBe(false)
  })
  it('retains asynchronous compatibility with existing bcrypt keys', async () => {
    const stored = await bcrypt.hash(raw, 4)
    expect(await verifyApiKey(raw, stored)).toBe(true)
    expect(await verifyApiKey('wrong', stored)).toBe(false)
  })
})
