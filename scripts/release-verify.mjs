import { requireRuntime, runtimeEnvironment, runNode } from './runtime-helper.mjs'
try {
  requireRuntime()
  runtimeEnvironment()
  runNode('node_modules/typescript/bin/tsc', ['--noEmit', '--incremental', 'false'])
  runNode('node_modules/vitest/vitest.mjs', ['run', '--maxWorkers=2'])
  runNode('scripts/runtime.mjs', ['build'])
  runNode('scripts/release-workflow-smoke.mjs')
  runNode('scripts/platform-smoke.mjs')
  console.log('Release verification passed.')
} catch (error) { console.error('Release verification failed:', error.message); process.exitCode = 1 }
