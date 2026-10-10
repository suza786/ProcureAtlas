import { meterApiRequest, assertSeatQuota } from '@/lib/usage-meter'
import { validatedSearch, pagination } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { readJson } from '@/lib/api-validation'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// GET /api/scim/Users — SCIM 2.0 user list
// POST /api/scim/Users — SCIM 2.0 user provisioning
//
// Auth: Bearer token MUST match the tenant's ScimConfig.bearerToken
// (constant-time comparison). The token is never accepted from the request
// body or query string.

function verifyScimBearer(req: NextRequest, bearerToken: string | null): boolean {
  if (!bearerToken) return false
  const header = req.headers.get('authorization') ?? ''
  const presented = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!presented) return false
  const a = Buffer.from(presented)
  const b = Buffer.from(bearerToken)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function scimUnauthorized() {
  return NextResponse.json(
    { error: 'unauthorized', detail: 'Valid SCIM bearer token required' },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
  )
}

export const GET = withApiErrors(async function GET(req: NextRequest) {
  const searchParams = validatedSearch(req)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
  }

  const scimConfig = await db.scimConfig.findUnique({ where: { tenantId } })
  if (!scimConfig || !scimConfig.isActive) {
    return NextResponse.json({ error: 'SCIM not configured or inactive' }, { status: 403 })
  }
  if (!verifyScimBearer(req, scimConfig.bearerToken)) {
    return scimUnauthorized()
  }

  await meterApiRequest(tenantId)
  const { limit, offset } = pagination(searchParams)
  const total = await db.user.count({ where: { tenantId } })
  const users = await db.user.findMany({
    where: { tenantId },
    take: limit, skip: offset, orderBy: { id: 'asc' },
    select: { id: true, email: true, name: true, role: true, active: true, mfaEnabled: true, lastLoginAt: true, createdAt: true },
  })

  return NextResponse.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: total,
    startIndex: offset + 1,
    itemsPerPage: users.length,
    Resources: users.map(u => ({
      id: u.id,
      userName: u.email,
      displayName: u.name ?? u.email,
      active: u.active,
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
})

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const body = await readJson(req, 'scim')
  const { tenantId } = body

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
  }

  const scimConfig = await db.scimConfig.findUnique({ where: { tenantId } })
  if (!scimConfig || !scimConfig.isActive || !scimConfig.userProvisioningEnabled) {
    return NextResponse.json({ error: 'SCIM provisioning not enabled' }, { status: 403 })
  }
  if (!verifyScimBearer(req, scimConfig.bearerToken)) {
    return scimUnauthorized()
  }

  await meterApiRequest(tenantId)
  const email = body.emails?.[0]?.value ?? body.userName
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 })
  }

  // Check if user already exists
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 })
  }

  // Create user with a cryptographically random temp password (user must reset via email)
  const tempPassword = crypto.randomBytes(18).toString('base64url') + 'Aa1!'
  const user = await db.$transaction(async tx => {
    await assertSeatQuota(tx, tenantId)
    return tx.user.create({
    data: {
      tenantId,
      email: email.toLowerCase(),
      name: body.displayName ?? email.split('@')[0],
      role: 'contributor',
      active: body.active ?? true,
      passwordHash: await bcrypt.hash(tempPassword, 12),
    },
    })
  })

  return NextResponse.json({
    id: user.id,
    userName: user.email,
    displayName: user.name,
    active: user.active,
    emails: [{ value: user.email, primary: true }],
    meta: {
      resourceType: 'User',
      created: user.createdAt,
      location: `/api/scim/Users/${user.id}`,
    },
  }, { status: 201 })
})
