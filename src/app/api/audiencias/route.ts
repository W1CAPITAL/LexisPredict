import {NextResponse} from 'next/server';
import {getUserContext,getSupabaseAdmin} from '@/lib/server-db';
import {reviewHermesCase} from '@/lib/hermes-return-service';
import {atualizarAudienciasDeConsulta} from '@/lib/audiencias-service';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
export async function GET(){
  const ctx=await getUserContext();
  if(!ctx.auth_id||!ctx.empresa_id)return NextResponse.json({ok:false,error:'Não autenticado'},{status:401,headers});
  try {
    const db=await getSupabaseAdmin();
    const {data,error}=await db.from('audiencias_monitoradas')
      .select('id,processo_id,protocolo_ref,cliente,advogado,tribunal,tipo,data_evento,data_fim,hora_local,hora_fim,fuso,modalidade,situacao,fonte,fonte_url,portal_url,meeting_url,evidencia,verificado_em,atualizado_em')
      .eq('empresa_id',ctx.empresa_id)
      .order('data_evento',{ascending:true,nullsFirst:false}).limit(800);
    if(error)throw error;
    return NextResponse.json({ok:true,items:data||[],consultadoEm:new Date().toISOString()},{headers});
  }catch(error){
    console.error('[audiencias] list',error instanceof Error?error.message:'erro');
    return NextResponse.json({ok:false,error:'Agenda de audiências indisponível'},{status:503,headers});
  }
}
export async function POST(request:Request){
  const ctx=await getUserContext();
  if(!ctx.auth_id||!ctx.empresa_id||ctx.isViewer)return NextResponse.json({ok:false,error:'Acesso negado'},{status:403,headers});
  const origin=request.headers.get('origin');
  if(origin){try{if(new URL(origin).host!==new URL(request.url).host)throw Error('origin');}
    catch{return NextResponse.json({ok:false,error:'Origem inválida'},{status:403,headers});}}
  const body=await request.json().catch(()=>({}));
  const processId=Number(body?.processId);
  if(!Number.isSafeInteger(processId)||processId<=0)return NextResponse.json({ok:false,error:'Processo inválido'},{status:400,headers});
  try {
    const result=await reviewHermesCase({empresaId:String(ctx.empresa_id),processId,mode:'manual'});
    if(!result.ok)return NextResponse.json({ok:false,error:'Processo não localizado nesta empresa'},{status:404,headers});
    // Idempotente; também lê eventuais documentos oficiais já salvos no cadastro.
    const audiencias=await atualizarAudienciasDeConsulta({empresaId:String(ctx.empresa_id),processoId:processId});
    if(!audiencias.ok)return NextResponse.json({ok:false,error:'Consulta executada, mas a agenda não pôde ser atualizada'},{status:503,headers});
    return NextResponse.json({ok:true,processId,eventoDetectados:audiencias.total,reviewState:result.state},{headers});
  }catch(error){
    console.error('[audiencias] refresh',error instanceof Error?error.message:'erro');
    return NextResponse.json({ok:false,error:'Não foi possível consultar as fontes oficiais agora'},{status:503,headers});
  }
}
