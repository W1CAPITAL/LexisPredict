import {NextRequest, NextResponse} from 'next/server';
import {getUserContext,getSupabaseAdmin} from '@/lib/server-db';
import {canonicalCnj,extractAutosDocuments,isSafeAutosKey} from '@/lib/autos-oab-logic';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const BASE='https://api.escavador.com/api/v2/processos/numero_cnj';
const PRIVATE_HEADERS={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Vary':'Cookie'};
const JSON_HEADERS={...PRIVATE_HEADERS,'Content-Type':'application/json; charset=utf-8'};
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:PRIVATE_HEADERS});
const configured=()=>Boolean(process.env.ESCAVADOR_API_TOKEN||process.env.ESCAVADOR_API_KEY);
function token():string {
 const value=process.env.ESCAVADOR_API_TOKEN||process.env.ESCAVADOR_API_KEY;
 if(!value)throw new Error('ESCAVADOR_NOT_CONFIGURED');
 return value;
}
async function access(cnj?:string){
 const ctx=await getUserContext();
 if(!ctx?.auth_id||!ctx?.empresa_id)return {error:response({ok:false,error:'Faça login para consultar autos.'},401)};
 if(ctx.isViewer||!(ctx.isSuperAdmin||ctx.isSupervisor||ctx.isAdministrador)){
   return {error:response({ok:false,error:'Somente supervisão e administradores podem solicitar autos com certificado.'},403)};
 }
 if(cnj){
   const admin=await getSupabaseAdmin();
   const {data,error}=await admin.from('processos')
     .select('id,cliente,protocolo_ref').eq('empresa_id',ctx.empresa_id)
     .in('protocolo_ref',[cnj,cnj.replace(/\D/g,'')]).limit(1);
   if(error)return {error:response({ok:false,error:'Não foi possível validar a carteira.'},503)};
   if(!data?.length)return {error:response({ok:false,error:'CNJ não localizado na carteira autorizada desta empresa.'},404)};
 }
 return {ctx};
}
function providerUrl(cnj:string,resource:string):string{
 return `${BASE}/${encodeURIComponent(cnj)}/${resource}`;
}
async function provider(path:string,method:'GET'|'POST'='GET',body?:object,timeoutMs=16000){
 const res=await fetch(path,{
  method,headers:{'Accept':'application/json','Authorization':`Bearer ${token()}`,...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined,
  signal:AbortSignal.timeout(Math.max(2000,Math.min(16000,timeoutMs))),redirect:'error',cache:'no-store',
 });
 if(!res.ok){
  // Never reflect provider errors or credential values into the UI/logs.
  throw new Error(`ESCAVADOR_HTTP_${res.status}`);
 }
 const text=await res.text();
 if(text.length>2_000_000)throw new Error('ESCAVADOR_RESPONSE_TOO_LARGE');
 try{return JSON.parse(text);}catch{throw new Error('ESCAVADOR_INVALID_RESPONSE');}
}
function serviceError(e:unknown){
 const raw=e instanceof Error?e.message:'';
 if(raw==='ESCAVADOR_NOT_CONFIGURED')return response({ok:false,error:'Configure a chave Escavador no servidor e o certificado A1 no painel do provedor.'},503);
 if(raw.includes('429'))return response({ok:false,error:'Limite de consultas da integração atingido; tente mais tarde.'},429);
 if(raw.includes('401')||raw.includes('403'))return response({ok:false,error:'A integração Escavador recusou as credenciais. Confira o token e a autorização do certificado no provedor.'},502);
 if(raw.includes('402'))return response({ok:false,error:'A integração exige créditos. Nenhum novo pedido será iniciado antes da regularização.'},402);
 if(raw.includes('Abort')||raw.includes('timeout'))return response({ok:false,error:'A consulta ao provedor demorou demais. Verifique o status novamente.'},504);
 return response({ok:false,error:'Não foi possível consultar a integração de autos. Confira o provedor e tente novamente.'},502);
}
function parseNextCursor(value:unknown,cnj:string):string|null{
 if(typeof value!=='string'||value.length>3500)return null;
 try {
  const next=new URL(value);
  if(next.protocol!=='https:'||next.hostname!=='api.escavador.com')return null;
  if(next.pathname!==new URL(providerUrl(cnj,'autos')).pathname)return null;
  const cursor=next.searchParams.get('cursor');
  return cursor&&cursor.length<=3000?cursor:null;
 }catch{return null;}
}
export async function GET(request:NextRequest){
 const url=request.nextUrl;
 const action=url.searchParams.get('action')||'config';
 const cnj=canonicalCnj(url.searchParams.get('cnj'));
 const auth=await access(action==='config'?undefined:cnj??undefined);
 if(auth.error)return auth.error;
 if(action==='config')return response({
  ok:true,configured:configured(),provider:'Escavador API v2',
  certificate:'Certificado A1 do advogado cadastrado diretamente no provedor',
  requiresCredits:true,storedInLexis:false,
 });
 if(!cnj)return response({ok:false,error:'Informe um número CNJ válido.'},400);
 if(!configured())return serviceError(new Error('ESCAVADOR_NOT_CONFIGURED'));
 try{
  if(action==='status'){
   const data=await provider(providerUrl(cnj,'status-atualizacao'));
   const recent=data?.ultima_verificacao||data?.ultima_atualizacao||data?.data?.ultima_verificacao||data;
   return response({ok:true,cnj,status:String(recent?.status||data?.status||'DESCONHECIDO').toUpperCase(),
     motivoErro:recent?.status==='ERRO'?'O provedor não conseguiu acessar o tribunal. Verifique a autenticação diretamente no provedor.':null,
     concluidoEm:recent?.concluido_em??null});
  }
  if(action==='autos'){
   const documents:ReturnType<typeof extractAutosDocuments>=[];
   const seen=new Set<string>();
   const initialCursor=url.searchParams.get('cursor')||'';
   if(initialCursor.length>3000)return response({ok:false,error:'Cursor inválido.'},400);
   let cursor=initialCursor||null;
   let nextCursor:string|null=null;
   let pages=0;
   const began=Date.now();
   // Bounded traversal: never claim the court's complete files were read.
   do{
    const q=new URL(providerUrl(cnj,'autos'));
    q.searchParams.set('limit','100');
    if(cursor)q.searchParams.set('cursor',cursor);
    const result=await provider(q.toString(),'GET',undefined,7000);
    pages++;
    for(const doc of extractAutosDocuments(result)){
      if(seen.has(doc.key))continue;
      seen.add(doc.key);documents.push(doc);
    }
    nextCursor=parseNextCursor(result?.links?.next,cnj);
    cursor=nextCursor;
   }while(cursor&&pages<6&&documents.length<600&&Date.now()-began<40000);
   return response({ok:true,cnj,documents,nextCursor,complete:!nextCursor,
    pages, contestacaoEncontrada:documents.some(x=>x.tipoDetectado==='contestacao'),
    disclaimer:'Uma peça identificada como contestação pelo título não confirma que foi apresentada pelo banco. Verifique autoria e conteúdo.'});
  }
  if(action==='documento'){
   const key=url.searchParams.get('key');
   const rawExt=(url.searchParams.get('ext')||'bin').toLowerCase();
   const ext=['pdf','docx','doc','xlsx','xls','png','jpg','jpeg','txt','xml','odt','zip','bin'].includes(rawExt)?rawExt:'bin';
   if(!isSafeAutosKey(key))return response({ok:false,error:'Documento inválido.'},400);
   const file=await fetch(providerUrl(cnj,'documentos/'+encodeURIComponent(key)),{
     headers:{Authorization:`Bearer ${token()}`,Accept:'application/pdf,image/png,image/jpeg,application/octet-stream,*/*'},
     signal:AbortSignal.timeout(24000),redirect:'error',cache:'no-store',
   });
   if(!file.ok||!file.body)return serviceError(new Error('ESCAVADOR_HTTP_'+file.status));
   const size=Number(file.headers.get('content-length')||0);
   if(size>25_000_000)return response({ok:false,error:'Documento maior que o limite de download (25 MB).'},413);
   const upstreamType=String(file.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
   const mime=['application/pdf','image/jpeg','image/png','application/octet-stream'].includes(upstreamType)?upstreamType:'application/octet-stream';
   // Stream body rather than buffering documents in Vercel or storing credentials.
   const reader=file.body.getReader();let sent=0;
   const stream=new ReadableStream<Uint8Array>({
     async pull(controller) {
       try {
         const next=await reader.read();
         if(next.done){controller.close();return;}
         sent+=next.value.byteLength;
         if(sent>25_000_000){await reader.cancel();controller.error(new Error('Documento acima do limite'));return;}
         controller.enqueue(next.value);
       }catch(err){controller.error(err);}
     },
     cancel(){void reader.cancel();}
   });
   return new Response(stream,{status:200,headers:{
     ...PRIVATE_HEADERS,'Content-Type':mime,'Content-Disposition':`attachment; filename="autos-${cnj.replace(/\D/g,'')}-documento.${ext}"`,
     'Content-Security-Policy':"default-src 'none'; sandbox",
   }});
  }
  return response({ok:false,error:'Operação desconhecida.'},400);
 }catch(e){return serviceError(e);}
}
export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 if(origin && origin!==request.nextUrl.origin)return response({ok:false,error:'Origem não autorizada.'},403);
 const input=await request.json().catch(()=>null);
 if(!input||input.action!=='solicitar')return response({ok:false,error:'Operação inválida.'},400);
 const cnj=canonicalCnj(input.cnj);
 if(!cnj)return response({ok:false,error:'Informe um número CNJ válido.'},400);
 const auth=await access(cnj);
 if(auth.error)return auth.error;
 if(!configured())return serviceError(new Error('ESCAVADOR_NOT_CONFIGURED'));
 if(input.confirmAuthorized!==true||input.confirmCosts!==true)
   return response({ok:false,error:'Confirme a autorização do advogado e a possibilidade de cobrança antes de solicitar.'},400);
 // The private certificate and password must never transit through LexisPredict.
 if('certificado' in input||'senha' in input||'pfx' in input||'token' in input)
   return response({ok:false,error:'Não envie certificados ou senhas por esta integração.'},400);
 try{
   const body:Record<string,number>={autos:1,utilizar_certificado:1};
   const id=Number(process.env.ESCAVADOR_CERTIFICADO_ID||0);
   if(Number.isInteger(id)&&id>0)body.certificado_id=id;
   const result=await provider(providerUrl(cnj,'solicitar-atualizacao'),'POST',body);
   return response({ok:true,cnj,status:'PENDENTE',solicitado:true,
      pedidoId:result?.id??result?.ultima_verificacao?.id??null,
      message:'Solicitação enviada ao provedor; acompanhe o status antes de listar os autos.'});
 }catch(e){return serviceError(e);}
}
