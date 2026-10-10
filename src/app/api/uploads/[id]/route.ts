import { parseIds } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import fs from 'fs/promises'
import { UPLOAD_ROOT, requireTenantStoredPath } from '@/lib/upload-security'
import { requireCleanUpload } from '@/lib/upload-processing'
import { createHash } from 'node:crypto'

// GET /api/uploads/[id] — download a file (or fetch metadata)
export const GET = withApiErrors(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = parseIds(await params)
  const ctx = await getCurrentTenant()
  const url = new URL(req.url)
  const download = url.searchParams.get('download') === 'true'

  const upload = await db.fileUpload.findFirst({
    where: { id, tenantId: ctx.tenantId },
  })

  if (!upload) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  if (!download) {
    return NextResponse.json({
      id: upload.id,
      fileName: upload.fileName,
      fileType: upload.fileType,
      fileSizeKb: upload.fileSizeKb,
      checksum: upload.checksum,
      category: upload.category,
      evidenceId: upload.evidenceId,
      virusScanResult: upload.virusScanResult,
      virusScannedAt: upload.virusScannedAt,
      textExtracted: upload.virusScanResult === 'clean' && upload.virusScannedAt ? upload.textExtracted : null,
      createdAt: upload.createdAt,
    })
  }

  requireCleanUpload(upload.virusScanResult, upload.virusScannedAt)
  // Download — read from local FS (dev) or signed URL (prod)
  if (!upload.storageUrl) {
    return NextResponse.json({ error: 'File storage not available' }, { status: 500 })
  }
  const storedPath = requireTenantStoredPath(UPLOAD_ROOT, ctx.tenantId, upload.category, upload.storageUrl)

  try {
    const buffer = await fs.readFile(storedPath)
    if (createHash('sha256').update(buffer).digest('hex') !== upload.checksum) {
      return NextResponse.json({ error: 'File integrity check failed' }, { status: 423 })
    }
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': upload.fileType,
        'Content-Disposition': `attachment; filename="${upload.fileName.replace(/[^a-zA-Z0-9. _-]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch {
    return NextResponse.json({ error: 'File could not be read' }, { status: 500 })
  }
})

// DELETE /api/uploads/[id] — soft-delete a file upload (revokes access)
export const DELETE = withApiErrors(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = parseIds(await params)
  const { ctx } = await requireTenantWithRole('contributor')

  const upload = await db.fileUpload.findFirst({
    where: { id, tenantId: ctx.tenantId },
  })

  if (!upload) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  // Phase 2 dev: hard delete from DB + try to remove file from FS
  // Phase 2 prod: soft-delete (set deletedAt) + retain for audit period
  const storedPath = upload.storageUrl ? requireTenantStoredPath(UPLOAD_ROOT, ctx.tenantId, upload.category, upload.storageUrl) : null
  await db.fileUpload.delete({ where: { id } })

  try {
    if (storedPath) {
      await fs.unlink(storedPath)
    }
  } catch {
    // File may already be gone — ignore
  }

  return NextResponse.json({ success: true })
})
