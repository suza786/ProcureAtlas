import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'
import crypto from 'crypto'

// GET /api/webhooks — list webhook endpoints
export async function GET() {
  const ctx = await getCurrentTenant()
  const endpoints = await db.webhookEndpoint.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      _count: { select: { deliveries: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    items: endpoints.map(e => ({
      id: e.id,
      name: e.name,
      url: e.url,
      events: e.events.split(' '),
      isActive: e.isActive,
      lastTriggeredAt: e.lastTriggeredAt,
      lastResponseCode: e.lastResponseCode,
      lastSuccessAt: e.lastSuccessAt,
      consecutiveFailures: e.consecutiveFailures,
      deliveryCount: e._count.deliveries,
      createdAt: e.createdAt,
    })),
  })
}

// POST /api/webhooks — create a webhook endpoint
export async function POST(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const body = await req.json()
  const { name, url, events } = body as { name: string; url: string; events: string[] }

  if (!name || !url || !events || events.length === 0) {
    return NextResponse.json({ error: 'name, url, and events[] required' }, { status: 400 })
  }

  const validEvents = [
    'tender.published', 'tender.amended', 'award.published',
    'pursuit.stage_changed', 'evidence.expiring', 'approval.requested',
    'proposal.submitted',
  ]
  const invalidEvents = events.filter(e => !validEvents.includes(e))
  if (invalidEvents.length > 0) {
    return NextResponse.json({ error: `Invalid events: ${invalidEvents.join(', ')}` }, { status: 400 })
  }

  // Generate a signing secret
  const secret = 'whsec_' + crypto.randomBytes(24).toString('hex')

  const endpoint = await db.webhookEndpoint.create({
    data: {
      tenantId: ctx.tenantId,
      name,
      url,
      secret,
      events: events.join(' '),
    },
  })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'webhook_endpoint_created',
    entityType: 'webhook_endpoint',
    entityId: endpoint.id,
    afterJson: { name, url, events },
    request: req,
  })

  return NextResponse.json({
    id: endpoint.id,
    name: endpoint.name,
    url: endpoint.url,
    events: endpoint.events.split(' '),
    secret: secret, // returned ONCE — caller must store securely
    isActive: endpoint.isActive,
    warning: 'Store the secret securely. It will not be shown again.',
  }, { status: 201 })
}

// DELETE /api/webhooks — delete an endpoint
export async function DELETE(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id, tenantId: ctx.tenantId },
  })
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
  }

  await db.webhookEndpoint.delete({ where: { id } })

  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'webhook_endpoint_deleted',
    entityType: 'webhook_endpoint',
    entityId: id,
    request: req,
  })

  return NextResponse.json({ success: true })
}
