import test from 'node:test';
import assert from 'node:assert/strict';
import { expenseInput, toCents } from '../server/validation.mjs';
const base = {amount:'12.50',category:'food',spent_on:'2026-11-14',note:'Lunch'};
test('accepts all six categories', () => { for (const category of ['unknown','food','waste','needs','tech','self']) assert.equal(expenseInput.parse({...base,category}).category,category); });
test('converts decimal rupees to exact integer cents', () => { assert.equal(toCents('12.50'),1250); assert.equal(toCents('0.01'),1); assert.equal(toCents('100'),10000); assert.equal(toCents('1.1'),110); });
test('rejects zero, negative, excess precision and invalid categories', () => { for (const amount of ['0','-2','1.999','Infinity','1e3','1000000000']) assert.equal(expenseInput.safeParse({...base,amount}).success,false); assert.equal(expenseInput.safeParse({...base,category:'invalid'}).success,false); });
test('rejects invalid calendar dates and long notes', () => { for (const spent_on of ['2026-02-30','2026-13-01','not a date']) assert.equal(expenseInput.safeParse({...base,spent_on}).success,false); assert.equal(expenseInput.safeParse({...base,note:'x'.repeat(161)}).success,false); });

test('workspace names are trimmed and validated', async () => {
  const { workspaceInput } = await import('../server/validation.mjs');
  assert.equal(workspaceInput.parse({name:'  Travel  '}).name,'Travel');
  for (const name of ['', '   ', 'x'.repeat(61)]) assert.equal(workspaceInput.safeParse({name}).success,false);
});
test('workspace selection validates UUID and defaults to Personal', async () => {
  const { workspaceId, DEFAULT_WORKSPACE } = await import('../server/validation.mjs');
  assert.equal(workspaceId.parse(undefined), DEFAULT_WORKSPACE);
  assert.equal(workspaceId.parse('00000000-0000-4000-8000-000000000002'),'00000000-0000-4000-8000-000000000002');
  for (const id of ['', 'not-a-uuid', ['bad']]) assert.equal(workspaceId.safeParse(id).success,false);
});
