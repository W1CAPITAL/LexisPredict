import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {cleanCnj,courtAlias,normalizeDataJud,normalizeDjen,mergeEvents} from "./core.mjs";

// Executa no Supabase Edge, não depende de Next.js, Vercel, janela aberta ou PC.
// Nunca envia mensagem, altera atendimento, situação ou datas dos processos.
const BASE=(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"");
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const DATAJUD_PUBLIC_KEY=Deno.env.get("DATAJUD_API_KEY")||atob("cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==");
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{
  status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
});
type JsonRecord=Record<string,any>;
const restHeaders=()=>{
  return {"apikey":SERVICE_KEY,"Authorization":"Bearer "+SERVICE_KEY,
    "Accept":"application/json","Content-Type":"application/json"};
};
async function db(path:string,method="GET",data?:unknown):Promise<any>{
  const res=await fetch(BASE+"/rest/v1/"+path,{
    method,headers:{...restHeaders(),...(method==="POST"?{"Prefer":"return=representation"}:{})},
    body:data===undefined?undefined:JSON.stringify(data),
    signal:AbortSignal.timeout(10000),cache:"no-store"
  });
  if(!res.ok)throw Error("database_http_"+res.status);
  if(res.status===204)return null;
  const raw=await res.text();return raw?JSON.parse(raw):null;
}
function apiPath(table:string,filters:Record<string,string>,selection:string){
  const query=new URLSearchParams({select:selection});
  for(const [k,v] of Object.entries(filters))query.set(k,"eq."+v);
  query.set("limit","1");
  return table+"?"+query.toString();
}
async function officialJson(url:string,init:RequestInit):Promise<any>{
  const response=await fetch(url,{...init,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000)});
  if(!response.ok){
    const err=Object.assign(Error("official_http_"+response.status),{status:response.status});
    throw err;
  }
  const raw=await response.text();
  if(raw.length>1_800_000)throw Error("official_response_too_large");
  let body:any;
  try{body=JSON.parse(raw)}catch{throw Error("invalid_official_json")}
  if(!body||typeof body!=="object")throw Error("invalid_official_json");
  return body;
}
function sourceError(error:unknown):{code:string,status:number|null}{
  const status=Number((error as any)?.status)||null;
  const code=status?"http_"+status:
    error instanceof Error&&error.name==="TimeoutError"?"timeout":
    String((error as any)?.message||"unavailable").startsWith("invalid_")?"invalid_payload":"unavailable";
  return {code,status};
}
function futureTime(raw:any){return raw&&Date.parse(raw)>Date.now()}
async function pauseSource(source:"datajud"|"djen",status:number|null){
  const minutes=status===429?90:status===403?360:status===401?240:
    status&&status>=500?20:0;
  if(!minutes)return;
  const until=new Date(Date.now()+minutes*60000).toISOString();
  // Saves global backoff, preventing the scheduler from hammering 403/429.
  await db("hermes_background_control?id=eq.1","PATCH",{
    [source+"_paused_until"]:until
  }).catch(()=>{});
}
async function readOne(path:string):Promise<JsonRecord|null>{
  const results=await db(path);
  return Array.isArray(results)&&results.length?results[0]:null;
}
function formatSourceError(error:{code:string,status:number|null}){
  return {code:error.code,checkedAt:new Date().toISOString()};
}
async function runOne(claim:{empresa_id:string;processo_id:number}){
  const companyId=String(claim.empresa_id||"");
  const processId=String(claim.processo_id||"");
  const record=await readOne(apiPath("processos",{empresa_id:companyId,id:processId},
    "id,protocolo_ref,empresa_id,ultimo_retorno,proximo_retorno"));
  const previous=await readOne(apiPath("hermes_portfolio_scans",
    {empresa_id:companyId,processo_id:processId},
    "events,findings,source_errors,datajud_ok,djen_ok,last_datajud_movement_at,last_djen_publication_at"));
  const cnj=cleanCnj(record?.protocolo_ref);
  const checkedAt=new Date().toISOString();
  const errorCodes:JsonRecord={};
  let datajud:any=null,djen:any=null;
  const controls=await readOne("hermes_background_control?select=datajud_paused_until,djen_paused_until&id=eq.1&limit=1");
  const oldEvents=Array.isArray(previous?.events)?previous.events:[];
  let freshDatajud:any[]=[];let freshDjen:any[]=[];
  if(!cnj||!record||record.empresa_id!==companyId){
    errorCodes.validation={code:"process_not_authorized_or_invalid_cnj",checkedAt};
  }else{
    const alias=courtAlias(cnj);
    if(futureTime(controls?.datajud_paused_until)){
      errorCodes.datajud={code:"global_backoff",checkedAt};
    }else if(!alias){
      errorCodes.datajud={code:"unsupported_court",checkedAt};
    }else{
      try{
        const payload=await officialJson("https://api-publica.datajud.cnj.jus.br/api_publica_"+alias+"/_search",{
          method:"POST",
          headers:{"Authorization":"APIKey "+DATAJUD_PUBLIC_KEY,
            "Content-Type":"application/json","Accept":"application/json"},
          body:JSON.stringify({size:1,query:{match:{numeroProcesso:cnj}}})
        });
        if(payload.timed_out===true)throw Error("invalid_datajud_timeout");
        datajud=normalizeDataJud(payload,cnj);
        freshDatajud=datajud.events;
      }catch(error){
        const safe=sourceError(error);
        errorCodes.datajud=formatSourceError(safe);
        await pauseSource("datajud",safe.status);
      }
    }
    if(futureTime(controls?.djen_paused_until)){
      errorCodes.djen={code:"global_backoff",checkedAt};
    }else{
      try{
        const params=new URLSearchParams({numeroProcesso:cnj,pagina:"1",itensPorPagina:"50"});
        const payload=await officialJson("https://comunicaapi.pje.jus.br/api/v1/comunicacao?"+params.toString(),{
          method:"GET",headers:{"Accept":"application/json"}
        });
        djen=normalizeDjen(payload,cnj);
        freshDjen=djen.events;
      }catch(error){
        const safe=sourceError(error);
        errorCodes.djen=formatSourceError(safe);
        await pauseSource("djen",safe.status);
      }
    }
  }
  const events=mergeEvents(oldEvents,freshDatajud,freshDjen,100);
  const verifiedSources=Number(Boolean(datajud))+Number(Boolean(djen));
  const state=verifiedSources===2?"ready":verifiedSources===1?"partial":"unavailable";
  const priorFindings=previous?.findings&&typeof previous.findings==="object"&&!Array.isArray(previous.findings)?previous.findings:{};
  const freshIds=new Set([...freshDatajud,...freshDjen].map(e=>e.id));
  const priorIds=new Set(oldEvents.map((e:any)=>e.id||[e.source,e.date||e.at||"",e.title||e.text||""].join("|")));
  const newEvidence=[...freshIds].filter(id=>!priorIds.has(id)).length;
  const payload={
    state,checked_at:checkedAt,datajud_ok:Boolean(datajud),
    djen_ok:Boolean(djen),source_errors:errorCodes,events,
    last_datajud_movement_at:datajud?.latestDay||previous?.last_datajud_movement_at||null,
    last_djen_publication_at:djen?.latestDay||previous?.last_djen_publication_at||null,
    findings:{...priorFindings,independentRunner:{
      checkedAt,verificationState:state,verifiedSources,
      newEvidenceCount:newEvidence,
      datajudFound:datajud?.found??null,retainedPreviousEvents:oldEvents.length,
      note:"Fonte indisponível não significa processo sem movimentação."
    }}
  };
  const filters=new URLSearchParams({empresa_id:"eq."+companyId,processo_id:"eq."+processId});
  await db("hermes_portfolio_scans?"+filters.toString(),"PATCH",payload);
  return {state,verifiedSources,newEvidence};
}
Deno.serve(async(request:Request)=>{
  if(request.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(BASE)||!SERVICE_KEY)
    return json({ok:false,error:"service_not_configured"},503);
  const auth=request.headers.get("Authorization")||"";
  const token=/^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim()||"";
  if(!token)return json({ok:false,error:"unauthorized"},401);
  try{
    const accepted=await db("rpc/hermes_background_authorized","POST",{p_token:token});
    if(accepted!==true)return json({ok:false,error:"unauthorized"},403);
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",
      year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const claims=await db("rpc/hermes_claim_portfolio_scan_batch","POST",{
      p_today:today,p_limit:2
    });
    if(!Array.isArray(claims))throw Error("invalid_claim_response");
    const outcome=[];
    for(const claim of claims){
      try{outcome.push(await runOne(claim));}
      catch(error){
        console.error("[hermes-background] storage_or_runtime_failure",String((error as any)?.message||"error").slice(0,90));
        outcome.push({state:"retry_pending",verifiedSources:0,newEvidence:0});
      }
    }
    return json({ok:true,processed:outcome.length,
      ready:outcome.filter(x=>x.state==="ready").length,
      partial:outcome.filter(x=>x.state==="partial").length,
      unavailable:outcome.filter(x=>x.state==="unavailable").length,
      retryPending:outcome.filter(x=>x.state==="retry_pending").length});
  }catch(error){
    console.error("[hermes-background] database_unavailable",String((error as any)?.message||"unknown").slice(0,90));
    return json({ok:false,error:"backend_unavailable"},503);
  }
});
