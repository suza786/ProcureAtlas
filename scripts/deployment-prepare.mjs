import { requireRuntime, runNode } from './runtime-helper.mjs'
try {
  requireRuntime()
  runNode('scripts/release-verify.mjs')
  runNode('scripts/database-deploy.mjs', process.argv.slice(2))
  console.log('Deployment preparation passed. No application server was started.')
} catch (error) { console.error('Deployment preparation failed:', error.message); process.exitCode = 1 }
