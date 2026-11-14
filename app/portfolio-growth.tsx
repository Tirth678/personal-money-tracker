'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { filterGrowth, portfolioGrowth } from '../lib/portfolio-growth.mjs';

type Entry={amount_cents:string;invested_on:string;units:string|null};
type NavPoint={date:string;nav:number};
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n);
const dateLabel=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
export default function PortfolioGrowth({entries,loading,error}:{entries:Entry[];loading:boolean;error:string}) {
  const [history,setHistory]=useState<NavPoint[]>([]);
  const [historyError,setHistoryError]=useState('');
  const [fetching,setFetching]=useState(false);
  const [range,setRange]=useState('all');
  const active=useRef(true);
  const refresh=useCallback(async()=>{
    setFetching(true);
    try {
      const response=await fetch('/api/fund/history',{cache:'no-store'});
      if(!response.ok)throw new Error('Historical NAV is unavailable. Showing invested cost only unless previously fetched history is available.');
      const data=await response.json();
      if(active.current){setHistory(data.points);setHistoryError('');}
    }catch(e){if(active.current)setHistoryError((e as Error).message);}
    finally{if(active.current)setFetching(false);}
  },[]);
  useEffect(()=>{active.current=true;refresh();const focus=()=>{if(!document.hidden)refresh();};const timer=setInterval(focus,300000);window.addEventListener('focus',focus);return()=>{active.current=false;clearInterval(timer);window.removeEventListener('focus',focus);};},[refresh]);
  const allPoints=useMemo(()=>portfolioGrowth(entries,history),[entries,history]);
  const points=useMemo(()=>filterGrowth(allPoints,range),[allPoints,range]);
  const last=points.at(-1);
  const hasValues=points.some(p=>p.value!==null);
  const missingUnits=entries.some(entry=>entry.units===null);
  return <div className="panel growth-panel">
    <div className="growth-heading"><div><div className="eyebrow">THE BIGGER PICTURE</div><h3>Watch your portfolio grow</h3><p>Invested cost alongside historical portfolio value</p></div><div className="growth-controls"><div className="range-tabs" role="group" aria-label="Portfolio growth period">{[['1','1M'],['6','6M'],['12','1Y'],['all','All']].map(([value,label])=><button key={value} aria-pressed={range===value} className={range===value?'selected':''} onClick={()=>setRange(value)}>{label}</button>)}</div><button className="secondary" onClick={refresh} disabled={fetching} aria-label="Refresh historical fund NAV"><RefreshCw size={15} className={fetching?'spin':''}/></button></div></div>
    <div className="growth-summary"><div><span>Invested cost</span><strong>{!loading&&!error&&last?money(last.cost):'—'}</strong></div><div><span>Portfolio value</span><strong>{!loading&&!error&&last?.value!=null?money(last.value):'—'}</strong></div><div><span>Unrealized gain / loss</span><strong className={last?.gain!=null?(last.gain>=0?'positive':'negative'):''}>{!loading&&!error&&last?.gain!=null?money(last.gain):'—'}</strong></div><small>{last&&!error?`As of ${dateLabel(last.date)}`:'Your history, at a glance'}</small></div>
    {historyError&&<div className="growth-notice" role="status">{historyError}{history.length>0&&' Retained history may be stale.'}</div>}
    {loading||error||!points.length?<div className="growth-empty"><span><TrendingUp size={27}/></span><h4>{loading?'Loading your portfolio…':error?'Portfolio data is unavailable':'Your growth story starts here'}</h4><p>{error?'Retry loading the portfolio to see your history.':'Add a contribution or previous holdings to start your timeline.'}</p></div>:<div className="growth-chart" role="img" aria-label="Portfolio growth in INR: invested cost compared with historical value based on allotted units and dated NAVs"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={points} margin={{top:16,right:20,left:4,bottom:6}}><defs><linearGradient id="portfolioValueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#80a48b" stopOpacity={.22}/><stop offset="100%" stopColor="#80a48b" stopOpacity={.015}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 5"/><XAxis dataKey="date" minTickGap={55} axisLine={false} tickLine={false} tick={{fontSize:11,fill:'var(--muted)'}} tickMargin={12} tickFormatter={d=>new Date(d+'T12:00:00').toLocaleDateString('en-IN',{month:'short',year:'2-digit',day:'numeric'})}/><YAxis width={65} axisLine={false} tickLine={false} tick={{fontSize:11,fill:'var(--muted)'}} tickFormatter={v=>Math.abs(v)>=100000?`₹${(v/100000).toFixed(1)}L`:Math.abs(v)>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`}/><Tooltip content={({active,payload,label})=>{if(!active||!payload?.length)return null;const row=payload[0].payload;return <div className="growth-tooltip"><strong>{dateLabel(String(label))}</strong><span>Invested cost <b>{money(row.cost)}</b></span><span>Portfolio value <b>{row.value===null?'Units / NAV missing':money(row.value)}</b></span>{row.gain!==null&&<span>Gain / loss <b>{money(row.gain)}</b></span>}{row.nav_date&&<small>NAV dated {dateLabel(row.nav_date)}</small>}</div>;}}/><Area name="Portfolio value" type="linear" dataKey="value" stroke="#759e83" fill="url(#portfolioValueFill)" strokeWidth={2.5} connectNulls={false} dot={points.length===1} isAnimationActive={false}/><Line name="Invested cost" type="stepAfter" dataKey="cost" stroke="#b3a078" strokeDasharray="5 4" strokeWidth={2} dot={points.length===1} isAnimationActive={false}/></ComposedChart></ResponsiveContainer></div>}
    <div className="growth-footer"><div className="growth-legend"><span><i className="value-key"/>Portfolio value{!hasValues?' (unavailable)':''}</span><span><i className="cost-key"/>Invested cost</span></div><p>{missingUnits?'Add statement units to every entry for a complete value curve. ':''}Value uses units held on each date and historical NAV, not today’s NAV applied to the past. Non-publishing days use the last available NAV. Opening holdings begin on their recorded date. This is not an annualized return.</p></div>
  </div>;
}
