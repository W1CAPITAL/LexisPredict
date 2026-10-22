import Link from "next/link";
import {redirect} from "next/navigation";
import {getUserContext,getSupabaseAdmin} from "@/lib/server-db";
import {getHistoricoAtendimentosEmpresa,type AtendimentosHistorico} from "@/lib/historico-atendimentos";
import type {PeriodoRelatorio} from "@/lib/atendimento-semana";
import {ReportSync} from "@/components/report/report-sync";
import {ReportSmartOverview} from "@/components/report/report-smart-overview";
import {TeamReport,type EquipeRelatorio} from "@/components/report/team-report";

export const dynamic="force-dynamic";
export const revalidate=0;
const choices=[
 {id:"esta_semana",name:"Esta semana"},
 {id:"semana_passada",name:"Semana passada"},
 {id:"mes",name:"Mês atual"},
] as const;
const br=(ymd:string)=>ymd?ymd.slice(8,10)+"/"+ymd.slice(5,7):"";
const fmt=(num:number|null|undefined)=>num==null?"—":num.toLocaleString("pt-BR");
type EncerramentosResumo={
 encerramentosManuais:number;processosManuais:number;manuaisPermanecemEncerrados:number;
 testesAdministrativos:number;testesSemReversao:number;testesRevertidos:number;
 porUsuario:Array<{userId:string;nome:string;processos:number;eventos:number;permanecemEncerrados:number}>;
};
type TrabalhoInternoResumo={
 registros:number;processosDistintos:number;comContatoConfirmado:number;testes:number;testesRevertidos:number;
 porCategoria:Array<{categoria:string;registros:number;processos:number}>;
 porUsuario:Array<{userId:string;nome:string;registros:number;processos:number}>;
};
export default async function ReportPage({searchParams}:{searchParams:Promise<{periodo?:string;escopo?:string}>}){
 const params=await searchParams;
 const periodo:PeriodoRelatorio=params.periodo==="semana_passada"?"semana_passada":params.periodo==="esta_semana"?"esta_semana":"mes";
 const ctx=await getUserContext();
 if(!ctx.empresa_id||!ctx.auth_id)redirect("/login");
 const empresaId=String(ctx.empresa_id);
 // O relatório de equipe mostra a empresa inteira por padrão (também para
 // administradores). "Minha carteira" é uma comparação opcional e explícita.
 const somenteMinhaCarteira=params.escopo==="meus";
 const owner=somenteMinhaCarteira?ctx.auth_id:null;
 const pathRelatorio=(p:string,escopo:boolean=somenteMinhaCarteira)=>
   `/report?periodo=${encodeURIComponent(p)}&escopo=${escopo?"meus":"empresa"}`;
 const db=await getSupabaseAdmin();
 const [historyResult,snapshotResult,meritoResult,retornoResult,closuresResult,trabalhoResult,teamResult]=await Promise.allSettled([
  getHistoricoAtendimentosEmpresa(empresaId,periodo),
  db.rpc("lexis_portfolio_snapshot",{p_empresa:empresaId,p_owner:owner}),
  db.rpc("lexis_merito_snapshot",{p_empresa:empresaId,p_owner:owner}),
  db.rpc("lexis_retorno_snapshot",{p_empresa:empresaId,p_owner:owner,p_dias:30}),
  db.rpc("lexis_encerramentos_kpis_periodo",{p_empresa:empresaId,p_periodo:periodo}),
  db.rpc("lexis_trabalho_interno_periodo",{p_empresa:empresaId,p_periodo:periodo}),
  db.rpc("lexis_relatorio_equipe_periodo",{p_empresa:empresaId,p_periodo:periodo})
 ]);
 const hist:AtendimentosHistorico|null=historyResult.status==="fulfilled"?historyResult.value:null;
 const res=snapshotResult.status==="fulfilled"?snapshotResult.value:null;
 const row=Array.isArray(res?.data)?res.data[0]:null;
 const snapshot=res&&!res.error&&row?{
   total:Number(row.total||0),ativos:Number(row.ativos||0),encerrados:Number(row.encerrados||0),
   vencidos:Number(row.vencidos||0),novidades:Number(row.novidades||0),baixas:Number(row.baixas||0)
 }:null;
 const mr=meritoResult.status==="fulfilled"?meritoResult.value:null;
 const merito=mr&&!mr.error&&mr.data&&typeof mr.data==="object"?mr.data as Record<string,number>:null;
 // Movimentações TPU: não equivalem a confirmação de trânsito ou resultado do recurso.
 const meritoOficial=(merito as any)?.oficial as Record<string,number>|undefined;
 const rr=retornoResult.status==="fulfilled"?retornoResult.value:null;
 const retorno=rr&&!rr.error&&rr.data&&typeof rr.data==="object"?rr.data as Record<string,number>:null;
 const cr=closuresResult.status==="fulfilled"?closuresResult.value:null;
 const encerramentos:EncerramentosResumo|null=cr&&!cr.error&&cr.data&&typeof cr.data==="object"?
   cr.data as EncerramentosResumo:null;
 const tr=trabalhoResult.status==="fulfilled"?trabalhoResult.value:null;
 const trabalho:TrabalhoInternoResumo|null=tr&&!tr.error&&tr.data&&typeof tr.data==="object"?
   tr.data as TrabalhoInternoResumo:null;
 const er=teamResult.status==="fulfilled"?teamResult.value:null;
 const teamReport:EquipeRelatorio|null=er&&!er.error&&er.data&&typeof er.data==="object"&&Array.isArray((er.data as any).pessoas)?er.data as EquipeRelatorio:null;
 const totals=[
  {title:"Processos atendidos",value:hist?.processos,help:"Distintos no período, empresa inteira"},
  {title:"Atendimentos registrados",value:hist?.eventos,help:"Eventos feitos por pessoas"},
  {title:"Processos editados",value:hist?.edicoes?.processos,help:"CNJs distintos com edição manual auditada no período"},
  {title:"Editados hoje",value:hist?.edicoes?.hoje,help:"Edições auditadas; não inclui correções automáticas em lote"},
 ];
 const carteira=[
   {title:"Carteira",value:snapshot?.total},
   {title:"Ativos",value:snapshot?.ativos},
   {title:"Encerrados",value:snapshot?.encerrados},
   {title:"Vencidos",value:snapshot?.vencidos},
   {title:"Novidades",value:snapshot?.novidades},
   {title:"Baixas tribunal",value:snapshot?.baixas},
 ];
 return <main className="min-h-screen bg-background px-4 py-7 text-foreground sm:px-8">
   <div className="mx-auto max-w-[1400px] space-y-6">
    <header className="rounded-3xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">LexisPredict · Relatórios</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Relatório da equipe</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Veja o trabalho de cada colaborador, seus atendimentos, edições, encerramentos, dossiês, investigações e atividades efetivamente registradas. Consulte também os indicadores gerais e pergunte ao LLM local.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ReportSync/>
          <a href={`/api/report/pdf?periodo=${encodeURIComponent(periodo)}&escopo=${somenteMinhaCarteira?"meus":"empresa"}`} className="inline-flex items-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-bold text-primary hover:bg-indigo-500/15">Baixar PDF da equipe e resumo</a>
          <Link href="/minhas-atividades" className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold">Minhas atividades</Link>
          <Link href="/report/completo" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Relatório completo e PDFs</Link>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-muted-foreground">Escopo dos processos:</span>
        <Link href={pathRelatorio(periodo,false)} aria-current={!somenteMinhaCarteira?"page":undefined}
          className={`rounded-full border px-4 py-2 text-xs font-bold ${!somenteMinhaCarteira?"bg-primary text-primary-foreground border-primary":"border-border bg-background"}`}>
          Empresa inteira
        </Link>
        <Link href={pathRelatorio(periodo,true)} aria-current={somenteMinhaCarteira?"page":undefined}
          className={`rounded-full border px-4 py-2 text-xs font-bold ${somenteMinhaCarteira?"bg-primary text-primary-foreground border-primary":"border-border bg-background"}`}>
          Minha carteira
        </Link>
      </div>
      <nav aria-label="Selecionar período" className="mt-3 flex flex-wrap gap-2">
        {choices.map(x=><Link key={x.id} href={pathRelatorio(x.id)}
          aria-current={periodo===x.id?"page":undefined}
          className={`rounded-full border px-4 py-2 text-xs font-bold ${periodo===x.id?"border-primary bg-primary text-primary-foreground":"border-border bg-background text-foreground hover:bg-muted"}`}>{x.name}</Link>)}
      </nav>
    </header>
    <TeamReport data={teamReport}/>
    <ReportSmartOverview
      periodLabel={choices.find(x=>x.id===periodo)?.name||"Mês atual"}
      scopeLabel={somenteMinhaCarteira?"Minha carteira":"Empresa inteira"}
      total={snapshot?.total??null}
      ativos={snapshot?.ativos??null}
      encerrados={snapshot?.encerrados??null}
      vencidos={snapshot?.vencidos??null}
      novidades={snapshot?.novidades??null}
      atendidos={hist?.processos??null}
      eventos={hist?.eventos??null}
      semRetorno30={retorno?.semRetornoLongo??null}
      naoLocalizados={meritoOficial?.nao_localizados??null}
      meritoPendente={meritoOficial?.nao_determinados??null}
      encerradosEmCumprimento={meritoOficial?.encerrados_cumprimento??null}
      improcedentesOficiais={meritoOficial?.improcedentes??null}
      procedentesOficiais={meritoOficial?.procedentes??null}
      parciaisOficiais={meritoOficial?.parciais??null}
      semMeritoOficial={meritoOficial?.sem_merito??null}
      dias={hist?.dias?.map(d=>({ymd:d.ymd,atendimentos:d.atendimentos}))??[]}
      equipe={teamReport?.pessoas?.map(p=>({nome:p.nome,atendimentos:p.atendimentos,edicoes:p.edicoes,encerramentos:p.encerramentos,atividades:p.atividades.registros,trabalho:p.trabalho.registros,verificacoesLote:p.trabalho.verificacoesLote,categorias:p.trabalho.categorias.slice(0,6),entregas:p.trabalho.entregasRecentes.slice(0,5).map(e=>e.titulo)}))??[]}
    />
    <details className="group rounded-[1.5rem] border border-border bg-card px-4 py-5 shadow-sm sm:px-6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl p-2 text-left marker:hidden">
        <div><h2 className="text-lg font-extrabold">Ver relatório completo e informações técnicas</h2><p className="mt-1 text-sm text-muted-foreground">Mérito judicial, produtividade por colaborador, encerramentos, auditorias e evolução da carteira — sem perder nenhum detalhe.</p></div>
        <span className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-primary group-open:bg-primary group-open:text-primary-foreground">Abrir / fechar</span>
      </summary>
      <div className="mt-5 space-y-6">
    <section aria-labelledby="merito-oficial-title" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Auditoria judicial · CNJ / DataJud</p>
          <h2 id="merito-oficial-title" className="mt-1 text-xl font-extrabold">Resultado dos processos encerrados</h2>
          <p className="mt-1 max-w-4xl text-xs text-muted-foreground">Movimentos oficiais identificados no DataJud (TPU). O tipo de sentença registrado não confirma trânsito em julgado nem eventual reforma por recurso. Encerrado no CRM é situação administrativa, não julgamento.</p>
        </div>
        <a href="https://docs.google.com/spreadsheets/d/1ZIiMHQDg2IsFqZQWBSybV116Bbw7oXIqFzV5Mzl_3Hc/edit" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary underline">Consultar processo, advogado e movimento na planilha</a>
      </div>
      {meritoOficial?<div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[
            ["Encerrados no CRM",meritoOficial.encerrados],
            ["Improcedência identificada",meritoOficial.improcedentes],
            ["Procedência parcial identificada",meritoOficial.parciais],
            ["Procedência identificada",meritoOficial.procedentes],
            ["Resultados divergentes",meritoOficial.divergentes],
          ].map(([title,value])=><div key={String(title)} className="rounded-xl border border-border bg-background p-3">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{fmt(value as number)}</p>
          </div>)}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          {[
            ["Sem mérito",meritoOficial.sem_merito],
            ["Acordos",meritoOficial.acordos],
            ["Iniciais indeferidas",meritoOficial.indeferimentos],
            ["Distribuição cancelada",meritoOficial.cancelamentos],
            ["Desistência",meritoOficial.desistencias],
            ["Abandono",meritoOficial.abandonos],
            ["A esclarecer",meritoOficial.nao_determinados],
            ["Não localizados",meritoOficial.nao_localizados],
          ].map(([title,value])=><div key={String(title)} className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">{title}</p><p className="font-bold tabular-nums">{fmt(value as number)}</p>
          </div>)}
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-3 text-xs">
          <p className="font-bold">Justificativas individualizadas dos processos ainda sem resultado conclusivo</p>
          <p className="mt-1 text-muted-foreground">Os casos com resultado divergente, não localizado ou indeterminado receberam o motivo registrado, sua origem, trecho do histórico e verificação necessária. São indícios, não decisões judiciais definitivas.</p>
          <a href="https://docs.google.com/spreadsheets/d/1ZIiMHQDg2IsFqZQWBSybV116Bbw7oXIqFzV5Mzl_3Hc/edit" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-bold text-primary underline">Ver aba “Pendências de mérito — 799” por processo e advogado</a>
        </div>
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <strong>{fmt(meritoOficial.encerrados_cumprimento)} encerrados no CRM sinalizados com cumprimento ativo.</strong> Conferir a fase antes de encerrar o cumprimento ou contá-lo como satisfeito. Não houve alteração automática do estado dos processos por esta auditoria.
        </p>
      </div>:<p className="mt-3 text-sm text-muted-foreground">Sem resumo oficial disponível na consulta. Os números não são estimados.</p>}
    </section>
    <section aria-labelledby="kpi-title" className="space-y-3">
      <h2 id="kpi-title" className="text-lg font-bold">Atendimentos e produtividade da empresa</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {totals.map(c=><div key={c.title} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">{c.title}</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums">{fmt(c.value)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{c.help}</p>
        </div>)}
      </div>
    </section>
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Encerramentos registrados no período</h2>
        <p className="mt-1 text-xs text-muted-foreground">Encerrar um processo é uma alteração na carteira; um mesmo CNJ pode receber mais de um registro ou ser reaberto depois. Operações em lote de teste não contam como atendimentos humanos.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {title:"Processos encerrados manualmente",value:encerramentos?.processosManuais,help:"CNJs distintos, equipe inteira no período"},
          {title:"Encerramentos manuais registrados",value:encerramentos?.encerramentosManuais,help:"Ações confirmadas, inclusive repetidas"},
          {title:"Desses, permanecem encerrados",value:encerramentos?.manuaisPermanecemEncerrados,help:"Situação atual da carteira no Supabase"},
          {title:"Encerramentos administrativos de teste",value:encerramentos?.testesAdministrativos,help:"CNJs distintos, não atendimento humano"},
        ].map(c=><div key={c.title} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">{c.title}</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums">{fmt(c.value)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{c.help}</p>
        </div>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-bold">Encerramentos manuais por colaborador</h3>
          <p className="mt-1 text-xs text-muted-foreground">Ações realmente registradas no período, sem contar somente quem é dono do processo.</p>
          <div className="mt-3 space-y-2">
            {encerramentos?.porUsuario?.length?encerramentos.porUsuario.map(x=><div key={x.userId} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-3">
              <span className="text-sm font-semibold">{x.nome}</span>
              <span className="text-right text-sm"><strong>{fmt(x.processos)}</strong> processos <span className="text-muted-foreground">· {fmt(x.eventos)} ações · {fmt(x.permanecemEncerrados)} ainda encerrados</span></span>
            </div>):<p className="mt-3 text-xs text-muted-foreground">Nenhum encerramento manual encontrado no período.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-bold">Rastreabilidade dos testes</h3>
          <p className="mt-2 text-sm">Processos distintos em encerramento administrativo de teste: <strong>{fmt(encerramentos?.testesAdministrativos)}</strong>.</p>
          <p className="mt-2 text-sm">Processos com reversão de teste registrada: <strong>{fmt(encerramentos?.testesRevertidos)}</strong>.</p>
          <p className="mt-2 text-sm">Processos do lote sem reversão registrada: <strong>{fmt(encerramentos?.testesSemReversao)}</strong>.</p>
          <p className="mt-3 text-xs text-muted-foreground">Os grupos podem se sobrepor aos encerramentos manuais. Não somar ao número atual de encerrados, nem considerar contato com o cliente sem evidência.</p>
        </div>
      </div>
    </section>
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Investigações, auditorias e atividades internas</h2>
          <p className="mt-1 max-w-4xl text-xs text-muted-foreground">Registros atribuídos a colaboradores no sistema, inclusive processos investigados, análises por planilha e trabalhos fora do CRM. São registros operacionais, não contatos comprovados com o cliente nem encerramentos judiciais.</p>
        </div>
        <Link href="/minhas-atividades" className="text-xs font-semibold text-primary underline">Registrar nova atividade</Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {title:"Registros de trabalho interno",value:trabalho?.registros},
          {title:"Processos distintos analisados",value:trabalho?.processosDistintos},
          {title:"Testes internos em lote",value:trabalho?.testes},
          {title:"Testes com reversão",value:trabalho?.testesRevertidos},
        ].map(x=><div key={x.title} className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-semibold text-muted-foreground">{x.title}</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{fmt(x.value)}</p>
        </div>)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-bold">Trabalho por colaborador</h3>
          <div className="mt-2 space-y-2">
            {trabalho?.porUsuario?.length?trabalho.porUsuario.map(x=><div key={x.userId||x.nome} className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
              <strong>{x.nome}</strong> — {fmt(x.processos)} processos distintos, {fmt(x.registros)} registros
            </div>):<p className="mt-2 text-xs text-muted-foreground">Nenhuma atividade interna encontrada no período.</p>}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold">Tipos de trabalho registrados</h3>
          <div className="mt-2 space-y-2">
            {trabalho?.porCategoria?.length?trabalho.porCategoria.map(x=><div key={x.categoria} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-xs">
              <span className="break-words">{({
                auditoria_sistemica:"Auditoria e triagem sistêmica",triagem_replica_provas:"Análise de réplica e provas",
                atendimento_por_perfil_davi:"Histórico de atendimentos atribuídos",auditoria_por_perfil_davi:"Auditorias por perfil",
                historico_atendimento_id_davi:"Histórico de atendimentos revisado",edicao_por_nome_davi:"Edições por identificação",
                entrega_projeto:"Projetos e sistemas",dossie_individual:"Dossiês individuais",
              } as Record<string,string>)[x.categoria]||x.categoria.replaceAll("_"," ")}</span>
              <span className="shrink-0 tabular-nums font-bold">{fmt(x.registros)}</span>
            </div>):null}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Contagem por data de registro da atividade, inclusive importações e conferências lançadas em lote. Um processo pode aparecer em diversas categorias; não some as categorias como se fossem processos únicos.</p>
    </section>
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Atendimentos por dia</h2>
        <p className="mt-1 text-xs text-muted-foreground">Um processo conta uma vez em cada dia de atendimento, mesmo que tenha vários registros no mesmo dia.</p>
        {hist?<div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {hist.dias.map(d=><div key={d.ymd} className="rounded-xl border border-border bg-background p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground">{periodo==="mes"?br(d.ymd):d.day}</p>
            <p className="mt-1 text-xl font-black tabular-nums">{d.atendimentos}</p>
            {periodo!=="mes"?<p className="text-[10px] text-muted-foreground">{br(d.ymd)}</p>:null}
          </div>)}
        </div>:<p className="mt-5 text-sm text-muted-foreground">Não foi possível consultar o histórico neste momento. Nenhum número provisório foi usado.</p>}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Por colaborador</h2>
        <p className="mt-1 text-xs text-muted-foreground">Crédito para o executor do atendimento, independentemente da carteira.</p>
        <div className="mt-4 space-y-2">
          {hist?.porUsuario.length?hist.porUsuario.map(x=><div key={x.userId} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3">
            <span className="text-sm font-semibold">{x.nome}</span>
            <span className="text-right text-sm tabular-nums"><strong>{x.processos}</strong> processos <span className="text-muted-foreground">· {x.eventos} registros</span></span>
          </div>):<p className="text-sm text-muted-foreground">Não há atendimentos pessoais confirmados para o período consultado.</p>}
        </div>
        {hist?.tecnicoEventos?<p className="mt-3 text-xs text-muted-foreground">{hist.tecnicoEventos} eventos de contas técnicas mantidos fora da contagem humana.</p>:null}
      </div>
    </section>
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-bold">Retornos dos processos ativos</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        O alerta de 30 dias inclui atendimentos antigos e nunca registrados. Não é o mesmo que “Sem retorno”, que considera apenas a data vazia.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Sem retorno há 30 dias ou mais",retorno?.semRetornoLongo],
          ["Nunca tiveram retorno registrado",retorno?.nuncaRegistrado],
          ["Último retorno antigo (30+ dias)",retorno?.antigos],
        ].map(([title,value])=><div key={String(title)} className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs font-semibold text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{fmt(value as number|undefined)}</p>
        </div>)}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Os números são da carteira {owner?"do usuário":"inteira da empresa"} no momento da consulta e não incluem processos encerrados.</p>
    </section>
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-bold">Resultado de mérito registrado na carteira</h2>
      <p className="mt-1 text-xs text-muted-foreground">Classificações cadastradas, não sentenças definitivamente confirmadas. Resultados contraditórios ficam fora dos totais de procedência e improcedência.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Procedentes",merito?.procedentes],
          ["Improcedentes",merito?.improcedentes],
          ["Parcialmente procedentes",merito?.parciais],
          ["Conferir divergências",merito?.divergentes],
        ].map(([title,value])=><div key={String(title)} className="rounded-lg border border-border bg-background p-3">
          <p className="text-xs font-semibold text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{fmt(value as number|undefined)}</p>
        </div>)}
      </div>
    </section>
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold">Visão da carteira — {somenteMinhaCarteira?"minha carteira":"empresa inteira"}</h2><p className="mt-1 text-xs text-muted-foreground">Totais atuais do banco; não confundir com o histórico de ações no período.</p></div>
        <Link href="/processos" className="text-sm font-semibold text-primary underline">Abrir processos da empresa</Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {carteira.map(c=><div key={c.title} className="rounded-lg border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">{c.title}</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{fmt(c.value)}</p>
        </div>)}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Escopo: {owner?"processos atribuídos ao usuário logado":"todos os processos da empresa"}. O total de encerrados mostra o estado atual; o bloco de encerramentos manuais mostra ações durante o período.</p>
    </section>
    <div className="flex flex-wrap gap-3">
      <Link href="/report/completo" className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Abrir relatório detalhado, parecer e PDFs</Link>
      <Link href="/analises-internas" className="inline-flex rounded-xl border border-border px-5 py-3 text-sm font-bold">Ver análises e auditorias</Link>
    </div>
    <p className="pb-4 text-xs text-muted-foreground">O histórico diferencia processos distintos, registros repetidos, edições e operações de contas técnicas. Os números refletem a consulta mais recente e podem crescer ao longo do dia.</p>
      </div>
    </details>
   </div>
 </main>;
}
