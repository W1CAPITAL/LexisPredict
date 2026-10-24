import React from "react";
import {getUserContext,getSupabaseAdmin} from "@/lib/server-db";
import {ReportTeamSummaryPdf} from "@/components/pdf/report-team-summary-pdf";
import type {EquipeRelatorio} from "@/components/report/team-report";
import {canExportOperationalData} from "@/lib/roles";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const val=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?v:null;

export async function GET(request:Request){
 try{
  const ctx=await getUserContext();
  if(!ctx.empresa_id||!ctx.auth_id)return Response.json({error:"Sessão necessária."},{status:401,headers:{"Cache-Control":"no-store"}});
  if(!canExportOperationalData(ctx))return Response.json({error:"Seu perfil não pode exportar relatórios."},{status:403,headers:{"Cache-Control":"no-store"}});
  const url=new URL(request.url);
  const raw=url.searchParams.get("periodo");
  const periodo=raw==="esta_semana"||raw==="semana_passada"||raw==="mes"?raw:"mes";
  const requestedScope=url.searchParams.get("escopo")==="meus"?"meus":"empresa";
  const canViewTeam=Boolean(ctx.isSupervisor||ctx.isSuperAdmin);
  if(requestedScope==="empresa"&&!canViewTeam)return Response.json({error:"Somente Supervisor ou Superadmin pode exportar dados da empresa."},{status:403,headers:{"Cache-Control":"no-store"}});
  const scope=requestedScope==="meus"?"Minha carteira":"Empresa inteira";
  const owner=scope==="Minha carteira"?ctx.auth_id:null;
  const db=await getSupabaseAdmin();
  const [teamResult,snapshotResult,meritoResult,retornoResult,histResult]=await Promise.all([
    db.rpc("lexis_relatorio_equipe_periodo",{p_empresa:String(ctx.empresa_id),p_periodo:periodo}),
    db.rpc("lexis_portfolio_snapshot",{p_empresa:String(ctx.empresa_id),p_owner:owner}),
    db.rpc("lexis_merito_snapshot",{p_empresa:String(ctx.empresa_id),p_owner:owner}),
    db.rpc("lexis_retorno_snapshot",{p_empresa:String(ctx.empresa_id),p_owner:owner,p_dias:30}),
    db.rpc("lexis_atividade_kpis_periodo",{p_empresa:String(ctx.empresa_id),p_periodo:periodo}),
  ]);
  if(teamResult.error||!teamResult.data||!Array.isArray(teamResult.data.pessoas)){
    return Response.json({error:"Não foi possível consultar a equipe para exportação."},{status:503,headers:{"Cache-Control":"no-store"}});
  }
  const rawTeam=teamResult.data as EquipeRelatorio;
  const team:EquipeRelatorio=owner?{...rawTeam,pessoas:rawTeam.pessoas.filter(p=>p.userId===String(owner))}:rawTeam;
  const snap=Array.isArray(snapshotResult.data)?snapshotResult.data[0]:null;
  const merito=meritoResult.data?.oficial;
  const ret=retornoResult.data;
  const hist=histResult.data;
  const overview={
   total:val(snap?.total),ativos:val(snap?.ativos),encerrados:val(snap?.encerrados),
   vencidos:val(snap?.vencidos),novidades:val(snap?.novidades),
   atendidos:val(owner?hist?.porUsuario?.find((p:{userId:string})=>p.userId===String(owner))?.processos:hist?.processos),
   eventos:val(owner?hist?.porUsuario?.find((p:{userId:string})=>p.userId===String(owner))?.eventos:hist?.eventos),
   semRetorno30:val(ret?.semRetornoLongo),meritoPendente:val(merito?.nao_determinados),
   procedentes:val(merito?.procedentes),improcedentes:val(merito?.improcedentes),
   parciais:val(merito?.parciais),semMerito:val(merito?.sem_merito)
  };
  // PDF produzido no servidor: o computador do usuário não processa gráficos nem fontes de um PDF pesado.
  const {renderToBuffer}=await import("@react-pdf/renderer");
  const trend:Array<{ymd:string;atendimentos:number;encerramentos:number}>=Array.isArray(hist?.dias)?hist.dias.map((day:{ymd:string;atendimentos:number})=>({
   ymd:day.ymd,
   atendimentos:owner?Number((hist.porUsuarioDia||[]).filter((x:{userId:string;ymd:string})=>x.userId===String(owner)&&x.ymd===day.ymd).reduce((acc:number,x:{eventos:number})=>acc+Number(x.eventos||0),0)):Number(day.atendimentos||0),
   encerramentos:Number((hist.porUsuarioDia||[]).filter((x:{userId:string;ymd:string})=>x.ymd===day.ymd&&(!owner||x.userId===String(owner))).reduce((acc:number,x:{encerramentos:number})=>acc+Number(x.encerramentos||0),0))
  })): [];
  const doc=React.createElement(ReportTeamSummaryPdf,{data:team,overview,scope,trend});
  // O componente retorna <Document>, embora os props do componente não sejam DocumentProps.
  const buffer=await renderToBuffer(doc as unknown as React.ReactElement<import("@react-pdf/renderer").DocumentProps>);
  const name="LexisPredict-Relatorio-Gerencial-"+periodo+".pdf";
  return new Response(new Uint8Array(buffer),{
   status:200,headers:{
    "Content-Type":"application/pdf",
    "Content-Disposition":'attachment; filename="'+name+'"',
    "Cache-Control":"private, no-store, max-age=0",
    "X-Content-Type-Options":"nosniff"
   }
  });
 }catch(error){
  console.error("[report/pdf] Falha ao gerar exportação:",error instanceof Error?error.message:"erro não identificado");
  return Response.json({error:"Não foi possível gerar o PDF. Os dados do relatório permanecem intactos."},{status:500,headers:{"Cache-Control":"no-store"}});
 }
}
