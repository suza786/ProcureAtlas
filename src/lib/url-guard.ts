import { isIP } from 'node:net'
const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa']
function publicIPv4(ip: string): boolean {
  const p = ip.split('.').map(Number)
  const value = ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0
  const blocked: Array<[number, number]> = [
    [0x00000000, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8],
    [0xa9fe0000, 16], [0xac100000, 12], [0xc0000000, 24], [0xc0000200, 24],
    [0xc0a80000, 16], [0xc6120000, 15], [0xc6336400, 24], [0xcb007100, 24], [0xe0000000, 3],
  ]
  return !blocked.some(([network, bits]) => ((value & (0xffffffff << (32 - bits))) >>> 0) === network)
}
/** Also classify every resolved DNS answer before outbound delivery. */
export function isPublicIp(raw: string): boolean {
  const ip = raw.replace(/^\[|\]$/g, '').toLowerCase()
  const family = isIP(ip)
  if (family === 4) return publicIPv4(ip)
  if (family !== 6 || ip.includes('%')) return false
  const normalized = new URL('http://[' + ip + ']/').hostname.slice(1, -1)
  const halves = normalized.split('::')
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const words = (halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left).map(w => parseInt(w, 16))
  if (words.slice(0, 5).every(w => w === 0) && words[5] === 0xffff) {
    return publicIPv4([words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255].join('.'))
  }
  // Global unicast only, excluding documentation and transition mechanisms.
  return (words[0] & 0xe000) === 0x2000 &&
    !(words[0] === 0x2001 && (words[1] === 0x0db8 || words[1] < 0x0200)) && words[0] !== 0x2002
}
export interface UrlGuardResult { ok: boolean; reason?: string }
export function assertPublicWebhookUrl(rawUrl: string): UrlGuardResult {
  let parsed: URL
  try { parsed = new URL(rawUrl) } catch { return { ok: false, reason: 'Invalid URL' } }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { ok: false, reason: 'Only HTTP(S) URLs are allowed' }
  if (parsed.username || parsed.password) return { ok: false, reason: 'URL credentials are not allowed' }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  if (hostname === 'localhost' || hostname === 'internal' || hostname.startsWith('internal.') ||
      BLOCKED_HOST_SUFFIXES.some(s => hostname.endsWith(s))) return { ok: false, reason: 'Internal hostname is not allowed' }
  if (isIP(hostname) && !isPublicIp(hostname)) return { ok: false, reason: 'Non-public IP is not allowed' }
  return { ok: true }
}
