import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
// Random 192-bit tokens need a fast cryptographic digest, not a password KDF.
export function digestApiKey(raw: string) { return 'sha256:' + crypto.createHash('sha256').update(raw).digest('hex') }
export async function verifyApiKey(raw: string, hash: string) {
  if (!hash.startsWith('sha256:')) return bcrypt.compare(raw, hash)
  const expected = Buffer.from(hash)
  const actual = Buffer.from(digestApiKey(raw))
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}
