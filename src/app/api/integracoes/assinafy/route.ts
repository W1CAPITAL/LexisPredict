import {NextRequest,NextResponse} from 'next/server';
import {getUserContext} from '@/lib/server-db';
import {W1_EMPRESA_PRINCIPAL_ID} from '@/lib/w1-empresa';
import {validateAssinafyPdf} from '@/lib/documents/assinafy-upload';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;

const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
function fail(error:string,status:number){return NextResponse.json({ok:false,error},{status,headers});}

async function authorization(){
 const ctx=await getUserContext();
 if(!ctx?.auth_id||!ctx?.empresa_id)return {ok:false as const,status:401,error:'Faça login para acessar documentos.'};
 if(ctx.isViewer||!(ctx.isSuperAdmin||ctx.isSupervisor||ctx.isAdministrador))return {ok:false as const,status:403,error:'Somente a administração pode preparar assinaturas externas.'};
 const allowed=String(process.env.ASSINAFY_ALLOWED_EMPRESA_ID||W1_EMPRESA_PRINCIPAL_ID).toLowerCase();
 if(String(ctx.empresa_id).toLowerCase()!==allowed)return {ok:false as const,status:403,error:'A conta Assinafy não pertence a esta empresa.'};
 return {ok:true as const};
}

function credentials(){
 const apiKey=process.env.ASSINAFY_API_KEY?.trim()||'';
 const accountId=process.env.ASSINAFY_ACCOUNT_ID?.trim()||'';
 return apiKey&&accountId?{apiKey,accountId}:null;
}

export async function GET(){
 const auth=await authorization();
 if(!auth.ok)return fail(auth.error,auth.status);
 return NextResponse.json({ok:true,configured:!!credentials(),mode:'preparar-documento',sendsInvites:false},{headers});
}

/**
 * Envia um PDF para o workspace Assinafy somente após confirmação explícita.
 * Não cria signatários, assignments, convites, mensagens ou cobranças.
 * Contrato REST referenciado do SDK oficial @assinafy/sdk (MIT): documents.upload.
 */
export async function POST(request:NextRequest){
 const auth=await authorization();
 if(!auth.ok)return fail(auth.error,auth.status);
 const config=credentials();
 if(!config)return fail('Assinafy ainda não vinculada à administração. Não foi enviado nenhum documento.',503);
 const origin=request.headers.get('origin');
 if(origin&&origin!==request.nextUrl.origin)return fail('Origem da solicitação não autorizada.',403);
 const contentType=request.headers.get('content-type')||'';
 if(!contentType.toLowerCase().startsWith('multipart/form-data;'))return fail('Envie o PDF como formulário.',415);
 const requestSize=Number(request.headers.get('content-length')||0);
 if(Number.isFinite(requestSize)&&requestSize>26*1024*1024)return fail('Arquivo muito grande.',413);
 let form:FormData;
 try{form=await request.formData();}
 catch{return fail('Arquivo inválido ou formulário incompleto.',400);}
 if(form.get('confirmed')!=='true')return fail('Revise o documento e confirme explicitamente antes do envio.',400);
 const file=form.get('pdf');
 if(!(file instanceof File))return fail('Selecione um PDF válido.',400);
 if(file.size>25*1024*1024)return fail('O PDF excede 25 MB.',413);
 let bytes:Uint8Array;
 try{bytes=new Uint8Array(await file.arrayBuffer());}
 catch{return fail('Não foi possível ler o PDF.',400);}
 const check=validateAssinafyPdf(bytes,file.name);
 if(!check.ok)return fail(check.error,400);
 const externalForm=new FormData();
 externalForm.append('file',new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),check.name);
 try{
  const url='https://api.assinafy.com.br/v1/accounts/'+encodeURIComponent(config.accountId)+'/documents';
  const upstream=await fetch(url,{
   method:'POST',
   headers:{'X-Api-Key':config.apiKey,'Accept':'application/json'},
   body:externalForm,
   cache:'no-store',
   redirect:'error',
   signal:AbortSignal.timeout(22000)
  });
  if(!upstream.ok){
   // Não repetir uploads automaticamente: um erro remoto pode ter criado o documento.
   return fail(upstream.status===401||upstream.status===403
     ? 'A conta Assinafy não autorizou este workspace; confira a conexão.'
     : 'A Assinafy não confirmou o preparo. Verifique a conta antes de tentar novamente.',502);
  }
  const payload=await upstream.json() as {id?:unknown;status?:unknown;account_id?:unknown};
  if(typeof payload.id!=='string'||!payload.id.trim())
   return fail('Resposta sem ID. Confira o painel Assinafy antes de tentar novamente.',502);
  if(typeof payload.account_id==='string'&&payload.account_id!==config.accountId)
   return fail('A Assinafy respondeu com workspace diferente. Procure o administrador.',502);
  return NextResponse.json({ok:true,documentId:payload.id,status:String(payload.status||'uploaded'),sentToSigners:false},{headers});
 }catch{
  return fail('Não foi possível confirmar o preparo. Consulte a conta Assinafy antes de repetir para evitar duplicação.',504);
 }
}
