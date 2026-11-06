import {NextRequest,NextResponse} from 'next/server';
import {getUserContext,getSupabaseAdmin} from '@/lib/server-db';
import {normalizeLawyerSearch} from '@/lib/integracoes-suite';
import {LAWYER_SEARCH_COLUMNS,mergeLawyerSearchResults,type LawyerSearchField} from '@/lib/lawyer-portfolio-search';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
export async function GET(request:NextRequest){
 const ctx=await getUserContext();
 if(!ctx?.auth_id||!ctx?.empresa_id)return NextResponse.json({ok:false,error:'Faça login.'},{status:401,headers});
 const name=normalizeLawyerSearch(request.nextUrl.searchParams.get('nome')||'');
 if(!name)return NextResponse.json({ok:false,error:'Informe o nome completo ou parte do nome do advogado, com ao menos 3 letras.'},{status:400,headers});
 const db=await getSupabaseAdmin();
 const permittedIds=[ctx.auth_id,ctx.profile_id].filter((x):x is string=>!!x);
 const ownerRestricted=ctx.caseScope!=='empresa'&&!ctx.isSuperAdmin&&!ctx.isSupervisor;
 if(ownerRestricted&&!permittedIds.length)
   return NextResponse.json({ok:true,records:[],count:0,partial:false,source:'carteira_autorizada'},{headers});

 // The legacy portfolio can store the lawyer in either a typed column or JSON.
 // Query each field separately to avoid embedding the name in raw PostgREST
 // filter expressions (apostrophes and punctuation can break .or() filters).
 const columns='id,protocolo_ref,cliente,tribunal,advogado,advogado_json:dados->>advogado,advogado_alt:dados->>ADVOGADO,status,status_interno,proximo_retorno,datajud_ultimo_nome,datajud_ultimo_movimento,updated_at,created_by';
 const searchTerm='%'+name+'%';
 const searchField=async(field:LawyerSearchField)=>{
   let query=db.from('processos')
     .select(columns)
     .eq('empresa_id',ctx.empresa_id)
     .ilike(field,searchTerm)
     .order('updated_at',{ascending:false}).limit(61);
   if(ownerRestricted)query=query.in('created_by',permittedIds);
   return await query;
 };
 const responses=await Promise.all(LAWYER_SEARCH_COLUMNS.map(field=>searchField(field)));
 if(responses.some(r=>r.error)){
   console.error('[integracoes/advogados] Falha na busca por nome',responses.map(r=>r.error?.code||null));
   return NextResponse.json({ok:false,error:'Erro ao consultar a carteira do escritório.'},{status:503,headers});
 }
 const merged=mergeLawyerSearchResults(responses.map(r=>r.data||[]));
 const data=merged.rows;
 const partial=merged.partial;
 const records=(data||[]).map(item=>({
   id:item.id,cnj:String(item.protocolo_ref||''),cliente:String(item.cliente||'').slice(0,110),
   tribunal:String(item.tribunal||'').slice(0,35),advogado:String(item.advogado||item.advogado_json||item.advogado_alt||'').slice(0,100),
   status:String(item.status_interno||item.status||'').slice(0,65),
   ultimaMovimentacao:String(item.datajud_ultimo_nome||'').slice(0,200),
   dataMovimento:item.datajud_ultimo_movimento||null,proximoRetorno:item.proximo_retorno||null
 }));
 return NextResponse.json({ok:true,records,count:records.length,partial,
   source:'carteira_autorizada',notice:'Busca apenas na carteira autorizada, inclusive campos antigos de advogado. Não equivale à pesquisa de processos por OAB nos tribunais.'},{headers});
}
