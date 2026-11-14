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
