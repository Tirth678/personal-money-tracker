import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { investmentInput } from '../server/validation.mjs';
import { parseFund } from '../server/fund.mjs';
const valid={amount:'2500.50',invested_on:'2025-01-15',kind:'contribution'};
test('investment input accepts backdated and previous holdings with optional actual units',()=>{
  assert.equal(investmentInput.parse(valid).invested_on,'2025-01-15');
  assert.equal(investmentInput.parse({...valid,kind:'opening',units:'123.12345678'}).units,'123.12345678');
  for(const patch of [{amount:'0'},{amount:'-1'},{units:'0'},{units:'-1'},{units:'NaN'},{units:'1.123456789'},{invested_on:'2025-02-30'},{invested_on:'2999-01-01'},{kind:'withdrawal'}]) assert.equal(investmentInput.safeParse({...valid,...patch}).success,false);
});
const sample={status:'SUCCESS',meta:{scheme_code:105758,scheme_name:'HDFC Mid Cap Fund - Regular Plan - Growth Option'},data:[{date:'13-11-2026',nav:'206.92800'}]};
test('NAV parser checks exact scheme and publishes dated values without substituting direct plan',()=>{
  const parsed=parseFund(sample);assert.equal(parsed.nav,206.928);assert.equal(parsed.nav_date,'2026-11-13');
  for(const payload of [{...sample,status:'FAILURE'},{...sample,meta:{...sample.meta,scheme_code:118989}},{...sample,meta:{...sample.meta,scheme_name:'HDFC Mid Cap Fund Direct Growth'}},{...sample,data:[{date:'13-11-2026',nav:'NaN'}]},{...sample,data:[{date:'31-02-2026',nav:'10'}]}]) assert.throws(()=>parseFund(payload));
});
test('investment migrations retain expense months, persist past contributions, and enforce workspace scoping',async()=>{
  const db=new PGlite();try{
    for(const f of ['001_expenses.sql','002_workspaces.sql','003_investments.sql'])await db.exec(await readFile(new URL('../db/'+f,import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../db/003_investments.sql',import.meta.url),'utf8'));
    const personal='00000000-0000-4000-8000-000000000001';
    const other=(await db.query("INSERT INTO workspaces(name) VALUES ('Travel') RETURNING id")).rows[0].id;
    await db.query("INSERT INTO expenses(workspace_id,amount_cents,category,spent_on) VALUES ($1,10000,'food','2025-01-01'),($1,20000,'food','2025-02-01')",[personal]);
    const amounts=await db.query('SELECT sum(amount_cents)::text AS total FROM expenses WHERE workspace_id=$1',[personal]);assert.equal(amounts.rows[0].total,'30000');
    assert.equal((await db.query("SELECT * FROM expenses WHERE workspace_id=$1 AND spent_on>='2025-01-01' AND spent_on<'2025-02-01'",[personal])).rows.length,1);
    const row=(await db.query("INSERT INTO investments(workspace_id,amount_cents,invested_on,kind,units,unit_source) VALUES ($1,250050,'2025-01-15','contribution',12.12,'statement') RETURNING id,units::text",[personal])).rows[0];assert.equal(Number(row.units),12.12);
    await db.query("INSERT INTO investments(workspace_id,amount_cents,invested_on,kind,unit_source) VALUES ($1,1000000,'2024-12-01','opening','unavailable')",[personal]);
    assert.equal((await db.query('SELECT * FROM investments WHERE workspace_id=$1',[personal])).rows.length,2);
    assert.equal((await db.query('SELECT * FROM investments WHERE workspace_id=$1',[other])).rows.length,0);
    assert.equal((await db.query('DELETE FROM investments WHERE id=$1 AND workspace_id=$2 RETURNING id',[row.id,other])).rows.length,0);
    assert.equal((await db.query('DELETE FROM investments WHERE id=$1 AND workspace_id=$2 RETURNING id',[row.id,personal])).rows.length,1);
    await assert.rejects(db.query("INSERT INTO investments(workspace_id,amount_cents,invested_on,kind,unit_source,units) VALUES ($1,100,'2025-01-01','contribution','unavailable',10)",[personal]));
  }finally{await db.close();}
});

test('fund fetch uses the fixed regular-growth endpoint and handles upstream failures',async()=>{
  const {fetchFund}=await import('../server/fund.mjs');
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async(url)=>{assert.equal(url,'https://api.mfapi.in/mf/105758/latest');return {ok:true,json:async()=>sample};};
    assert.equal((await fetchFund()).scheme_code,105758);
    globalThis.fetch=async()=>({ok:false});await assert.rejects(fetchFund());
    globalThis.fetch=async()=>{throw new Error('network down');};await assert.rejects(fetchFund());
  }finally{globalThis.fetch=original;}
});
