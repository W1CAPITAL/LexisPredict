import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, getSupabaseAdmin, getStoredCasesPageForEmpresa } from '@/lib/server-db';
import { isProcessDateField, isValidProcessDate, nextProcessDay, PROCESSOS_DATE_FIELDS, validateProcessDateRange } from '@/lib/processos-date-range';

export const dynamic='force-dynamic';
export const revalidate=0;
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','X-Content-Type-Options':'nosniff'};

export async function GET(request:NextRequest) {
  try {
    const ctx=await getUserContext();
    if(!ctx?.auth_id||!ctx?.empresa_id)
      return NextResponse.json({ok:false,error:'Sessão expirada.'},{status:401,headers});
    const url=new URL(request.url);
    const field=String(url.searchParams.get('field')||'');
    const from=String(url.searchParams.get('from')||'');
    const to=String(url.searchParams.get('to')||'');
    if(!isProcessDateField(field) || (!from&&!to) || validateProcessDateRange(from,to))
      return NextResponse.json({ok:false,error:validateProcessDateRange(from,to)||'Preencha um intervalo de datas válido.'},{status:400,headers});
    const page=Number(url.searchParams.get('offset')||0);
    const offset=Number.isInteger(page)?Math.max(0,Math.min(page,100000)):0;
    const limit=100;
    const empresaId=String(ctx.empresa_id);
    const config=PROCESSOS_DATE_FIELDS[field];
    const admin=await getSupabaseAdmin();
    // Never accept an empresa_id or an owner scope from the client.
    let countQuery=admin.from('processos').select('id',{count:'exact',head:true}).eq('empresa_id',empresaId);
    if(from)countQuery=countQuery.gte(config.column,config.timestamp?`${from}T00:00:00-03:00`:from);
    if(to){
      const next=nextProcessDay(to);
      countQuery=countQuery.lt(config.column,config.timestamp?`${next}T00:00:00-03:00`:next);
    }
    const [countResult, cases]=await Promise.all([
      countQuery,
      getStoredCasesPageForEmpresa(empresaId,limit,offset,false,{
        companyReadOnly:true,validatedContext:ctx,
        dateFilter:{field,from:from||undefined,to:to||undefined},
      }),
    ]);
    if(countResult.error)throw countResult.error;
    const totalCount=countResult.count??0;
    return NextResponse.json({ok:true,cases,totalCount,hasMore:offset+cases.length<totalCount,offset,limit,field,from,to},{headers});
  }catch(e){
    console.error('[api/carteira/filtered]',e instanceof Error?e.message:e);
    return NextResponse.json({ok:false,error:'Não foi possível consultar as datas no banco. Tente novamente.'},{status:503,headers});
  }
}
