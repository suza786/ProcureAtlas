import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import * as http from 'node:http'
import * as https from 'node:https'
import { assertPublicWebhookUrl, isPublicIp } from './url-guard'

/** Pin a validated DNS answer for the connection, preserve TLS hostname, never follow redirects. */
export async function sendPublicWebhook(rawUrl: string, payload: { headers: Record<string, string>; body: string }) {
  const guard = assertPublicWebhookUrl(rawUrl)
  if (!guard.ok) throw new Error(`Blocked webhook URL: ${guard.reason}`)
  const url = new URL(rawUrl)
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const signal = AbortSignal.timeout(10_000)
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new Error('Webhook DNS timeout')), { once: true })),
    ])
  if (!addresses.length || addresses.some(a => !isPublicIp(a.address))) throw new Error('Non-public webhook DNS destination')
  const selected = addresses[0]
  return new Promise<{ ok: boolean; status: number; body: string; retryAfter?: string }>((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http
    const request = transport.request(url, {
      method: 'POST', headers: payload.headers, agent: false, signal,
      // No second resolver lookup is allowed between validation and connection.
      lookup: (_host, options, callback) => {
        if (typeof options === 'object' && options.all) callback(null, [selected])
        else callback(null, selected.address, selected.family)
      },
    }, response => {
      const chunks: Buffer[] = []
      let retained = 0
      response.on('data', (chunk: Buffer) => {
        if (retained < 2000) {
          const part = Buffer.from(chunk).subarray(0, 2000 - retained)
          chunks.push(part); retained += part.length
        }
      })
      response.on('error', reject)
      response.on('end', () => {
        const status = response.statusCode ?? 502
        resolve({ ok: status >= 200 && status < 300, status, body: Buffer.concat(chunks).toString('utf8'), retryAfter: response.headers?.['retry-after'] })
      })
    })
    request.on('error', reject)
    request.end(payload.body)
  })
}
