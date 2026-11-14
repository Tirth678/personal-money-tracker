import { pool, database } from '../server/db.mjs';
import { readFile } from 'node:fs/promises';
try { for (const file of ['001_expenses.sql', '002_workspaces.sql']) { await database().query(await readFile(new URL('../db/' + file, import.meta.url), 'utf8')); console.log('Migration applied: ' + file); } }
catch (e) { console.error(e.message); process.exitCode = 1; }
finally { await pool?.end(); }
