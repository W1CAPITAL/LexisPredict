"use server";

import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationKind,
  type NotificationPreferences,
  type NotificationPriority,
} from "@/lib/notifications";

type NotificationDraft = {
  tipo: NotificationKind;
  prioridade: NotificationPriority;
  titulo: string;
  corpo: string;
  link: string;
  dedupe_key: string;
  processo_id?: number | null;
  source?: string | null;
  meta?: Record<string, unknown>;
};

function enabledByPreference(pref: NotificationPreferences, tipo: NotificationKind) {
  if (tipo === "prazo") return pref.prazos;
  if (tipo === "djen") return pref.djen;
  if (tipo === "datajud") return pref.datajud;
  if (tipo === "tarefa") return pref.tarefas;
  if (tipo === "chat") return pref.chat;
  return pref.sistema;
}

async function loadPreferences(admin: any, empresaId: string, authId: string): Promise<NotificationPreferences> {
  const { data } = await admin
    .from("notification_preferences")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("user_id", authId)
    .maybeSingle();

  if (!data) return DEFAULT_NOTIFICATION_PREFERENCES;

  return {
    in_app_enabled: data.in_app_enabled !== false,
    browser_enabled: !!data.browser_enabled,
    prazos: data.prazos !== false,
    djen: data.djen !== false,
    datajud: data.datajud !== false,
    tarefas: data.tarefas !== false,
    chat: data.chat !== false,
    sistema: data.sistema !== false,
    sound_enabled: !!data.sound_enabled,
    quiet_hours_enabled: !!data.quiet_hours_enabled,
    quiet_hours_start: data.quiet_hours_start || null,
    quiet_hours_end: data.quiet_hours_end || null,
  };
}

async function persistDrafts(
  admin: any,
  empresaId: string,
  authId: string,
  pref: NotificationPreferences,
  drafts: NotificationDraft[]
) {
  const usable = drafts
    .filter((item) => enabledByPreference(pref, item.tipo))
    .slice(0, 250);

  if (!usable.length) return 0;

  const keys = usable.map((item) => item.dedupe_key);
  const { data: existing } = await admin
    .from("notificacoes")
    .select("id,dedupe_key")
    .eq("empresa_id", empresaId)
    .eq("recipient_user_id", authId)
    .in("dedupe_key", keys);

  const existingByKey = new Map<string, string>();
  for (const row of existing || []) {
    if (row?.dedupe_key && row?.id) existingByKey.set(String(row.dedupe_key), String(row.id));
  }

  let changed = 0;
  for (const item of usable) {
    const payload = {
      empresa_id: empresaId,
      recipient_user_id: authId,
      tipo: item.tipo,
      prioridade: item.prioridade,
      titulo: item.titulo,
      corpo: item.corpo,
      link: item.link,
      dedupe_key: item.dedupe_key,
      processo_id: item.processo_id ?? null,
      source: item.source ?? "notification-sync",
      meta: item.meta || {},
      updated_at: new Date().toISOString(),
    };

    const existingId = existingByKey.get(item.dedupe_key);
    if (existingId) {
      const { error } = await admin
        .from("notificacoes")
        .update(payload)
        .eq("id", existingId)
        .eq("empresa_id", empresaId)
        .eq("recipient_user_id", authId);
      if (!error) changed += 1;
    } else {
      const { error } = await admin
        .from("notificacoes")
        .insert({
          ...payload,
          lida: false,
          read_at: null,
          created_at: new Date().toISOString(),
        });
      if (!error) changed += 1;
    }
  }

  return changed;
}

export async function syncMyNotificationsAction() {
  try {
    const ctx = await getUserContext();
    if (!ctx?.empresa_id || !ctx?.auth_id) {
      return { ok: false as const, error: "Sessão não identificada." };
    }

    const empresaId = String(ctx.empresa_id);
    const authId = String(ctx.auth_id);
    const admin = await getSupabaseAdmin();
    const pref = await loadPreferences(admin, empresaId, authId);
    const drafts: NotificationDraft[] = [];
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    let processQuery = admin
      .from("processos")
      .select("id,protocolo_ref,status,proximo_retorno,djen_nova_comunicacao,djen_ultimo_resumo,djen_ultima_data,djen_count,tem_atualizacao_pos_retorno,datajud_ultimo_nome,datajud_hash,created_by")
      .eq("empresa_id", empresaId)
      .eq("created_by", authId)
      .not("status", "in", '("ENCERRADO","ARQUIVADO","EXTINTO")')
      .order("proximo_retorno", { ascending: true, nullsFirst: false })
      .limit(250);

    const { data: processes } = await processQuery;

    for (const p of processes || []) {
      const cnj = String(p.protocolo_ref || "Processo");
      const due = p.proximo_retorno ? new Date(p.proximo_retorno) : null;

      if (due && due.toISOString() <= next24h) {
        const overdue = due.getTime() < now.getTime();
        drafts.push({
          tipo: "prazo",
          prioridade: overdue ? "critica" : "alta",
          titulo: overdue ? "Retorno vencido" : "Retorno nas próximas 24h",
          corpo: `${cnj} · ${overdue ? "o retorno está vencido" : "há um retorno próximo"}.`,
          link: "/cases",
          dedupe_key: `deadline:${p.id}:${due.toISOString().slice(0, 10)}`,
          processo_id: Number(p.id),
          source: "processos",
          meta: { cnj, proximo_retorno: p.proximo_retorno },
        });
      }

      if (p.djen_nova_comunicacao) {
        drafts.push({
          tipo: "djen",
          prioridade: "alta",
          titulo: "Publicação pendente no DJEN",
          corpo: String(p.djen_ultimo_resumo || `Há uma publicação nova no processo ${cnj}.`).slice(0, 500),
          link: "/cases",
          dedupe_key: `djen-sync:${p.id}:${p.djen_count || 0}:${p.djen_ultima_data || ""}`,
          processo_id: Number(p.id),
          source: "processos",
          meta: { cnj },
        });
      }

      if (p.tem_atualizacao_pos_retorno) {
        drafts.push({
          tipo: "datajud",
          prioridade: "alta",
          titulo: "Movimentação após o último atendimento",
          corpo: String(p.datajud_ultimo_nome || `O processo ${cnj} teve nova movimentação.`).slice(0, 500),
          link: "/cases",
          dedupe_key: `datajud-sync:${p.id}:${p.datajud_hash || p.datajud_ultimo_nome || "new"}`,
          processo_id: Number(p.id),
          source: "processos",
          meta: { cnj },
        });
      }
    }

    const { data: userRow } = await admin
      .from("usuarios")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("auth_user_id", authId)
      .maybeSingle();

    const assigneeIds = [authId, userRow?.id].filter(Boolean);
    if (assigneeIds.length) {
      const { data: tasks } = await admin
        .from("crm_tarefas")
        .select("id,titulo,feito,status,due_at,vencimento,assignee_id")
        .eq("empresa_id", empresaId)
        .eq("feito", false)
        .in("assignee_id", assigneeIds)
        .limit(100);

      for (const task of tasks || []) {
        const dueRaw = task.due_at || (task.vencimento ? `${task.vencimento}T23:59:59` : null);
        if (!dueRaw) continue;
        const due = new Date(dueRaw);
        if (Number.isNaN(due.getTime()) || due.getTime() > now.getTime() + 24 * 60 * 60 * 1000) continue;
        const overdue = due.getTime() < now.getTime();
        drafts.push({
          tipo: "tarefa",
          prioridade: overdue ? "critica" : "alta",
          titulo: overdue ? "Tarefa atrasada" : "Tarefa vence em breve",
          corpo: String(task.titulo || "Tarefa sem título"),
          link: "/tarefas",
          dedupe_key: `task-deadline:${task.id}:${due.toISOString().slice(0, 10)}`,
          source: "crm_tarefas",
          meta: { tarefa_id: task.id, due_at: due.toISOString() },
        });
      }
    }

    if (ctx.isSupervisor || ctx.isSuperAdmin) {
      const { count } = await admin
        .from("processos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .lt("proximo_retorno", now.toISOString())
        .not("status", "in", '("ENCERRADO","ARQUIVADO","EXTINTO")');

      if ((count || 0) > 0) {
        drafts.push({
          tipo: "prazo",
          prioridade: "alta",
          titulo: "Carteira da empresa exige atenção",
          corpo: `${count} processo(s) com retorno vencido na empresa.`,
          link: "/supervisao",
          dedupe_key: `supervision-overdue:${now.toISOString().slice(0, 10)}`,
          source: "supervisao",
          meta: { total_vencidos: count || 0 },
        });
      }
    }

    const changed = await persistDrafts(admin, empresaId, authId, pref, drafts);

    await admin
      .from("notificacoes")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("recipient_user_id", authId)
      .eq("lida", true)
      .lt("created_at", new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString());

    return { ok: true as const, changed };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message || e) };
  }
}

export async function getNotificationBootstrapAction(limit = 30) {
  try {
    const ctx = await getUserContext();
    if (!ctx?.empresa_id || !ctx?.auth_id) {
      return {
        ok: false as const,
        error: "Sessão não identificada.",
        notifications: [],
        preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      };
    }

    await syncMyNotificationsAction();

    const admin = await getSupabaseAdmin();
    const pref = await loadPreferences(admin, String(ctx.empresa_id), String(ctx.auth_id));
    const { data, error } = await admin
      .from("notificacoes")
      .select("id,tipo,prioridade,titulo,corpo,link,lida,read_at,created_at,updated_at,source,meta,processo_id")
      .eq("empresa_id", ctx.empresa_id)
      .eq("recipient_user_id", ctx.auth_id)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(limit, 100)));

    if (error) throw error;

    return {
      ok: true as const,
      notifications: data || [],
      preferences: pref,
    };
  } catch (e: any) {
    return {
      ok: false as const,
      error: String(e?.message || e),
      notifications: [],
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    };
  }
}

export async function markNotificationReadAction(id: string) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id || !ctx?.auth_id) return { ok: false as const };
  const admin = await getSupabaseAdmin();
  const { error } = await admin
    .from("notificacoes")
    .update({ lida: true, read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", ctx.empresa_id)
    .eq("recipient_user_id", ctx.auth_id);
  return { ok: !error, error: error?.message };
}

export async function markAllNotificationsReadAction() {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id || !ctx?.auth_id) return { ok: false as const };
  const admin = await getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("notificacoes")
    .update({ lida: true, read_at: now, updated_at: now })
    .eq("empresa_id", ctx.empresa_id)
    .eq("recipient_user_id", ctx.auth_id)
    .eq("lida", false);
  return { ok: !error, error: error?.message };
}

export async function deleteReadNotificationsAction() {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id || !ctx?.auth_id) return { ok: false as const };
  const admin = await getSupabaseAdmin();
  const { error } = await admin
    .from("notificacoes")
    .delete()
    .eq("empresa_id", ctx.empresa_id)
    .eq("recipient_user_id", ctx.auth_id)
    .eq("lida", true);
  return { ok: !error, error: error?.message };
}

export async function saveNotificationPreferencesAction(patch: Partial<NotificationPreferences>) {
  try {
    const ctx = await getUserContext();
    if (!ctx?.empresa_id || !ctx?.auth_id) {
      return { ok: false as const, error: "Sessão não identificada." };
    }
    const admin = await getSupabaseAdmin();
    const current = await loadPreferences(admin, String(ctx.empresa_id), String(ctx.auth_id));
    const next: NotificationPreferences = { ...current, ...patch };
    const { error } = await admin
      .from("notification_preferences")
      .upsert({
        user_id: ctx.auth_id,
        empresa_id: ctx.empresa_id,
        ...next,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) throw error;
    return { ok: true as const, preferences: next };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message || e) };
  }
}
