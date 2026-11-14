// Runs against the actual Express server and database. No mock or fallback.
import assert from 'node:assert/strict';
import { database, pool } from '../server/db.mjs';
const base = process.env.TEST_URL || 'http://localhost:3000';
let id; let workspace; let query = '';
try {
  const health = await fetch(`${base}/api/health`); assert.equal(health.status,200,'Database must be connected');
  console.log('PASS database health');
  const spaceResponse = await fetch(`${base}/api/workspaces`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'E2E temporary workspace'})});
  assert.equal(spaceResponse.status,201); workspace=(await spaceResponse.json()).id; query=`?workspace_id=${workspace}`;
  const spaces = await (await fetch(`${base}/api/workspaces`)).json(); assert(spaces.workspaces.some(w=>w.id===workspace)); console.log('PASS create and list workspaces');
  const create = await fetch(`${base}/api/expenses${query}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:'123.45',category:'tech',note:'E2E persistence check',spent_on:'2026-11-14'})});
  assert.equal(create.status,201); id=(await create.json()).id; console.log('PASS create expense');
  const read = await (await fetch(`${base}/api/expenses${query}`)).json(); const entry=read.expenses.find(e=>e.id===id); assert.equal(entry.amount_cents,'12345'); console.log('PASS read persisted expense');
  const secondRead = await (await fetch(`${base}/api/expenses${query}`)).json(); assert(secondRead.expenses.some(e=>e.id===id)); console.log('PASS separate request persistence');
  const personal = await (await fetch(`${base}/api/expenses`)).json(); assert(!personal.expenses.some(e=>e.id===id));
  const wrongDelete = await fetch(`${base}/api/expenses/${id}`,{method:'DELETE'}); assert.equal(wrongDelete.status,404); console.log('PASS workspace read and delete isolation');
  const events = await fetch(`${base}/api/events${query}`,{signal:AbortSignal.timeout(15000)}); assert.equal(events.status,200,'Neon Realtime must be configured');
  const reader=events.body.getReader(); const first=await reader.read(); assert(new TextDecoder().decode(first.value).includes('event: ready')); console.log('PASS Neon Realtime subscription');
  const deletion = await fetch(`${base}/api/expenses/${id}${query}`,{method:'DELETE'}); assert.equal(deletion.status,204); const remaining = await (await fetch(`${base}/api/expenses${query}`)).json(); assert(!remaining.expenses.some(e=>e.id===id)); console.log('PASS database deletion'); id=null;
  let sawChange=false; const until=Date.now()+10000; while(Date.now()<until) { const chunk=await reader.read(); if(chunk.done) break; if(new TextDecoder().decode(chunk.value).includes('event: change')) {sawChange=true;break;} } await reader.cancel(); assert(sawChange,'Realtime must observe a change'); console.log('PASS realtime change notification');
} catch(e) { console.error('FAIL',e.message); process.exitCode=1; }
finally { try { if(id) await fetch(`${base}/api/expenses/${id}${query}`,{method:'DELETE'}); if(workspace) await database().query('DELETE FROM workspaces WHERE id = $1',[workspace]); } finally { await pool?.end(); } }
