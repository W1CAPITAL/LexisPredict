"use client";
/** Dispara a reconciliação automática sem bloquear a entrada no app. */
const KEY='lexis_hybrid_entry_sync_v1';
const MIN_INTERVAL=15_000;
export function startHybridEntrySync(){
 if(typeof window==='undefined')return;
 try{const last=Number(localStorage.getItem(KEY)||0);if(Date.now()-last<MIN_INTERVAL)return;localStorage.setItem(KEY,String(Date.now()));}catch{return;}
 void fetch('/api/hybrid/auto-sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'app-entry'}),keepalive:true}).catch(()=>{});
}
