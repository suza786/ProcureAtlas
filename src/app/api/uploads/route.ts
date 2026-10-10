import type { Prisma } from '@prisma/client'
import { validatedSearch } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireTenantWithRole } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { getTenantUploadDirectory, UPLOAD_ROOT } from '@/lib/upload-security'
import { idSchema } from '@/lib/api-validation'
import { boundedFormData, validateUploadContent } from '@/lib/upload-processing'
import { enqueueOutbox } from '@/lib/outbox'

// POST /api/uploads — upload a file (evidence, tender doc, bid doc)
// Dev: local filesystem under UPLOAD_DIR (default: <cwd>/uploads)/{tenantId}/...
// Prod: use S3-compatible object store with signed URLs.

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { ctx } = await requireTenantWithRole('contributor')
  const formData = await boundedFormData(req)
  const file = formData.get('file') as File | null
  const categoryValue = formData.get('category') ?? 'evidence'
  const uploadDir = getTenantUploadDirectory(UPLOAD_ROOT, ctx.tenantId, categoryValue)
  const category = categoryValue as string
  const evidenceId = formData.get('evidenceId')
  if (evidenceId !== null && typeof evidenceId !== 'string') {
    return NextResponse.json({ error: 'Invalid evidenceId' }, { status: 400 })
  }
  if (evidenceId) {
    idSchema.parse(evidenceId)
    const evidence = await db.evidence.findFirst({
      where: { id: evidenceId, company: { tenantId: ctx.tenantId } }, select: { id: true },
    })
    if (!evidence) return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
  }

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  validateUploadContent(file.name, file.type, buffer)
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex')
  const fileSizeKb = Math.ceil(buffer.length / 1024)

  // Storage path (dev: local FS, env-configurable root)
  await fs.mkdir(uploadDir, { recursive: true })
  const fileId = crypto.randomBytes(8).toString('hex')
  const storedFileName = `${fileId}-${file.name.replace(/[^a-zA-Z0-9.\-]/g, '_')}`
  const filePath = path.join(uploadDir, storedFileName)
  await fs.writeFile(filePath, buffer)

  const storageKey = `${ctx.tenantId}/${category}/${storedFileName}`

  let upload
  try {
    upload = await db.$transaction(async tx => {
      const record = await tx.fileUpload.create({
        data: {
          tenantId: ctx.tenantId, uploadedById: ctx.userId,
          fileName: file.name, fileType: file.type, fileSizeKb, checksum,
          storageKey, storageUrl: filePath, category, evidenceId: evidenceId ?? null,
          virusScanResult: 'pending', textExtracted: null, textExtractedAt: null,
        },
      })
      await enqueueOutbox(tx, ctx.tenantId, 'upload.scan', { uploadId: record.id })
      return record
    })
  } catch (error) {
    await fs.unlink(filePath).catch(() => undefined)
    throw error
  }
  await logAction({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'file_uploaded',
    entityType: 'file_upload',
    entityId: upload.id,
    afterJson: { fileName: file.name, fileType: file.type, fileSizeKb, category, evidenceId },
    request: req,
  })

  return NextResponse.json({
    id: upload.id,
    fileName: upload.fileName,
    fileType: upload.fileType,
    fileSizeKb,
    checksum,
    category,
    evidenceId: upload.evidenceId,
    virusScanResult: upload.virusScanResult,
    virusScannedAt: upload.virusScannedAt,
    textExtracted: null,
    createdAt: upload.createdAt,
  }, { status: 201 })
})

// GET /api/uploads — list uploads for the tenant
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const searchParams = validatedSearch(req)
  const category = searchParams.get('category')
  const evidenceId = searchParams.get('evidenceId')

  const where: Prisma.FileUploadWhereInput = { tenantId: ctx.tenantId }
  if (category) where.category = category
  if (evidenceId) where.evidenceId = evidenceId

  const items = await db.fileUpload.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({
    items: items.map((u) => ({
      id: u.id,
      fileName: u.fileName,
      fileType: u.fileType,
      fileSizeKb: u.fileSizeKb,
      category: u.category,
      evidenceId: u.evidenceId,
      virusScanResult: u.virusScanResult,
      virusScannedAt: u.virusScannedAt,
      textExtractedPreview: u.virusScanResult === 'clean' && u.virusScannedAt ? u.textExtracted?.slice(0, 200) ?? null : null,
      createdAt: u.createdAt,
    })),
  })
})
