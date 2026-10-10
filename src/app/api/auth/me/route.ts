import { meterApiRequest } from '@/lib/usage-meter'
import { withApiErrors } from '@/lib/api-errors'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

// GET /api/auth/me — current session info
export const GET = withApiErrors(async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  await meterApiRequest(user.tenantId, { userId: user.userId })
  return NextResponse.json({ authenticated: true, user })
})
