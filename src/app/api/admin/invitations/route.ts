import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { inviteUser } from '@/lib/account-lifecycle'
import { readWebhookBody } from '@/lib/inbound-webhook'
export const POST = withApiErrors(async function POST(req: Request) {
  const { ctx } = await requireTenantWithRole('admin')
  const body = z.object({ email: z.email().max(254).transform(s => s.toLowerCase().trim()), name: z.string().max(200).optional(), role: z.enum(['viewer', 'contributor', 'manager', 'admin']).default('viewer') }).strict().parse(JSON.parse((await readWebhookBody(req, 4096))))
  return NextResponse.json(await inviteUser(ctx.tenantId, body.email, body.name, body.role), { status: 201 })
})

