"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {AlertTriangle,CalendarClock,CheckCircle2,ChevronRight,Clock3,Filter,Search,ShieldAlert,Users} from "lucide-react";
import {classificarVencimento} from "@/lib/vencimentos";

export type VencidoRow={
 id:number;cliente:string;protocolo_ref:string;created_by:string|null;status:string|null;status_interno:string|null;statusManual?:string|null;
 proximo_retorno:string|null;proximo_prazo:string|null;ultimo_retorno:string|null;
 escritorio:string|null;advogado:string|null;datajud_ultimo_nome:string|null;ultima_movimentacao:string|null;
 tem_atualizacao_pos_retorno:boolean|null;
};
export type Owner={id:string;auth_user_id:string|null;nome:string};
const format=(n:number)=>n.toLocaleString("pt-BR");
const br=(v:string|null)=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v.slice(8,10)+"/"+v.slice(5,7)+"/"+v.slice(0,4):"—";
const norm=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const crmVencido=(p:VencidoRow)=>p.status==="Vencido"||p.status==="Caso Crítico";
export function VencidosPanel({data,owners,hoje,limitReached}:{data:VencidoRow[];owners:Owner[];hoje:string;limitReached:boolean}){
 const [tab,setTab]=useState<"todos"|"retorno"|"prazo"|"revisar">("todos");
 const [query,setQuery]=useState("");
 const [owner,setOwner]=useState("todos");
 const [office,setOffice]=useState("todos");
 const [order,setOrder]=useState<"mais_antigo"|"mais_recente"|"nome">("mais_antigo");
 const [visibleCount,setVisibleCount]=useState(40);
 const ownerMap=useMemo(()=>{
  const m=new Map<string,string>();
  owners.forEach(x=>{m.set(x.id,x.nome);if(x.auth_user_id)m.set(x.auth_user_id,x.nome)});
  return m;
 },[owners]);
 const prepared=useMemo(()=>data.map(p=>({...p,flag:classificarVencimento(p,hoje)}))
 .filter(p=>crmVencido(p)||(!p.flag.excluido&&(p.flag.vencido||p.flag.historico||p.flag.inconsistencia))),[data,hoje]);
 const offices=useMemo(()=>Array.from(new Set(prepared.map(p=>p.escritorio?.trim()).filter((s):s is string=>!!s))).sort((a,b)=>a.localeCompare(b,"pt-BR")),[prepared]);
 const counts={todos:prepared.filter(crmVencido).length,retorno:prepared.filter(p=>p.flag.retorno).length,prazo:prepared.filter(p=>p.flag.historico).length,revisar:prepared.filter(p=>p.flag.inconsistencia).length};
 const bloqueados=prepared.filter(p=>crmVencido(p)&&p.flag.excluido).length;
 const visible=useMemo(()=>prepared.filter(p=>{
  if(tab==="todos"&&!crmVencido(p))return false;
  if(tab==="retorno"&&!p.flag.retorno)return false;
  if(tab==="prazo"&&!p.flag.historico)return false;
  if(tab==="revisar"&&!p.flag.inconsistencia)return false;
  if(owner!=="todos"&&!(owners.some(x=>x.id===owner&&(p.created_by===x.id||p.created_by===x.auth_user_id))))return false;
  if(office!=="todos"&&p.escritorio?.trim()!==office)return false;
  const q=norm(query.trim());if(q&&!norm([p.cliente,p.protocolo_ref,p.advogado,p.escritorio,ownerMap.get(p.created_by||"")].join(" ")).includes(q))return false;
  return true;
 }).sort((a,b)=>{
  if(order==="nome")return a.cliente.localeCompare(b.cliente,"pt-BR");
  const dt=(p:typeof a)=>tab==="prazo"?(p.proximo_prazo||"9999"):(p.proximo_retorno||"9999");
  return order==="mais_antigo"?dt(a).localeCompare(dt(b)):dt(b).localeCompare(dt(a));
 }),[prepared,tab,owner,office,query,order,owners,hoje,ownerMap]);
 return <div className="space-y-5">
  <div className="rounded-[1.6rem] border border-rose-300/35 bg-gradient-to-br from-rose-50 via-background to-violet-50 p-6 dark:from-rose-950/20 dark:to-violet-950/20">
   <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-rose-700 dark:text-rose-300"><AlertTriangle size={15}/> Central de vencidos</p>
   <h1 className="mt-2 text-3xl font-black">Vencidos do CRM, sem confundir com retornos atrasados.</h1>
   <p className="mt-2 max-w-3xl text-sm text-muted-foreground">O indicador principal considera o status Vencido/Caso Crítico cadastrado no CRM. Retornos atrasados por data são exibidos separadamente e não aumentam essa contagem. Cadastros com encerramento manual ficam bloqueados para cobrança.</p>
   <p className="mt-3 text-xs text-muted-foreground">Referência: {br(hoje)} · Datas calculadas no horário de Brasília · A contagem muda quando os dados são atualizados</p>
  </div>
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
   {([{id:"todos",label:"Vencidos no CRM",value:counts.todos,icon:AlertTriangle},
      {id:"retorno",label:"Retornos por data (conferir)",value:counts.retorno,icon:CalendarClock},
      {id:"revisar",label:"Status divergentes",value:counts.revisar,icon:ShieldAlert},
      {id:"prazo",label:"Datas antigas (não vencidos)",value:counts.prazo,icon:Clock3}] as const).map(x=><button type="button" key={x.id} onClick={()=>{setTab(x.id);setVisibleCount(40)}} aria-pressed={tab===x.id}
    className={"rounded-2xl border p-4 text-left shadow-sm transition "+(tab===x.id?"border-rose-400 bg-rose-500/10":"border-border bg-card hover:border-rose-300")}>
     <x.icon className="h-5 w-5 text-rose-600"/><p className="mt-3 text-2xl font-black tabular-nums">{format(x.value)}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{x.label}</p>
    </button>)}
  </div>
  <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-4">
   <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input type="search" value={query} onChange={e=>{setQuery(e.target.value);setVisibleCount(40)}} placeholder="Buscar cliente, CNJ ou advogado" aria-label="Pesquisar vencidos" className="h-10 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm"/></div>
   <label className="flex items-center gap-2 text-xs"><Users className="h-4 w-4 text-muted-foreground"/><span className="sr-only">Responsável</span><select value={owner} onChange={e=>{setOwner(e.target.value);setVisibleCount(40)}} className="h-10 max-w-[205px] rounded-xl border border-input bg-background px-3 text-xs"><option value="todos">Todos responsáveis</option>{owners.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></label>
   <label className="flex items-center gap-2 text-xs"><Filter className="h-4 w-4 text-muted-foreground"/><span className="sr-only">Escritório</span><select value={office} onChange={e=>{setOffice(e.target.value);setVisibleCount(40)}} className="h-10 max-w-[190px] rounded-xl border border-input bg-background px-3 text-xs"><option value="todos">Todos escritórios</option>{offices.map(o=><option key={o} value={o}>{o}</option>)}</select></label>
   <select aria-label="Ordenar vencidos" value={order} onChange={e=>{setOrder(e.target.value as typeof order);setVisibleCount(40)}} className="h-10 rounded-xl border border-input bg-background px-3 text-xs"><option value="mais_antigo">Mais atrasado primeiro</option><option value="mais_recente">Menos atrasado primeiro</option><option value="nome">Cliente A–Z</option></select>
  </div>
  {limitReached?<p role="alert" className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-3 text-xs">A consulta alcançou o limite de registros. A lista pode estar incompleta; refine os filtros ou recarregue.</p>:null}
  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
   <span><strong className="text-foreground">{format(visible.length)}</strong> {tab==="todos"?"marcações no status do CRM":tab==="retorno"?"retornos atrasados por data para conferência":"cadastros a conferir"} {tab==="todos"&&bloqueados>0?` · ${bloqueados} com encerramento manual, sem cobrança`:""}</span>
   <div className="flex flex-wrap gap-2">
    <Link href="/cases?filter=vencido" className="rounded-lg border border-border px-3 py-2 font-bold hover:text-primary">Meus processos vencidos</Link>
    <Link href="/tarefas?filtro=vencido" className="rounded-lg border border-border px-3 py-2 font-bold hover:text-primary">Fila de tarefas vencidas</Link>
   </div>
  </div>
  {visible.length?<div className="grid gap-3 md:grid-cols-2">
   {visible.slice(0,visibleCount).map(p=><article key={p.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold">{p.cliente||"Cliente não identificado"}</h2><p className="mt-1 font-mono text-[11px] text-muted-foreground">{p.protocolo_ref||"Sem CNJ"}</p></div>
     <div className="flex gap-1.5 flex-wrap">{p.flag.excluido?<span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-700">Encerrado manualmente: revisar</span>:null}{tab==="todos"&&crmVencido(p)&&!p.flag.retorno&&!p.flag.excluido?<span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-700">Status antigo: revisar</span>:null}{p.flag.retorno?<span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-300">Retorno vencido</span>:null}{tab==="prazo"&&p.flag.historico?<span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">Data histórica; retorno não vencido</span>:null}{tab==="revisar"&&p.flag.inconsistencia?<span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">{p.flag.marcado?"Marcado como vencido indevidamente":"Retorno vencido sem status atualizado"}</span>:null}</div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
     <div><p className="text-muted-foreground">Próximo retorno</p><p className="mt-1 font-bold">{br(p.proximo_retorno)}</p></div>
     <div><p className="text-muted-foreground">Prazo cadastrado</p><p className="mt-1 font-bold">{br(p.proximo_prazo)}</p></div>
     <div><p className="text-muted-foreground">Último atendimento</p><p className="mt-1 font-bold">{br(p.ultimo_retorno)}</p></div>
     <div><p className="text-muted-foreground">Responsável</p><p className="mt-1 font-bold">{ownerMap.get(p.created_by||"")||"Sem identificação"}</p></div>
    </div>
    {p.flag.excluido?<p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">Há encerramento manual registrado. Esta marcação exige conferência cadastral e não deve gerar cobrança.</p>:null}
    {p.flag.historico&&tab==="prazo"?<p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">O campo de prazo antigo não representa o próximo retorno. Confira sua origem e atualize o cadastro somente com evidência; não atribua atraso ao cliente ou advogado.</p>:null}{p.flag.inconsistencia&&tab==="revisar"?<p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">O status salvo não corresponde à data e ao último atendimento. Corrija a classificação após conferir o histórico; este alerta não comprova omissão.</p>:null}
    {p.datajud_ultimo_nome?<p className="mt-3 line-clamp-2 text-xs text-muted-foreground">Movimentação registrada: {p.datajud_ultimo_nome}</p>:null}
    <div className="mt-4 flex flex-wrap gap-2">
     <Link prefetch={false} href={"/processos?search="+encodeURIComponent(p.protocolo_ref)+"&processo="+encodeURIComponent(p.protocolo_ref)} className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Abrir processo <ChevronRight size={14}/></Link>
     <Link prefetch={false} href={"/tarefas?search="+encodeURIComponent(p.protocolo_ref)} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold">Abrir nas tarefas</Link>
    </div>
   </article>)}
  </div>:<div className="rounded-2xl border border-border bg-card p-10 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600"/><p className="mt-3 font-semibold">Nenhum vencido neste filtro</p><p className="mt-1 text-sm text-muted-foreground">Experimente outro responsável ou remova a busca.</p></div>}
  {visible.length>visibleCount?<button type="button" onClick={()=>setVisibleCount(x=>x+40)} className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold hover:bg-muted">Mostrar mais 40 processos ({format(visible.length-visibleCount)} restantes)</button>:null}
 </div>;
}

