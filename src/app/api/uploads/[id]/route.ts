import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import fs from 'fs/promises'

// GET /api/uploads/[id] — download a file (or fetch metadata)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
      textExtracted: upload.textExtracted,
      createdAt: upload.createdAt,
    })
  }

  // Download — read from local FS (dev) or signed URL (prod)
  if (!upload.storageUrl) {
    return NextResponse.json({ error: 'File storage not available' }, { status: 500 })
  }

  try {
    const buffer = await fs.readFile(upload.storageUrl)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': upload.fileType,
        'Content-Disposition': `attachment; filename="${upload.fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'File could not be read: ' + (e as Error).message }, { status: 500 })
  }
}

// DELETE /api/uploads/[id] — soft-delete a file upload (revokes access)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getCurrentTenant()

  const upload = await db.fileUpload.findFirst({
    where: { id, tenantId: ctx.tenantId },
  })

  if (!upload) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  // Phase 2 dev: hard delete from DB + try to remove file from FS
  // Phase 2 prod: soft-delete (set deletedAt) + retain for audit period
  await db.fileUpload.delete({ where: { id } })

  try {
    if (upload.storageUrl) {
      await fs.unlink(upload.storageUrl)
    }
  } catch {
    // File may already be gone — ignore
  }

  return NextResponse.json({ success: true })
}
