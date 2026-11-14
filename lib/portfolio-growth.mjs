// All amounts from saved database records. No estimation of allotted units.
// Weekends/holidays carry the last published NAV with its date attached.
export function portfolioGrowth(investments, history) {
  if (!investments.length) return [];
  const entries = [...investments].sort((a,b)=>a.invested_on.localeCompare(b.invested_on));
  const navs = [...history].sort((a,b)=>a.date.localeCompare(b.date));
  const firstDate=entries[0].invested_on;
  const lastDate=[entries[entries.length-1].invested_on,navs.at(-1)?.date || firstDate].sort().at(-1);
  const dates=[...new Set([...entries.map(e=>e.invested_on),...navs.filter(p=>p.date>=firstDate && p.date<=lastDate).map(p=>p.date)])].sort();
  let entryIndex=0, navIndex=0, cost=0, units=0, missingUnits=false, nav=null;
  return dates.map(date=>{
    while(entryIndex<entries.length && entries[entryIndex].invested_on<=date) {
      const entry=entries[entryIndex++];cost+=Number(entry.amount_cents)/100;
      if(entry.units===null || entry.units===undefined || entry.units==='') missingUnits=true;
      else units+=Number(entry.units);
    }
    while(navIndex<navs.length && navs[navIndex].date<=date)nav=navs[navIndex++];
    const value=!missingUnits && nav ? units*nav.nav : null;
    return {date,cost,value,gain:value===null?null:value-cost,nav_date:nav?.date || null};
  });
}
export function filterGrowth(points, range) {
  if(range==='all' || !points.length)return points;
  const end=new Date(points[points.length-1].date+'T12:00:00Z');
  const start=new Date(end);
  const day=start.getUTCDate();start.setUTCDate(1);start.setUTCMonth(start.getUTCMonth()-Number(range));
  const lastDay=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
  start.setUTCDate(Math.min(day,lastDay));
  return points.filter(point=>point.date>=start.toISOString().slice(0,10));
}
