/**
 * Inventário PASSIVO de tráfego HAR de sessões próprias/autorizadas.
 * Não captura, não reexecuta, não armazena cookies/tokens, não faz requests.
 * Leitura exclusivamente no navegador do operador, sem Supabase/Vercel APIs.
 */
const MAX_ENTRIES=2000;
export const MAX_HAR_BYTES=3*1024*1024;

export type EndpointInsight={
 host:string;route:string;method:string;calls:number;errors:number;
 authFailures:number;limited:number;latencyMs:number;needsReview:boolean;
};
export type ApiObservation={
 total:number;totalShown:number;redactedCredentials:number;
 endpoints:EndpointInsight[];suggestions:string[];
 previewOnly:true;containsNoRawSecrets:true;
};

const KNOWN_SEGMENTS=new Set([
 'api','rest','v1','v2','v3','rpc','auth','user','users','token','session','sessions',
 'processos','cases','case','whatsapp','local','report','pdf','completo','dashboard',
 'metrics','health','status','scan','datajud','djen','movimentacoes','movement','tasks',
 'tarefas','vencidos','crm','companies','contacts','clientes','messages','send',
 'jobs','worker','supabase','storage','object','public','functions','v1','realtime',
 'query','list','search','chat','ai','model','agent','agents','analyze','evidence',
 'files','documents','billing','planos','subscriptions','webhook','integracoes',
 'cron','wa-daily-return','wa-movement','history','notifications','notificacoes',
]);
const METHODS=new Set(['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD']);
const asRecord=(v:unknown):Record<string,unknown>|null=>
 v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const bounded=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(120000,Math.round(n))):0;

export function sanitizedPath(pathname:string):string{
 const parts=pathname.split('/').filter(Boolean).slice(0,12);
 return '/'+parts.map(part=>{
  const segment=part.toLowerCase();
  if(KNOWN_SEGMENTS.has(segment))return segment;
  if(/^\d{1,3}$/.test(segment))return ':n';
  // Do not show slugs, client names, CNJ, CPF, JWT, UUID, opaque IDs, file names.
  return ':id';
 }).join('/');
}

export function inspectAuthorizedHar(payload:unknown):ApiObservation{
 const root=asRecord(payload);
 const log=asRecord(root?.log);
 const entries=log?.entries;
 if(!Array.isArray(entries))throw new Error('Formato HAR inválido: esperado log.entries.');
 if(entries.length>MAX_ENTRIES)throw new Error('HAR excede 2.000 requisições. Exporte um período menor.');
 const groups=new Map<string,EndpointInsight>();
 let redactedCredentials=0;
 for(const entry of entries){
  const obj=asRecord(entry);if(!obj)continue;
  const request=asRecord(obj.request),response=asRecord(obj.response);
  if(!request||!response)continue;
  const rawUrl=request.url;
  if(typeof rawUrl!=='string'||rawUrl.length>5000)continue;
  let url:URL;
  try{url=new URL(rawUrl);}catch{continue;}
  if(url.protocol!=='http:'&&url.protocol!=='https:')continue;
  if(url.username||url.password)redactedCredentials++;
  const headers=Array.isArray(request.headers)?request.headers:[];
  if(headers.some(h=>{
   const name=asRecord(h)?.name;
   return typeof name==='string'&&/^(authorization|cookie|proxy-authorization|x-api-key|x-auth-token)$/i.test(name);
  }))redactedCredentials++;
  if(url.search||url.hash)redactedCredentials++; // values are never retained
  const host=url.hostname.toLowerCase().replace(/^www\./,'').slice(0,100);
  const route=sanitizedPath(url.pathname);
  const method=typeof request.method==='string'&&METHODS.has(request.method.toUpperCase())
   ?request.method.toUpperCase():'OTHER';
  const status=typeof response.status==='number'?response.status:0;
  const error=status>=500||status===0;
  const auth=status===401||status===403;
  const limited=status===429;
  const key=[host,route,method].join(' ');
  let item=groups.get(key);
  if(!item){
    item={host,route,method,calls:0,errors:0,authFailures:0,limited:0,latencyMs:0,needsReview:false};
    groups.set(key,item);
  }
  item.calls++;
  item.errors+=Number(error);
  item.authFailures+=Number(auth);
  item.limited+=Number(limited);
  item.latencyMs+=bounded(obj.time);
 }
 const endpoints=Array.from(groups.values()).map(x=>({
  ...x,latencyMs:Math.round(x.latencyMs/Math.max(1,x.calls)),
  needsReview:x.errors>0||x.limited>0||x.authFailures>0||x.latencyMs>2500,
 })).sort((a,b)=>Number(b.needsReview)-Number(a.needsReview)||b.calls-a.calls).slice(0,80);
 const hasErrors=endpoints.some(x=>x.errors>0);
 const hasAuth=endpoints.some(x=>x.authFailures>0);
 const hasRate=endpoints.some(x=>x.limited>0);
 const hasSlow=endpoints.some(x=>x.latencyMs>2500);
 const suggestions=[
   hasErrors?'Investigar respostas 5xx e timeouts nas APIs próprias antes de alterar contratos.':'Sem 5xx observados na amostra; isso não comprova disponibilidade.',
   hasAuth?'Conferir permissões/RLS e validade das sessões; nunca reutilizar cookies ou tokens extraídos.':'Não foram observados 401/403 na amostra.',
   hasRate?'Há respostas 429: revisar limites oficiais, fila e backoff; não contornar bloqueios.':'Sem 429 na amostra.',
   hasSlow?'Identificar chamadas lentas e N+1; preferir paginação, cache e índices no backend.':'Sem latência média acima de 2,5s nos endpoints resumidos.',
   'Inventário local e anonimizado: revisar manualmente contratos, termos de uso, documentação e autorização antes de qualquer integração.',
 ];
 return {
  total:entries.length,totalShown:endpoints.reduce((s,x)=>s+x.calls,0),
  redactedCredentials,endpoints,suggestions,previewOnly:true,containsNoRawSecrets:true,
 };
}
