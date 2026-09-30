import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenant } from '@/lib/tenant'
import { logAction } from '@/lib/auth'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

// POST /api/uploads — upload a file (evidence, tender doc, bid doc)
// Phase 2 dev: stores to local filesystem under /home/z/my-project/uploads/{tenantId}/...
// Phase 2 prod: will use S3-compatible object store with signed URLs.
export async function POST(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const category = (formData.get('category') as string) ?? 'evidence'
  const evidenceId = formData.get('evidenceId') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // File-type validation (whitelist)
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]
  const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.txt', '.docx', '.xlsx']

  const fileName = file.name.toLowerCase()
  const extOk = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext))
  if (!ALLOWED_TYPES.includes(file.type) || !extOk) {
    return NextResponse.json({
      error: `File type ${file.type || 'unknown'} not allowed. Allowed: PDF, PNG, JPG, TXT, DOCX, XLSX.`,
    }, { status: 400 })
  }

  // Size limit: 25 MB
  const MAX_SIZE = 25 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File exceeds 25 MB limit.' }, { status: 400 })
  }

  // Read file buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex')
  const fileSizeKb = Math.ceil(buffer.length / 1024)

  // Storage path (dev: local FS)
  const uploadDir = path.join('/home/z/my-project/uploads', ctx.tenantId, category)
  await fs.mkdir(uploadDir, { recursive: true })
  const fileId = crypto.randomBytes(8).toString('hex')
  const storedFileName = `${fileId}-${file.name.replace(/[^a-zA-Z0-9.\-]/g, '_')}`
  const filePath = path.join(uploadDir, storedFileName)
  await fs.writeFile(filePath, buffer)

  const storageKey = `${ctx.tenantId}/${category}/${storedFileName}`

  // Extract text for simple text files (Phase 2: PDF extraction would use pdf-parse)
  let textExtracted: string | null = null
  if (file.type === 'text/plain') {
    textExtracted = buffer.toString('utf-8').slice(0, 64000)
  } else if (file.type === 'application/pdf') {
    // Phase 2 dev: placeholder text. Production: use pdf-parse or vision fallback.
    textExtracted = `[PDF binary — text extraction pending. File: ${file.name}, size: ${fileSizeKb}KB, checksum: ${checksum.slice(0, 16)}...]`
  }

  const upload = await db.fileUpload.create({
    data: {
      tenantId: ctx.tenantId,
      uploadedById: ctx.userId,
      fileName: file.name,
      fileType: file.type,
      fileSizeKb,
      checksum,
      storageKey,
      storageUrl: filePath,
      category,
      evidenceId: evidenceId ?? null,
      virusScanResult: 'clean', // Phase 2 dev: skip actual virus scan. Production: ClamAV or S3 scan.
      textExtracted,
      textExtractedAt: textExtracted ? new Date() : null,
    },
  })

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
    textExtracted: textExtracted?.slice(0, 500),
    createdAt: upload.createdAt,
  }, { status: 201 })
}

// GET /api/uploads — list uploads for the tenant
export async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const evidenceId = searchParams.get('evidenceId')

  const where: Record<string, unknown> = { tenantId: ctx.tenantId }
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
      textExtractedPreview: u.textExtracted?.slice(0, 200) ?? null,
      createdAt: u.createdAt,
    })),
  })
}
