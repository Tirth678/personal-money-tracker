// Start `npm start` first. These checks exercise the Next -> Express bridge
// without requiring a working database or creating any production records.
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://localhost:3000';
const checks = [
  ['homepage', '/', {}, 200],
  ['workspace body validation', '/api/workspaces', {method:'POST',headers:{'Content-Type':'application/json'},body:'{"name":" "}'},400],
  ['expense body validation', '/api/expenses', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:'0',category:'food',spent_on:'2026-11-14'})},400],
  ['workspace query validation', '/api/expenses?workspace_id=bad', {},400],
  ['delete ID validation', '/api/expenses/bad', {method:'DELETE'},400],
  ['investment workspace validation', '/api/investments?workspace_id=bad', {},400],
  ['investment amount validation', '/api/investments', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:'0',invested_on:'2025-01-15',kind:'contribution'})},400],
  ['investment future date rejection', '/api/investments', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:'100',invested_on:'2999-01-15',kind:'opening'})},400],
  ['investment delete ID validation', '/api/investments/bad', {method:'DELETE'},400],
  ['investment edit ID validation', '/api/investments/bad', {method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'},400],
  ['unknown API route', '/api/does-not-exist', {},404],
  ['JSON parser', '/api/expenses', {method:'POST',headers:{'Content-Type':'application/json'},body:'{'},400],
  ['cross-origin write rejection', '/api/workspaces', {method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:'{"name":"Test"}'},403],
];
for (const [label,path,init,status] of checks) {
  const response = await fetch(base+path,{...init,signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,status,label);
  if(path.startsWith('/api/')) assert.equal(response.headers.get('cache-control'),'no-store',label+' cache control');
  console.log(`PASS ${label} (${status})`);
}
