import crypto from 'node:crypto'
export const demoBillingEnabled = () => process.env.DEMO_MODE === 'true' && process.env.DEMO_BILLING_SWITCHING === 'true'
export function verifyStripeSignature(body: string, header: string | null, secret: string | undefined, now = Math.floor(Date.now() / 1000)) {
  if (!secret) throw new Response('Billing webhook is not configured', { status: 503 })
  const parts = (header ?? '').split(',').map(part => part.split('='))
  const timestamp = parts.find(([key]) => key === 't')?.[1]
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300) throw new Response('Invalid billing signature timestamp', { status: 401 })
  const expected = crypto.createHmac('sha256', secret).update(timestamp + '.' + body).digest()
  if (!parts.some(([key,value]) => key === 'v1' && /^[a-f0-9]{64}$/i.test(value ?? '') && crypto.timingSafeEqual(expected, Buffer.from(value, 'hex')))) throw new Response('Invalid billing signature', { status: 401 })
}
