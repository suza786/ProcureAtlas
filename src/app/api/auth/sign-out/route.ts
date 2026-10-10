import { withApiErrors } from '@/lib/api-errors'
import { NextRequest, NextResponse } from 'next/server'
import { signOut } from '@/lib/auth'

// POST /api/auth/sign-out
export const POST = withApiErrors(async function POST(req: NextRequest) {
  await signOut(req)
  return NextResponse.json({ success: true })
})
