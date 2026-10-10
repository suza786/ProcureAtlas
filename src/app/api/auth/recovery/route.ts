import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiErrors } from '@/lib/api-errors'
import { readWebhookBody } from '@/lib/inbound-webhook'
import { checkRateLimit } from '@/lib/rate-limit'
import { hashToken } from '@/lib/auth'
import { requestRecovery, redeemAccountToken } from '@/lib/account-lifecycle'
const requestSchema = z.object({ email: z.email().max(254).transform(s => s.toLowerCase().trim()) }).strict()
const redeemSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(12).max(72).refine(s => Buffer.byteLength(s) <= 72) }).strict()
async function throttle(req: Request, identity: string) {
  const ip = process.env.TRUST_PROXY_HEADERS === 'true' ? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown' : 'unknown'
  for (const [id, bucket, burst] of [[identity, 'recovery:account', 3], [ip, 'recovery:ip', 20]] as const) {
    const result = await checkRateLimit(hashToken(id), bucket, 'free', { requestsPerHour: burst * 4, burst })
    if (!result.allowed) throw new Response('Too many account recovery attempts', { status: 429 })
  }
}
export const POST = withApiErrors(async function POST(req: Request) {
  const { email } = requestSchema.parse(JSON.parse((await readWebhookBody(req, 4096))))
  await throttle(req, email)
  await requestRecovery(email)
  return NextResponse.json({ message: 'If this account is active, a recovery email will be sent.' }, { status: 202 })
})
export const PUT = withApiErrors(async function PUT(req: Request) {
  const body = redeemSchema.parse(JSON.parse((await readWebhookBody(req, 4096))))
  await throttle(req, body.token)
  await redeemAccountToken(body.token, body.password)
  return NextResponse.json({ success: true })
})

