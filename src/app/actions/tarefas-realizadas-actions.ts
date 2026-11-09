'use server';

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";
import { normalizarTarefaRealizada, validarTarefaRealizada } from "@/lib/tarefas-realizadas";

function lerCampos(formData: FormData) {
  return normalizarTarefaRealizada({
    titulo: String(formData.get("titulo") || ""),
    descricao: String(formData.get("descricao") || ""),
    categoria: String(formData.get("categoria") || "outro"),
    data_realizacao: String(formData.get("data_realizacao") || ""),
    protocolo_ref: String(formData.get("protocolo_ref") || ""),
    contato_confirmado: formData.get("contato_confirmado") === "sim",
  });
}

function hojeEmSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function invalidarAtividades() {
  for (const caminho of [
    "/minhas-atividades", "/analises-internas", "/", "/processos",
    "/report", "/report/completo", "/supervisao",
  ]) revalidatePath(caminho);
}

async function buscarProcessoId(
  db: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  empresaId: string,
  cnj: string,
): Promise<{ processo_id: number | null; erro: boolean }> {
  if (!cnj) return { processo_id: null, erro: false };
  const { data, error } = await db.from("processos")
    .select("id").eq("empresa_id", empresaId).eq("protocolo_ref", cnj).maybeSingle();
  return { processo_id: data?.id ?? null, erro: Boolean(error) };
}

export async function registrarTarefaRealizadaAction(formData: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx.auth_id || !ctx.empresa_id) redirect("/login");

  const tarefa = lerCampos(formData);
  if (!validarTarefaRealizada(tarefa, hojeEmSaoPaulo())) {
    redirect("/minhas-atividades?erro=validacao");
  }

  const db = await getSupabaseAdmin();
  const vinculo = await buscarProcessoId(db, String(ctx.empresa_id), tarefa.protocolo_ref);
  if (vinculo.erro) redirect("/minhas-atividades?erro=consulta");

  const { error } = await db.from("tarefas_realizadas").insert({
    empresa_id: ctx.empresa_id,
    responsavel_auth_user_id: ctx.auth_id,
    ...tarefa,
    protocolo_ref: tarefa.protocolo_ref || null,
    processo_id: vinculo.processo_id,
    origem: "registro_manual_autodeclarado",
  });

  if (error) {
    console.error("[tarefas_realizadas] insert failed", error);
    redirect("/minhas-atividades?erro=salvar");
  }
  invalidarAtividades();
  redirect("/minhas-atividades?salvo=1");
}

/**
 * Edita apenas a atividade da pessoa autenticada dentro da própria empresa.
 * O ID enviado no formulário não concede acesso a registros de terceiros.
 */
export async function editarTarefaRealizadaAction(formData: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx.auth_id || !ctx.empresa_id) redirect("/login");

  const destino = formData.get("destino") === "analises-internas"
    ? "/analises-internas" : "/minhas-atividades";
  const pagina = Math.max(1, Math.min(999, Number(formData.get("pagina")) || 1));
  const paginaAtividades = Math.max(1, Math.min(99, Number(formData.get("atividadesPagina")) || 1));
  const retorno = destino === "/analises-internas"
    ? `${destino}?pagina=${pagina}&atividadesPagina=${paginaAtividades}`
    : `${destino}?pagina=${pagina}`;
  const id = String(formData.get("id") || "").trim();
  const tarefa = lerCampos(formData);

  if (!/^[0-9a-f-]{1,100}$/i.test(id) || !validarTarefaRealizada(tarefa, hojeEmSaoPaulo())) {
    redirect(`${retorno}&erro=validacao`);
  }

  const db = await getSupabaseAdmin();
  const vinculo = await buscarProcessoId(db, String(ctx.empresa_id), tarefa.protocolo_ref);
  if (vinculo.erro) redirect(`${retorno}&erro=consulta`);

  const { data, error } = await db.from("tarefas_realizadas")
    .update({
      ...tarefa,
      protocolo_ref: tarefa.protocolo_ref || null,
      processo_id: vinculo.processo_id,
    })
    .eq("id", id)
    .eq("empresa_id", ctx.empresa_id)
    .eq("responsavel_auth_user_id", ctx.auth_id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[tarefas_realizadas] update failed", error);
    redirect(`${retorno}&erro=editar`);
  }
  invalidarAtividades();
  redirect(`${retorno}&editado=1`);
}
