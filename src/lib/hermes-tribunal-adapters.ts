/**
 * Consulta oficial de metadados públicos por MNI/SCMPP.
 * Serviços FIXOS publicados pelos tribunais; sem RPA, CAPTCHA, cookies
 * de sessão, leitura de documentos, conteúdo de partes ou bypass de WAF.
 * Acessibilidade do WSDL não é evidência de processo consultado.
 */
import {load} from 'cheerio';

export type TribunalAdapter={
 code:'tjpr-scmpp'|'tjpe-mni';label:string;tribunal:'TJPR'|'TJPE';instance:'1g';
 wsdl:string;endpoint:string;sourceUrl:string;portal:string;
};
export type TribunalMovement={date:string;code:string;name:string};
export type TribunalAttemptStatus=
 'verified'|'verified_empty'|'unsupported'|'restricted'|'rate_limited'|
 'timeout'|'unavailable'|'unexpected_response'|'cnj_mismatch';
export type TribunalAttempt={
 status:TribunalAttemptStatus;connector:string|null;tribunal:string|null;
 checkedAt:string;movements:TribunalMovement[];httpStatus:number|null;
 message:string;officialUrl:string|null;
};
const REGISTRY:Record<string,TribunalAdapter>={
 '816':{code:'tjpr-scmpp',label:'TJPR · SCMPP / Projudi',tribunal:'TJPR',instance:'1g',
  wsdl:'https://projudi.tjpr.jus.br/projudi_consulta/webservices/projudiIntercomunicacaoWebService222?wsdl',
  endpoint:'https://projudi.tjpr.jus.br/projudi_consulta/webservices/projudiIntercomunicacaoWebService222',
  sourceUrl:'https://sti.tjpr.jus.br/documents/d/planejamento/servico-de-consulta-as-movimentacoes-processuais-publicas-automatizado-scmpp-pdf',
  portal:'https://consulta.tjpr.jus.br/projudi_consulta/'},
 '817':{code:'tjpe-mni',label:'TJPE · MNI / PJe',tribunal:'TJPE',instance:'1g',
  wsdl:'https://pjemni.app.tjpe.jus.br/1g/servico-intercomunicacao-2.2.2?wsdl',
  endpoint:'https://pjemni.app.tjpe.jus.br/1g/servico-intercomunicacao-2.2.2',
  sourceUrl:'https://portal.tjpe.jus.br/web/transparencia/tic/dados-abertos',
  portal:'https://portal.tjpe.jus.br/'},
};
const onlyDigits=(v:unknown)=>String(v??'').replace(/\D/g,'');
export function resolveOfficialTribunalAdapter(rawCnj:unknown):TribunalAdapter|null{
 const cnj=onlyDigits(rawCnj);
 if(cnj.length!==20)return null;
 return REGISTRY[cnj.slice(13,16)]??null;
}
const local=(tag:unknown)=>String(tag||'').replace(/^.*:/,'').toLowerCase();
const limitChars=(v:unknown,n=240)=>String(v??'').replace(/[\r\n\t]/g,' ').slice(0,n);
const response=(status:TribunalAttemptStatus,adapter:TribunalAdapter|null,movements:TribunalMovement[]=[],httpStatus:number|null=null,message=''):TribunalAttempt=>({
 status,connector:adapter?.code||null,tribunal:adapter?.tribunal||null,
 officialUrl:adapter?.portal||null,checkedAt:new Date().toISOString(),
 movements,httpStatus,message,
});

function findLocal($:ReturnType<typeof load>,name:string){
 return $('*').filter((_i,el)=>local((el as {name?:string}).name)===name.toLowerCase());
}
function attrLocal($node:ReturnType<ReturnType<typeof load>>,key:string):string{
 // Cheerio.attr() as object works across namespace prefixes.
 const attrs=$node.attr()||{};
 const item=Object.entries(attrs).find(([k])=>local(k)===key.toLowerCase());
 return item?String(item[1]):'';
}
function dateFromMni(v:unknown):string|null{
 const s=String(v??'');
 const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);
 const digits=onlyDigits(s);
 const date=match?match[1]+'-'+match[2]+'-'+match[3]:
  digits.length>=8?digits.slice(0,4)+'-'+digits.slice(4,6)+'-'+digits.slice(6,8):'';
 if(!date)return null;
 const when=Date.parse(date+'T12:00:00Z');
 return Number.isFinite(when)&&new Date(when).toISOString().slice(0,10)===date?date:null;
}
/** Nunca usa nomes, partes, documentos ou complementos ocultos: apenas código TPU público. */
export function parseMniPublicMovements(xml:string,cnj:string):{
 status:TribunalAttemptStatus;movements:TribunalMovement[];
}{
 if(typeof xml!=='string'||xml.length>1_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml))
  return {status:'unexpected_response',movements:[]};
 if(/<(?:[\w-]+:)?(?:Fault|faultcode)\b/i.test(xml))return {status:'restricted',movements:[]};
 if(!/<(?:[\w-]+:)?(?:consultarProcessoResposta|consultarProcessoResponse|processo)\b/i.test(xml))
  return {status:'unexpected_response',movements:[]};
 const $=load(xml,{xmlMode:true});
 const answers=findLocal($,'consultarprocessoresposta').add(findLocal($,'consultarprocessoresponse'));
 const successNode=answers.first();
 const successAttr=attrLocal(successNode,'sucesso')||
  findLocal($,'sucesso').first().text().trim();
 if(successAttr.toLowerCase()!=='true')return {status:'unavailable',movements:[]};
 const basicos=findLocal($,'dadosbasicos').first();
 const processNode=findLocal($,'processo').first();
 const actual=onlyDigits(attrLocal(basicos,'numero')||
  attrLocal(basicos,'numeroprocesso')||
  attrLocal(processNode,'numero')||
  findLocal($,'numeroprocesso').first().text());
 if(actual!==onlyDigits(cnj)||actual.length!==20)return {status:'cnj_mismatch',movements:[]};
 const sigilo=attrLocal(basicos,'nivelsigilo')||
  findLocal($,'nivelsigilo').first().text().trim();
 if(sigilo!==''&&sigilo!=='0')return {status:'restricted',movements:[]};
 const movements:TribunalMovement[]=[];
 const unique=new Set<string>();
 const nodes=findLocal($,'movimento');
 nodes.slice(0,300).each((_index,node)=>{
  const n=$(node);
  const date=dateFromMni(attrLocal(n,'datahora')||
   n.find('*').filter((_i,el)=>local((el as {name?:string}).name)==='datahora').first().text());
  const nacional=n.find('*').filter((_i,el)=>local((el as {name?:string}).name)==='movimentonacional').first();
  const code=onlyDigits(attrLocal(nacional,'codigonacional')||
   nacional.find('*').filter((_i,el)=>local((el as {name?:string}).name)==='codigonacional').first().text()).slice(0,8);
  if(!date||!code)return;
  const key=date+'|'+code;
  if(unique.has(key))return;
  unique.add(key);
  movements.push({date,code,name:'Movimento oficial TPU '+code});
 });
 return {status:movements.length?'verified':'verified_empty',movements:movements.slice(0,120)};
}

const MAX_RESPONSE_BYTES=750_000;
async function boundedText(res:Response):Promise<string>{
 const declared=Number(res.headers.get('content-length'));
 if(Number.isFinite(declared)&&declared>MAX_RESPONSE_BYTES)throw Error('response_too_large');
 const reader=res.body?.getReader();
 if(!reader)return '';
 const chunks:Uint8Array[]=[];let count=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   if(value){
    count+=value.byteLength;
    if(count>MAX_RESPONSE_BYTES){await reader.cancel();throw Error('response_too_large');}
    chunks.push(value);
   }
  }
 }finally{reader.releaseLock();}
 const buf=new Uint8Array(count);let at=0;
 for(const chunk of chunks){buf.set(chunk,at);at+=chunk.length;}
 return new TextDecoder('utf-8',{fatal:false}).decode(buf);
}
function xmlEscape(s:string):string{
 return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function publicMniEnvelope(cnj:string,ns:string,adapter:TribunalAdapter):string{
 // Credenciais SOMENTE se configuradas explicitamente para o tribunal.
 const prefix=adapter.tribunal==='TJPR'?'HERMES_MNI_TJPR':'HERMES_MNI_TJPE';
 const user=process.env[prefix+'_ID']||'';
 const pass=process.env[prefix+'_SENHA']||'';
 const namespace=xmlEscape(ns);
 return '<?xml version="1.0" encoding="UTF-8"?>'+
  '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mni="'+namespace+'">'+
  '<soap:Body><mni:consultarProcesso>'+
  '<mni:idConsultante>'+xmlEscape(user)+'</mni:idConsultante>'+
  '<mni:senhaConsultante>'+xmlEscape(pass)+'</mni:senhaConsultante>'+
  '<mni:numeroProcesso>'+cnj+'</mni:numeroProcesso>'+
  '<mni:movimentos>true</mni:movimentos>'+
  '<mni:incluirCabecalho>true</mni:incluirCabecalho>'+
  '<mni:incluirDocumentos>false</mni:incluirDocumentos>'+
  '</mni:consultarProcesso></soap:Body></soap:Envelope>';
}
export async function runOfficialTribunalConnector(rawCnj:string):Promise<TribunalAttempt>{
 const adapter=resolveOfficialTribunalAdapter(rawCnj);
 if(!adapter)return response('unsupported',null,[],null,'Tribunal ainda sem endpoint MNI público homologado no Hermes.');
 const cnj=onlyDigits(rawCnj);
 try{
  // WSDL precisa responder e anunciar consultarProcesso; sem isso não faz POST.
  const wsdl=await fetch(adapter.wsdl,{method:'GET',redirect:'error',cache:'no-store',
   headers:{Accept:'text/xml,application/xml'},signal:AbortSignal.timeout(6500)});
  if(wsdl.status===429)return response('rate_limited',adapter,[],429,'O tribunal limitou o acesso ao contrato MNI.');
  if(wsdl.status===401||wsdl.status===403)return response('restricted',adapter,[],wsdl.status,'WSDL não permite acesso nesta origem.');
  if(!wsdl.ok)return response('unavailable',adapter,[],wsdl.status,'Serviço oficial MNI indisponível nesta consulta.');
  const xml=await boundedText(wsdl);
  if(/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<(?:[\w-]+:)?definitions\b/i.test(xml)||
   !/http:\/\/schemas\.xmlsoap\.org\/wsdl\//.test(xml)||
   !/<(?:[\w-]+:)?operation\b[^>]*name=["']consultarProcesso["']/i.test(xml))
   return response('unexpected_response',adapter,[],wsdl.status,'Contrato não corresponde ao MNI consultarProcesso.');
  const match=/<(?:[\w-]+:)?definitions\b[^>]*targetNamespace=["']([^"']+)["']/i.exec(xml);
  const namespace=match?.[1]||'http://www.cnj.jus.br/servico-intercomunicacao-2.2.2/';
  if(!/^https?:\/\/www\.cnj\.jus\.br\/servico-intercomunicacao-2\.(?:2|4)/.test(namespace)&&
   !/^https?:\/\/www\.cnj\.jus\.br\/mni/.test(namespace))
   return response('unexpected_response',adapter,[],wsdl.status,'Namespace desconhecido; contrato requer revisão.');
  const soap=publicMniEnvelope(cnj,namespace,adapter);
  const res=await fetch(adapter.endpoint,{
   method:'POST',redirect:'error',cache:'no-store',
   headers:{'Content-Type':'text/xml; charset=utf-8','SOAPAction':'"consultarProcesso"',Accept:'text/xml,application/soap+xml'},
   body:soap,signal:AbortSignal.timeout(12000),
  });
  if(res.status===429)return response('rate_limited',adapter,[],429,'Limite HTTP 429 do serviço MNI; nova tentativa será adiada.');
  if(res.status===401||res.status===403)return response('restricted',adapter,[],res.status,'Consulta MNI requer credenciamento/autorização.');
  if(!res.ok)return response('unavailable',adapter,[],res.status,'Serviço SOAP não concluiu a consulta.');
  const parsed=parseMniPublicMovements(await boundedText(res),cnj);
  const desc:Record<TribunalAttemptStatus,string>={
   verified:'Movimentos públicos MNI verificados e vinculados ao CNJ.',
   verified_empty:'Consulta MNI verificada, sem movimentos públicos na resposta.',
   unsupported:'Sem conector.',restricted:'Sem autorização para consulta pública desta origem.',
   rate_limited:'Limite do tribunal.',timeout:'Timeout no serviço oficial.',
   unavailable:'Sem resposta MNI confirmada.',
   unexpected_response:'O serviço retornou formato diferente do contrato esperado.',
   cnj_mismatch:'O tribunal devolveu número CNJ divergente; resposta rejeitada.',
  };
  return response(parsed.status,adapter,parsed.movements,res.status,desc[parsed.status]);
 }catch(error){
  const timedOut=error instanceof Error&&(error.name==='TimeoutError'||error.name==='AbortError');
  return response(timedOut?'timeout':'unavailable',adapter,[],null,
   timedOut?'Tempo esgotado na consulta oficial MNI.':'Conexão ao serviço MNI indisponível; nenhum movimento confirmado.');
 }
}
