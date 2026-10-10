import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { spawnSync } from 'node:child_process'

export const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function requireRuntime(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number)
  if (major < 22 || (major === 22 && minor < 13)) throw new Error('Node.js 22.13 or newer is required (Node.js 24 recommended).')
}
export function loadEnvironment(root = workspaceRoot, env = process.env) {
  const values = {}
  for (const name of ['.env', '.env.local']) {
    const file = resolve(root, name)
    if (existsSync(file)) Object.assign(values, parseEnv(readFileSync(file, 'utf8')))
  }
  for (const [key, value] of Object.entries(values)) if (env[key] === undefined) env[key] = value
  return env
}
export function sqliteLocation(url, root = workspaceRoot) {
  if (!url?.startsWith('file:')) throw new Error('DATABASE_URL must be a SQLite file: URL')
  const [filename, query] = url.slice(5).split('?')
  if (!filename || filename === ':memory:') throw new Error('A persistent SQLite database path is required')
  const database = isAbsolute(filename) ? resolve(filename) : resolve(root, 'prisma', filename)
  return { database, url: `file:${database.replaceAll('\\', '/')}${query ? `?${query}` : ''}` }
}
export function runtimeEnvironment(root = workspaceRoot, env = process.env) {
  loadEnvironment(root, env)
  if (env.DATABASE_URL) env.DATABASE_URL = sqliteLocation(env.DATABASE_URL, root).url
  env.UPLOAD_DIR = resolve(root, env.UPLOAD_DIR || 'uploads')
  env.EXPORT_DIR = resolve(root, env.EXPORT_DIR || '.private/exports')
  return env
}
export function runNode(module, args = [], options = {}) {
  const result = spawnSync(process.execPath, [resolve(workspaceRoot, module), ...args], { cwd: workspaceRoot, env: process.env, stdio: 'inherit', windowsHide: true, ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${module} failed (${result.status ?? result.signal ?? 'unknown'})`)
}
export function generateClient() {
  runNode(process.platform === 'win32' ? 'scripts/generate-client-windows.mjs' : 'node_modules/prisma/build/index.js', process.platform === 'win32' ? [] : ['generate'])
}
