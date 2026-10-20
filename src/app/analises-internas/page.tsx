import Link from "next/link";
import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";
import { getResumoAnalisesDaEmpresa } from "@/lib/analises-internas";

export const dynamic="force-dynamic";
export const revalidate=0;

export default async function AnalisesInternasPage({searchParams}:{
  searchParams:Promise<{q?:string;cat?:string;pagina?:string}>
}) {
  const ctx=await getUserContext();
  const davi=String(ctx?.auth_id||"")==="4581d2fe-c358-45f9-a1bd-f90f93dce0fc";
  if(!ctx?.empresa_id || !(davi||ctx.isSupervisor||ctx.isSuperAdmin)) {
    return <main className="p-8 text-foreground"><h1 className="text-2xl font-bold">Acesso restrito</h1><p className="mt-2">Disponível para o responsável da auditoria e para Supervisão.</p><Link className="text-primary underline" href="/report">Voltar aos relatórios</Link></main>;
  }
  const param=await searchParams;
  const q=String(param?.q||"").replace(/[^0-9A-Za-z.\- ]/g,"").slice(0,80);
  const cat=String(param?.cat||"").replace(/[^a-z_]/g,"").slice(0,50);
  const pagina=Math.min(99,Math.max(1,Number(param?.pagina||1)||1));
  const limit=100;
  const empresa=String(ctx.empresa_id);
  const admin=await getSupabaseAdmin();
  let query=admin.from("registros_trabalho_analitico")
    .select("protocolo_ref,descricao,categoria,origem,data_atividade,nivel_conferencia,processo_id,responsavel_nome,contato_cliente_confirmado",{count:"exact"})
    .eq("empresa_id",empresa);
  if(q)query=query.ilike("protocolo_ref",`%${q}%`);
  if(cat)query=query.eq("categoria",cat);
  const {data,error,count}=await query.order("data_atividade",{ascending:false})
    .order("categoria",{ascending:true})
    .range((pagina-1)*limit,pagina*limit-1);
  const resumo=await getResumoAnalisesDaEmpresa(empresa);
  const grupos=[
    ["","Todos"],["auditoria_sistemica","Auditoria sistêmica"],
    ["auditoria_documental","Auditoria documental"],
    ["triagem_replica_provas","Réplica e provas"],["dossie_individual","Dossiês"],
    ["investigacao_get","Processos GET"],["investigacao_externa","Investigação externa"],
    ["entrega_projeto","Projetos e sistemas"]
  ];
  const link=(page:number,category=cat)=>`/analises-internas?pagina=${page}&cat=${category}&q=${encodeURIComponent(q)}`;
  const ids=[...new Set((data||[]).map(x=>x.protocolo_ref).filter(x=>/^\d{7}-/.test(x)))];
  const {data:names}=ids.length?await admin.from("processos").select("protocolo_ref,cliente").eq("empresa_id",empresa).in("protocolo_ref",ids):{data:[]};
  const nomePorCnj=new Map((names||[]).map(x=>[String(x.protocolo_ref),String(x.cliente||"")]));
  return <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-8 text-foreground sm:px-8">
    <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">LexisPredict · Relatórios e Auditoria</p>
      <h1 className="mt-2 text-3xl font-extrabold">Análises e investigações de Davi</h1>
      <p className="mt-2 max-w-4xl text-sm text-slate-300">Produção interna atribuída a Davi Alves Figueredo, com CNJ, fonte e data. Contabilizada como atendimento interno/produção analítica; não equivale a contato do cliente ou validação de todo o processo no tribunal.</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[[resumo.processosAnalisados,"Processos com registro"],[resumo.auditoriaDocumental,"Auditorias documentais"],[resumo.triagemReplicaProvas,"Réplica e provas"],[resumo.investigacoesExternas,"Investigações externas"]].map(([v,l])=>
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
    {error?<p className="rounded-lg bg-red-100 p-4 text-red-800">Erro ao consultar o Supabase: {error.message}</p>:
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-slate-900 text-white"><tr>{["Cliente / processo","Atividade atribuída","Data","Fonte","Comprovação"].map(t=><th key={t} className="p-3 text-left">{t}</th>)}</tr></thead>
        <tbody>{(data||[]).map((x,i)=><tr key={String(x.protocolo_ref)+x.categoria+x.origem} className={i%2?"bg-muted/40":""}>
          <td className="p-3 align-top"><b>{nomePorCnj.get(String(x.protocolo_ref))||(!x.processo_id?"Investigação ou projeto externo":"Processo cadastrado")}</b><div className="mt-1 font-mono text-xs">{x.protocolo_ref}</div></td>
          <td className="max-w-[310px] p-3 align-top"><b>{String(x.categoria).replace(/_/g," ")}</b><p className="mt-1 text-xs text-muted-foreground">{x.descricao}</p></td>
          <td className="p-3 align-top">{x.data_atividade}</td>
          <td className="max-w-[260px] break-words p-3 align-top text-xs">{x.origem}</td>
          <td className="p-3 align-top text-xs"><b>Davi Alves Figueredo</b><p className="mt-1 text-muted-foreground">{String(x.nivel_conferencia).replace(/_/g," ")} · sem contato presumido</p></td>
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
    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
     Registros de auditoria sistêmica comprovam que o processo passou pela planilha de triagem coordenada por Davi, não leitura integral dos autos um a um. Erro, irregularidade, prazo perdido e responsabilidade profissional exigem conferência oficial adicional.
    </p>
  </main>;
}
