import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

// GET /api/auth/me — current session info
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({ authenticated: true, user })
}
