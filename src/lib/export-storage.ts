import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, rename, unlink, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { resolve, join, relative, isAbsolute, sep } from 'node:path'
import { Readable } from 'node:stream'
import { csvRow } from './export-csv'

const MAX_BYTES = 100 * 1024 * 1024
const root = () => {
  const directory = resolve(process.env.EXPORT_DIR || join(process.cwd(), '.private', 'exports'))
  const publicRelative = relative(resolve(process.cwd(), 'public'), directory)
  const outsidePublic = publicRelative === '..' || publicRelative.startsWith('..' + sep) || isAbsolute(publicRelative)
  if (!outsidePublic) throw new Error('EXPORT_DIR must be outside the public directory')
  return directory
}
const pathFor = (id: string) => join(root(), createHash('sha256').update(id).digest('hex') + '.artifact')

/** The producer must yield bounded pages; no entire export is buffered in memory. */
export async function persistExport(id: string, format: 'json' | 'csv', records: AsyncIterable<Record<string, unknown>>) {
  await mkdir(root(), { recursive: true, mode: 0o700 })
  const target = pathFor(id)
  const temporary = target + '.' + randomUUID() + '.tmp'
  const file = await open(temporary, 'wx', 0o600)
  let bytes = 0
  let recordCount = 0
  let headers: string[] | undefined
  const write = async (text: string) => {
    const content = Buffer.from(text, 'utf8')
    bytes += content.length
    if (bytes > MAX_BYTES) throw new Error('Export exceeds the 100 MiB artifact limit; choose a smaller export type')
    await file.writeFile(content)
  }
  try {
    if (format === 'json') await write('[')
    for await (const record of records) {
      if (format === 'json') await write((recordCount ? ',' : '') + JSON.stringify(record))
      else {
        if (!headers) { headers = Object.keys(record); await write(csvRow(headers)) }
        if (Object.keys(record).some(key => !headers!.includes(key))) throw new Error('CSV export records have inconsistent columns')
        await write(csvRow(headers.map(key => record[key])))
      }
      recordCount++
    }
    if (format === 'json') await write(']')
    await file.sync()
    await file.close()
    await rename(temporary, target)
    return { recordCount, fileSizeKb: Math.ceil(bytes / 1024), bytes }
  } catch (error) {
    await file.close().catch(() => undefined)
    await unlink(temporary).catch(() => undefined)
    throw error
  }
}

export async function removeExportArtifact(id: string) {
  await unlink(pathFor(id)).catch(error => { if (error.code !== 'ENOENT') throw error })
}

export async function openExportArtifact(id: string) {
  const path = pathFor(id)
  const metadata = await stat(path)
  return { bytes: metadata.size, stream: Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array> }
}

export function exportDownloadStatus(record: { tenantId: string; status: string; expiresAt: Date | null } | null, tenantId: string, now = new Date()): number {
  if (!record || record.tenantId !== tenantId) return 404
  if (record.status !== 'completed') return 409
  if (!record.expiresAt || record.expiresAt <= now) return 410
  return 200
}
