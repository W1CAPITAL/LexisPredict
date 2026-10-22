import {redirect} from "next/navigation";
import {getUserContext,getSupabaseAdmin} from "@/lib/server-db";
import {hojeBrasilISO} from "@/lib/prazo-status";
import {Sidebar} from "@/components/layout/sidebar";
import {VencidosPanel,type VencidoRow,type Owner} from "@/components/vencidos/vencidos-panel";
import {VencidosLiveSync} from "@/components/vencidos/vencidos-live-sync";
import Link from "next/link";
export const dynamic="force-dynamic";
export const revalidate=0;

/** Consulta direta e restrita à empresa: não depende das primeiras 24/60
 * linhas em cache das telas /cases, /processos ou /tarefas.
 */
export default async function VencidosPage(){
 const ctx=await getUserContext();
 if(!ctx.empresa_id||!ctx.auth_id)redirect("/login");
 const today=hojeBrasilISO();
 const db=await getSupabaseAdmin();
 const candidate="proximo_retorno.lt."+today+",proximo_prazo.lt."+today+",status.eq.Vencido,status.eq.Caso Crítico";
 const batchSize=500;
 let rows:VencidoRow[]=[];
 let failed="";
 let reached=false;
 // Paginação explícita: o limite padrão do Supabase não corta silenciosamente a lista.
 for(let offset=0;offset<10000;offset+=batchSize){
  const result=await db.from("processos")
   .select("id,cliente,protocolo_ref,created_by,status,status_interno,statusManual:dados->>statusManual,proximo_retorno,proximo_prazo,ultimo_retorno,escritorio,advogado,datajud_ultimo_nome,ultima_movimentacao,tem_atualizacao_pos_retorno")
   .eq("empresa_id",ctx.empresa_id).or(candidate)
   .order("id",{ascending:true}).range(offset,offset+batchSize-1);
  if(result.error){failed="Não foi possível buscar todos os vencidos. Confira a conexão.";break;}
  const batch=(result.data||[]) as VencidoRow[];
  rows.push(...batch);
  if(batch.length<batchSize)break;
  if(offset+batchSize>=10000)reached=true;
 }
 const staff=await db.from("usuarios").select("id,auth_user_id,nome")
  .eq("empresa_id",ctx.empresa_id).order("nome");
 if(staff.error)failed=failed||"A lista de responsáveis não pôde ser carregada.";
 const owners=((staff.data||[]) as Owner[]).filter(x=>x.nome&&!/^(GET|W1 CONTROL|SISTEMA INTERNO|SUPERVISÃO)$/i.test(x.nome));
 return <div className="flex min-h-screen bg-background text-foreground">
  <Sidebar/>
  <main className="lexis-main-pad min-w-0 flex-1 p-4 sm:p-7">
   <div className="mx-auto max-w-[1380px] space-y-4">
    <nav className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
     <Link href="/cases" className="hover:text-primary">Meus processos</Link><span>/</span>
     <Link href="/processos" className="hover:text-primary">Empresa</Link><span>/</span>
     <span className="text-foreground">Vencidos</span>
     <div className="ml-auto"><VencidosLiveSync/></div>
    </nav>
    {failed?<p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm">{failed}</p>:null}
    <VencidosPanel data={rows} owners={owners} hoje={today} limitReached={reached||!!failed}/>
   </div>
  </main>
 </div>;
}
