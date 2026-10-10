import crypto from 'node:crypto'

function encryptionKey(key = process.env.APP_ENCRYPTION_KEY ?? '') {
  const decoded = Buffer.from(key, 'base64')
  if (decoded.length !== 32) throw new Response('Account encryption is not configured', { status: 503 })
  return decoded
}
export function encryptSecret(value: string, key?: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(key), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}
export function decryptSecret(value: string, key?: string): string {
  const [version, iv, tag, ciphertext] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Response('Invalid encrypted credential', { status: 401 })
  const cipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(key), Buffer.from(iv, 'base64url'))
  cipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([cipher.update(Buffer.from(ciphertext, 'base64url')), cipher.final()]).toString('utf8')
}
function decodeBase32(input: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of input.toUpperCase().replace(/=+$/, '')) {
    const index = alphabet.indexOf(c)
    if (index < 0) throw new Error('Invalid TOTP secret')
    bits += index.toString(2).padStart(5, '0')
  }
  return Buffer.from(bits.match(/.{8}/g)?.map(b => parseInt(b, 2)) ?? [])
}
export function generateTotpSecret() {
  const bits = [...crypto.randomBytes(20)].map(b => b.toString(2).padStart(8, '0')).join('')
  return (bits.match(/.{5}/g) ?? []).map(b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[parseInt(b, 2)]).join('')
}
export function totpCode(secret: string, now = Date.now(), digits = 6) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30000)))
  const hash = crypto.createHmac('sha1', decodeBase32(secret)).update(counter).digest()
  const offset = hash[hash.length - 1] & 15
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits)).padStart(digits, '0')
}
export function verifyTotp(secret: string, code: string, now = Date.now()) {
  return verifiedTotpStep(secret, code, now) !== null
}
export function verifiedTotpStep(secret: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null
  for (const step of [-1, 0, 1]) {
    if (crypto.timingSafeEqual(Buffer.from(totpCode(secret, now + step * 30000)), Buffer.from(code))) return Math.floor(now / 30000) + step
  }
  return null
}
