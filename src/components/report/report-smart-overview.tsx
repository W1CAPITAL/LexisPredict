"use client";

import { useState, useEffect, type FormEvent } from "react";
import { AlertTriangle, ArrowRight, BarChart3, ChevronRight, CircleHelp, Loader2, MessageSquareText, ShieldCheck, Sparkles, Square } from "lucide-react";
import {stopBrowserLocalLLM} from "@/lib/ai/browser-local-llm";
import {responderRelatorioPergunta, type IndicadoresRelatorio} from "@/lib/report/report-instant-answer";

type Day = { ymd: string; atendimentos: number };
type MemberBrief = {nome:string;atendimentos:{processos:number;eventos:number};edicoes:{processos:number;eventos:number};encerramentos:{processos:number;eventos:number};atividades:number;trabalho:number;verificacoesLote:number;categorias:Array<{categoria:string;registros:number}>;entregas:string[]};
type Props = {
  equipe?:MemberBrief[];
  periodLabel: string;
  scopeLabel: string;
  total: number | null;
  ativos: number | null;
  encerrados: number | null;
  vencidos: number | null;
  novidades: number | null;
  atendidos: number | null;
  eventos: number | null;
  semRetorno30: number | null;
  naoLocalizados: number | null;
  meritoPendente: number | null;
  encerradosEmCumprimento: number | null;
  improcedentesOficiais: number | null;
  procedentesOficiais: number | null;
  parciaisOficiais: number | null;
  semMeritoOficial: number | null;
  dias: Day[];
};
const fmt = (value: number | null) => value == null ? "—" : value.toLocaleString("pt-BR");
function Highlight({ amount, label, description, tone }: { amount: number | null; label: string; description: string; tone: string }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-background/70 p-4">
    <div className={"flex h-12 w-16 shrink-0 items-center justify-center rounded-xl text-xl font-black tabular-nums " + tone}>{fmt(amount)}</div>
    <div className="min-w-0">
      <p className="text-sm font-bold text-foreground">{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  </div>;
}

export function ReportSmartOverview(props: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  useEffect(()=>{stopBrowserLocalLLM();return ()=>stopBrowserLocalLLM();},[]);
  const activePct = props.total && props.ativos != null ? Math.max(0,Math.min(100,Math.round(100*props.ativos/props.total))) : null;
  const closedPct = activePct == null ? null : 100-activePct;
  const maxDaily = Math.max(1,...props.dias.map(d=>d.atendimentos || 0));
  const questions = ["Compare os atendimentos da equipe", "Quais atividades foram registradas?", "Quais dossiês e projetos foram registrados?", "Quais atividades precisam de conferência?"];
  const facts = {
    periodo: props.periodLabel,
    escopo_carteira: props.scopeLabel,
    carteira_total: props.total,
    processos_ativos: props.ativos,
    encerrados_crm: props.encerrados,
    processos_marcados_vencidos_no_crm: props.vencidos,
    novidades: props.novidades,
    processos_atendidos_no_periodo: props.atendidos,
    eventos_de_atendimento: props.eventos,
    ativos_sem_retorno_30_dias_ou_mais: props.semRetorno30,
    encerrados_sem_resultado_judicial_localizado: props.naoLocalizados,
    encerrados_resultado_judicial_a_esclarecer: props.meritoPendente,
    encerrados_crm_com_sinal_de_cumprimento: props.encerradosEmCumprimento,
    procedencia_identificada_em_movimentos_oficiais: props.procedentesOficiais,
    improcedencia_identificada_em_movimentos_oficiais: props.improcedentesOficiais,
    procedencia_parcial_identificada_em_movimentos_oficiais: props.parciaisOficiais,
    sem_julgamento_de_merito_identificado: props.semMeritoOficial,
    equipe: (props.equipe||[]).map(p=>({nome:p.nome,atendimentos:p.atendimentos,edicoes:p.edicoes,encerramentos:p.encerramentos,atividades:p.atividades,trabalho:p.trabalho,verificacoesLote:p.verificacoesLote,categorias:p.categorias,entregas:p.entregas})),
    atendimentos_por_dia: props.dias
  };
  const instantFacts:IndicadoresRelatorio={
    periodo:props.periodLabel,total:props.total,ativos:props.ativos,encerrados:props.encerrados,
    vencidos:props.vencidos,novidades:props.novidades,atendidos:props.atendidos,eventos:props.eventos,
    semRetorno30:props.semRetorno30,naoLocalizados:props.naoLocalizados,meritoPendente:props.meritoPendente,
    encerradosEmCumprimento:props.encerradosEmCumprimento,improcedentesOficiais:props.improcedentesOficiais,
    procedentesOficiais:props.procedentesOficiais,parciaisOficiais:props.parciaisOficiais,
    semMeritoOficial:props.semMeritoOficial,equipe:props.equipe||[],
  };
  function ask(event?: FormEvent<HTMLFormElement>, suggested?: string){
    event?.preventDefault();
    const input=(suggested||question).trim().slice(0,260);
    if(!input)return;
    // Resposta sempre imediata e fundamentada no snapshot. Nenhuma inferência pesada inicia automaticamente.
    const text=responderRelatorioPergunta(input,instantFacts);
    setQuestion(input);setLastQuestion(input);setAnswer(text);
  }
  const canAsk=question.trim().length>0;
  return <div data-lexis-report-smart className="space-y-5">
    <div className="report-smart-hero relative overflow-hidden rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-7">
      
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold text-primary">
            <BarChart3 className="h-3.5 w-3.5" /> Análise operacional
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-foreground sm:text-3xl">Visão geral da operação</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Depois da análise individual da equipe, consulte os indicadores e obtenha respostas imediatas sem carregar um modelo pesado.</p>
          <div className="mt-4 inline-flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="rounded-lg bg-muted/50 px-3 py-2">{props.periodLabel}</span>
            <span className="rounded-lg bg-muted/50 px-3 py-2">{props.scopeLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-5 w-5" /> Dados da carteira, sem estimativas
        </div>
      </div>
    </div>
    {/* Duplicate portfolio/attendance summary cards were removed: the newer
        ReportExecutiveDashboard above already renders these exact snapshot and
        period metrics. Keep the merit and Q&A drill-downs below. */}
    <section className="rounded-[1.35rem] border border-border/70 bg-card p-5 shadow-sm sm:p-6" aria-labelledby="report-merit-overview">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div><h3 id="report-merit-overview" className="text-base font-extrabold">O que aconteceu nos processos?</h3><p className="mt-1 text-xs text-muted-foreground">Identificações de mérito a partir de movimentações oficiais. Não confirmam trânsito em julgado nem encerramento definitivo.</p></div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          {label:"Procedência identificada",value:props.procedentesOficiais,style:"bg-emerald-500/5"},
          {label:"Procedência parcial",value:props.parciaisOficiais,style:"bg-sky-500/5"},
          {label:"Improcedência identificada",value:props.improcedentesOficiais,style:"bg-rose-500/5"},
          {label:"Sem julgamento de mérito",value:props.semMeritoOficial,style:"bg-amber-500/5"},
        ].map(item=><div key={item.label} className={"rounded-2xl border border-border/70 p-4 " + item.style}>
          <p className="text-xs font-semibold leading-relaxed text-muted-foreground">{item.label}</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{fmt(item.value)}</p>
        </div>)}
      </div>
    </section>
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[1.35rem] border border-border/70 bg-card p-5 shadow-sm sm:p-6" aria-labelledby="report-alert-heading">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-xl bg-amber-500/10 p-2 text-amber-600 dark:text-amber-300"><AlertTriangle className="h-5 w-5"/></span>
          <div><h3 id="report-alert-heading" className="text-base font-extrabold">O que precisa de atenção</h3><p className="text-xs text-muted-foreground">Alertas objetivos do banco, não decisões automáticas</p></div>
        </div>
        <div className="space-y-2">
          <Highlight amount={props.semRetorno30} label="Ativos sem contato recente" description="Sem registro de retorno nos últimos 30 dias, incluindo os nunca registrados." tone="bg-amber-500/10 text-amber-700 dark:text-amber-300"/>
          <Highlight amount={props.encerradosEmCumprimento} label="Encerrados com indício de cumprimento" description="Verificar a fase judicial antes de considerar o caso finalizado." tone="bg-rose-500/10 text-rose-700 dark:text-rose-300"/>
          <Highlight amount={props.meritoPendente} label="Resultado judicial a esclarecer" description="Classificação ainda inconclusiva nos dados oficiais disponíveis." tone="bg-primary/10 text-primary"/>
        </div>
      </section>
      <section className="rounded-[1.35rem] border border-border/70 bg-card p-5 shadow-sm sm:p-6" aria-labelledby="report-activity-heading">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-xl bg-primary/10 p-2 text-primary"><BarChart3 className="h-5 w-5"/></span>
          <div><h3 id="report-activity-heading" className="text-base font-extrabold">A carteira em um olhar</h3><p className="text-xs text-muted-foreground">Carteira atual e atendimento no período</p></div>
        </div>
        <div className="flex items-end justify-between gap-3 text-sm"><span className="font-semibold">Ativos <span className="text-muted-foreground">{fmt(props.ativos)}</span></span><span className="font-semibold">Encerrados <span className="text-muted-foreground">{fmt(props.encerrados)}</span></span></div>
        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={activePct===null?"Distribuição indisponível":activePct+"% ativos, "+closedPct+"% demais"}>
          {activePct!==null?<><div style={{width:activePct+"%"}} className="bg-primary"/><div style={{width:closedPct+"%"}} className="bg-muted-foreground/30"/></>:null}
        </div>
        <div className="mt-6 flex items-center justify-between text-sm"><strong>Atendimentos por dia</strong><span className="text-xs text-muted-foreground">{fmt(props.eventos)} registros da equipe no período</span></div>
        {props.dias.length?<div className="mt-4 flex h-28 items-end gap-1.5 overflow-x-auto pb-1 sm:gap-2">
          {props.dias.map(d=><div key={d.ymd} className="group flex min-w-[14px] flex-1 flex-col items-center justify-end gap-1" title={d.ymd+": "+fmt(d.atendimentos)+" processos"}>
            <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{d.atendimentos || ""}</span>
            <div className="w-full max-w-9 rounded-t-md bg-primary" style={{height:Math.max(3,Math.round(66*(d.atendimentos||0)/maxDaily))+"px"}} />
            <span className="text-[9px] text-muted-foreground">{d.ymd.slice(8,10)}</span>
          </div>)}
        </div>:<p className="mt-5 text-sm text-muted-foreground">Histórico diário indisponível.</p>}
        <p className="mt-3 text-xs text-muted-foreground">Os registros representam eventos; um processo pode ter mais de um atendimento.</p>
      </section>
    </div>
    <section className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-sm" aria-labelledby="report-llm-heading">
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-5 sm:px-6">
        <span className="rounded-2xl bg-primary/10 p-3 text-primary"><BarChart3 className="h-6 w-6"/></span>
        <div className="min-w-0"><h3 id="report-llm-heading" className="text-lg font-extrabold">Consultar os dados do relatório</h3><p className="text-xs text-muted-foreground">Análise instantânea dos registros · sem carregamento de modelos pesados</p></div>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {questions.map(item=><button key={item} type="button" onClick={()=>void ask(undefined,item)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">{item}<ChevronRight className="h-3.5 w-3.5"/></button>)}
        </div>
        <form onSubmit={ask} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="report-intelligence-question" className="sr-only">Sua pergunta sobre o relatório</label>
          <input id="report-intelligence-question" maxLength={260} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ex.: O que cada colaborador realizou neste mês?" className="min-h-12 w-full min-w-0 flex-1 rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"/>
          <button type="submit" disabled={!canAsk} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"><MessageSquareText className="h-4 w-4"/> Responder agora<ArrowRight className="h-4 w-4"/></button>
        </form>
        {answer?<div className="rounded-2xl border border-border bg-muted/30 p-5">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold text-primary"><Sparkles className="h-4 w-4"/> Análise dos dados · {lastQuestion}</p>
          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{answer}</p>
          <p className="mt-4 text-xs text-muted-foreground">Resposta calculada diretamente dos registros, sem modelo pesado.</p>
        </div>:null}
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0"/> Para proteger computadores com pouca memória, desativei o Qwen 0.5B nesta tela após o travamento relatado. Esta resposta usa indicadores conferidos, não gera fatos novos, e não realiza envios ou alterações no CRM.</p>
      </div>
    </section>
  </div>;
}
