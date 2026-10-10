import type { OutboxJob } from '@prisma/client'
import { db } from './db'
import { inboundTenderSchema, idSchema } from './api-validation'
import { enqueueOutbox, JobFailure } from './outbox'

export async function dispatchInboundWebhook(job: OutboxJob) {
  const { webhookId } = JSON.parse(job.payloadJson) as { webhookId: string }
  idSchema.parse(webhookId)
  try {
    await db.$transaction(async tx => {
      const record = await tx.inboundWebhook.findFirst({ where: { id: webhookId, tenantId: job.tenantId } })
      if (!record || !record.signatureValid || !record.eventId) throw new JobFailure('Authenticated inbound event not found', true)
      if (['processed', 'ignored'].includes(record.processedStatus)) return
      const claimed = await tx.inboundWebhook.updateMany({ where: { id: webhookId, tenantId: job.tenantId, processedStatus: { in: ['pending', 'failed'] } }, data: { processedStatus: 'processing' } })
      if (!claimed.count) throw new JobFailure('Inbound event is being processed')
      if (!['worldbank', 'adb', 'ungm'].includes(record.source)) {
        await tx.inboundWebhook.update({ where: { id: webhookId }, data: { processedStatus: 'ignored', processedAt: new Date(), errorMessage: 'No processor registered for this source' } })
        return
      }
      const payload = inboundTenderSchema.parse(JSON.parse(record.payloadJson))
      const externalId = String(payload.id ?? payload.reference)
      const key = { sourcePortal_externalId: { sourcePortal: record.source, externalId } }
      const existing = await tx.tender.findUnique({ where: key, select: { id: true } })
      const data = {
        sourceUrl: payload.url, title: payload.title, description: payload.description ?? null,
        country: payload.country ?? 'GLOBAL', market: record.source === 'worldbank' ? 'WB' : record.source === 'adb' ? 'ADB' : 'UN',
        sector: payload.sector ?? 'IT', currency: payload.currency ?? 'USD', estimatedValue: payload.value ?? null,
        valueUSD: payload.value_usd ?? ((payload.currency ?? 'USD') === 'USD' ? payload.value ?? null : null),
        publishedAt: payload.published ? new Date(payload.published) : record.createdAt,
        submissionDeadline: payload.deadline ? new Date(payload.deadline) : null, status: 'active', confidence: .95,
      }
      const tender = await tx.tender.upsert({ where: key, create: { ...data, sourcePortal: record.source, externalId }, update: data })
      await enqueueOutbox(tx, job.tenantId, 'webhook.event', { eventType: existing ? 'tender.amended' : 'tender.published', data: { tenderId: tender.id, source: record.source, externalId, inboundEventId: record.eventId } })
      await tx.inboundWebhook.update({ where: { id: webhookId }, data: { processedStatus: 'processed', processedAt: new Date(), errorMessage: null, createdEntities: JSON.stringify([`tender:${tender.id}`]) } })
    })
  } catch (error) {
    // The mutation, claim, downstream event and status all roll back together on failure.
    await db.inboundWebhook.updateMany({ where: { id: webhookId, tenantId: job.tenantId, processedStatus: { in: ['pending', 'failed'] } }, data: { processedStatus: 'failed', errorMessage: error instanceof Error ? error.message.slice(0, 2000) : 'Inbound processing failed' } })
    throw error
  }
}
