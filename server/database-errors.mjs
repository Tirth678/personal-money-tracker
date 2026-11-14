// Only return curated messages: raw driver errors can contain connection details.
export function databaseError(error) {
  if (error.code === 'DB_NOT_CONFIGURED') return { code: 'DB_NOT_CONFIGURED', error: 'DATABASE_URL is missing. Add it to this Vercel deployment environment and redeploy.' };
  if (['42P01', '42703'].includes(error.code)) return { code: 'DB_SCHEMA_MISSING', error: 'Postgres is reachable, but the database schema is missing or outdated. Apply the database migrations and redeploy.' };
  if (['28P01', '28000'].includes(error.code)) return { code: 'DB_AUTH_FAILED', error: 'Postgres rejected the database credentials. Update DATABASE_URL and redeploy.' };
  if (error.code === '42501') return { code: 'DB_PERMISSION_DENIED', error: 'The database role does not have permission to access the tracker tables.' };
  return { code: 'DB_UNAVAILABLE', error: 'The database request failed. Check the database endpoint and server logs.' };
}
