// Bundle internal TypeScript imports and aliases, leaving installed dependencies external.
import { build } from 'esbuild'
import { mkdir, unlink } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
const directory = resolve('.worker')
await mkdir(directory, { recursive: true })
const bundle = resolve(directory, `worker-${process.pid}.cjs`)
await build({ entryPoints: ['scripts/worker-entry.ts'], outfile: bundle, bundle: true, platform: 'node', format: 'cjs', packages: 'external', sourcemap: true, tsconfig: 'tsconfig.json' })
const child = spawn(process.execPath, ['--env-file-if-exists=.env', '--env-file-if-exists=.env.local', bundle, ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', async code => { await Promise.allSettled([unlink(bundle), unlink(`${bundle}.map`)]); process.exit(code ?? 1) })
