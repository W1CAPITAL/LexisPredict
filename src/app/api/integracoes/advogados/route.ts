import {NextRequest,NextResponse} from 'next/server';
import {getUserContext,getSupabaseAdmin} from '@/lib/server-db';
import {normalizeLawyerSearch} from '@/lib/integracoes-suite';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
export async function GET(request:NextRequest){
 const ctx=await getUserContext();
 if(!ctx?.auth_id||!ctx?.empresa_id)return NextResponse.json({ok:false,error:'Faça login.'},{status:401,headers});
 const name=normalizeLawyerSearch(request.nextUrl.searchParams.get('nome')||'');
 if(!name)return NextResponse.json({ok:false,error:'Informe o nome completo ou parte do nome do advogado, com ao menos 3 letras.'},{status:400,headers});
 const db=await getSupabaseAdmin();
 let query=db.from('processos')
  .select('id,protocolo_ref,cliente,tribunal,advogado,status,status_interno,proximo_retorno,datajud_ultimo_nome,datajud_ultimo_movimento,updated_at,created_by')
  .eq('empresa_id',ctx.empresa_id)
  .ilike('advogado','%'+name+'%')
  .order('updated_at',{ascending:false}).limit(60);
 if(ctx.caseScope!=='empresa'&&!ctx.isSuperAdmin&&!ctx.isSupervisor){
  const ids=[ctx.auth_id,ctx.profile_id].filter((x):x is string=>!!x);
  if(!ids.length)return NextResponse.json({ok:true,records:[],count:0,partial:false,source:'carteira_autorizada'},{headers});
  query=query.in('created_by',ids);
 }
 const {data,error}=await query;
 if(error)return NextResponse.json({ok:false,error:'Erro ao consultar a carteira do escritório.'},{status:503,headers});
 const records=(data||[]).map(item=>({
   id:item.id,cnj:String(item.protocolo_ref||''),cliente:String(item.cliente||'').slice(0,110),
   tribunal:String(item.tribunal||'').slice(0,35),advogado:String(item.advogado||'').slice(0,100),
   status:String(item.status_interno||item.status||'').slice(0,65),
   ultimaMovimentacao:String(item.datajud_ultimo_nome||'').slice(0,200),
   dataMovimento:item.datajud_ultimo_movimento||null,proximoRetorno:item.proximo_retorno||null
 }));
 return NextResponse.json({ok:true,records,count:records.length,partial:records.length>=60,
   source:'carteira_autorizada',notice:'Busca na carteira da sua empresa, não varredura completa de todos os tribunais.'},{headers});
}
