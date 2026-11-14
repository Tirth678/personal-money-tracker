import dotenv from 'dotenv';
import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });
export const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 }) : null;
if (pool && process.env.VERCEL) attachDatabasePool(pool);
pool?.on('error', (err) => console.error('Database pool:', err.message));
export function database() {
  if (!pool) { const e = new Error('Database is not connected. Configure DATABASE_URL and run npm run migrate.'); e.status = 503; throw e; }
  return pool;
}
