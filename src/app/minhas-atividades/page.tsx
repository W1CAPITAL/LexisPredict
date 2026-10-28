import Link from "next/link";
import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";
import { registrarTarefaRealizadaAction } from "@/app/actions/tarefas-realizadas-actions";
import { JurisTimesheetSection } from "@/components/atividades/timesheet-integrado";
export const dynamic="force-dynamic";
const categorias=[["atendimento","Atendimento"],["analise_processual","Análise de processo"],["auditoria","Auditoria"],["dossie","Dossiê"],["investigacao","Investigação"],["planilha","Planilha"],["sistema","Sistema"],["automacao","Automação"],["outro","Outra"]];
export default async function MinhasAtividades({searchParams}:{searchParams:Promise<{salvo?:string;erro?:string}>}){
 const ctx=await getUserContext();
 if(!ctx.auth_id||!ctx.empresa_id)return <main className="p-8"><Link href="/login">Entrar</Link></main>;
 const db=await getSupabaseAdmin();
 const {data:atividades,error}=await db.from("tarefas_realizadas").select("id,titulo,descricao,categoria,data_realizacao,protocolo_ref,contato_cliente_confirmado").eq("empresa_id",ctx.empresa_id).eq("responsavel_auth_user_id",ctx.auth_id).order("data_realizacao",{ascending:false}).limit(100);
 const qs=await searchParams;
 const hoje=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
 return <main data-lexis-visual="activities" className="mx-auto max-w-[1250px] space-y-6 p-5 text-foreground sm:p-8">
  <header className="rounded-3xl bg-slate-950 p-8 text-white">
   <p className="text-xs uppercase tracking-widest text-sky-300">LexisPredict • Produtividade</p>
   <h1 className="mt-2 text-3xl font-extrabold">Minhas atividades realizadas</h1>
   <p className="mt-3 text-sm text-slate-300">Registre seu trabalho por data, categoria e processo. As tarefas concluídas serão consideradas no seu relatório e na supervisão.</p>
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
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Histórico pessoal</h2><Link href="/analises-internas" className="text-sm text-primary underline">Análises antigas</Link></div>
    {error?<p className="text-red-600">Falha na consulta: {error.message}</p>:null}
    {!atividades?.length?<p className="text-sm text-muted-foreground">Ainda não há atividades inseridas manualmente.</p>:null}
    <div className="max-h-[900px] space-y-3 overflow-y-auto">{(atividades||[]).map(a=><article key={a.id} className="rounded-xl border border-border bg-background p-4">
     <p className="text-xs text-muted-foreground">{a.data_realizacao} • {categorias.find(x=>x[0]===a.categoria)?.[1]||a.categoria}</p>
     <h3 className="mt-2 font-bold">{a.titulo}</h3>
     <p className="mt-2 whitespace-pre-wrap text-sm">{a.descricao}</p>
     {a.protocolo_ref?<p className="mt-2 font-mono text-xs">CNJ: {a.protocolo_ref}</p>:null}
     {a.contato_cliente_confirmado?<p className="mt-2 text-xs text-emerald-600">Contato declarado</p>:null}
    </article>)}</div>
   </section>
  </div>
  <JurisTimesheetSection />
 </main>;
}