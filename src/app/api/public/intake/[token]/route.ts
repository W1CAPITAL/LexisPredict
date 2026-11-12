import {NextRequest,NextResponse} from 'next/server';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {getSupabaseAdmin} from '@/lib/server-db';
import {validateIntakeAnswers,type IntakeField} from '@/lib/ops-suite/policy';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
type Params={params:Promise<{token:string}>};
function json(value:unknown,status=200){return NextResponse.json(value,{status,headers});}
function fingerprint(input:string,secret:string){
 return createHmac('sha256',secret).update(input).digest('hex');
}
function validToken(token:string){
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new Error('Link inválido.');
 return createHash('sha256').update(token).digest('hex');
}
async function lookup(token:string){
 const hash=validToken(token);
 const db=await getSupabaseAdmin();
 const {data,error}=await db.from('lexis_ops_forms').select('id,empresa_id,title,fields,status,expires_at,max_submissions,submissions_count')
  .eq('token_hash',hash).maybeSingle();
 if(error)throw new Error('Formulário indisponível.');
 if(!data||data.status!=='ativo'||Date.parse(data.expires_at)<=Date.now()||data.submissions_count>=data.max_submissions)
  throw new Error('Este formulário está expirado ou indisponível.');
 return {db,form:data,hash};
}
export async function GET(_request:NextRequest,{params}:Params){
 try{
  const {token}=await params;
  const {form}=await lookup(token);
  return json({ok:true,title:form.title,fields:form.fields,expiresAt:form.expires_at,attachmentTypes:['PDF','PNG','JPEG'],maxAttachments:2});
 }catch{return json({ok:false,error:'Link expirado, inválido ou indisponível.'},404);}
}
const MIME:Record<string,{extension:string;signature:(bytes:Uint8Array)=>boolean}>={
 'application/pdf':{extension:'.pdf',signature:(b)=>b.length>=4&&b[0]===37&&b[1]===80&&b[2]===68&&b[3]===70},
 'image/png':{extension:'.png',signature:(b)=>b.length>=4&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71},
 'image/jpeg':{extension:'.jpg',signature:(b)=>b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255}
};
export async function POST(request:NextRequest,{params}:Params){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return json({ok:false,error:'Origem não permitida.'},403);
 const length=Number(request.headers.get('content-length')||0);
 if(length>8_800_000)return json({ok:false,error:'Anexos excedem o limite.'},413);
 try{
  const {token}=await params;
  const {db,form,hash}=await lookup(token);
  const formData=await request.formData();
  if(formData.get('website'))return json({ok:false,error:'Resposta inválida.'},400);
  if(formData.get('consent')!=='yes')return json({ok:false,error:'Confirme a autorização para tratamento dos dados.'},400);
  const rawAnswers=String(formData.get('answers')||'{}');
  if(rawAnswers.length>16_000)throw new Error('Resposta muito longa.');
  const raw=JSON.parse(rawAnswers);
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Resposta inválida.');
  const answers=validateIntakeAnswers(form.fields as IntakeField[],raw);
  const inputFiles=formData.getAll('files').filter((x):x is File=>typeof x!=='string');
  if(inputFiles.length>2)throw new Error('Até dois anexos são permitidos.');
  const attachments:Array<{body:ArrayBuffer;mime:string;extension:string}>=[];
  for(const file of inputFiles){
   if(file.size>4194304||file.size<1)throw new Error('Cada arquivo precisa ter até 4 MB.');
   const rule=MIME[file.type];
   if(!rule)throw new Error('Apenas PDF, PNG e JPEG são aceitos.');
   const body=await file.arrayBuffer();
   if(!rule.signature(new Uint8Array(body)))throw new Error('O tipo real do anexo não corresponde à extensão informada.');
   attachments.push({body,mime:file.type,extension:rule.extension});
  }
  const remote=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||
    request.headers.get('x-real-ip')||'endereco_nao_informado';
  const secret=process.env.OPS_INTAKE_RATE_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret)throw new Error('Proteção de formulário indisponível.');
  const limitHash=fingerprint(hash+':'+remote,secret);
  const {data:slot,error:limitError}=await db.rpc('lexis_ops_intake_slot',{
   p_form:form.id,p_fingerprint:limitHash
  });
  if(limitError)throw new Error('Limite de envio indisponível.');
  if(slot!==true)return json({ok:false,error:'Muitas tentativas. Tente novamente depois.'},429);
  const {data:submissionId,error:submitError}=await db.rpc('lexis_ops_submit_intake',{
   p_token_hash:hash,p_answers:{...answers,_consent_at:new Date().toISOString()}
  });
  if(submitError||!submissionId)throw new Error('Este formulário não aceita mais respostas.');
  const savedPaths:string[]=[];
  const warnings:string[]=[];
  for(const attachment of attachments){
   const path=[form.empresa_id,form.id,submissionId,randomUUID()+attachment.extension].join('/');
   const {error}=await db.storage.from('lexis-intake-private').upload(path,Buffer.from(attachment.body),{
    contentType:attachment.mime,upsert:false
   });
   if(error)warnings.push('Um anexo não pôde ser salvo.');
   else savedPaths.push(path);
  }
  if(savedPaths.length){
   const {error}=await db.from('lexis_ops_submissions').update({attachments:savedPaths})
    .eq('id',submissionId).eq('empresa_id',form.empresa_id);
   if(error)warnings.push('Foi necessário revisar o vínculo dos anexos.');
  }
  return json({ok:true,message:'Resposta registrada.',warnings},201);
 }catch(e:any){
  const reason=String(e?.message||'Falha ao registrar formulário.');
  if(/inválid|obrigat|campo|anexo|preencha|arquivo|limite|autoriz/i.test(reason.toLowerCase()))
   return json({ok:false,error:reason.slice(0,220)},400);
  return json({ok:false,error:'Não foi possível registrar a resposta. Nenhum reenvio automático será realizado.'},503);
 }
}
