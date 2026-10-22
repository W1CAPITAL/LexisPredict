"use client";

import {useMemo,useState} from "react";
import {Activity,ArrowRight,BookOpenCheck,BriefcaseBusiness,CheckCircle2,ChevronDown,ClipboardCheck,FileClock,FilePenLine,FolderKanban,Layers3,Search,ShieldCheck,UsersRound} from "lucide-react";

export type EquipeCategoria={categoria:string;registros:number};
export type EquipeAtividade={categoria:string;titulo:string;data:string;detalhe?:string;protocolo?:string|null;contatoConfirmado?:boolean};
export type EquipeEntrega={categoria:string;titulo:string;data:string;detalhe?:string;conferencia?:string};
export type EquipeMembro={
 userId:string;nome:string;cargo:string|null;
 carteira:{total:number;ativos:number;encerrados:number};
 atendimentos:{processos:number;eventos:number};
 edicoes:{processos:number;eventos:number};
 encerramentos:{processos:number;eventos:number};
 atividades:{registros:number;contato:number;contatosDeclarados:number;internas:number;processos:number;categorias:EquipeCategoria[];recentes:EquipeAtividade[]};
 trabalho:{registros:number;processos:number;entregas:number;verificacoesLote:number;categorias:EquipeCategoria[];entregasRecentes:EquipeEntrega[]};
};
export type EquipeRelatorio={periodo:string;inicio:string;fim:string;pessoas:EquipeMembro[];nota?:string};
const n=(value?:number|null)=>Number(value||0).toLocaleString("pt-BR");
const d=(value?:string)=>value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value.slice(8,10)+"/"+value.slice(5,7)+"/"+value.slice(0,4):value||"";
const labelCategoria:Record<string,string>={
 atendimento:"Atendimento ao cliente",analise_processual:"Análise processual",auditoria:"Auditoria",dossie:"Dossiê",investigacao:"Investigação",planilha:"Planilha",sistema:"Desenvolvimento de sistemas",automacao:"Automação",outro:"Outra atividade",
 auditoria_sistemica:"Auditoria sistêmica em lote",auditoria_documental:"Revisão documental",
 triagem_replica_provas:"Triagem de réplica e provas",atendimento_por_perfil_davi:"Revisão histórica de atendimentos",
 historico_atendimento_id_davi:"Histórico revisado de atendimentos",auditoria_por_perfil_davi:"Auditorias por perfil",
 edicao_por_nome_davi:"Edições identificadas",historico_edicao_id_davi:"Histórico de edições",
 historico_encerramento_lote_id_davi:"Histórico de encerramentos",entrega_projeto:"Projeto / entrega",
 dossie_individual:"Dossiê individual",investigacao_get:"Investigação GET",
 investigacao_externa:"Investigação externa",
};
function nomeCategoria(s:string){return labelCategoria[s]||s.replace(/_/g," ");}
function Stat({title,value,explain}:{title:string;value:number;explain:string}){
 return <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
  <p className="text-xs font-semibold text-muted-foreground">{title}</p>
  <p className="mt-1 text-2xl font-extrabold tabular-nums">{n(value)}</p>
  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{explain}</p>
 </div>;
}
function Highlights({entries,empty}:{entries:EquipeCategoria[];empty:string}){
 if(!entries.length)return <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">{empty}</p>;
 const max=Math.max(...entries.map(x=>x.registros),1);
 return <div className="space-y-3">{entries.map(x=><div key={x.categoria}>
  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs"><span className="font-medium">{nomeCategoria(x.categoria)}</span><strong className="tabular-nums">{n(x.registros)}</strong></div>
  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-indigo-400 dark:bg-indigo-500" style={{width:Math.max(2,(x.registros/max)*100)+"%"}}/></div>
 </div>)}</div>;
}
function ActivityList({items}:{items:EquipeAtividade[]}){
 if(!items.length)return <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Não há descrição individual registrada nesta fonte para o período. Isso não significa ausência de trabalho: os atendimentos e as edições do CRM aparecem nos indicadores acima.</p>;
 return <div className="space-y-2">{items.map((x,i)=><article key={x.data+x.titulo+i} className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span className="rounded-full bg-violet-500/10 px-2 py-0.5 font-semibold text-violet-700 dark:text-violet-300">{nomeCategoria(x.categoria)}</span><span>{d(x.data)}</span>{x.contatoConfirmado?<span className="text-emerald-600 dark:text-emerald-300">Contato declarado no registro</span>:null}</div>
  <p className="mt-2 text-sm font-bold leading-snug">{x.titulo}</p>
  {x.detalhe?<p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{x.detalhe}</p>:null}
  {x.protocolo?<p className="mt-1 text-[11px] text-muted-foreground">Processo: <span className="font-mono">{x.protocolo}</span></p>:null}
 </article>)}</div>;
}
function DeliveryList({items}:{items:EquipeEntrega[]}){
 if(!items.length)return <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Não há dossiês, investigações ou entregas de projeto descritos nesta fonte durante o período escolhido. Verifique os atendimentos e demais atividades acima.</p>;
 return <div className="space-y-2">{items.map((x,i)=><article key={x.titulo+i} className="rounded-xl border border-border/70 bg-background/70 p-4">
  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span className="rounded-full bg-indigo-500/10 px-2 py-0.5 font-bold text-indigo-700 dark:text-indigo-300">{nomeCategoria(x.categoria)}</span><span>{d(x.data)}</span></div>
  <p className="mt-2 text-sm font-bold">{x.titulo}</p>
  {x.detalhe?<p className="mt-1 text-xs leading-relaxed text-muted-foreground">{x.detalhe}</p>:null}
  {x.conferencia?<p className="mt-1 text-[11px] text-muted-foreground">Tipo de registro: {nomeCategoria(x.conferencia)}</p>:null}
 </article>)}</div>;
}
function resumoPessoa(x:EquipeMembro){
 const parts:string[]=[];
 if(x.atendimentos.processos)parts.push("Atendimento a "+n(x.atendimentos.processos)+" processos, com "+n(x.atendimentos.eventos)+" registros auditados.");
 if(x.edicoes.processos)parts.push("Edição registrada em "+n(x.edicoes.processos)+" processos.");
 if(x.encerramentos.processos)parts.push(n(x.encerramentos.processos)+" processos tiveram encerramento manual registrado sob seu usuário.");
 if(x.atividades.registros)parts.push(n(x.atividades.registros)+" atividades cadastradas com descrição ou referência.");
 if(x.trabalho.registros)parts.push(n(x.trabalho.registros)+" registros de análises e auditorias; "+n(x.trabalho.verificacoesLote)+" deles são verificações sistêmicas em lote.");
 return parts.length?parts.join(" "):"Não há ações individuais identificadas nas fontes consultadas dentro deste período. Isso não equivale a afirmar que a pessoa não trabalhou.";
}
export function TeamReport({data}:{data:EquipeRelatorio|null}){
 const [selected,setSelected]=useState<string|null>(null);
 const [search,setSearch]=useState("");
 const [scope,setScope]=useState<"todos"|"com-atividade">("todos");
 const pessoas=data?.pessoas||[];
 const visible=useMemo(()=>pessoas.filter(x=>x.nome.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")) && (scope==="todos"||x.atendimentos.eventos+x.edicoes.eventos+x.encerramentos.eventos+x.atividades.registros+x.trabalho.registros>0)),[pessoas,scope,search]);
 const current=visible.find(x=>x.userId===selected)||visible[0];
 const logged=(x:EquipeMembro)=>x.atendimentos.eventos+x.edicoes.eventos+x.encerramentos.eventos+x.atividades.registros+x.trabalho.registros;
 const cards=[
  {label:"Pessoas cadastradas",val:pessoas.length,icon:UsersRound},
  {label:"Com registros no período",val:pessoas.filter(x=>logged(x)>0).length,icon:Activity},
  {label:"Registros de atendimento",val:pessoas.reduce((s,x)=>s+x.atendimentos.eventos,0),icon:ClipboardCheck},
  {label:"Atividades descritivas",val:pessoas.reduce((s,x)=>s+x.atividades.registros,0),icon:BookOpenCheck},
 ];
 return <section id="equipe" aria-labelledby="team-report-title" className="space-y-5">
  <div className="rounded-[1.65rem] border border-indigo-300/40 bg-gradient-to-br from-indigo-50 via-white to-rose-50 p-6 shadow-sm dark:border-indigo-400/20 dark:from-indigo-950/60 dark:via-slate-950 dark:to-violet-950/20 sm:p-7">
   <div className="flex flex-wrap items-start justify-between gap-3"><div>
    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.17em] text-indigo-600 dark:text-indigo-300"><UsersRound className="h-4 w-4"/> Produtividade e entregas</p>
    <h2 id="team-report-title" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Relatório da equipe</h2>
    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">Cada pessoa separadamente: clientes atendidos, processos editados, encerramentos, atividades registradas, dossiês, investigações, auditorias e projetos. Confira as evidências e o que cada registro realmente significa.</p>
   </div><div className="rounded-xl border border-indigo-200/50 bg-white/80 px-3 py-2 text-xs font-semibold text-indigo-700 dark:border-white/10 dark:bg-white/10 dark:text-indigo-200">{data?d(data.inicio)+" a "+d(data.fim):"Período indisponível"}</div></div>
  </div>
  {!data?<div role="alert" className="rounded-2xl border border-amber-500/30 bg-card p-5 text-sm text-muted-foreground">Não foi possível carregar o detalhamento individual nesta consulta. Os números não foram estimados. Os outros painéis continuam disponíveis.</div>:<>
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(c=><div key={c.label} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm"><div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground"><span>{c.label}</span><c.icon className="h-4 w-4 text-indigo-500"/></div><p className="mt-2 text-2xl font-extrabold tabular-nums">{n(c.val)}</p></div>)}</div>
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input type="search" aria-label="Pesquisar colaborador" placeholder="Buscar colaborador" value={search} onChange={e=>setSearch(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"/></div>
    <div className="flex gap-2">{([{id:"todos",title:"Toda a equipe"},{id:"com-atividade",title:"Com registros"}] as const).map(x=><button type="button" key={x.id} onClick={()=>setScope(x.id)} aria-pressed={scope===x.id} className={"rounded-full border px-3 py-2 text-xs font-bold "+(scope===x.id?"border-primary bg-primary text-primary-foreground":"border-border bg-card")}>{x.title}</button>)}</div>
   </div>
   <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {visible.map(x=><button type="button" key={x.userId} onClick={()=>setSelected(x.userId)} aria-pressed={current?.userId===x.userId} className={"w-full rounded-2xl border p-4 text-left shadow-sm transition-colors "+(current?.userId===x.userId?"border-indigo-400 bg-indigo-500/10 dark:border-indigo-400/60":"border-border/70 bg-card hover:border-indigo-300")}>
     <div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-extrabold">{x.nome}</span><ArrowRight className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300"/></div>
     <p className="mt-1 text-xs text-muted-foreground">{x.cargo||"Colaborador"} · {n(x.carteira.total)} processos na carteira</p>
     <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
      <div><p className="text-lg font-black tabular-nums">{n(x.atendimentos.processos)}</p><p className="text-[10px] text-muted-foreground">Atendidos</p></div>
      <div><p className="text-lg font-black tabular-nums">{n(x.edicoes.processos)}</p><p className="text-[10px] text-muted-foreground">Editados</p></div>
      <div><p className="text-lg font-black tabular-nums">{n(x.atividades.registros)}</p><p className="text-[10px] text-muted-foreground">Atividades</p></div>
     </div>
    </button>)}
   </div>
   {!visible.length?<p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Nenhum colaborador encontrado com esses filtros.</p>:null}
   {current?<div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-sm">
    <div className="border-b border-border/70 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent p-5 sm:p-7">
     <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Análise individual</p><h3 className="mt-1 text-xl font-black sm:text-2xl">{current.nome}</h3><p className="text-xs text-muted-foreground">{current.cargo||"Colaborador"} · registros sob a identidade do executor, não sob o dono da carteira</p></div>
      <span className="rounded-xl border border-border bg-card/70 px-4 py-2 text-sm font-semibold">{n(current.carteira.total)} processos atribuídos</span>
     </div>
     <p className="mt-4 max-w-4xl text-sm leading-relaxed">{resumoPessoa(current)}</p>
    </div>
    <div className="space-y-6 p-5 sm:p-6">
     <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat title="Clientes/processos atendidos" value={current.atendimentos.processos} explain={n(current.atendimentos.eventos)+" registros no CRM no período"}/>
      <Stat title="Processos editados" value={current.edicoes.processos} explain={n(current.edicoes.eventos)+" ações de edição auditadas"}/>
      <Stat title="Encerramentos manuais" value={current.encerramentos.processos} explain={n(current.encerramentos.eventos)+" ações, sem testes administrativos"}/>
      <Stat title="Atividades registradas" value={current.atividades.registros} explain={n(current.atividades.internas)+" internas; "+n(current.atividades.contatosDeclarados)+" contatos declarados"}/>
     </div>
     <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border/70 p-5"><div className="mb-4 flex items-center gap-2"><FilePenLine className="h-5 w-5 text-indigo-500"/><h4 className="font-extrabold">O que foi registrado como atividade</h4></div><Highlights entries={current.atividades.categorias||[]} empty="Sem atividades cadastradas na tabela de tarefas neste período."/></div>
      <div className="rounded-2xl border border-border/70 p-5"><div className="mb-4 flex items-center gap-2"><Layers3 className="h-5 w-5 text-violet-500"/><h4 className="font-extrabold">Auditorias, análises e projetos</h4></div>
       <p className="mb-3 text-xs text-muted-foreground"><strong className="text-foreground">{n(current.trabalho.registros)}</strong> registros analíticos, incluindo <strong className="text-foreground">{n(current.trabalho.verificacoesLote)}</strong> verificações sistêmicas em lote. Não equivale a atendimentos a clientes.</p>
       <Highlights entries={current.trabalho.categorias||[]} empty="Sem análise ou projeto cadastrado nessa trilha para o período."/>
      </div>
     </div>
     <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-border/70 p-5"><h4 className="mb-1 flex items-center gap-2 font-extrabold"><FolderKanban className="h-5 w-5 text-violet-500"/> Entregas e trabalhos descritos</h4><p className="mb-4 text-xs text-muted-foreground">Dossiês, investigações, projetos e triagens com identificação própria. Exibe até oito exemplos distintos do período; a contagem completa está acima.</p><DeliveryList items={current.trabalho.entregasRecentes||[]}/></section>
      <section className="rounded-2xl border border-border/70 p-5"><h4 className="mb-1 flex items-center gap-2 font-extrabold"><FileClock className="h-5 w-5 text-indigo-500"/> Histórico das atividades cadastradas</h4><p className="mb-4 text-xs text-muted-foreground">Descrições recentes salvas em “Minhas atividades”; são registros próprios, não ações presumidas. A lista é uma amostra.</p><ActivityList items={current.atividades.recentes||[]}/></section>
     </div>
     <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2"><ShieldCheck className="h-4 w-4 text-emerald-600"/> Atendimento só com registro atribuído ao executor</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2"><BriefcaseBusiness className="h-4 w-4 text-indigo-500"/> Carteira e produtividade são medidas diferentes</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2"><CheckCircle2 className="h-4 w-4 text-violet-500"/> Testes sistêmicos não contam como atendimento</span>
     </div>
    </div>
   </div>:null}
   <details className="rounded-2xl border border-border/70 bg-card p-4 text-xs text-muted-foreground">
    <summary className="flex cursor-pointer items-center gap-2 font-semibold text-foreground"><ChevronDown className="h-4 w-4"/> Como o relatório atribui o trabalho</summary>
    <p className="mt-3 leading-relaxed">Atendimento e edição são apurados pelos eventos de auditoria vinculados ao usuário que executou o registro, mesmo em processo atribuído a outro responsável. Tarefas cadastradas em “Minhas atividades” e registros analíticos são fontes distintas e podem se referir ao mesmo trabalho; por isso, suas contagens não são somadas. Atividades importadas ou verificações em lote não comprovam, isoladamente, contato com clientes ou execução manual de cada caso. A falta de registro significa apenas falta de evidência nesta base e período. Encerramento administrativo não implica sentença definitiva.</p>
   </details>
  </>}
 </section>;
}
