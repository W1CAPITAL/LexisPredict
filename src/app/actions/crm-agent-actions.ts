"use server";

/**
 * Agentes CRM Lexis — fila + tools + run.
 * CompAI: o CRM é onde o agente guarda notas; o agente decide o próximo trabalho.
 */

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";
import { ALL_SKILLS, AGENT_CATALOG } from "@/lib/crm-agent/skills";
import type { CrmAgentId, CrmAgentRunLog } from "@/lib/crm-agent/types";
import { processChat } from "@/lib/ai/chat-service";

async function ctx() {
  const c = await getUserContext();
  if (!c.empresa_id) return null;
  return c;
}

export async function listAgentCatalogAction() {
  return { success: true, catalog: AGENT_CATALOG };
}

/** Tools determinísticas (sem LLM) — sempre disponíveis */
export async function agentSearchCrmAction(q: string) {
  const c = await ctx();
  if (!c) return { success: false, error: "Sessão expirada.", rows: [] as any[] };
  const admin = await getSupabaseAdmin();
  if (!admin) return { success: false, error: "Admin ausente.", rows: [] as any[] };
  const term = `%${String(q || "").trim()}%`;
  const { data } = await admin
    .from("crm_negocios")
    .select("id, cliente_nome, status, valor_total, protocolo_cnj, cliente_telefone, updated_at, created_at")
    .eq("empresa_id", c.empresa_id)
    .or(`cliente_nome.ilike.${term},protocolo_cnj.ilike.${term},cliente_doc.ilike.${term}`)
    .limit(25);
  return { success: true, rows: data || [] };
}

export async function agentListOutstandingAction() {
  const c = await ctx();
  if (!c) return { success: false, error: "Sessão expirada.", atrasados: [] as any[], silencio: [] as any[] };
  const admin = await getSupabaseAdmin();
  if (!admin) return { success: false, error: "Admin ausente.", atrasados: [] as any[], silencio: [] as any[] };

  const { data: rec } = await admin
    .from("crm_receber")
    .select("id, cliente_nome, valor, vencimento, status, negocio_id")
    .eq("empresa_id", c.empresa_id)
    .in("status", ["pendente", "atrasado"])
    .order("vencimento", { ascending: true })
    .limit(40);

  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data: neg } = await admin
    .from("crm_negocios")
    .select("id, cliente_nome, status, valor_total, protocolo_cnj, updated_at")
    .eq("empresa_id", c.empresa_id)
    .not("status", "in", '("concluido","cancelado")')
    .lt("updated_at", cutoff)
    .limit(40);

  return { success: true, atrasados: rec || [], silencio: neg || [] };
}

export async function agentReadHistoryAction(opts: { negocioId?: string; protocolo?: string }) {
  const c = await ctx();
  if (!c) return { success: false, error: "Sessão.", negocio: null, processo: null };
  const admin = await getSupabaseAdmin();
  if (!admin) return { success: false, error: "Admin.", negocio: null, processo: null };

  let negocio: any = null;
  if (opts.negocioId) {
    const { data } = await admin
      .from("crm_negocios")
      .select("*")
      .eq("empresa_id", c.empresa_id)
      .eq("id", opts.negocioId)
      .maybeSingle();
    negocio = data;
  }

  let processo: any = null;
  const proto = opts.protocolo || negocio?.protocolo_cnj;
  if (proto) {
    const digits = String(proto).replace(/\D/g, "");
    const { data } = await admin
      .from("processos")
      .select("id, protocolo_ref, created_by, status, ultimo_retorno, proximo_retorno, datajud_encerrado_tribunal, dados")
      .eq("empresa_id", c.empresa_id)
      .or(`protocolo_ref.eq.${proto},protocolo_ref.ilike.%${digits.slice(-15)}%`)
      .limit(3);
    processo = (data && data[0]) || null;
  }
  return { success: true, negocio, processo };
}

export async function agentScheduleRecheckAction(input: {
  agent_id: CrmAgentId;
  subject_type: string;
  subject_id: string;
  days?: number;
  note?: string;
}) {
  const c = await ctx();
  if (!c) return { success: false, error: "Sessão." };
  const admin = await getSupabaseAdmin();
  if (!admin) return { success: false, error: "Admin. Rode sql/crm-agent-queue.sql." };
  const due = new Date(Date.now() + Math.max(1, input.days || 7) * 86400000).toISOString();
  const row = {
    empresa_id: c.empresa_id,
    agent_id: input.agent_id,
    status: "due",
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    payload: { note: input.note || "", via: "schedule_recheck" },
    due_at: due,
  };
  const { error } = await admin.from("crm_agent_tasks").insert(row);
  if (error) return { success: false, error: error.message };
  return { success: true, due_at: due };
}

export async function agentRecordFactAction(input: {
  subject_type: string;
  subject_id: string;
  field: string;
  value: string;
  evidence_kind: string;
  evidence_note?: string;
}) {
  const c = await ctx();
  if (!c) return { success: false, error: "Sessão." };
  const admin = await getSupabaseAdmin();
  if (!admin) return { success: false, error: "Admin." };
  const row = {
    empresa_id: c.empresa_id,
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    field: input.field,
    value: input.value,
    evidence_kind: input.evidence_kind,
    evidence_note: input.evidence_note || null,
    created_by: c.auth_id,
  };
  const { error } = await admin.from("crm_agent_facts").insert(row);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function listAgentTasksAction() {
  const c = await ctx();
  if (!c) return { success: false, tasks: [] as any[], error: "Sessão." };
  const admin = await getSupabaseAdmin();
  if (!admin) return { success: false, tasks: [] as any[], error: "Rode sql/crm-agent-queue.sql" };
  const { data, error } = await admin
    .from("crm_agent_tasks")
    .select("*")
    .eq("empresa_id", c.empresa_id)
    .order("due_at", { ascending: true })
    .limit(80);
  if (error) return { success: false, tasks: [], error: error.message };
  return { success: true, tasks: data || [] };
}

export async function runCrmAgentAction(input: {
  agent_id: CrmAgentId;
  prompt?: string;
  negocioId?: string;
  protocolo?: string;
}): Promise<{ success: boolean; content: string; logs: CrmAgentRunLog[]; error?: string }> {
  const c = await ctx();
  const logs: CrmAgentRunLog[] = [];
  const now = () => new Date().toISOString();
  if (!c) return { success: false, content: "", logs, error: "Sessão expirada." };

  const agent = AGENT_CATALOG[input.agent_id] || AGENT_CATALOG.livre;
  const outstanding = await agentListOutstandingAction();
  logs.push({
    agent_id: input.agent_id,
    tool: "list_outstanding_work",
    ok: !!outstanding.success,
    summary: `atrasados=${(outstanding.atrasados || []).length} silencio=${(outstanding.silencio || []).length}`,
    at: now(),
  });

  let history: any = null;
  if (input.negocioId || input.protocolo) {
    history = await agentReadHistoryAction({
      negocioId: input.negocioId,
      protocolo: input.protocolo,
    });
    logs.push({
      agent_id: input.agent_id,
      tool: "read_crm_history",
      ok: !!history.success,
      summary: history.negocio
        ? `negocio=${history.negocio.cliente_nome}`
        : history.processo
          ? `processo=${history.processo.protocolo_ref}`
          : "sem registro",
      at: now(),
    });
  }

  const userMsg = [
    `Agente: ${agent.nome}`,
    `Pedido do operador: ${input.prompt || "(rodar rotina padrão)"}`,
    "",
    "A receber / atrasados (amostra):",
    JSON.stringify((outstanding.atrasados || []).slice(0, 12), null, 2),
    "",
    "Negócios em silêncio >14d (amostra):",
    JSON.stringify((outstanding.silencio || []).slice(0, 12), null, 2),
    history ? `\nHistórico pedido:\n${JSON.stringify(history, null, 2).slice(0, 6000)}` : "",
    "",
    "Produza: (1) diagnóstico (2) lista priorizada (3) brief curto (4) o que NÃO fazer sozinho.",
  ].join("\n");

  const res = await processChat({
    message: `${ALL_SKILLS}\n\n${userMsg}`,
    contextType: "case_swot",
    temperature: 0.25,
  });

  logs.push({
    agent_id: input.agent_id,
    tool: "write_brief",
    ok: !!res.success,
    summary: res.success ? "brief gerado" : res.error || "falha IA",
    at: now(),
  });

  return {
    success: !!res.success,
    content: res.content || "",
    logs,
    error: res.error,
  };
}
