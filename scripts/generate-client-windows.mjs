// Reuse the installed engine under a distinct name when a dev server locks its DLL.
// Generated runtime files still use the installed engine of the same version.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
const root = process.cwd()
const engine = path.join(root, 'node_modules', '@prisma', 'engines', 'query_engine-windows.dll.node')
const temporary = path.join(root, 'scripts', 'query_engine-windows-generation.dll.node')
if (process.platform !== 'win32') throw new Error('This helper is Windows-only')
try {
  fs.copyFileSync(engine, temporary)
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'generate'], { cwd: root, env: { ...process.env, PRISMA_QUERY_ENGINE_LIBRARY: temporary }, stdio: 'inherit', windowsHide: true })
  process.exitCode = result.status ?? 1
} finally {
  if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
}
