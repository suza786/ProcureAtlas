import { randomUUID } from 'node:crypto'
import { db } from '../src/lib/db'
import { builtinHandlers, runNextJob } from '../src/lib/outbox'
import { dispatchUploadScan } from '../src/lib/upload-processing'
import { dispatchAccountEmail } from '../src/lib/account-lifecycle'
import { dispatchInboundWebhook } from '../src/lib/inbound-processing'
import { ANALYTICS_JOB, dispatchAnalyticsSnapshot, scheduleAnalyticsPage } from '../src/lib/analytics-history'

async function main() {
  let stopping = false
  process.on('SIGTERM', () => { stopping = true })
  process.on('SIGINT', () => { stopping = true })
  const workerId = randomUUID()
  const once = process.argv.includes('--once')
  console.log(`Outbox worker ${workerId} started`)
  let nextAnalyticsSweep = 0
  let analyticsCursor: string | undefined
  try {
    do {
      if (Date.now() >= nextAnalyticsSweep) {
        try {
          const page = await scheduleAnalyticsPage(new Date(), analyticsCursor)
          analyticsCursor = page.cursor
          if (!analyticsCursor) nextAnalyticsSweep = Date.now() + 3_600_000
        } catch (error) {
          console.error('Analytics scheduling failed:', error instanceof Error ? error.message : 'Unknown error')
          nextAnalyticsSweep = Date.now() + 60_000
        }
      }
      const processed = await runNextJob({ ...builtinHandlers, 'upload.scan': dispatchUploadScan, 'email.send': dispatchAccountEmail, 'inbound.process': dispatchInboundWebhook, [ANALYTICS_JOB]: dispatchAnalyticsSnapshot }, workerId)
      if (once) break
      if (!processed) await new Promise(resolve => setTimeout(resolve, 1000))
    } while (!stopping)
  } finally { await db.$disconnect() }
}
main().catch(error => { console.error('Worker stopped:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1 })
