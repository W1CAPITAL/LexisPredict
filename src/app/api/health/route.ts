import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Health check leve — NÃO usa DB pesado.
 * Confirma processo vivo + env críticas + uptime.
 */
export async function GET(request:Request) {
  const scope=new URL(request.url).searchParams.get('scope');
  if(scope==='commercial'){
    return NextResponse.json({
      ok:true,product:'LexisPredict Commercial',
      supabase:Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      serviceRole:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      environment:process.env.VERCEL_ENV||process.env.NODE_ENV||'unknown',
    },{headers:{'Cache-Control':'no-store'}});
  }
  if(scope==='crm'){
    const tables=['crm_negocios','crm_receber','crm_pagar','crm_servicos','crm_atividades','crm_tarefas'];
    const status:Record<string,string>={};
    try{
      const {getSupabaseAdmin}=await import('@/lib/server-db');
      const admin=await getSupabaseAdmin();
      for(const table of tables){
        const {error}=await admin.from(table).select('id').limit(1);
        status[table]=error?(error.message.includes('exist')||error.code==='42P01'?'missing':'error'):'ok';
      }
      return NextResponse.json({success:true,status,ts:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
    }catch(e){
      return NextResponse.json({success:false,error:e instanceof Error?e.message:'Health CRM indisponível.'},{status:500});
    }
  }
  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const body = {
    ok: true,
    app: "lexispredict",
    version: process.env.npm_package_version || process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
    supabaseEnv: hasSupabase,
    khojEnv: Boolean(process.env.KHOJ_URL && (process.env.KHOJ_TOKEN || process.env.KHOJ_API_TOKEN)),
    node: process.version,
    uptimeSec: Math.round(process.uptime()),
    ts: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
