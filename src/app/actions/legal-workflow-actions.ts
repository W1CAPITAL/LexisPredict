"use server";
import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";

export type WorkflowStepState = {
 step_key: string;
 title: string;
 status: "pending" | "done";
 updated_at: string;
 updated_by: string;
 completed_at: string | null;
};
type Result = { success: true; steps: WorkflowStepState[] } | { success: false; error: string };
function protocol(value: string): string {
 return String(value || "").trim().replace(/\s/g, "").slice(0, 80);
}
async function context() {
 const user = await getUserContext();
 if (!user.empresa_id || !user.auth_id) return null;
 return user;
}
async function caseExists(empresaId: string, number: string): Promise<boolean> {
 const admin = await getSupabaseAdmin();
 const p = await admin.from("processos").select("id").eq("empresa_id", empresaId).eq("protocolo_ref", number).limit(1);
 if (p.error) throw new Error(p.error.message);
 if (p.data?.length) return true;
 const c = await admin.from("cases").select("id").eq("empresa_id", empresaId).eq("protocolo", number).limit(1);
 if (c.error && c.error.code !== "42P01") throw new Error(c.error.message);
 return !!c.data?.length;
}
export async function listLegalWorkflowStepsAction(input: { protocolo: string }): Promise<Result> {
 const user = await context();
 if (!user) return { success: false, error: "Sessão ou empresa indisponível" };
 const number = protocol(input.protocolo);
 if (!number) return { success: false, error: "Processo não informado" };
 try {
  if (!(await caseExists(user.empresa_id!, number))) return { success: false, error: "Processo fora da carteira da empresa" };
  const admin = await getSupabaseAdmin();
  const { data, error } = await admin.from("lexis_case_workflow_steps")
   .select("step_key,title,status,updated_at,updated_by,completed_at")
   .eq("empresa_id", user.empresa_id).eq("protocolo", number).order("created_at");
  if (error) return { success: false, error: error.message };
  return { success: true, steps: (data || []) as WorkflowStepState[] };
 } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Falha na consulta" }; }
}
export async function setLegalWorkflowStepAction(input: {
 protocolo: string; step_key: string; title: string; done: boolean;
}): Promise<Result> {
 const user = await context();
 if (!user) return { success: false, error: "Sessão ou empresa indisponível" };
 if (user.isViewer) return { success: false, error: "Perfil somente leitura" };
 const number = protocol(input.protocolo);
 const key = String(input.step_key || "").trim();
 const title = String(input.title || "").trim();
 if (!number || !/^[a-zA-Z0-9_-]{1,120}$/.test(key) || !title || title.length > 240) {
  return { success: false, error: "Dados de etapa inválidos" };
 }
 try {
  if (!(await caseExists(user.empresa_id!, number))) return { success: false, error: "Processo fora da carteira da empresa" };
  const admin = await getSupabaseAdmin();
  const { error } = await admin.from("lexis_case_workflow_steps").upsert({
   empresa_id: user.empresa_id, protocolo: number, step_key: key, title,
   status: input.done ? "done" : "pending",
   completed_by: input.done ? user.auth_id : null,
   completed_at: input.done ? new Date().toISOString() : null,
   updated_by: user.auth_id, updated_at: new Date().toISOString()
  }, { onConflict: "empresa_id,protocolo,step_key" });
  if (error) return { success: false, error: error.message };
  return listLegalWorkflowStepsAction({ protocolo: number });
 } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Falha ao salvar" }; }
}
