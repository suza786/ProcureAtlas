import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

// POST /api/v1/webhooks/ingest — accept signed webhooks from external sources
// Sources: World Bank, ADB, UNGM, external CRM, or custom integrations
export async function POST(req: NextRequest) {
  const body = await req.text()
  const source = req.headers.get('x-webhook-source') ?? 'custom'
  const eventType = req.headers.get('x-webhook-event') ?? 'unknown'
  const signature = req.headers.get('x-webhook-signature')

  // Verify signature if source has a known secret
  // In production: each source would have a configured signing secret
  let signatureValid = true
  if (signature) {
    // For demo: accept any signature format
    // In production: verify HMAC against source-specific secret
    signatureValid = signature.startsWith('sha256=') || signature.length > 10
  }

  // Parse payload
  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  // Create inbound webhook record
  const webhook = await db.inboundWebhook.create({
    data: {
      source,
      eventType,
      signature,
      signatureValid,
      payloadJson: body,
      processedStatus: 'pending',
    },
  })

  // Process the webhook (simplified — in production this would be async via worker)
  try {
    let createdEntities: string[] = []

    // Handle different sources
    if (source === 'worldbank' || source === 'adb' || source === 'ungm') {
      // Try to create a tender from the payload
      const data = payload as Record<string, unknown>
      if (data.title && data.url) {
        const existing = await db.tender.findUnique({
          where: {
            sourcePortal_externalId: {
              sourcePortal: source,
              externalId: String(data.id ?? data.reference ?? 'unknown'),
            },
          },
        })

        if (!existing) {
          const tender = await db.tender.create({
            data: {
              externalId: String(data.id ?? data.reference ?? `ext-${Date.now()}`),
              sourcePortal: source,
              sourceUrl: String(data.url),
              title: String(data.title),
              description: data.description ? String(data.description) : null,
              country: String(data.country ?? 'GLOBAL'),
              market: source === 'worldbank' ? 'WB' : source === 'adb' ? 'ADB' : 'UN',
              sector: String(data.sector ?? 'IT'),
              currency: String(data.currency ?? 'USD'),
              estimatedValue: data.value ? Number(data.value) : null,
              valueUSD: data.value_usd ? Number(data.value_usd) : (data.value ? Number(data.value) : null),
              publishedAt: data.published ? new Date(String(data.published)) : new Date(),
              submissionDeadline: data.deadline ? new Date(String(data.deadline)) : null,
              status: 'active',
              confidence: 0.95,
            },
          })
          createdEntities.push(`tender:${tender.id}`)
        }
      }
    }

    // Mark as processed
    await db.inboundWebhook.update({
      where: { id: webhook.id },
      data: {
        processedStatus: 'processed',
        processedAt: new Date(),
        createdEntities: createdEntities.length > 0 ? JSON.stringify(createdEntities) : null,
      },
    })

    return NextResponse.json({
      success: true,
      webhookId: webhook.id,
      source,
      eventType,
      signatureValid,
      entitiesCreated: createdEntities.length,
      createdEntities,
    }, { status: 200 })

  } catch (e) {
    await db.inboundWebhook.update({
      where: { id: webhook.id },
      data: {
        processedStatus: 'failed',
        processedAt: new Date(),
        errorMessage: (e as Error).message.slice(0, 2000),
      },
    })

    return NextResponse.json({
      success: false,
      webhookId: webhook.id,
      error: (e as Error).message,
    }, { status: 500 })
  }
}
