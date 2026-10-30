'use server';

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";

const CATEGORIAS=new Set([
  "atendimento","auditoria","dossie","investigacao","planilha",
  "sistema","automacao","analise_processual","outro"
]);

export async function registrarTarefaRealizadaAction(formData:FormData):Promise<void>{
  const ctx=await getUserContext();
  if(!ctx.auth_id||!ctx.empresa_id) redirect("/login");
  const title=String(formData.get("titulo")||"").trim();
  const description=String(formData.get("descricao")||"").trim();
  const category=String(formData.get("categoria")||"outro").trim();
  const day=String(formData.get("data_realizacao")||"").trim();
  const cnj=String(formData.get("protocolo_ref")||"").trim();
  const contact=formData.get("contato_confirmado")==="sim";
  const nowDay=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const valid=title.length>=4&&title.length<=180
    &&description.length<=4000&&CATEGORIAS.has(category)
    &&/^20\d{2}-\d{2}-\d{2}$/.test(day)
    &&day>="2020-01-01" && day<=nowDay
    &&(!cnj||/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(cnj))
    &&(!contact||category==="atendimento");
  if(!valid)redirect("/minhas-atividades?erro=validacao");
  const db=await getSupabaseAdmin();
  let processo_id:number|null=null;
  if(cnj){
    const {data:caseRecord,error:lookErr}=await db.from("processos")
      .select("id").eq("empresa_id",ctx.empresa_id).eq("protocolo_ref",cnj).maybeSingle();
    if(lookErr) redirect("/minhas-atividades?erro=consulta");
    processo_id=caseRecord?.id??null;
  }
  const {error}=await db.from("tarefas_realizadas").insert({
    empresa_id:ctx.empresa_id,
    responsavel_auth_user_id:ctx.auth_id,
    titulo:title,
    descricao:description,
    categoria:category,
    data_realizacao:day,
    protocolo_ref:cnj||null,
    processo_id,
    contato_cliente_confirmado:contact,
    origem:"registro_manual_autodeclarado"
  });
  if(error){console.error("[tarefas_realizadas] insert failed",error);redirect("/minhas-atividades?erro=salvar");}
  revalidatePath("/minhas-atividades");
  revalidatePath("/");
  revalidatePath("/processos");
  revalidatePath("/report");
  revalidatePath("/supervisao");
  redirect("/minhas-atividades?salvo=1");
}
