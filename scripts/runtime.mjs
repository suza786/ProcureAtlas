import { cp, access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { requireRuntime, runtimeEnvironment, workspaceRoot, runNode, generateClient } from './runtime-helper.mjs'

try {
  requireRuntime()
  runtimeEnvironment()
  const command = process.argv[2]
  const args = process.argv.slice(3)
  if (command === 'generate') generateClient()
  else if (command === 'build') {
    generateClient()
    runNode('node_modules/next/dist/bin/next', ['build', ...args])
    const standalone = resolve(workspaceRoot, '.next/standalone')
    await access(resolve(standalone, 'server.js'))
    await cp(resolve(workspaceRoot, '.next/static'), resolve(standalone, '.next/static'), { recursive: true })
    await cp(resolve(workspaceRoot, 'public'), resolve(standalone, 'public'), { recursive: true })
  } else if (command === 'start') {
    process.env.NODE_ENV = 'production'
    runNode('.next/standalone/server.js', args, { cwd: resolve(workspaceRoot, '.next/standalone') })
  } else if (command === 'dev') runNode('node_modules/next/dist/bin/next', ['dev', '-p', '3000', ...args])
  else throw new Error('Expected runtime command: dev, build, start, or generate')
} catch (error) { console.error(error.message); process.exitCode = 1 }
