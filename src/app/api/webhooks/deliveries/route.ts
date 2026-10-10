import type { Prisma } from '@prisma/client'
import { validatedSearch } from '@/lib/api-validation'
import { readJson, pagination } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enqueueOutbox } from '@/lib/outbox'



// GET /api/webhooks/deliveries — list webhook delivery log
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('admin')
  const searchParams = validatedSearch(req)
  const endpointId = searchParams.get('endpointId')
  const status = searchParams.get('status')
  const { limit } = pagination(searchParams, 50, 100)

  const where: Prisma.WebhookDeliveryWhereInput = { tenantId: ctx.tenantId }
  if (endpointId) where.endpointId = endpointId
  if (status) where.status = status

  const deliveries = await db.webhookDelivery.findMany({
    where,
    include: {
      endpoint: { select: { name: true, url: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({
    items: deliveries.map(d => ({
      id: d.id,
      eventType: d.eventType,
      status: d.status,
      attemptCount: d.attemptCount,
      maxAttempts: d.maxAttempts,
      nextRetryAt: d.nextRetryAt,
      responseCode: d.responseCode,
      responseBody: d.responseBody?.slice(0, 500),
      errorMessage: d.errorMessage,
      deliveredAt: d.deliveredAt,
      createdAt: d.createdAt,
      endpoint: d.endpoint,
      signature: d.signature.slice(0, 16) + '...',
      payloadSize: d.payloadJson.length,
    })),
  })
})

// POST /api/webhooks/deliveries — manually trigger a test delivery
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('admin')
  const body = await readJson(req, 'delivery')
  const { endpointId, eventType, payload } = body

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id: endpointId, tenantId: ctx.tenantId },
  })
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
  }

  if (!endpoint.isActive) return NextResponse.json({ error: 'Endpoint is inactive' }, { status: 409 })
  const job = await enqueueOutbox(db, ctx.tenantId, 'webhook.event', { endpointId, eventType, data: payload ?? { test: true } })
  return NextResponse.json({ success: true, jobId: job.id, message: 'Delivery queued. Run the worker to process it.' }, { status: 202 })
})
