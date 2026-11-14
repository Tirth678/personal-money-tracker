import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSpending, spendingTarget } from '../lib/spending.mjs';
const expense={id:'e1',amount_cents:'10000',category:'food',note:'Lunch',spent_on:'2026-11-01',created_at:'2026-11-01T12:00:00Z'};
const contribution={id:'i1',amount_cents:'250000',kind:'contribution',invested_on:'2026-11-02',note:''};
const opening={...contribution,id:'i2',amount_cents:'1000000',kind:'opening'};
test('current spending includes contribution cost once, not market value or opening balances',()=>{
  const rows=mergeSpending([expense],[contribution,opening]);
  assert.equal(rows.length,2);assert.equal(rows.reduce((sum,row)=>sum+Number(row.amount_cents),0),260000);
  assert.equal(rows[0].category,'investment');assert.equal(rows[0].id,'investment:i1');
  assert.equal(mergeSpending([expense],[contribution,opening]).length,2);
});
test('contributions follow their investment month and edits/deletes recalculate from DB rows',()=>{
  const past={...contribution,invested_on:'2026-10-01'};
  const rows=mergeSpending([expense],[past]);
  assert.equal(rows.filter(row=>row.spent_on.startsWith('2026-11')).reduce((n,row)=>n+Number(row.amount_cents),0),10000);
  assert.equal(mergeSpending([expense],[{...contribution,amount_cents:'50000'}]).reduce((n,row)=>n+Number(row.amount_cents),0),60000);
  assert.equal(mergeSpending([expense],[]).length,1);
  assert.equal(spendingTarget('investment:i1'),'/api/investments/i1');
  assert.equal(spendingTarget('e1'),'/api/expenses/e1');
});
