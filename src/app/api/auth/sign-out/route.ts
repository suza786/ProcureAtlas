import { NextRequest, NextResponse } from 'next/server'
import { signOut } from '@/lib/auth'

// POST /api/auth/sign-out
export async function POST(req: NextRequest) {
  await signOut(req)
  return NextResponse.json({ success: true })
}
