'use client';
import { useEffect } from 'react';

// Poll only while visible; optional Realtime is probed before opening a stream.
// Clean up streams and backoff timers on workspace changes or unmount.
export function useLedgerRefresh(load:()=>Promise<void>, query:string, setLive:(live:boolean)=>void) {
  useEffect(()=>{
    let disposed=false, source:EventSource|null=null, retry:ReturnType<typeof setTimeout>|undefined;
    let supported=false, failures=0;
    const controller=new AbortController();
    const disconnect=()=>{source?.close();source=null;clearTimeout(retry);setLive(false);};
    const connect=()=>{
      if(disposed || document.hidden || !supported || source)return;
      source=new EventSource('/api/events'+query);
      source.addEventListener('ready',()=>{if(!disposed){failures=0;setLive(true);}});
      source.addEventListener('change',()=>{if(!disposed)void load();});
      source.onerror=()=>{disconnect();if(!disposed && !document.hidden)retry=setTimeout(connect,Math.min(60000,3000*2**Math.min(failures++,5)));};
    };
    void load();
    void fetch('/api/health',{cache:'no-store',signal:controller.signal}).then(async response=>{
      if(!response.ok)return;
      const health=await response.json();
      if(!disposed){supported=health.realtime===true;connect();}
    }).catch(()=>{/* Polling remains available if health or Realtime fails. */});
    const poll=setInterval(()=>{if(!document.hidden)void load();},30000);
    const visibility=()=>{if(document.hidden)disconnect();else{void load();connect();}};
    const focus=()=>{if(!document.hidden){void load();connect();}};
    window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visibility);
    return()=>{disposed=true;controller.abort();clearInterval(poll);disconnect();window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility);};
  },[load,query,setLive]);
}
