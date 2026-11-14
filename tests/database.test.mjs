import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { databaseError } from '../server/database-errors.mjs';

test('database errors distinguish schema/auth/config failures without exposing secrets', () => {
  for (const [code, expected] of [['42P01','DB_SCHEMA_MISSING'],['42703','DB_SCHEMA_MISSING'],['28P01','DB_AUTH_FAILED'],['DB_NOT_CONFIGURED','DB_NOT_CONFIGURED'],['42501','DB_PERMISSION_DENIED'],['ECONNRESET','DB_UNAVAILABLE']]) {
    const result=databaseError({code,message:'secret credentials'});
    assert.equal(result.code,expected); assert(!JSON.stringify(result).includes('secret credentials'));
  }
});

test('actual SQL migrations preserve old entries, rerun safely, and isolate workspaces', async () => {
  // Embedded PostgreSQL only for testing SQL; never used by the running app.
  const db = new PGlite();
  try {
    const first=await readFile(new URL('../db/001_expenses.sql',import.meta.url),'utf8');
    const second=await readFile(new URL('../db/002_workspaces.sql',import.meta.url),'utf8');
    await db.exec(first);
    await db.query("INSERT INTO expenses(amount_cents, category, note) VALUES (12345,'food','Existing expense')");
    await db.exec(second);
    await db.exec(first); await db.exec(second);
    const personal='00000000-0000-4000-8000-000000000001';
    const old=await db.query('SELECT amount_cents, workspace_id FROM expenses');
    assert.equal(String(old.rows[0].amount_cents),'12345'); assert.equal(old.rows[0].workspace_id,personal);
    const space=await db.query("INSERT INTO workspaces(name) VALUES ('Travel') RETURNING id");
    const id=space.rows[0].id;
    const expense=await db.query("INSERT INTO expenses(amount_cents,category,workspace_id) VALUES (100,'tech',$1) RETURNING id",[id]);
    const rows=await db.query('SELECT * FROM expenses WHERE workspace_id=$1',[id]);assert.equal(rows.rows.length,1);
    const wrong=await db.query('DELETE FROM expenses WHERE id=$1 AND workspace_id=$2 RETURNING id',[expense.rows[0].id,personal]);assert.equal(wrong.rows.length,0);
    const deleted=await db.query('DELETE FROM expenses WHERE id=$1 AND workspace_id=$2 RETURNING id',[expense.rows[0].id,id]);assert.equal(deleted.rows.length,1);
    await db.query('SELECT id,name FROM workspaces LIMIT 0');
    await db.query('SELECT id,amount_cents,category,note,spent_on,created_at,workspace_id FROM expenses LIMIT 0');
  } finally { await db.close(); }
});
