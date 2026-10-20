import Link from "next/link";
import { getUserContext, getStoredCasesPageForEmpresa } from "@/lib/server-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = { cnj: string; cliente: string; escritorio: string; advogado: string;
  status: string; fase: string; leitura: string; registro: string;
  origem: string; datajud: string; djen: string; comercial: string; motivos: string; tipo: "replica" | "provas" };
const normalize = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dateLabel = (value: unknown) => {
  if (!value) return "Sem data";
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR", {timeZone:"America/Sao_Paulo"}) : String(value).slice(0,10);
};

function classify(note: string, summary: string, type: "replica" | "provas") {
  const n = normalize(note), d = normalize(summary);
  // Um andamento posterior pode contrariar a etiqueta antiga da carteira.
  if (/sentenca|improcedent|procedent|extincao|arquivamento|baixa definitiva/.test(d))
    return { fase:"Revisar decisão posterior", leitura:"O DJEN menciona decisão/encerramento; a anotação de fase pode estar ultrapassada." };
  if (type==="replica") {
    if (/nao apresent|nao foi apresentada|prazo decorrid|passado prazo|perda de prazo|ausencia replica/.test(n))
      return { fase:"Conferir prazo / não apresentada", leitura:"Conferir intimação e petição protocolada antes de concluir perda de prazo." };
    if (/replica (apresentad|juntad|realizad|protocolad)|apresentamos a replica|apos apresentarmos a replica/.test(n))
      return { fase:"Réplica informada como enviada", leitura:"Confirmar protocolo e próximo andamento no tribunal." };
    if (/aguard.{0,35}replica|apresentar.{0,15}replica|realizar replica|intimad.{0,45}replica/.test(n))
      return { fase:"Aguardando réplica", leitura:"Conferir se o prazo está aberto e quem deve peticionar." };
    return { fase:"Referência à réplica", leitura:"A palavra aparece no histórico, mas não comprova fase atual." };
  }
  if (/provas (juntad|apresentad|protocolad)|juntada de provas|manifestacao de provas.*apresent|protocolamos nossa manifestacao/.test(n))
    return { fase:"Provas informadas como enviadas", leitura:"Confirmar protocolo/recebimento dos documentos." };
  if (/intimad.{0,70}(provas|documentos)|aguard.{0,30}(provas|documentos)|especificacao de provas|producao de provas|apresentacao de provas|envio de provas/.test(n+" "+d))
    return { fase:"Provas / verificar envio", leitura:"Conferir despacho, necessidade de documentos e prazo." };
  if (/pericia|laudo|perito/.test(n)) return {fase:"Perícia / laudo",leitura:"Conferir andamento e eventual manifestação técnica."};
  return {fase:"Referência a provas",leitura:"Não comprova prazo para enviar documentos."};
}
function classifySale(status: string, phase: string) {
 if (normalize(status).includes("encerrado")) return ["Não oferecer","Processo encerrado na carteira."];
 if (/Revisar decisão|Conferir prazo/.test(phase)) return ["Não oferecer agora","Antes, conferir prazo ou decisão com o advogado."];
 if (/Provas \/ verificar envio|Referência a provas|Perícia/.test(phase))
   return ["Avaliar, não vender automaticamente","Somente serviço administrativo/documental adicional, necessário e fora do contrato; medida jurídica é do advogado."];
 return ["Não oferecer automaticamente","Etapa processual não é motivo suficiente para nova contratação."];
}
export default async function FasesProcessuaisPage() {
 const ctx = await getUserContext();
 const empresaId = String(ctx?.empresa_id || "");
 if (!empresaId || !ctx.auth_id) {
   return <main className="p-8"><h1 className="text-xl font-bold">Acesso restrito</h1><p>Entre na sua conta para ver os processos.</p><Link href="/login" className="underline">Entrar</Link></main>;
 }
 const rows: any[] = [];
 // Mesma exceção de leitura empresarial da página /processos; não concede edição nem envio.
 for (let offset=0; offset<10000; offset+=400) {
   const page = await getStoredCasesPageForEmpresa(empresaId,400,offset,false,{companyReadOnly:true,validatedContext:ctx});
   rows.push(...page);
   if (page.length<400) break;
 }
 const seen = new Set<string>(), data: Row[]=[];
 for (const c of rows) {
   const caseData=c as any;
   const status=String(caseData.status || caseData.situacao || "");
   if (normalize(status).includes("encerrado") || normalize(caseData.status_interno).includes("encerrado")) continue;
   const note=String(caseData.observacao || caseData.observacoes || "");
   const summary=String(caseData.djen_ultimo_resumo || "");
   const extra=String(caseData.datajud_ultimo_nome || "");
   const content=normalize(note+" "+summary+" "+extra);
   const cnj=String(caseData.protocolo || caseData.protocolo_ref || "").trim();
   for (const type of ["replica","provas"] as const) {
     const matched=type==="replica" ? /replica/.test(content) : /provas|pericia|laudo pericial|instrucao probatoria/.test(content);
     if(!matched) continue;
     const key=cnj+":"+type;
     if(seen.has(key)) continue;
     seen.add(key);
     const result=classify(note,summary,type);
     const [comercial,motivos]=classifySale(status,result.fase);
     data.push({
       cnj,cliente:String(caseData.cliente||"Sem nome"),
       escritorio:String(caseData.escritorio||""),advogado:String(caseData.advogado||"Não atribuído"),
       status,fase:result.fase,leitura:result.leitura,
       registro:note.slice(0,450),origem:summary.slice(0,280),
       datajud:dateLabel(caseData.datajud_consultado_em),
       djen:dateLabel(caseData.djen_consultado_em),
       comercial,motivos,tipo:type
     });
   }
 }
 const replica=data.filter(r=>r.tipo==="replica").sort((a,b)=>a.cliente.localeCompare(b.cliente,"pt-BR"));
 const provas=data.filter(r=>r.tipo==="provas").sort((a,b)=>a.cliente.localeCompare(b.cliente,"pt-BR"));
 const unique=new Set(data.map(r=>r.cnj)).size;
 const Table = ({items}:{items:Row[]}) => <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
  <table className="w-full min-w-[1060px] text-sm">
   <thead className="bg-slate-900 text-white"><tr>{["Cliente / CNJ","Advogado / escritório","Fase indicada","Status","Fonte mais recente","Comercial / motivo"].map(x=><th key={x} className="p-3 text-left font-semibold">{x}</th>)}</tr></thead>
   <tbody>{items.map((r,i)=><tr key={r.cnj+":"+r.tipo} className={i%2?"bg-muted/40":""}>
    <td className="p-3 align-top"><b>{r.cliente}</b><div className="font-mono text-xs text-muted-foreground">{r.cnj}</div></td>
    <td className="p-3 align-top">{r.advogado}<div className="text-xs text-muted-foreground">{r.escritorio}</div></td>
    <td className="p-3 align-top"><b>{r.fase}</b><p className="mt-1 max-w-[280px] text-xs text-muted-foreground">{r.leitura}</p><details className="mt-1 text-xs"><summary className="cursor-pointer underline">Ver registros</summary><p className="mt-1 whitespace-pre-wrap break-words">{r.registro||"Sem observação"}</p><p className="mt-1 text-muted-foreground">{r.origem}</p></details></td>
    <td className="p-3 align-top">{r.status}</td>
    <td className="p-3 align-top text-xs">DataJud: {r.datajud}<div>DJEN: {r.djen}</div></td>
    <td className="p-3 align-top"><b>{r.comercial}</b><p className="mt-1 max-w-[290px] text-xs text-muted-foreground">{r.motivos}</p></td>
   </tr>)}</tbody>
  </table>
 </div>;
 return <main className="mx-auto max-w-[1700px] space-y-6 px-4 py-8 text-foreground sm:px-8">
   <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-9">
    <p className="text-xs font-semibold tracking-[0.17em] text-blue-200">LEXISPREDICT / CARTEIRA / TRIAGEM</p>
    <h1 className="mt-2 text-3xl font-bold">Réplica, provas e envio de documentos</h1>
    <p className="mt-2 max-w-4xl text-sm text-slate-300">Consulta ao Supabase da empresa feita ao abrir esta página. A anotação de réplica ou provas não confirma prazo aberto nem fase atual no tribunal. Datas de consulta mostradas por processo.</p>
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[[String(rows.length),"processos analisados"],[String(replica.length),"referências à réplica"],[String(provas.length),"provas e perícias"],[String(unique),"processos distintos"]].map(([v,t])=><div key={t} className="rounded-xl border border-white/20 bg-white/10 p-3"><b className="text-2xl">{v}</b><p className="text-xs text-slate-300">{t}</p></div>)}</div>
   </header>
   <div className="flex flex-wrap items-center gap-3"><Link className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white" href="#provas">Ver provas e envios</Link><Link className="rounded-lg border border-border px-4 py-2 text-sm" href="#replica">Ver réplicas</Link><Link className="rounded-lg border border-border px-4 py-2 text-sm" href="/processos">Voltar à carteira</Link></div>
   <section id="provas" className="space-y-3 scroll-mt-6"><h2 className="text-2xl font-bold">Provas e documentos ({provas.length})</h2><p className="text-sm text-muted-foreground">Os casos com sentença, prova já enviada ou simples menção no histórico ficam sinalizados para conferência; nenhum é marcado automaticamente como prazo aberto.</p><Table items={provas}/></section>
   <section id="replica" className="space-y-3 scroll-mt-6"><h2 className="text-2xl font-bold">Réplica à contestação ({replica.length})</h2><Table items={replica}/></section>
   <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">Nenhuma oferta é aprovada automaticamente. Contrato, serviço já contratado, intimação, petição e fase judicial precisam ser conferidos antes de recomendar cobrança ou contratação adicional.</p>
 </main>;
}