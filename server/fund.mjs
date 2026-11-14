export const SCHEME_CODE = 105758;
export function parseFund(payload) {
  const meta=payload?.meta, row=payload?.data?.[0];
  if (payload?.status !== 'SUCCESS' || meta?.scheme_code !== SCHEME_CODE || !/HDFC.*Mid.*Cap/i.test(meta.scheme_name) || !/Regular/i.test(meta.scheme_name) || !/Growth/i.test(meta.scheme_name)) throw new Error('Unexpected fund response');
  const [day,month,year]=(row?.date || '').split('-');
  const date=`${year}-${month}-${day}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Number(row?.nav)) || Number(row.nav)<=0 || new Date(date).toISOString().slice(0,10)!==date) throw new Error('Invalid NAV response');
  return { scheme_code: SCHEME_CODE, name: meta.scheme_name, nav: Number(row.nav), nav_date: date, source: 'MFapi (AMFI NAV data)', fetched_at: new Date().toISOString() };
}
export async function fetchFund() {
  const response=await fetch(`https://api.mfapi.in/mf/${SCHEME_CODE}/latest`,{signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!response.ok) throw new Error('NAV provider unavailable');
  return parseFund(await response.json());
}

export function parseFundHistory(payload) {
  // Reuse exact scheme and date/NAV validation; never accept Direct-plan data.
  if (!Array.isArray(payload?.data) || payload.data.length === 0) throw new Error('Missing NAV history');
  const points = payload.data.map(row => {
    const parsed = parseFund({ ...payload, data: [row] });
    return { date: parsed.nav_date, nav: parsed.nav };
  });
  const unique = new Map(points.map(point => [point.date, point]));
  return { scheme_code: SCHEME_CODE, points: [...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)), source: 'MFapi (AMFI NAV data)', fetched_at: new Date().toISOString() };
}
let historyCache;
export async function fetchFundHistory() {
  if (historyCache && Date.now() - historyCache.time < 300000) return historyCache.data;
  const response=await fetch(`https://api.mfapi.in/mf/${SCHEME_CODE}`,{signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!response.ok) throw new Error('NAV history provider unavailable');
  const data=parseFundHistory(await response.json());
  historyCache={time:Date.now(),data};
  return data;
}
