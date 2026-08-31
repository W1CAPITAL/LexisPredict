"use server";

import { getUserContext, getSupabaseAdmin, getEmpresaUsers } from "@/lib/server-db";

const BUCKET = "chat-empresa";

async function ctxOk() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return null;
  return ctx;
}

export async function listarMembrosChatAction() {
  const ctx = await ctxOk();
  if (!ctx) return [];
  const users = await getEmpresaUsers().catch(() => []);
  return (users || []).map((u: any) => ({
    auth_user_id: u.auth_user_id,
    nome: u.nome,
    email: u.email,
    cargo: u.cargo,
    avatar_url: u.avatar_url || null,
  }));
}

export async function garantirThreadGeralAction() {
  const ctx = await ctxOk();
  if (!ctx) return { success: false, threadId: null as string | null };
  const admin = await getSupabaseAdmin();
  const { data: existing } = await admin
    .from("chat_threads")
    .select("id")
    .eq("empresa_id", ctx.empresa_id)
    .eq("tipo", "geral")
    .maybeSingle();
  if (existing?.id) return { success: true, threadId: existing.id as string };
  const { data, error } = await admin
    .from("chat_threads")
    .insert({
      empresa_id: ctx.empresa_id,
      tipo: "geral",
      titulo: "Geral da empresa",
      created_by: ctx.auth_id,
    })
    .select("id")
    .single();
  if (error) return { success: false, threadId: null, message: error.message };
  return { success: true, threadId: data.id as string };
}

export async function garantirThreadDmAction(otherAuthId: string) {
  const ctx = await ctxOk();
  if (!ctx?.auth_id || !otherAuthId) return { success: false, threadId: null as string | null };
  const a = [ctx.auth_id, otherAuthId].sort().join(":");
  const admin = await getSupabaseAdmin();
  const { data: existing } = await admin
    .from("chat_threads")
    .select("id")
    .eq("empresa_id", ctx.empresa_id)
    .eq("dm_key", a)
    .maybeSingle();
  if (existing?.id) return { success: true, threadId: existing.id as string };
  const users = await getEmpresaUsers().catch(() => []);
  const other = (users || []).find((u: any) => String(u.auth_user_id) === String(otherAuthId));
  const { data, error } = await admin
    .from("chat_threads")
    .insert({
      empresa_id: ctx.empresa_id,
      tipo: "dm",
      dm_key: a,
      titulo: other?.nome || "Conversa",
      created_by: ctx.auth_id,
    })
    .select("id")
    .single();
  if (error) return { success: false, threadId: null, message: error.message };
  return { success: true, threadId: data.id as string };
}

export async function listarMensagensAction(threadId: string, after?: string) {
  const ctx = await ctxOk();
  if (!ctx || !threadId) return [];
  const admin = await getSupabaseAdmin();
  let q = admin
    .from("chat_messages")
    .select("*")
    .eq("empresa_id", ctx.empresa_id)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (after) q = q.gt("created_at", after);
  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

export async function enviarMensagemAction(input: {
  threadId: string;
  body?: string;
  tipo?: string;
  file_path?: string;
  file_name?: string;
  file_mime?: string;
  file_size?: number;
}) {
  const ctx = await ctxOk();
  if (!ctx) return { success: false, message: "Sessão expirada" };
  if (!input.threadId) return { success: false, message: "Thread inválida" };
  const body = String(input.body || "").trim();
  if (!body && !input.file_path) return { success: false, message: "Mensagem vazia" };
  const admin = await getSupabaseAdmin();
  const { data: profile } = await admin
    .from("usuarios")
    .select("nome")
    .eq("auth_user_id", ctx.auth_id)
    .maybeSingle();
  const { data, error } = await admin
    .from("chat_messages")
    .insert({
      empresa_id: ctx.empresa_id,
      thread_id: input.threadId,
      auth_user_id: ctx.auth_id,
      autor_nome: profile?.nome || ctx.email || "Operador",
      body: body || input.file_name || "",
      tipo: input.tipo || (input.file_path ? "file" : "text"),
      file_path: input.file_path || null,
      file_name: input.file_name || null,
      file_mime: input.file_mime || null,
      file_size: input.file_size || null,
    })
    .select("*")
    .single();
  if (error) return { success: false, message: error.message };
  return { success: true, message: data };
}

export async function urlArquivoChatAction(filePath: string) {
  const ctx = await ctxOk();
  if (!ctx || !filePath) return { url: null as string | null };
  if (!filePath.startsWith(String(ctx.empresa_id))) return { url: null };
  const admin = await getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60 * 60);
  if (error) return { url: null };
  return { url: data.signedUrl };
}

export async function assinarUploadChatAction(input: {
  threadId: string;
  fileName: string;
  mime: string;
}) {
  const ctx = await ctxOk();
  if (!ctx) return { success: false, message: "Sessão expirada" };
  const safe = String(input.fileName || "arquivo").replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const path = `${ctx.empresa_id}/${input.threadId}/${Date.now()}-${safe}`;
  const admin = await getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error) return { success: false, message: error.message };
  return {
    success: true,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
  };
}

export async function quemSouChatAction() {
  const ctx = await ctxOk();
  if (!ctx) return { auth_id: null, empresa_id: null, nome: null };
  return { auth_id: ctx.auth_id, empresa_id: ctx.empresa_id, email: ctx.email };
}


export async function diagnosticoChatAction() {
  const ctx = await ctxOk();
  if (!ctx) return { ok: false, detail: "Sessão sem empresa_id. Entre de novo." };
  try {
    const admin = await getSupabaseAdmin();
    const { error } = await admin.from("chat_threads").select("id").eq("empresa_id", ctx.empresa_id).limit(1);
    if (error) {
      return {
        ok: false,
        detail:
          error.message.includes("does not exist") || error.code === "42P01"
            ? "Falta rodar supabase/chat-empresa.sql no SQL Editor."
            : error.message,
      };
    }
    return { ok: true, detail: "ok", empresa_id: ctx.empresa_id, auth_id: ctx.auth_id };
  } catch (e: any) {
    return { ok: false, detail: e?.message || "erro" };
  }
}


/** Lista threads da empresa (geral + grupos + DMs recentes). */
export async function listarThreadsChatAction() {
  const ctx = await ctxOk();
  if (!ctx) return [];
  const admin = await getSupabaseAdmin();
  const { data } = await admin
    .from("chat_threads")
    .select("id, tipo, titulo, dm_key, created_by, created_at")
    .eq("empresa_id", ctx.empresa_id)
    .order("created_at", { ascending: true });
  return data || [];
}

/** Cria grupo com título e membros (sempre inclui o criador). */
export async function criarGrupoChatAction(input: {
  titulo: string;
  memberIds: string[];
}) {
  const ctx = await ctxOk();
  if (!ctx?.auth_id) return { success: false, threadId: null as string | null, message: "Sessão expirada" };
  const titulo = String(input.titulo || "").trim().slice(0, 80);
  if (!titulo) return { success: false, threadId: null, message: "Informe o nome do grupo" };
  const admin = await getSupabaseAdmin();
  const { data, error } = await admin
    .from("chat_threads")
    .insert({
      empresa_id: ctx.empresa_id,
      tipo: "grupo",
      titulo,
      created_by: ctx.auth_id,
    })
    .select("id")
    .single();
  if (error) return { success: false, threadId: null, message: error.message };
  const ids = new Set<string>([ctx.auth_id, ...(input.memberIds || []).map(String)]);
  const rows = [...ids].map((uid) => ({
    thread_id: data.id,
    auth_user_id: uid,
    role: uid === ctx.auth_id ? "admin" : "member",
  }));
  const { error: e2 } = await admin.from("chat_thread_members").upsert(rows, {
    onConflict: "thread_id,auth_user_id",
  });
  if (e2) return { success: true, threadId: data.id, message: `Grupo criado; membros: ${e2.message}` };
  return { success: true, threadId: data.id as string };
}

export async function listarMembrosGrupoAction(threadId: string) {
  const ctx = await ctxOk();
  if (!ctx || !threadId) return [];
  const admin = await getSupabaseAdmin();
  const { data: thr } = await admin
    .from("chat_threads")
    .select("id, empresa_id, tipo")
    .eq("id", threadId)
    .eq("empresa_id", ctx.empresa_id)
    .maybeSingle();
  if (!thr) return [];
  if (thr.tipo === "geral") {
    return listarMembrosChatAction();
  }
  const { data } = await admin
    .from("chat_thread_members")
    .select("auth_user_id, role")
    .eq("thread_id", threadId);
  const users = await getEmpresaUsers().catch(() => []);
  const byId = new Map((users || []).map((u: any) => [String(u.auth_user_id), u]));
  return (data || []).map((r: any) => {
    const u = byId.get(String(r.auth_user_id));
    return {
      auth_user_id: r.auth_user_id,
      role: r.role,
      nome: u?.nome || r.auth_user_id,
      email: u?.email || null,
      cargo: u?.cargo || null,
      avatar_url: u?.avatar_url || null,
    };
  });
}

/** Remove membro de um grupo (não apaga o canal Geral). */
export async function removerMembroGrupoAction(threadId: string, memberAuthId: string) {
  const ctx = await ctxOk();
  if (!ctx?.auth_id) return { success: false, message: "Sessão expirada" };
  if (!threadId || !memberAuthId) return { success: false, message: "Dados incompletos" };
  const admin = await getSupabaseAdmin();
  const { data: thr } = await admin
    .from("chat_threads")
    .select("id, tipo, created_by, empresa_id")
    .eq("id", threadId)
    .eq("empresa_id", ctx.empresa_id)
    .maybeSingle();
  if (!thr) return { success: false, message: "Grupo não encontrado" };
  if (thr.tipo === "geral") {
    return {
      success: false,
      message: "O canal Geral não remove membros da empresa. Use 'Ocultar desta lista' na barra lateral.",
    };
  }
  if (thr.tipo !== "grupo") return { success: false, message: "Só grupos permitem remover membros" };
  const isOwner = String(thr.created_by) === String(ctx.auth_id);
  const isSelf = String(memberAuthId) === String(ctx.auth_id);
  // Qualquer administrador / supervisor / superadmin pode remover
  const isAdm =
    !!(ctx as any).isAdministrador ||
    !!(ctx as any).isSupervisor ||
    !!(ctx as any).isSuperAdmin;
  if (!isOwner && !isSelf && !isAdm) {
    return { success: false, message: "Sem permissão — só admin, criador do grupo ou o próprio membro" };
  }
  const { error } = await admin
    .from("chat_thread_members")
    .delete()
    .eq("thread_id", threadId)
    .eq("auth_user_id", memberAuthId);
  if (error) return { success: false, message: error.message };
  return { success: true };
}

/** Oculta um colega da lista lateral (só para você) — útil no Geral. */
export async function ocultarMembroListaAction(hiddenAuthUserId: string) {
  const ctx = await ctxOk();
  if (!ctx?.auth_id || !hiddenAuthUserId) return { success: false, message: "Sessão" };
  if (String(hiddenAuthUserId) === String(ctx.auth_id)) {
    return { success: false, message: "Não é possível ocultar a si mesmo" };
  }
  const admin = await getSupabaseAdmin();
  const { error } = await admin.from("chat_geral_hidden").upsert({
    empresa_id: ctx.empresa_id,
    auth_user_id: ctx.auth_id,
    hidden_auth_user_id: hiddenAuthUserId,
  });
  if (error) return { success: false, message: error.message };
  return { success: true };
}

export async function listarOcultosListaAction() {
  const ctx = await ctxOk();
  if (!ctx?.auth_id) return [] as string[];
  const admin = await getSupabaseAdmin();
  const { data } = await admin
    .from("chat_geral_hidden")
    .select("hidden_auth_user_id")
    .eq("empresa_id", ctx.empresa_id)
    .eq("auth_user_id", ctx.auth_id);
  return (data || []).map((r: any) => String(r.hidden_auth_user_id));
}

export async function restaurarMembroListaAction(hiddenAuthUserId: string) {
  const ctx = await ctxOk();
  if (!ctx?.auth_id) return { success: false };
  const admin = await getSupabaseAdmin();
  await admin
    .from("chat_geral_hidden")
    .delete()
    .eq("empresa_id", ctx.empresa_id)
    .eq("auth_user_id", ctx.auth_id)
    .eq("hidden_auth_user_id", hiddenAuthUserId);
  return { success: true };
}


/** Apaga o grupo inteiro (admin / criador). */
export async function apagarGrupoChatAction(threadId: string) {
  const ctx = await ctxOk();
  if (!ctx?.auth_id || !threadId) return { success: false, message: "Sessão" };
  const admin = await getSupabaseAdmin();
  const { data: thr } = await admin
    .from("chat_threads")
    .select("id, tipo, created_by, empresa_id")
    .eq("id", threadId)
    .eq("empresa_id", ctx.empresa_id)
    .maybeSingle();
  if (!thr) return { success: false, message: "Grupo não encontrado" };
  if (thr.tipo !== "grupo") return { success: false, message: "Só grupos customizados podem ser apagados" };
  const isOwner = String(thr.created_by) === String(ctx.auth_id);
  const isAdm =
    !!(ctx as any).isAdministrador ||
    !!(ctx as any).isSupervisor ||
    !!(ctx as any).isSuperAdmin;
  if (!isOwner && !isAdm) return { success: false, message: "Sem permissão para apagar o grupo" };
  await admin.from("chat_thread_members").delete().eq("thread_id", threadId);
  const { error } = await admin.from("chat_threads").delete().eq("id", threadId);
  if (error) return { success: false, message: error.message };
  return { success: true };
}


export async function apagarMensagemChatAction(messageId: string) {
  const ctx = await ctxOk();
  if (!ctx?.auth_id || !messageId) return { success: false, message: "Sessão" };
  const admin = await getSupabaseAdmin();
  const { data: msg } = await admin
    .from("chat_messages")
    .select("id, auth_user_id, empresa_id, thread_id")
    .eq("id", messageId)
    .eq("empresa_id", ctx.empresa_id)
    .maybeSingle();
  if (!msg) return { success: false, message: "Mensagem não encontrada" };
  const isOwn = String(msg.auth_user_id) === String(ctx.auth_id);
  const isAdm =
    !!(ctx as any).isAdministrador ||
    !!(ctx as any).isSupervisor ||
    !!(ctx as any).isSuperAdmin;
  if (!isOwn && !isAdm) return { success: false, message: "Só o autor ou admin pode apagar" };
  const { error } = await admin.from("chat_messages").delete().eq("id", messageId);
  if (error) return { success: false, message: error.message };
  return { success: true };
}
