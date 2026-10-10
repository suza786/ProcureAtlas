import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { withApiErrors } from '@/lib/api-errors'
import { requireScim } from '@/lib/scim-auth'
import { parseIds } from '@/lib/api-validation'
import { readWebhookBody } from '@/lib/inbound-webhook'
import { assertSeatQuota } from '@/lib/usage-meter'
const resource = (user: { id: string; email: string; name: string | null; active: boolean }) => ({ schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], id: user.id, userName: user.email, displayName: user.name, active: user.active, emails: [{ value: user.email, primary: true }] })
type Context = { params: Promise<{ id: string }> }
export const GET = withApiErrors(async function GET(req: Request, context: Context) {
  const tenantId = await requireScim(req)
  const { id } = parseIds(await context.params)
  const user = await db.user.findFirst({ where: { id, tenantId } })
  if (!user) throw new Response('User not found', { status: 404 })
  return NextResponse.json(resource(user))
})
async function update(req: Request, context: Context, deactivate = false) {
  const tenantId = await requireScim(req, true)
  const { id } = parseIds(await context.params)
  const schema = z.object({ active: z.boolean().optional(), displayName: z.string().min(1).max(200).optional(), userName: z.email().max(254).transform(s => s.toLowerCase()).optional(), schemas: z.array(z.string().max(200)).max(5).optional() }).strict()
  let data: z.infer<typeof schema>
  if (deactivate) data = { active: false }
  else {
    const raw = JSON.parse(await readWebhookBody(req, 16384))
    if (req.method === 'PATCH') {
      const patch = z.object({ schemas: z.array(z.string().max(200)).optional(), Operations: z.array(z.object({ op: z.enum(['replace','Replace','add','Add']), path: z.enum(['active','displayName','userName']).optional(), value: z.unknown() }).strict()).min(1).max(10) }).strict().parse(raw)
      const flattened: Record<string, unknown> = {}
      for (const op of patch.Operations) {
        if (op.path) flattened[op.path] = op.value
        else Object.assign(flattened, schema.parse(op.value))
      }
      data = schema.parse(flattened)
    } else data = schema.parse(raw)
  }
  const user = await db.$transaction(async tx => {
    const current = await tx.user.findFirst({ where: { id, tenantId } })
    if (!current) throw new Response('User not found', { status: 404 })
    // SCIM bearer is not an owner credential. Owner changes use the owner administration flow.
    if (current.role === 'owner') throw new Response('Owner accounts cannot be changed by SCIM', { status: 403 })
    if (data.active === true && !current.active) await assertSeatQuota(tx, tenantId)
    const updated = await tx.user.update({ where: { id }, data: { active: data.active, name: data.displayName, email: data.userName } })
    if (data.active === false || (data.userName && data.userName !== current.email)) {
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
      await tx.apiKey.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
      await tx.accountToken.updateMany({ where: { userId: id, usedAt: null }, data: { usedAt: new Date() } })
    }
    await tx.auditLog.create({ data: { tenantId, actorType: 'scim', action: 'scim_user_updated', entityType: 'user', entityId: id, afterJson: JSON.stringify(data) } })
    return updated
  })
  return deactivate ? new NextResponse(null, { status: 204 }) : NextResponse.json(resource(user))
}
export const PATCH = withApiErrors(async function PATCH(req: Request, ctx: Context) { return update(req, ctx) })
export const PUT = withApiErrors(async function PUT(req: Request, ctx: Context) { return update(req, ctx) })
export const DELETE = withApiErrors(async function DELETE(req: Request, ctx: Context) { return update(req, ctx, true) })
