import { db } from './db'
import { timingSafeEqual } from 'node:crypto'
import { idSchema } from './api-validation'
import { meterApiRequest } from './usage-meter'
export async function requireScim(req: Request, provisioning = false) {
  const tenantId = idSchema.parse(new URL(req.url).searchParams.get('tenantId'))
  const config = await db.scimConfig.findUnique({ where: { tenantId } })
  const header = req.headers.get('authorization') ?? ''
  const presented = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '')
  const expected = Buffer.from(config?.bearerToken ?? '')
  if (!config?.isActive || !expected.length || presented.length !== expected.length || !timingSafeEqual(presented, expected)) throw new Response('Valid SCIM bearer required', { status: 401 })
  if (provisioning && !config.userProvisioningEnabled) throw new Response('SCIM provisioning disabled', { status: 403 })
  await meterApiRequest(tenantId)
  return tenantId
}
