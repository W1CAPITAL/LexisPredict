import Link from "next/link";
import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";
import { canViewCompanyAnalyses } from "@/lib/roles";
import { AnalisesPdfExportButton } from "@/components/analises-internas/pdf-export-button";

export const dynamic="force-dynamic";
export const revalidate=0;

export default async function AnalisesInternasPage({searchParams}:{
  searchParams:Promise<{q?:string;cat?:string;pagina?:string;atividadesPagina?:string;acoesPagina?:string}>
}) {
  const ctx=await getUserContext();
  // A rota é acessível a todo colaborador autenticado, mas conteúdo e KPIs
  // devem ser exclusivamente de sua autoria, sempre dentro da própria empresa.
  // Nunca aceitar um ID de responsável via query string ou dados do navegador.
  if(!canViewCompanyAnalyses(ctx)) {
    return <main className="p-8 text-foreground"><h1 className="text-2xl font-bold">Acesso restrito</h1><p className="mt-2">Entre com uma conta vinculada a uma empresa para consultar as análises internas.</p><Link className="text-primary underline" href="/login">Entrar</Link></main>;
  }
  const param=await searchParams;
  const q=String(param?.q||"").replace(/[^0-9A-Za-z.\- ]/g,"").slice(0,80);
  const cat=String(param?.cat||"").replace(/[^a-z_]/g,"").slice(0,50);
  const pagina=Math.min(999,Math.max(1,Number(param?.pagina||1)||1));
  const atividadesPagina=Math.min(99,Math.max(1,Number(param?.atividadesPagina||1)||1));
  const acoesPagina=Math.min(99,Math.max(1,Number(param?.acoesPagina||1)||1));
  const limit=40;
  const taskLimit=25;
  const actionLimit=20;
  const empresa=String(ctx.empresa_id);
  const usuario=String(ctx.auth_id);
  const admin=await getSupabaseAdmin();
  // As fontes são sempre delimitadas por empresa E pelo autor da sessão.
  // Usamos count+limit no banco, sem carregar milhares de registros para KPIs.
  let query=admin.from("registros_trabalho_analitico")
    .select("id,protocolo_ref,descricao,categoria,origem,data_atividade,nivel_conferencia,processo_id,responsavel_nome",{count:"exact"})
    .eq("empresa_id",empresa).eq("responsavel_auth_user_id",usuario);
  let tarefasQuery=admin.from("tarefas_realizadas")
    .select("id,titulo,descricao,categoria,data_realizacao,protocolo_ref,origem",{count:"exact"})
    .eq("empresa_id",empresa).eq("responsavel_auth_user_id",usuario);
  let acoesQuery=admin.from("auditoria_logs_app")
    .select("id,action,created_at,protocolo_ref",{count:"exact"})
    .eq("empresa_id",empresa).eq("auth_user_id",usuario)
    .in("action",["edicao","atendimento"]);
  if(q) {
    query=query.ilike("protocolo_ref",`%${q}%`);
    tarefasQuery=tarefasQuery.ilike("protocolo_ref",`%${q}%`);
    acoesQuery=acoesQuery.ilike("protocolo_ref",`%${q}%`);
  }
  if(cat)query=query.eq("categoria",cat);
  const [analisesResult,tarefasResult,acoesResult,docsResult,replicasResult]=await Promise.all([
    query.order("data_atividade",{ascending:false}).order("id",{ascending:false}).range((pagina-1)*limit,pagina*limit-1),
    tarefasQuery.order("data_realizacao",{ascending:false}).order("id",{ascending:false}).range((atividadesPagina-1)*taskLimit,atividadesPagina*taskLimit-1),
    acoesQuery.order("created_at",{ascending:false}).range((acoesPagina-1)*actionLimit,acoesPagina*actionLimit-1),
    admin.from("registros_trabalho_analitico").select("id",{head:true,count:"exact"}).eq("empresa_id",empresa).eq("responsavel_auth_user_id",usuario).eq("categoria","auditoria_documental"),
    admin.from("registros_trabalho_analitico").select("id",{head:true,count:"exact"}).eq("empresa_id",empresa).eq("responsavel_auth_user_id",usuario).eq("categoria","triagem_replica_provas"),
  ]);
  const {data,error,count}=analisesResult;
  const {data:atividades,error:atividadesError,count:atividadesCount}=tarefasResult;
  const {data:acoes,error:acoesError,count:acoesCount}=acoesResult;
  const resumo={
    totalRegistros:count||0,
    atividadesRegistradas:atividadesCount||0,
    acoesRegistradas:acoesCount||0,
    auditoriaDocumental:docsResult.count||0,
    triagemReplicaProvas:replicasResult.count||0,
  };
  const resumoError=docsResult.error||replicasResult.error;
  const grupos=[
    ["","Todos"],["auditoria_sistemica","Auditoria sistêmica"],
    ["auditoria_documental","Auditoria documental"],
    ["triagem_replica_provas","Réplica e provas"],["dossie_individual","Dossiês"],
    ["investigacao_get","Processos GET"],["investigacao_externa","Investigação externa"],
    ["entrega_projeto","Projetos e sistemas"]
  ];
  const link=(page:number,category=cat,taskPage=atividadesPagina,actionPage=acoesPagina)=>
    `/analises-internas?pagina=${page}&cat=${encodeURIComponent(category)}&q=${encodeURIComponent(q)}&atividadesPagina=${taskPage}&acoesPagina=${actionPage}`;
  const ids=[...new Set((data||[]).map(x=>x.protocolo_ref).filter(x=>/^\d{7}-/.test(x)))];
  const {data:names}=ids.length?await admin.from("processos").select("protocolo_ref,cliente").eq("empresa_id",empresa).in("protocolo_ref",ids):{data:[]};
  const nomePorCnj=new Map((names||[]).map(x=>[String(x.protocolo_ref),String(x.cliente||"")]));
  return <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-8 text-foreground sm:px-8">
    <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">LexisPredict · Relatórios e Auditoria</p>
      <h1 className="mt-2 text-3xl font-extrabold">Minhas análises e atividades</h1>
      <p className="mt-2 max-w-4xl text-sm text-slate-300">Histórico individual: análises documentadas, atividades manuais e ações operacionais. Cada fonte é identificada e não comprova, por si só, revisão jurídica integral ou contato com o cliente.</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[[resumo.totalRegistros,cat?"Análises filtradas":"Registros analíticos"],[resumo.atividadesRegistradas,"Atividades manuais"],[resumo.acoesRegistradas,"Ações operacionais"],[resumo.auditoriaDocumental,"Auditorias documentais"]].map(([v,l])=>
          <div key={String(l)} className="rounded-xl border border-white/20 bg-white/10 p-3"><strong className="text-2xl">{v}</strong><p className="mt-1 text-xs text-slate-300">{l}</p></div>)}
      </div>
    </header>
    <div className="flex flex-wrap gap-2">{grupos.map(([key,label])=>
      <Link key={key||"all"} href={link(1,key)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${cat===key?"bg-blue-700 border-blue-700 text-white":"border-border bg-card text-foreground hover:bg-muted"}`}>{label}</Link>)}
    </div>
    <form className="flex flex-wrap gap-3" action="/analises-internas">
      <input name="q" type="search" defaultValue={q} placeholder="Pesquisar CNJ ou identificação do projeto" className="min-w-[260px] flex-1 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground"/>
      <input type="hidden" name="cat" value={cat}/>
      <button className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white" type="submit">Buscar</button>
      <Link href="/report" className="rounded-lg border border-border bg-card px-4 py-2 text-sm">Voltar ao relatório</Link>
    </form>
    <section className="flex flex-col gap-4 rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/10 via-background to-background p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300">Exportação profissional</p>
        <h2 className="mt-1 text-lg font-bold">Seu trabalho em PDF</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">Capa, indicadores e histórico pessoal, respeitando a busca, a categoria e a paginação da tela. Sem expor análises de outros usuários.</p>
      </div>
      {ctx.isViewer
        ?<p className="max-w-xs text-xs text-muted-foreground">Perfil Visualizador: exportação bloqueada. A leitura da página continua disponível.</p>
        :<AnalisesPdfExportButton q={q} cat={cat} pagina={pagina} atividadesPagina={atividadesPagina} acoesPagina={acoesPagina}/>}
    </section>
    {resumoError?<p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Não foi possível conferir todos os indicadores: {resumoError.message}</p>:null}
    <h2 className="text-xl font-bold">Análises e auditorias documentadas</h2>
    {error?<p role="alert" className="rounded-lg bg-red-100 p-4 text-red-800">Erro ao consultar análises: {error.message}</p>:
    !(data||[]).length?<p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Nenhuma análise documental atribuída à sua conta nesta seleção. Outras atividades e ações registradas podem aparecer nas seções abaixo.</p>:
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-slate-900 text-white"><tr>{["Cliente / processo","Atividade atribuída","Data","Fonte","Comprovação"].map(t=><th key={t} className="p-3 text-left">{t}</th>)}</tr></thead>
        <tbody>{(data||[]).map((x,i)=><tr key={x.id} className={i%2?"bg-muted/40":""}>
          <td className="p-3 align-top"><b>{nomePorCnj.get(String(x.protocolo_ref))||(!x.processo_id?"Investigação ou projeto externo":"Processo cadastrado")}</b><div className="mt-1 font-mono text-xs">{x.protocolo_ref}</div></td>
          <td className="max-w-[310px] p-3 align-top"><b>{String(x.categoria).replace(/_/g," ")}</b><p className="mt-1 text-xs text-muted-foreground">{x.descricao}</p></td>
          <td className="p-3 align-top">{x.data_atividade}</td>
          <td className="max-w-[260px] break-words p-3 align-top text-xs">{x.origem}</td>
          <td className="p-3 align-top text-xs"><b>{x.responsavel_nome}</b><p className="mt-1 text-muted-foreground">{String(x.nivel_conferencia).replace(/_/g," ")} · sem contato presumido</p></td>
        </tr>)}</tbody>
      </table>
    </div>}
    <div className="flex items-center justify-between text-sm">
      <span>{count||0} registros encontrados · página {pagina}</span>
      <div className="flex gap-4">
       {pagina>1?<Link href={link(pagina-1)} className="text-primary underline">Anterior</Link>:null}
       {pagina*limit<(count||0)?<Link href={link(pagina+1)} className="text-primary underline">Próxima</Link>:null}
      </div>
    </div>
    <section className="space-y-3">
      <h2 className="text-xl font-bold">Minhas atividades registradas</h2>
      <p className="text-sm text-muted-foreground">Lançamentos manuais da aba Minhas atividades. Atendimentos e outras tarefas são identificados pela categoria original; não são automaticamente análises jurídicas.</p>
      {atividadesError?<p role="alert" className="rounded-lg border border-red-500/40 p-3 text-sm">Erro ao carregar atividades: {atividadesError.message}</p>:
      !(atividades||[]).length?<p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Nenhuma atividade manual encontrada nesta seleção.</p>:
      <div className="grid gap-3 lg:grid-cols-2">{(atividades||[]).map(item=>
        <article key={item.id} className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{item.data_realizacao} · {String(item.categoria||"outro").replace(/_/g," ")} · registro manual</p>
          <h3 className="mt-2 font-semibold">{item.titulo}</h3>
          {item.descricao?<p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.descricao}</p>:null}
          {item.protocolo_ref?<p className="mt-2 font-mono text-xs">CNJ: {item.protocolo_ref}</p>:null}
        </article>)}</div>}
      <div className="flex items-center justify-between text-sm">
        <span>{atividadesCount||0} atividades · página {atividadesPagina}</span>
        <div className="flex gap-4">
          {atividadesPagina>1?<Link href={link(pagina,cat,atividadesPagina-1)} className="text-primary underline">Anterior</Link>:null}
          {atividadesPagina*taskLimit<(atividadesCount||0)?<Link href={link(pagina,cat,atividadesPagina+1)} className="text-primary underline">Próxima</Link>:null}
        </div>
      </div>
    </section>
    <section className="space-y-3">
      <h2 className="text-xl font-bold">Minhas ações operacionais</h2>
      <p className="text-sm text-muted-foreground">Histórico técnico de edições e atendimentos atribuído à sua conta na auditoria do aplicativo. Não corresponde a análise jurídica confirmada nem prova de contato humano sem evidência adicional.</p>
      {acoesError?<p role="alert" className="rounded-lg border border-red-500/40 p-3 text-sm">Erro ao consultar auditoria: {acoesError.message}</p>:
      !(acoes||[]).length?<p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Nenhuma ação operacional encontrada nesta seleção.</p>:
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[500px] text-sm">
          <thead className="bg-slate-900 text-white"><tr><th className="p-3 text-left">Data</th><th className="p-3 text-left">Ação</th><th className="p-3 text-left">Processo</th></tr></thead>
          <tbody>{(acoes||[]).map(item=><tr key={item.id} className="border-t border-border">
            <td className="p-3">{new Date(item.created_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</td>
            <td className="p-3">{item.action==="edicao"?"Edição no sistema":"Atendimento registrado"}</td>
            <td className="p-3 font-mono text-xs">{item.protocolo_ref||"Sem processo vinculado"}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <div className="flex items-center justify-between text-sm">
        <span>{acoesCount||0} ações · página {acoesPagina}</span>
        <div className="flex gap-4">
          {acoesPagina>1?<Link href={link(pagina,cat,atividadesPagina,acoesPagina-1)} className="text-primary underline">Anterior</Link>:null}
          {acoesPagina*actionLimit<(acoesCount||0)?<Link href={link(pagina,cat,atividadesPagina,acoesPagina+1)} className="text-primary underline">Próxima</Link>:null}
        </div>
      </div>
    </section>
    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
     Registros de auditoria sistêmica podem indicar somente triagem de processos, sem leitura integral dos autos. Erros, irregularidades, prazos perdidos e responsabilidade profissional exigem conferência oficial adicional.
    </p>
  </main>;
}
