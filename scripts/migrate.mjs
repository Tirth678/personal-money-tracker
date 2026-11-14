import { pool, database } from '../server/db.mjs';
import { readFile } from 'node:fs/promises';
let client;
try {
  client = await database().connect();
  // Prevent concurrent deployments from racing on CREATE/ALTER statements.
  await client.query("SELECT pg_advisory_lock(742139821)");
  for (const file of ['001_expenses.sql', '002_workspaces.sql', '003_investments.sql']) {
    await client.query(await readFile(new URL('../db/' + file, import.meta.url), 'utf8'));
    console.log('Migration applied: ' + file);
  }
} catch (e) {
  console.error('Migration failed:', e.code || 'UNKNOWN', 'Check database access, credentials, and schema permissions.');
  process.exitCode = 1;
} finally {
  if (client) {
    try { await client.query('ROLLBACK'); await client.query('SELECT pg_advisory_unlock(742139821)'); }
    finally { client.release(); }
  }
  await pool?.end();
}
