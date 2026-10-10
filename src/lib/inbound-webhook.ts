import crypto from 'node:crypto'

export const MAX_WEBHOOK_BYTES = 1024 * 1024

export function verifyInboundWebhook(headers: Headers, body: string, secrets: Record<string, unknown>, now = Math.floor(Date.now() / 1000)) {
  const source = headers.get('x-webhook-source') ?? ''
  const eventType = headers.get('x-webhook-event') ?? ''
  const eventId = headers.get('x-webhook-id') ?? ''
  const timestamp = headers.get('x-webhook-timestamp') ?? ''
  const signature = headers.get('x-webhook-signature') ?? ''
  const secret = Object.hasOwn(secrets, source) ? secrets[source] : undefined
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(source) || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(eventType) ||
      !/^[a-zA-Z0-9_:-]{1,128}$/.test(eventId) || !/^\d{10}$/.test(timestamp) ||
      Math.abs(now - Number(timestamp)) > 300 || typeof secret !== 'string' || !secret ||
      !/^sha256=[a-fA-F0-9]{64}$/.test(signature)) {
    throw new Response('Invalid webhook authentication', { status: 401 })
  }
  const expected = crypto.createHmac('sha256', secret).update(`${source}.${eventType}.${eventId}.${timestamp}.${body}`).digest()
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))) {
    throw new Response('Invalid webhook authentication', { status: 401 })
  }
  return { source, eventType, eventId, signature }
}

export async function readWebhookBody(req: Request, maxBytes = MAX_WEBHOOK_BYTES): Promise<string> {
  const size = req.headers.get('content-length')
  if (size && Number(size) > maxBytes) throw new Response('Payload too large', { status: 413 })
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > maxBytes) {
        await reader.cancel()
        throw new Response('Payload too large', { status: 413 })
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)) }
  catch { throw new Response('Invalid UTF-8 payload', { status: 400 }) }
}
