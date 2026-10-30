import Link from "next/link";
import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";
import { registrarTarefaRealizadaAction } from "@/app/actions/tarefas-realizadas-actions";
import { JurisTimesheetSection } from "@/components/atividades/timesheet-integrado";
import { getAtividadesRegistradasPorResponsavel, type AtividadesResponsavelResumo } from "@/lib/atividades-registradas";

export const dynamic="force-dynamic";
export const revalidate=0;

const PAGE_SIZE=50;
const categorias=[["atendimento","Atendimento"],["analise_processual","Análise de processo"],["auditoria","Auditoria"],["dossie","Dossiê"],["investigacao","Investigação"],["planilha","Planilha"],["sistema","Sistema"],["automacao","Automação"],["outro","Outra"]] as const;
type ProcessoResumo={
 id:number;
 protocolo_ref:string|null;
 cliente:string|null;
 advogado:string|null;
 escritorio:string|null;
 status:string|null;
 status_interno:string|null;
 risco:string|null;
 ultima_movimentacao:string|null;
 ultimo_retorno:string|null;
 proximo_retorno:string|null;
 proximo_prazo:string|null;
 datajud_ultimo_nome:string|null;
 datajud_ultimo_movimento:string|null;
 djen_ultima_data:string|null;
 djen_ultimo_resumo:string|null;
 tribunal:string|null;
 classe_acao:string|null;
 parte_passiva:string|null;
 dados:Record<string,unknown>|null;
};
const dataBr=(value?:string|null)=>{
 if(!value)return "—";
 const match=value.match(/^(\d{4})-(\d{2})-(\d{2})/);
 return match?match[3]+"/"+match[2]+"/"+match[1]:value;
};

export default async function MinhasAtividades({searchParams}:{searchParams:Promise<{salvo?:string;erro?:string;pagina?:string}>}){
 const ctx=await getUserContext();
 if(!ctx.auth_id||!ctx.empresa_id)return <main className="p-8"><Link href="/login">Entrar</Link></main>;
 const qs=await searchParams;
 const pagina=Math.max(1,Math.min(999,Number(qs.pagina||1)||1));
 const db=await getSupabaseAdmin();
 const empresa=String(ctx.empresa_id);
 const usuario=String(ctx.auth_id);
 const [{data:perfil},{data:atividades,error,count},activityStatsByUser]=await Promise.all([
  db.from("usuarios").select("nome").eq("empresa_id",empresa).eq("auth_user_id",usuario).maybeSingle(),
  db.from("tarefas_realizadas")
   .select("id,titulo,descricao,categoria,data_realizacao,protocolo_ref,processo_id,contato_cliente_confirmado,created_at",{count:"exact"})
   .eq("empresa_id",empresa).eq("responsavel_auth_user_id",usuario)
   .order("data_realizacao",{ascending:false}).order("created_at",{ascending:false})
   .range((pagina-1)*PAGE_SIZE,pagina*PAGE_SIZE-1),
  getAtividadesRegistradasPorResponsavel(empresa).catch(()=>({} as Record<string,AtividadesResponsavelResumo>))
 ]);
 const rows=atividades||[];
 const processIds=[...new Set(rows.map(a=>a.processo_id).filter((id):id is number=>id!=null))];
 const cnjs=[...new Set(rows.map(a=>String(a.protocolo_ref||"").trim()).filter(Boolean))];
 const activitySummary=activityStatsByUser[usuario]||null;
 const processColumns="id,protocolo_ref,cliente,advogado,escritorio,status,status_interno,risco,ultima_movimentacao,ultimo_retorno,proximo_retorno,proximo_prazo,datajud_ultimo_nome,datajud_ultimo_movimento,djen_ultima_data,djen_ultimo_resumo,tribunal,classe_acao,parte_passiva,dados";
 const [byIdResult,byCnjResult]=await Promise.all([
  processIds.length
   ?db.from("processos").select(processColumns).eq("empresa_id",empresa).in("id",processIds)
   :Promise.resolve({data:[],error:null}),
  cnjs.length
   ?db.from("processos").select(processColumns).eq("empresa_id",empresa).in("protocolo_ref",cnjs)
   :Promise.resolve({data:[],error:null})
 ]);
 const byId=new Map<number,ProcessoResumo>(((byIdResult.data||[]) as ProcessoResumo[]).map(p=>[Number(p.id),p]));
 const byCnj=new Map<string,ProcessoResumo>(((byCnjResult.data||[]) as ProcessoResumo[]).map(p=>[String(p.protocolo_ref||""),p]));
 const processoDaAtividade=(a:(typeof rows)[number])=>
  (a.processo_id!=null?byId.get(Number(a.processo_id)):null)
  ||(a.protocolo_ref?byCnj.get(String(a.protocolo_ref)):null);
 const processError=byIdResult.error||byCnjResult.error;
 const total=count||0;
 const totalPaginas=Math.max(1,Math.ceil(total/PAGE_SIZE));
 const hoje=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
 const responsavel=perfil?.nome||"Usuário autenticado";
 const paginaLink=(p:number)=>"/minhas-atividades?pagina="+p;

 return <main data-lexis-visual="activities" className="mx-auto max-w-[1450px] space-y-6 p-5 text-foreground sm:p-8">
  <header className="rounded-3xl bg-slate-950 p-8 text-white">
   <p className="text-xs uppercase tracking-widest text-sky-300">LexisPredict • Produtividade</p>
   <h1 className="mt-2 text-3xl font-extrabold">Minhas atividades realizadas</h1>
   <p className="mt-2 text-sm text-slate-300">Responsável: <strong>{responsavel}</strong>. Registros separados por executor, com os dados do processo vinculado quando houver correspondência segura.</p>
   <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
    <div className="rounded-xl border border-white/20 bg-white/10 p-3"><strong className="text-2xl tabular-nums">{(activitySummary?.registros??total).toLocaleString("pt-BR")}</strong><p className="mt-1 text-xs text-slate-300">Atividades cadastradas</p></div>
    <div className="rounded-xl border border-white/20 bg-white/10 p-3"><strong className="text-2xl tabular-nums">{activitySummary?.processos?.toLocaleString("pt-BR")??"—"}</strong><p className="mt-1 text-xs text-slate-300">Processos relacionados</p></div>
    <div className="rounded-xl border border-white/20 bg-white/10 p-3"><strong className="text-2xl tabular-nums">{activitySummary?.contatosMarcados?.toLocaleString("pt-BR")??"—"}</strong><p className="mt-1 text-xs text-slate-300">Contatos marcados</p></div>
    <div className="rounded-xl border border-white/20 bg-white/10 p-3"><strong className="text-2xl tabular-nums">{activitySummary?.semReferencia?.toLocaleString("pt-BR")??"—"}</strong><p className="mt-1 text-xs text-slate-300">Sem referência de processo</p></div>
    <div className="col-span-2 rounded-xl border border-white/20 bg-white/10 p-3 sm:col-span-1"><strong className="text-2xl tabular-nums">{pagina.toLocaleString("pt-BR")} / {totalPaginas.toLocaleString("pt-BR")}</strong><p className="mt-1 text-xs text-slate-300">Página do histórico</p></div>
   </div>
  </header>
  {qs.salvo?<p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-emerald-600">Atividade salva no Supabase.</p>:null}
  {qs.erro?<p role="alert" className="rounded-lg bg-red-500/10 p-3 text-red-600">Verifique os campos e tente novamente.</p>:null}
  <div className="grid gap-5 lg:grid-cols-2">
   <section className="rounded-2xl border border-border bg-card p-6">
    <h2 className="mb-4 text-xl font-bold">Adicionar tarefa realizada</h2>
    <form action={registrarTarefaRealizadaAction} className="space-y-3 text-sm">
     <label className="block font-semibold">Título *<input required minLength={4} maxLength={180} name="titulo" placeholder="O que você realizou?" className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-normal"/></label>
     <label className="block font-semibold">Categoria *<select name="categoria" className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-normal">{categorias.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
     <label className="block font-semibold">Data real de execução *<input required type="date" max={hoje} defaultValue={hoje} name="data_realizacao" className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-normal"/></label>
     <label className="block font-semibold">CNJ (opcional)<input name="protocolo_ref" placeholder="0000000-00.2026.8.26.0000" className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-normal"/></label>
     <label className="block font-semibold">Descrição / resultado<textarea name="descricao" maxLength={4000} rows={5} className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-normal" placeholder="Explique o que foi entregue ou resolvido."/></label>
     <label className="flex gap-2 rounded-lg border border-border p-3"><input type="checkbox" name="contato_confirmado" value="sim"/><span>Houve contato real com o cliente. Marcar somente para categoria Atendimento e quando puder comprovar a interação.</span></label>
     <button className="w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white" type="submit">Salvar atividade concluída</button>
    </form>
   </section>
   <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Histórico pessoal completo</h2><Link href="/analises-internas" className="text-sm text-primary underline">Análises antigas</Link></div>
    <p className="text-xs text-muted-foreground">Cada atividade mantém o responsável que realmente a cadastrou. Os dados do processo são consultados no cadastro do CRM, sem copiar ou inventar movimentações.</p>
    {error?<p className="text-red-600">Falha na consulta: {error.message}</p>:null}
    {processError?<p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">Alguns dados dos processos não puderam ser carregados nesta página. As atividades e os CNJs originais continuam disponíveis.</p>:null}
    {!rows.length&&!error?<p className="text-sm text-muted-foreground">Ainda não há atividades inseridas manualmente nesta conta.</p>:null}
    <div className="max-h-[1100px] space-y-3 overflow-y-auto">
     {rows.map(a=>{
      const processo=processoDaAtividade(a);
      const situacao=String(processo?.dados?.situacao||processo?.status_interno||processo?.status||"Não informada");
      return <article key={a.id} className="rounded-xl border border-border bg-background p-4">
       <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{dataBr(a.data_realizacao)} • {categorias.find(x=>x[0]===a.categoria)?.[1]||a.categoria}</p>
        {a.contato_cliente_confirmado?<span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Contato marcado no registro</span>:null}
       </div>
       <h3 className="mt-2 font-bold">{a.titulo}</h3>
       {a.descricao?<p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{a.descricao}</p>:null}
       <div className="mt-3 rounded-xl border border-border/70 bg-card/70 p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-primary">Dados do processo relacionado</p>
        {processo?<div className="mt-2 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
         <div className="sm:col-span-2"><span className="text-muted-foreground">Cliente</span><p className="font-semibold">{processo.cliente||"Não informado no cadastro"}</p></div>
         <div className="sm:col-span-2"><span className="text-muted-foreground">CNJ</span><p className="break-all font-mono">{processo.protocolo_ref||a.protocolo_ref||"Não cadastrado"}</p></div>
         <div><span className="text-muted-foreground">Advogado</span><p className="font-semibold">{processo.advogado||"Não atribuído"}</p></div>
         <div><span className="text-muted-foreground">Escritório</span><p className="font-semibold">{processo.escritorio||"Não informado"}</p></div>
         <div><span className="text-muted-foreground">Situação no CRM</span><p className="font-semibold">{situacao}</p></div>
         <div><span className="text-muted-foreground">Status / risco</span><p className="font-semibold">{processo.status||"—"} · {processo.risco||"Risco não classificado"}</p></div>
         <div><span className="text-muted-foreground">Tribunal</span><p className="font-semibold">{processo.tribunal||"Não informado"}</p></div>
         <div><span className="text-muted-foreground">Classe</span><p className="font-semibold">{processo.classe_acao||"Não informada"}</p></div>
         <div><span className="text-muted-foreground">Parte contrária</span><p className="font-semibold">{processo.parte_passiva||"Não informada"}</p></div>
         <div><span className="text-muted-foreground">Última movimentação cadastrada</span><p className="font-semibold">{dataBr(processo.ultima_movimentacao)}</p></div>
         <div><span className="text-muted-foreground">Último movimento DataJud</span><p className="font-semibold">{processo.datajud_ultimo_nome||"Não informado"} · {dataBr(processo.datajud_ultimo_movimento)}</p></div>
         <div><span className="text-muted-foreground">Última publicação DJEN</span><p className="font-semibold">{processo.djen_ultimo_resumo||"Não informada"} · {dataBr(processo.djen_ultima_data)}</p></div>
         <div><span className="text-muted-foreground">Último retorno</span><p className="font-semibold">{dataBr(processo.ultimo_retorno)}</p></div>
         <div><span className="text-muted-foreground">Próximo retorno</span><p className="font-semibold">{dataBr(processo.proximo_retorno)}</p></div>
         <div><span className="text-muted-foreground">Próximo prazo</span><p className="font-semibold">{dataBr(processo.proximo_prazo)}</p></div>
        </div>:a.processo_id||a.protocolo_ref?<div className="mt-2 text-xs text-amber-700 dark:text-amber-300"><p>Há referência de processo neste registro, mas o cadastro correspondente não foi localizado com segurança.</p>{a.protocolo_ref?<p className="mt-1 break-all font-mono">CNJ informado na atividade: {a.protocolo_ref}</p>:null}{a.processo_id?<p className="mt-1">ID do processo: {a.processo_id}</p>:null}</div>:<p className="mt-2 text-xs text-muted-foreground">Esta atividade não possui processo vinculado.</p>}
       </div>
      </article>;
     })}
    </div>
    {totalPaginas>1?<nav aria-label="Paginação do histórico de atividades" className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
     <span className="text-xs text-muted-foreground">Exibindo {(total?((pagina-1)*PAGE_SIZE+1):0).toLocaleString("pt-BR")}–{Math.min(pagina*PAGE_SIZE,total).toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")} atividades</span>
     <div className="flex items-center gap-3">
      {pagina>1?<Link href={paginaLink(pagina-1)} className="rounded-lg border border-border px-3 py-2 font-semibold text-primary">Anterior</Link>:null}
      <span className="text-xs tabular-nums">Página {pagina} / {totalPaginas}</span>
      {pagina<totalPaginas?<Link href={paginaLink(pagina+1)} className="rounded-lg border border-border px-3 py-2 font-semibold text-primary">Próxima</Link>:null}
     </div>
    </nav>:null}
   </section>
  </div>
  <JurisTimesheetSection />
 </main>;
}
