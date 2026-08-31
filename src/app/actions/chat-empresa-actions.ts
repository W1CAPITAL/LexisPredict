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
