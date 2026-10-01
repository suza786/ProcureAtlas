import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import crypto from 'crypto'

// GET /api/webhooks/deliveries — list webhook delivery log
export async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const { searchParams } = new URL(req.url)
  const endpointId = searchParams.get('endpointId')
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  const where: Record<string, unknown> = { tenantId: ctx.tenantId }
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
}

// POST /api/webhooks/deliveries — manually trigger a test delivery
export async function POST(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const { endpointId, eventType, payload } = body as {
    endpointId: string
    eventType: string
    payload?: object
  }

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id: endpointId, tenantId: ctx.tenantId },
  })
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
  }

  // Create a delivery record
  const eventPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    tenantId: ctx.tenantId,
    data: payload ?? { test: true },
  }
  const payloadJson = JSON.stringify(eventPayload)
  const signature = crypto
    .createHmac('sha256', endpoint.secret)
    .update(payloadJson)
    .digest('hex')

  const delivery = await db.webhookDelivery.create({
    data: {
      tenantId: ctx.tenantId,
      endpointId,
      eventType,
      payloadJson,
      signature,
      status: 'pending',
      maxAttempts: 5,
    },
  })

  // Attempt delivery (in production this would be async via a worker)
  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ProcureAtlas-Event': eventType,
        'X-ProcureAtlas-Signature': `sha256=${signature}`,
      },
      body: payloadJson,
      signal: AbortSignal.timeout(10000),
    })

    const responseBody = await response.text()

    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: response.ok ? 'delivered' : 'failed',
        attemptCount: 1,
        responseCode: response.status,
        responseBody: responseBody.slice(0, 2000),
        errorMessage: response.ok ? null : `HTTP ${response.status}`,
        deliveredAt: response.ok ? new Date() : null,
        nextRetryAt: response.ok ? null : new Date(Date.now() + 60000),
      },
    })

    await db.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        lastTriggeredAt: new Date(),
        lastResponseCode: response.status,
        lastSuccessAt: response.ok ? new Date() : undefined,
        consecutiveFailures: response.ok ? 0 : endpoint.consecutiveFailures + 1,
      },
    })

    return NextResponse.json({
      success: response.ok,
      deliveryId: delivery.id,
      responseCode: response.status,
      responseBody: responseBody.slice(0, 500),
      message: response.ok ? 'Delivery successful' : `Delivery failed (HTTP ${response.status}). Will retry.`,
    })
  } catch (e) {
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'retrying',
        attemptCount: 1,
        errorMessage: (e as Error).message,
        nextRetryAt: new Date(Date.now() + 60000),
      },
    })

    await db.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        lastTriggeredAt: new Date(),
        consecutiveFailures: endpoint.consecutiveFailures + 1,
      },
    })

    return NextResponse.json({
      success: false,
      deliveryId: delivery.id,
      error: (e as Error).message,
      message: 'Delivery failed — will retry with exponential backoff.',
    })
  }
}
