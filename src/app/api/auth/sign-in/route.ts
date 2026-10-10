import { withApiErrors } from '@/lib/api-errors'
import { readJson } from '@/lib/api-validation'
import { NextRequest, NextResponse } from 'next/server'
import { signIn } from '@/lib/auth'

// POST /api/auth/sign-in
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const body = await readJson(req, 'login')
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required.' }, { status: 400 })
  }

  const result = await signIn(email, password, req, body.otp)
  if (result.mfaRequired) return NextResponse.json({ mfaRequired: true }, { status: 202 })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, lockedUntil: result.lockedUntil },
      { status: 401 }
    )
  }

  return NextResponse.json({ success: true })
})
