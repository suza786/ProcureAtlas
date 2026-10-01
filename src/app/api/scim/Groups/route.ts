import { NextResponse } from 'next/server'

// GET /api/scim/Groups — SCIM 2.0 group list (skeleton)
export async function GET() {
  return NextResponse.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 0,
    startIndex: 1,
    itemsPerPage: 0,
    Resources: [],
    note: 'SCIM Groups endpoint — Phase 6 skeleton. Group sync requires groupSyncEnabled in ScimConfig.',
  })
}
