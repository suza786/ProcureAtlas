import { NextResponse } from 'next/server'
import { withApiErrors } from '@/lib/api-errors'
import { verifyStripeSignature } from '@/lib/billing-security'
import { readWebhookBody } from '@/lib/inbound-webhook'
import { applyStripeBillingEvent } from '@/lib/stripe-billing'

// Stripe signature authentication replaces session authorization for this provider callback.
export const POST = withApiErrors(async function POST(req: Request) {
  const body = await readWebhookBody(req)
  verifyStripeSignature(body, req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)
  return NextResponse.json(await applyStripeBillingEvent(body))
})
