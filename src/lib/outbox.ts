import type { Prisma, OutboxJob } from '@prisma/client'
import { randomUUID, createHmac } from 'node:crypto'
import { db } from './db'
import { sendPublicWebhook } from './webhook-delivery'

export type JobHandler = (job: OutboxJob) => Promise<void>
export class JobFailure extends Error {
  constructor(message: string, public readonly permanent = false, public readonly retryAfterMs?: number) { super(message) }
}

/** Call with the mutation's transaction client so events cannot precede committed data. */
export function enqueueOutbox(tx: Prisma.TransactionClient, tenantId: string, kind: string, payload: unknown) {
  return tx.outboxJob.create({ data: { tenantId, kind, payloadJson: JSON.stringify(payload) } })
}

export function retryDelay(attempt: number, retryAfterMs?: number, random = Math.random) {
  const backoff = Math.min(3_600_000, 1000 * 2 ** Math.min(attempt - 1, 12))
  return Math.min(86_400_000, Math.max(backoff + Math.floor(backoff * .25 * random()), retryAfterMs ?? 0))
}

export function parseRetryAfter(value?: string, now = Date.now()) {
  if (!value) return undefined
  const seconds = Number(value)
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now
  return Number.isFinite(delay) ? Math.max(0, Math.min(delay, 86_400_000)) : undefined
}

const LEASE_MS = 120_000

/** Compare-and-swap claim: competing workers may select the same row, only one owns it. */
export async function claimJob(workerId: string, now = new Date()) {
  const stale = new Date(now.getTime() - LEASE_MS)
  const eligible: Prisma.OutboxJobWhereInput = {
    availableAt: { lte: now },
    OR: [{ status: 'pending' }, { status: 'retrying' }, { status: 'running', lockedAt: { lt: stale } }],
  }
  for (let n = 0; n < 8; n++) {
    const candidate = await db.outboxJob.findFirst({ where: eligible, orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }] })
    if (!candidate) return null
    if (candidate.attempts >= candidate.maxAttempts) {
      await db.outboxJob.updateMany({ where: { id: candidate.id, ...eligible }, data: { status: 'failed', error: 'Attempt limit reached after interrupted execution', lockedAt: null, lockedBy: null } })
      continue
    }
    const claimed = await db.outboxJob.updateMany({
      where: { id: candidate.id, ...eligible, attempts: candidate.attempts },
      data: { status: 'running', lockedAt: now, lockedBy: workerId, attempts: { increment: 1 } },
    })
    if (claimed.count === 1) return db.outboxJob.findUnique({ where: { id: candidate.id } })
  }
  return null
}

async function fanoutWebhook(job: OutboxJob) {
  const payload = JSON.parse(job.payloadJson) as { eventType: string; data: unknown; endpointId?: string }
  if (!payload.eventType) throw new JobFailure('Missing webhook event type', true)
  await db.$transaction(async tx => {
    const endpoints = await tx.webhookEndpoint.findMany({ where: { tenantId: job.tenantId, isActive: true, ...(payload.endpointId ? { id: payload.endpointId } : {}) } })
    for (const endpoint of endpoints) {
      if (!payload.endpointId && !endpoint.events.split(' ').includes(payload.eventType)) continue
      const eventId = `${job.id}:${endpoint.id}`
      if (await tx.webhookDelivery.findUnique({ where: { eventId } })) continue
      const payloadJson = JSON.stringify({ id: eventId, event: payload.eventType, timestamp: job.createdAt.toISOString(), tenantId: job.tenantId, data: payload.data })
      const delivery = await tx.webhookDelivery.create({ data: {
        eventId, tenantId: job.tenantId, endpointId: endpoint.id, eventType: payload.eventType,
        payloadJson, signature: createHmac('sha256', endpoint.secret).update(payloadJson).digest('hex'), maxAttempts: 5,
      } })
      await enqueueOutbox(tx, job.tenantId, 'webhook.deliver', { deliveryId: delivery.id })
    }
  })
}

async function deliverWebhook(job: OutboxJob) {
  const { deliveryId } = JSON.parse(job.payloadJson) as { deliveryId: string }
  const delivery = await db.webhookDelivery.findFirst({ where: { id: deliveryId, tenantId: job.tenantId }, include: { endpoint: true } })
  if (!delivery) throw new JobFailure('Webhook delivery no longer exists', true)
  if (delivery.status === 'delivered') return
  await db.webhookDelivery.update({ where: { id: delivery.id }, data: { attemptCount: job.attempts, status: 'pending', nextRetryAt: null } })
  try {
    if (!delivery.endpoint.isActive) throw new JobFailure('Webhook endpoint is inactive', true)
    const response = await sendPublicWebhook(delivery.endpoint.url, {
      headers: { 'Content-Type': 'application/json', 'X-ProcureAtlas-Event': delivery.eventType, 'X-ProcureAtlas-Event-Id': delivery.eventId ?? delivery.id, 'X-ProcureAtlas-Signature': `sha256=${delivery.signature}` },
      body: delivery.payloadJson,
    })
    await db.webhookDelivery.update({ where: { id: delivery.id }, data: { responseCode: response.status, responseBody: response.body } })
    await db.webhookEndpoint.update({ where: { id: delivery.endpointId }, data: { lastTriggeredAt: new Date(), lastResponseCode: response.status, ...(response.ok ? { lastSuccessAt: new Date(), consecutiveFailures: 0 } : { consecutiveFailures: { increment: 1 } }) } })
    if (!response.ok) throw new JobFailure(`HTTP ${response.status}`, response.status >= 300 && response.status < 500 && ![408, 429].includes(response.status), parseRetryAfter(response.retryAfter))
    await db.webhookDelivery.update({ where: { id: delivery.id }, data: { status: 'delivered', deliveredAt: new Date(), errorMessage: null, nextRetryAt: null } })
  } catch (error) {
    const failure = error instanceof JobFailure ? error : new JobFailure(error instanceof Error ? error.message : 'Webhook transport failed')
    const failed = failure.permanent || job.attempts >= job.maxAttempts
    await db.webhookDelivery.update({ where: { id: delivery.id }, data: { status: failed ? 'failed' : 'retrying', errorMessage: failure.message.slice(0, 2000), nextRetryAt: failed ? null : new Date(Date.now() + retryDelay(job.attempts, failure.retryAfterMs)) } })
    throw failure
  }
}

export async function sendEmailJob(job: OutboxJob, payload: { to: string; subject: string; text: string; html?: string }) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new JobFailure('Email transport is not configured')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': job.id },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, ...payload }),
  })
  if (!response.ok) throw new JobFailure(`Email provider HTTP ${response.status}`, response.status < 500 && ![408, 429].includes(response.status), parseRetryAfter(response.headers.get('retry-after') ?? undefined))
}

export const builtinHandlers: Record<string, JobHandler> = { 'webhook.event': fanoutWebhook, 'webhook.deliver': deliverWebhook }

export async function runNextJob(handlers: Record<string, JobHandler> = builtinHandlers, workerId: string = randomUUID()) {
  const job = await claimJob(workerId)
  if (!job) return false
  const owned = { id: job.id, status: 'running', lockedBy: workerId, attempts: job.attempts }
  const heartbeat = setInterval(() => {
    void db.outboxJob.updateMany({ where: owned, data: { lockedAt: new Date() } }).catch(() => { /* Lease recovery handles a disconnected worker. */ })
  }, LEASE_MS / 3)
  heartbeat.unref()
  try {
    const handler = handlers[job.kind]
    if (!handler) throw new JobFailure(`Unsupported job kind: ${job.kind}`, true)
    await handler(job)
    await db.outboxJob.updateMany({ where: owned, data: { status: 'completed', completedAt: new Date(), lockedAt: null, lockedBy: null, error: null } })
  } catch (error) {
    const failure = error instanceof JobFailure ? error : new JobFailure(error instanceof Error ? error.message : 'Job execution failed')
    const failed = failure.permanent || job.attempts >= job.maxAttempts
    await db.outboxJob.updateMany({ where: owned, data: { status: failed ? 'failed' : 'retrying', error: failure.message.slice(0, 2000), lockedAt: null, lockedBy: null, availableAt: new Date(Date.now() + retryDelay(job.attempts, failure.retryAfterMs)) } })
  } finally { clearInterval(heartbeat) }
  return true
}
