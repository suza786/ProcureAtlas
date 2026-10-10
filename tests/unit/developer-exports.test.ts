import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
vi.mock('@/lib/db', () => ({ db: {} }))
import { csvCell, csvRow } from '@/lib/export-csv'
import { cursorRecords } from '@/lib/export-records'
import { developerRequest } from '@/lib/developer-request'
import { exportDownloadStatus, openExportArtifact, persistExport } from '@/lib/export-storage'

let directory: string | undefined
afterEach(async () => {
  vi.unstubAllEnvs()
  if (directory) await rm(directory, { recursive: true, force: true })
  directory = undefined
})
async function* rows() { yield { id: 'one', title: 'ঢাকা\n"quoted"', nested: { a: 'x,y' } }; yield { id: 'two', title: '=SUM(1,2)', nested: null } }
async function setup() {
  directory = await mkdtemp(join(tmpdir(), 'procure-exports-'))
  vi.stubEnv('EXPORT_DIR', directory)
}

describe('real developer requests', () => {
  it('requires a full key and real IDs', () => {
    expect(() => developerRequest({ method: 'GET', path: '/api/v1/tenders' }, '', '', '', '')).toThrow('API key')
    expect(() => developerRequest({ method: 'GET', path: '/api/v1/tenders/:id' }, 'pak_real', '', '', '')).toThrow('real entity ID')
  })
  it('uses bearer authorization, selected method/body, and encoded IDs', () => {
    const result = developerRequest({ method: 'POST', path: '/api/v1/embeddings' }, 'Bearer pak_secret', '', '', '{"texts":["hi"]}')
    expect(result.init).toMatchObject({ method: 'POST', body: '{"texts":["hi"]}', credentials: 'omit', headers: { Authorization: 'Bearer pak_secret' } })
    expect(developerRequest({ method: 'GET', path: '/api/v1/tenders/:id' }, 'pak_real', 'a/b', 'q=a&limit=5', '').url).toBe('/api/v1/tenders/a%2Fb?q=a&limit=5')
    expect(() => developerRequest({ method: 'POST', path: '/api/v1/exports' }, 'pak_real', '', '', '[]')).toThrow('JSON object')
  })
})

describe('export artifacts', () => {
  it.each(['exports', '..exports'])('rejects public artifact directories including %s', async folder => {
    vi.stubEnv('EXPORT_DIR', join(process.cwd(), 'public', folder))
    await expect(persistExport('unsafe', 'json', rows())).rejects.toThrow('outside the public directory')
  })
  it('quotes headers, multiline cells and nested objects and mitigates formulas', () => {
    expect(csvRow(['x,y', 'a"b'])).toBe('"x,y","a""b"\r\n')
    expect(csvCell({ x: 'a,b\nc' })).toBe('"{""x"":""a,b\\nc""}"')
    expect(csvCell(' \t=1+1')).toBe('"\' \t=1+1"')
    expect(csvCell(-12)).toBe('"-12"')
  })
  it('persists exact UTF-8 JSON and serves it on a later read', async () => {
    await setup()
    const result = await persistExport('../../unsafe-id', 'json', rows())
    const artifact = await openExportArtifact('../../unsafe-id')
    const body = await new Response(artifact.stream).text()
    expect(JSON.parse(body)).toHaveLength(2)
    expect(body).toContain('ঢাকা')
    expect(artifact.bytes).toBe(Buffer.byteLength(body))
    expect(result.recordCount).toBe(2)
    expect(await readdir(directory!)).toHaveLength(1)
  })
  it('cleans incomplete files when a producer fails', async () => {
    await setup()
    async function* failing() { yield { id: 'one' }; throw new Error('database unavailable') }
    await expect(persistExport('failed', 'json', failing())).rejects.toThrow('database unavailable')
    expect(await readdir(directory!)).toEqual([])
  })
  it('does not truncate after the first page', async () => {
    const fetch = vi.fn().mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]).mockResolvedValueOnce([{ id: 'c' }]).mockResolvedValueOnce([])
    const ids: string[] = []
    for await (const record of cursorRecords(fetch)) ids.push(record.id)
    expect(ids).toEqual(['a', 'b', 'c'])
    expect(fetch.mock.calls).toEqual([[undefined], ['b'], ['c']])
  })
  it('rejects cross tenant, incomplete, missing expiry and expired downloads', () => {
    const valid = { tenantId: 'a', status: 'completed', expiresAt: new Date('2030-01-01') }
    expect(exportDownloadStatus(valid, 'a', new Date('2029-01-01'))).toBe(200)
    expect(exportDownloadStatus(valid, 'b')).toBe(404)
    expect(exportDownloadStatus(null, 'a')).toBe(404)
    expect(exportDownloadStatus({ ...valid, status: 'processing' }, 'a')).toBe(409)
    expect(exportDownloadStatus({ ...valid, expiresAt: null }, 'a')).toBe(410)
    expect(exportDownloadStatus(valid, 'a', valid.expiresAt)).toBe(410)
  })
})
