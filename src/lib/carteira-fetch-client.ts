"use client";
import type { LegalCase } from "@/lib/case-logic";
const KEY='lexis_carteira_client_v4';
const TTL_MS=30*60*1000;
type Box={at:number;empresaKey:string;cases:LegalCase[]};
let box:Box|null=null; let inflight:Promise<LegalCase[]>|null=null; let inflightKey='';
function read(key:string):Box|null{try{const p=JSON.parse(localStorage.getItem(KEY)||'null');if(!p||p.empresaKey!==key||!Array.isArray(p.cases))return null;return p;}catch{return null;}}
function write(v:Box){try{localStorage.setItem(KEY,JSON.stringify(v));}catch{}}
export function peekCarteiraClientCache(empresaKey='default'):LegalCase[]|null{const b=box&&box.empresaKey===empresaKey?box:read(empresaKey);if(!b)return null;box=b;return Date.now()-b.at<TTL_MS?b.cases:null;}
export function seedCarteiraClientCache(cases:LegalCase[],empresaKey='default'){box={at:Date.now(),empresaKey,cases:Array.isArray(cases)?cases:[]};if(box.cases.length)write(box);}
export function invalidateCarteiraClientCache(){box=null;inflight=null;inflightKey='';try{localStorage.removeItem(KEY);}catch{}}
export async function fetchCarteiraDeduped(fetchFn:()=>Promise<LegalCase[]|null|undefined>,opts?:{force?:boolean;empresaKey?:string}):Promise<LegalCase[]>{
 const key=opts?.empresaKey||'default'; const cached=peekCarteiraClientCache(key);
 if(!opts?.force&&cached)return cached;
 if(inflight&&inflightKey===key)return inflight;
 inflightKey=key; inflight=(async()=>{try{const raw=(await fetchFn())||[];const cases=Array.isArray(raw)?raw:[];if(cases.length)seedCarteiraClientCache(cases,key);return cases;}finally{inflight=null;inflightKey='';}})();return inflight;
}
