import 'server-only';
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';

const TJPR_MNI_1G='https://projudi.tjpr.jus.br/projudi_consulta/webservices/projudiIntercomunicacaoWebService222';
const TJPR_MNI_2G='https://projudi.tjpr.jus.br/projudi_consulta/webservices/projudiIntercomunicacaoWebService2G222';
const SOAP_NAMESPACE='http://schemas.xmlsoap.org/soap/envelope/';
const SERVICE_NAMESPACE='http://www.cnj.jus.br/servico-intercomunicacao-2.2.2/';
const TYPES_NAMESPACE='http://www.cnj.jus.br/tipos-servico-intercomunicacao-2.2.2';
const SOAP_ACTION=SERVICE_NAMESPACE+'consultarProcesso';
const REQUEST_TIMEOUT_MS=12_000;
const MAX_RESPONSE_CHARS=2_000_000;
const PUBLIC_PROJUDI_URL='https://consulta.tjpr.jus.br/projudi_consulta/';

export type TJPRProjudiEvent={source:'TJPR PROJUDI';at:string;text:string;url:string|null};
export type TJPRMniCredentials={id:string;code:string};
export type TJPRProjudiResult={
 applicable:boolean;
 configured:boolean;
 ok:boolean;
 found:boolean;
 source:'TJPR PROJUDI';
 message:string|null;
 errorCode?:'not_configured'|'invalid_cnj'|'rate_limited'|'unauthorized'|'http_error'|'timeout'|'invalid_response'|'court_rejected'|'not_found';
 events:TJPRProjudiEvent[];
 endpoint?:string;
};

type FetchOptions={
 credentials?:TJPRMniCredentials|null;
 now?:Date;
 fetchImpl?:typeof fetch;
};

const escapeXml=(value:string)=>value
 .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
 .replace(/"/g,'&quot;').replace(/'/g,'&apos;');

function brazilCompactDate(value:Date):string{
 const parts=new Intl.DateTimeFormat('en-US',{
  timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
 }).formatToParts(value);
 const get=(key:string)=>parts.find(p=>p.type===key)?.value||'';
 return get('year')+get('month')+get('day');
}

/** TJPR fornece o código privativo; o MNI exige a senha MD5 diária. */
export function buildTJPRMniDynamicPassword(code:string,now:Date=new Date()):string{
 return createHash('md5').update(String(code)+brazilCompactDate(now)).digest('hex');
}

function credentialsFromEnvironment():TJPRMniCredentials|null{
 const id=String(process.env.TJPR_PROJUDI_MNI_ID||process.env.TJPR_PROJUDI_MNI_ID_MANIFESTANTE||'').trim();
 const code=String(process.env.TJPR_PROJUDI_MNI_CODE||process.env.TJPR_PROJUDI_MNI_SECRET_CODE||'').trim();
 return id&&code?{id,code}:null;
}

function localName(node:any):string{
 return String(node?.name||node?.tagName||'').split(':').pop()?.toLowerCase()||'';
}
function descendants(node:any,name:string):any[]{
 const found:any[]=[];
 const visit=(parent:any)=>{
  for(const child of Array.isArray(parent?.children)?parent.children:[]){
   if(child?.type!=='tag')continue;
   if(localName(child)===name.toLowerCase())found.push(child);
   visit(child);
  }
 };
 visit(node);
 return found;
}
function firstDescendant(node:any,name:string):any|null{
 return descendants(node,name)[0]||null;
}
function nodeText($:cheerio.CheerioAPI,node:any):string{
 return node?$(node).text().replace(/\s+/g,' ').trim():'';
}
function attribute(node:any,name:string):string{
 return String(node?.attribs?.[name]||'').trim();
}
function safeMessage(value:unknown):string{
 return String(value||'').replace(/<[^>]*>/g,' ').replace(/[\r\n\t]+/g,' ')
  .replace(/\s+/g,' ').trim().slice(0,220);
}

function parseMniProcess(xml:string):{success:boolean;message:string;found:boolean;events:TJPRProjudiEvent[]}|null{
 try{
  const $=cheerio.load(xml,{xmlMode:true,decodeEntities:true});
  const root=$.root().get(0);
  const fault=firstDescendant(root,'faultstring');
  if(fault)return {success:false,message:nodeText($,fault)||'Falha SOAP do TJPR.',found:false,events:[]};
  const response=firstDescendant(root,'consultarProcessoResposta');
  if(!response)return null;
  const successNode=firstDescendant(response,'sucesso');
  const messageNode=firstDescendant(response,'mensagem');
  const success=/^(true|1|sim)$/i.test(nodeText($,successNode));
  const message=safeMessage(nodeText($,messageNode));
  if(!success)return {success:false,message:message||'O TJPR não confirmou a consulta MNI.',found:false,events:[]};
  const processNode=firstDescendant(response,'processo');
  if(!processNode)return {success:true,message:message||'Consulta concluída sem objeto processual.',found:false,events:[]};
  const events:TJPRProjudiEvent[]=[];
  for(const movement of descendants(processNode,'movimento')){
   const secrecy=Number(attribute(movement,'nivelSigilo')||0);
   if(Number.isFinite(secrecy)&&secrecy>0)continue;
   const at=attribute(movement,'dataHora');
   if(!at||!Number.isFinite(Date.parse(at)))continue;
   const local=firstDescendant(movement,'movimentoLocal');
   const national=firstDescendant(movement,'movimentoNacional');
   const description=attribute(local,'descricao')||nodeText($,local);
   const nationalCode=attribute(national,'codigoNacional');
   const complements=descendants(movement,'complemento')
    .map(node=>nodeText($,node)).filter(Boolean).slice(0,8);
   const text=[description||(nationalCode?'Movimento nacional '+nationalCode:''),...complements]
    .filter(Boolean).join(' · ').slice(0,2400);
   if(text)events.push({source:'TJPR PROJUDI',at,text,url:PUBLIC_PROJUDI_URL});
  }
  return {success:true,message:message||'Processo consultado no PROJUDI/TJPR.',found:true,events};
 }catch{
  return null;
}

function requestBody(cnj:string,credentials:TJPRMniCredentials,now:Date):string{
 const password=buildTJPRMniDynamicPassword(credentials.code,now);
 return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${SOAP_NAMESPACE}" xmlns:svc="${SERVICE_NAMESPACE}" xmlns:types="${TYPES_NAMESPACE}">
 <soap:Header/>
 <soap:Body>
  <svc:consultarProcesso>
   <types:idConsultante>${escapeXml(credentials.id)}</types:idConsultante>
   <types:senhaConsultante>${password}</types:senhaConsultante>
   <types:numeroProcesso>${cnj}</types:numeroProcesso>
   <types:movimentos>true</types:movimentos>
   <types:incluirCabecalho>true</types:incluirCabecalho>
   <types:incluirDocumentos>false</types:incluirDocumentos>
  </svc:consultarProcesso>
 </soap:Body>
</soap:Envelope>`;
}

/**
 * Consulta oficial MNI 2.2.2 do TJPR. Não acessa a tela pública do Projudi,
 * não contorna reCAPTCHA e não consulta documentos sigilosos.
 * As credenciais são provisionadas privativamente pelo próprio TJPR.
 */
export async function fetchTJPRProjudiProcess(cnjRaw:string,options:FetchOptions={}):Promise<TJPRProjudiResult>{
 const digits=String(cnjRaw||'').replace(/\D/g,'');
 const base={source:'TJPR PROJUDI' as const,events:[] as TJPRProjudiEvent[]};
 if(digits.length!==20||digits.slice(13,16)!=='816'){
  return {...base,applicable:false,configured:false,ok:false,found:false,message:null,errorCode:'invalid_cnj'};
 }
 const credentials=options.credentials===undefined?credentialsFromEnvironment():options.credentials;
 if(!credentials?.id?.trim()||!credentials?.code?.trim()){
  return {...base,applicable:true,configured:false,ok:false,found:false,
   message:'Integração oficial TJPR PROJUDI MNI não configurada: faltam as credenciais privativas do tribunal.',
   errorCode:'not_configured'};
 }
 const secondGrade=digits.slice(16,20)==='9000';
 const endpoint=secondGrade?TJPR_MNI_2G:TJPR_MNI_1G;
 const fetcher=options.fetchImpl||fetch;
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
 try{
  const response=await fetcher(endpoint,{
   method:'POST',
   headers:{
    'Content-Type':'text/xml; charset=utf-8',
    Accept:'text/xml, application/soap+xml',
    SOAPAction:'"'+SOAP_ACTION+'"',
   },
   body:requestBody(digits,credentials,options.now||new Date()),
   signal:controller.signal,
   cache:'no-store',
  });
  const body=await response.text();
  if(response.status===429){
   return {...base,applicable:true,configured:true,ok:false,found:false,endpoint,
    message:'TJPR PROJUDI MNI temporariamente limitado (HTTP 429). Nova tentativa automática será feita depois.',
    errorCode:'rate_limited'};
  }
  if(response.status===401||response.status===403){
   return {...base,applicable:true,configured:true,ok:false,found:false,endpoint,
    message:'TJPR PROJUDI MNI recusou a autenticação. Verifique as credenciais privativas da integração.',
    errorCode:'unauthorized'};
  }
  if(!response.ok){
   return {...base,applicable:true,configured:true,ok:false,found:false,endpoint,
    message:'TJPR PROJUDI MNI respondeu HTTP '+response.status+'.',
    errorCode:'http_error'};
  }
  if(body.length>MAX_RESPONSE_CHARS){
   return {...base,applicable:true,configured:true,ok:false,found:false,endpoint,
    message:'Resposta do TJPR PROJUDI MNI excedeu o limite de segurança.',
    errorCode:'invalid_response'};
  }
  const parsed=parseMniProcess(body);
  if(!parsed){
   return {...base,applicable:true,configured:true,ok:false,found:false,endpoint,
    message:'Resposta XML do TJPR PROJUDI MNI não pôde ser validada.',
    errorCode:'invalid_response'};
  }
  if(!parsed.success){
   return {...base,applicable:true,configured:true,ok:false,found:false,endpoint,
    message:safeMessage(parsed.message)||'TJPR não confirmou a consulta.',
    errorCode:'court_rejected'};
  }
  if(!parsed.found){
   return {...base,applicable:true,configured:true,ok:false,found:false,endpoint,
    message:safeMessage(parsed.message)||'O TJPR não retornou o objeto processual.',
    errorCode:'not_found'};
  }
  return {...base,applicable:true,configured:true,ok:true,found:true,endpoint,
   message:safeMessage(parsed.message)||'Consulta oficial confirmada.',events:parsed.events};
 }catch(error){
  const timedOut=(error as {name?:string})?.name==='AbortError';
  return {...base,applicable:true,configured:true,ok:false,found:false,endpoint,
   message:timedOut?'Consulta TJPR PROJUDI MNI excedeu o tempo limite.':'Falha de conexão com o TJPR PROJUDI MNI.',
   errorCode:timedOut?'timeout':'http_error'};
 }finally{
  clearTimeout(timeout);
 }
}
