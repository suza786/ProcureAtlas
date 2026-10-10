import { describe, it, expect } from 'vitest'
import { totpCode, verifyTotp, encryptSecret, decryptSecret } from '../../src/lib/account-security'
describe('account security', () => {
  it('matches RFC6238 and rejects invalid codes', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    expect(totpCode(secret, 59000, 8)).toBe('94287082')
    expect(verifyTotp(secret, totpCode(secret, 59000), 59000)).toBe(true)
    expect(verifyTotp(secret, '000000', 59000)).toBe(false)
    expect(verifyTotp(secret, '123', 59000)).toBe(false)
  })
  it('authenticates ciphertext and fails closed without an encryption key', () => {
    const key = Buffer.alloc(32, 4).toString('base64')
    const sealed = encryptSecret('a recovery token', key)
    expect(sealed).not.toContain('a recovery token')
    expect(decryptSecret(sealed, key)).toBe('a recovery token')
    expect(() => decryptSecret(sealed, Buffer.alloc(32, 8).toString('base64'))).toThrow()
    expect(() => encryptSecret('secret', '')).toThrow()
  })
})
