/**
 * Diagnóstico explícito e de baixa frequência do WSDL público do TJPR.
 * Não executa consultarProcesso, não acessa documentos, não altera o estado
 * judicial e não presume que o WSDL acessível garante API sem credenciais.
 * A Resolução 532-OE/2026 dispensa login para movimentos públicos; o manual
 * antigo do SCMPP ainda apresenta idManifestante. Precisa validar o contrato.
 */
export type TjprScmppInstance='1g'|'2g';
export type TjprScmppStatus=
 |'wsdl_detected'|'restricted'|'rate_limited'|'unavailable'|'timeout'|'unexpected_response';
export type TjprScmppProbe={
 status:TjprScmppStatus;
 instance:TjprScmppInstance;
 checkedAt:string;
 httpStatus:number|null;
 message:string;
 movementsConfirmed:false;
};
const WSDL_ENDPOINTS:Record<TjprScmppInstance,string>={
 '1g':'https://projudi.tjpr.jus.br/projudi_consulta/webservices/projudiIntercomunicacaoWebService222?wsdl',
 '2g':'https://projudi.tjpr.jus.br/projudi_consulta/webservices/projudiIntercomunicacaoWebService2G222?wsdl',
};
const MAX_BYTES=131_072;
const TIMEOUT_MS=6_000;

async function boundedResponseText(response:Response):Promise<string>{
 const headerLength=Number(response.headers.get('content-length'));
 if(Number.isFinite(headerLength)&&headerLength>MAX_BYTES)return '';
 const stream=response.body;
 if(!stream)return '';
 const reader=stream.getReader();
 const buffers:Uint8Array[]=[];
 let total=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   if(value){
    total+=value.byteLength;
    if(total>MAX_BYTES){await reader.cancel();return '';}
    buffers.push(value);
   }
  }
 }finally{reader.releaseLock();}
 const output=new Uint8Array(total);
 let at=0;
 for(const b of buffers){output.set(b,at);at+=b.byteLength;}
 return new TextDecoder().decode(output);
}

function result(instance:TjprScmppInstance,status:TjprScmppStatus,httpStatus:number|null,message:string):TjprScmppProbe{
 return {instance,status,checkedAt:new Date().toISOString(),httpStatus,message,movementsConfirmed:false};
}

/** Somente destinos oficiais fixos: nunca encaminhar URL do navegador a fetch. */
export async function probeTjprScmppWsdl(instance:TjprScmppInstance='1g'):Promise<TjprScmppProbe>{
 if(instance!=='1g'&&instance!=='2g')return result('1g','unavailable',null,'Instância SCMPP inválida.');
 try{
  const res=await fetch(WSDL_ENDPOINTS[instance],{
   method:'GET',redirect:'error',cache:'no-store',
   headers:{Accept:'text/xml,application/xml;q=0.9'},
   signal:AbortSignal.timeout(TIMEOUT_MS),
  });
  if(res.status===429)return result(instance,'rate_limited',429,
   'O TJPR limitou a consulta ao serviço SCMPP (HTTP 429). Nenhuma nova tentativa automática será feita.');
  if(res.status===401||res.status===403)return result(instance,'restricted',res.status,
   'O WSDL do TJPR exige permissão ou recusou esta origem. O contrato público de consulta não foi confirmado.');
  if(!res.ok)return result(instance,'unavailable',res.status,
   'O serviço SCMPP do TJPR não respondeu com sucesso. Utilize o portal oficial para a consulta humana.');
  const xml=await boundedResponseText(res);
  const valid=/<(?:[\w-]+:)?definitions\b/i.test(xml)&&
   xml.includes('http://schemas.xmlsoap.org/wsdl/')&&
   /consultarProcesso/i.test(xml);
  if(!valid)return result(instance,'unexpected_response',res.status,
   'A resposta não contém um WSDL SOAP/MNI reconhecível com o método consultarProcesso. Pode ser página de login, bloqueio ou contrato diferente.');
  return result(instance,'wsdl_detected',res.status,
   'WSDL oficial do TJPR acessível nesta origem. Ainda falta validar uma consulta pública real por CNJ; nenhum andamento foi consultado.');
 }catch(e){
  const timedOut=e instanceof Error&&(e.name==='AbortError'||e.name==='TimeoutError');
  return result(instance,timedOut?'timeout':'unavailable',null,
   timedOut?'Tempo esgotado ao verificar o WSDL do TJPR.':'Não foi possível conectar ao WSDL do TJPR a partir do servidor.');
 }
}
