import test from 'node:test';
import assert from 'node:assert/strict';
import { portfolioGrowth, filterGrowth } from '../lib/portfolio-growth.mjs';
import { parseFundHistory } from '../server/fund.mjs';
const entry=(date,cost,units)=>({invested_on:date,amount_cents:String(cost),units});
const history=[{date:'2026-01-01',nav:100},{date:'2026-01-02',nav:110},{date:'2026-01-05',nav:90}];
test('growth uses units held on each date, not latest NAV or future contributions',()=>{
  const points=portfolioGrowth([entry('2026-01-01',100000,'10'),entry('2026-01-05',45000,'5')],history);
  assert.deepEqual(points.map(p=>[p.date,p.cost,p.value,p.gain]),[
    ['2026-01-01',1000,1000,0],['2026-01-02',1000,1100,100],['2026-01-05',1450,1350,-100]
  ]);
});
test('weekends use dated previous NAV and never invent a pre-inception price',()=>{
  const points=portfolioGrowth([entry('2025-12-31',100000,'10'),entry('2026-01-03',11000,'1')],history);
  assert.equal(points[0].value,null);assert.equal(points[0].nav_date,null);
  const saturday=points.find(p=>p.date==='2026-01-03');assert.equal(saturday.value,1210);assert.equal(saturday.nav_date,'2026-01-02');
});
test('missing units leave value unavailable from that entry onward; cost is always tracked',()=>{
  const points=portfolioGrowth([entry('2026-01-01',100000,'10'),entry('2026-01-02',20000,null)],history);
  assert.equal(points[0].value,1000);assert.equal(points[1].value,null);assert.equal(points.at(-1).cost,1200);assert.equal(points.at(-1).gain,null);
  assert.equal(portfolioGrowth([entry('2026-01-01',100000,'10')],[])[0].value,null);
  assert.deepEqual(portfolioGrowth([],history),[]);
});
test('opening holdings start on their recorded date, edits and deletions recompute the curve',()=>{
  const first={...entry('2026-01-02',100000,'10'),kind:'opening'};
  const points=portfolioGrowth([first],history);assert.equal(points[0].date,'2026-01-02');assert.equal(points[0].cost,1000);
  assert.equal(portfolioGrowth([{...first,units:'20'}],history)[0].value,2200);
  assert.deepEqual(portfolioGrowth([],history),[]);
});
test('range filter uses latest recorded date and preserves cumulative values',()=>{
  const points=portfolioGrowth([entry('2025-01-01',100000,'10')],[{date:'2025-01-01',nav:100},{date:'2026-01-01',nav:120}]);
  assert.equal(filterGrowth(points,'all').length,2);assert.equal(filterGrowth(points,'1').length,1);assert.equal(filterGrowth(points,'1')[0].cost,1000);
});
test('history parser validates regular growth, dates and NAV then sorts and deduplicates',()=>{
  const payload={status:'SUCCESS',meta:{scheme_code:105758,scheme_name:'HDFC Mid Cap Fund Regular Growth'},data:[{date:'02-01-2026',nav:'110'},{date:'01-01-2026',nav:'100'},{date:'01-01-2026',nav:'100'}]};
  assert.deepEqual(parseFundHistory(payload).points,[{date:'2026-01-01',nav:100},{date:'2026-01-02',nav:110}]);
  assert.throws(()=>parseFundHistory({...payload,data:[]}));
  assert.throws(()=>parseFundHistory({...payload,meta:{...payload.meta,scheme_code:118989}}));
  assert.throws(()=>parseFundHistory({...payload,data:[{date:'31-02-2026',nav:'100'}]}));
});
test('one-month range clamps month-end to February rather than rolling into March',()=>{
  const points=[{date:'2026-02-27'},{date:'2026-02-28'},{date:'2026-03-31'}];
  assert.deepEqual(filterGrowth(points,'1').map(p=>p.date),['2026-02-28','2026-03-31']);
});
