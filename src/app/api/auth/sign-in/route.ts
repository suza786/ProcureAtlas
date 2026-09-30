import { NextRequest, NextResponse } from 'next/server'
import { signIn } from '@/lib/auth'

// POST /api/auth/sign-in
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required.' }, { status: 400 })
  }

  const result = await signIn(email, password, req)

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, lockedUntil: result.lockedUntil },
      { status: 401 }
    )
  }

  return NextResponse.json({ success: true })
}
