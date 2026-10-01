import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

// GET /api/scim/Users — SCIM 2.0 user list
// POST /api/scim/Users — SCIM 2.0 user provisioning
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
  }

  const scimConfig = await db.scimConfig.findUnique({ where: { tenantId } })
  if (!scimConfig || !scimConfig.isActive) {
    return NextResponse.json({ error: 'SCIM not configured or inactive' }, { status: 403 })
  }

  const users = await db.user.findMany({
    where: { tenantId },
    select: { id: true, email: true, name: true, role: true, mfaEnabled: true, lastLoginAt: true, createdAt: true },
  })

  return NextResponse.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: users.length,
    startIndex: 1,
    itemsPerPage: users.length,
    Resources: users.map(u => ({
      id: u.id,
      userName: u.email,
      displayName: u.name ?? u.email,
      active: true,
      emails: [{ value: u.email, primary: true }],
      groups: [],
      meta: {
        resourceType: 'User',
        created: u.createdAt,
        lastModified: u.lastLoginAt ?? u.createdAt,
        location: `/api/scim/Users/${u.id}`,
      },
    })),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tenantId } = body as { tenantId?: string; schemas?: string[]; userName?: string; displayName?: string; emails?: Array<{ value: string }> }

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
  }

  const scimConfig = await db.scimConfig.findUnique({ where: { tenantId } })
  if (!scimConfig || !scimConfig.isActive || !scimConfig.userProvisioningEnabled) {
    return NextResponse.json({ error: 'SCIM provisioning not enabled' }, { status: 403 })
  }

  const email = body.emails?.[0]?.value ?? body.userName
  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }

  // Check if user already exists
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 })
  }

  // Create user with random password (user must reset via email)
  const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!'
  const user = await db.user.create({
    data: {
      tenantId,
      email,
      name: body.displayName ?? email.split('@')[0],
      role: 'contributor',
      passwordHash: await bcrypt.hash(tempPassword, 12),
    },
  })

  return NextResponse.json({
    id: user.id,
    userName: user.email,
    displayName: user.name,
    active: true,
    emails: [{ value: user.email, primary: true }],
    meta: {
      resourceType: 'User',
      created: user.createdAt,
      location: `/api/scim/Users/${user.id}`,
    },
  }, { status: 201 })
}
