import 'server-only';
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
export type TJPRProjudiResult={
 applicable:boolean;
 configured:boolean;
 ok:boolean;
 found:boolean;
 source:'TJPR PROJUDI';
 message:string|null;
 errorCode?:'invalid_cnj'|'rate_limited'|'unauthorized'|'http_error'|'timeout'|'invalid_response'|'court_rejected'|'not_found';
 events:TJPRProjudiEvent[];
 endpoint?:string;
};

type FetchOptions={fetchImpl?:typeof fetch};

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
function nodeText($:any,node:any):string{
 return node?$(node).text().replace(/\s+/g,' ').trim():'';
}
function attribute(node:any,name:string):string{
 return String(node?.attribs?.[name]||'').trim();
}
function normalizeMniDateTime(value:string):string{
 const raw=value.trim();
 return /^\\d{4}-\\d{2}-\\d{2}T/.test(raw)&&!/(?:Z|[+-]\\d{2}:\\d{2})$/i.test(raw)?raw+'-03:00':raw;
}
function safeMessage(value:unknown):string{
 return String(value||'').replace(/<[^>]*>/g,' ').replace(/[\r\n\t]+/g,' ')
  .replace(/\s+/g,' ').trim().slice(0,220);
}

function parseMniProcess(xml:string):{success:boolean;message:string;found:boolean;events:TJPRProjudiEvent[]}|null{
 try{
  const $=cheerio.load(xml,{xmlMode:true};
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
   const rawAt=attribute(movement,'dataHora');
   const at=rawAt?normalizeMniDateTime(rawAt):'';
   if(!at||!Number.isFinite(Date.parse(at)))continue;
   const local=firstDescendant(movement,'movimentoLocal');
   const national=firstDescendant(movement,'movimentoNacional');
   const description=attribute(local,'descricao')||nodeText($,local);
   const nationalCode=attribute(national,'codigoNacional');
   // Resolução TJPR 532-OE/2026: complementos de movimentos ficam ocultos
   // em toda consulta pública automatizada; não os ler nem persistir.
   const text=(description||(nationalCode?'Movimento nacional '+nationalCode:'')).slice(0,1200);
   if(text)events.push({source:'TJPR PROJUDI',at,text,url:PUBLIC_PROJUDI_URL});
  }
  return {success:true,message:message||'Processo consultado no PROJUDI/TJPR.',found:true,events};
 }catch{
  return null;
}

function requestBody(cnj:string):string{
 // O WSDL mantém os campos de autenticação obrigatórios no schema, mas a
 // Resolução TJPR 532-OE/2026 dispensa login e senha para dados públicos.
 return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${SOAP_NAMESPACE}" xmlns:svc="${SERVICE_NAMESPACE}" xmlns:types="${TYPES_NAMESPACE}">
 <soap:Header/>
 <soap:Body>
  <svc:consultarProcesso>
   <types:idConsultante></types:idConsultante>
   <types:senhaConsultante></types:senhaConsultante>
   <types:numeroProcesso>${cnj}</types:numeroProcesso>
   <types:movimentos>true</types:movimentos>
   <types:incluirCabecalho>false</types:incluirCabecalho>
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
   body:requestBody(digits),
   signal:controller.signal,
   cache:'no-store',
  });
  const contentLength=Number(response.headers.get('content-length')||0);
  if(contentLength>MAX_RESPONSE_CHARS){
   return {...base,applicable:true,configured:true,ok:false,found:false,endpoint,
    message:'Resposta do TJPR PROJUDI MNI excedeu o limite de segurança.',errorCode:'invalid_response'};
  }
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
