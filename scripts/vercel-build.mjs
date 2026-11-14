import { spawnSync } from 'node:child_process';
function run(script) {
  const result = spawnSync('npm', ['run', script], { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) { console.error(`Deployment stopped: ${script} failed.`); process.exit(result.status || 1); }
}
// Provision the existing schema before publishing a working production UI.
// No runtime request performs DDL and no credentials are bundled in the UI.
if (process.env.DATABASE_URL) run('migrate');
else if (process.env.VERCEL_ENV === 'production') {
  console.error('Deployment stopped: DATABASE_URL is required for production.');
  process.exit(1);
} else console.warn('No DATABASE_URL: building a disconnected preview.');
run('build');
