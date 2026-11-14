import express from 'express';
import { database } from './db.mjs';
import { expenseInput, toCents, workspaceId, workspaceInput } from './validation.mjs';
import { z } from 'zod';
import { createRealtime, rawSql } from '@neon/realtime/server';
const app = express();
app.disable('x-powered-by');
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(express.json({ limit: '10kb' }));
// No authentication by request: all visitors share this ledger.
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  if (!['GET', 'HEAD'].includes(req.method) && origin && new URL(origin).host !== req.get('host') && new URL(origin).host !== req.get('x-forwarded-host')) return res.status(403).json({ error: 'Cross-origin writes are not allowed.' });
  next();
});
app.get('/api/health', async (_req, res, next) => { try { await database().query('SELECT 1'); res.json({ database: 'connected', realtime: !!(process.env.NEON_REALTIME_URL && process.env.NEON_REALTIME_SECRET) }); } catch (e) { next(e); } });
app.get('/api/workspaces', async (_req, res, next) => {
  try { const { rows } = await database().query('SELECT id, name FROM workspaces ORDER BY created_at, id'); res.json({ workspaces: rows }); } catch(e) { next(e); }
});
app.post('/api/workspaces', async (req, res, next) => {
  try { const { name } = workspaceInput.parse(req.body); const { rows } = await database().query('INSERT INTO workspaces (name) VALUES ($1) RETURNING id, name', [name]); res.status(201).json(rows[0]); } catch(e) { next(e); }
});
app.get('/api/expenses', async (req, res, next) => {
  try { const workspace = workspaceId.parse(req.query.workspace_id); const { rows } = await database().query("SELECT id, amount_cents::text, category, note, to_char(spent_on, 'YYYY-MM-DD') AS spent_on, created_at FROM expenses WHERE workspace_id = $1 ORDER BY spent_on DESC, created_at DESC", [workspace]); res.json({ expenses: rows }); } catch (e) { next(e); }
});
app.post('/api/expenses', async (req, res, next) => {
  try {
    const input = expenseInput.parse(req.body);
    const workspace = workspaceId.parse(req.query.workspace_id);
    const { rows } = await database().query('INSERT INTO expenses (amount_cents, category, note, spent_on, workspace_id) VALUES ($1,$2,$3,$4,$5) RETURNING id', [toCents(input.amount), input.category, input.note, input.spent_on, workspace]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});
app.delete('/api/expenses/:id', async (req, res, next) => {
  try { const id = z.uuid().parse(req.params.id); const workspace = workspaceId.parse(req.query.workspace_id); const result = await database().query('DELETE FROM expenses WHERE id = $1 AND workspace_id = $2 RETURNING id', [id, workspace]); if (!result.rowCount) return res.status(404).json({ error: 'Entry not found.' }); res.status(204).end(); } catch (e) { next(e); }
});
// Neon subscribes on the trusted server; SSE forwards change signals, not credentials.
app.get('/api/events', async (req, res, next) => {
  if (!process.env.NEON_REALTIME_URL || !process.env.NEON_REALTIME_SECRET) return res.status(503).json({ error: 'Neon Realtime is not configured.' });
  let realtime;
  let heartbeat;
  const cleanup = () => { clearInterval(heartbeat); clearTimeout(deadline); realtime?.close(); };
  const deadline = setTimeout(() => { cleanup(); if (!res.headersSent) res.status(504).json({ error: 'Live connection timed out. Retrying.' }); else res.end(); }, 50000);
  res.once('close', cleanup);
  try {
    const workspace = workspaceId.parse(req.query.workspace_id);
    realtime = createRealtime({ url: process.env.NEON_REALTIME_URL, secret: process.env.NEON_REALTIME_SECRET, db: new URL(process.env.DATABASE_URL).pathname.slice(1) });
    const sub = await realtime.subscribe(rawSql('SELECT id, amount_cents, category, note, spent_on, created_at FROM expenses WHERE workspace_id = $1', [workspace]));
    if (res.destroyed || res.writableEnded) { realtime.close(); return; }
    res.set({ 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' }); res.flushHeaders();
    res.write('event: ready\ndata: {}\n\n');
    sub.onChange(() => { if (!res.writableEnded && !res.destroyed) res.write('event: change\ndata: {}\n\n'); });
    sub.onStateChange((state) => { if (state === 'error') res.end(); });
    heartbeat = setInterval(() => res.write(': keepalive\n\n'), 20000);
  } catch (e) { cleanup(); if (res.writableEnded || res.destroyed) return; if (!res.headersSent) next(e); else res.end(); }
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0].message });
  if (err.code === '23503') return res.status(404).json({ error: 'Workspace not found.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  console.error(err.message);
  res.status(err.status || 503).json({ error: err.status === 503 ? err.message : 'Database request failed. Check the database connection and migration.' });
});
export default app;
