"use server";

/**
 * Agentes CRM Lexis — fila + tools + run (CompAI-style).
 * Respostas determinísticas quando possível (não fica “carregando” à toa).
 */

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";
import { ALL_SKILLS, AGENT_CATALOG } from "@/lib/crm-agent/skills";
import type { CrmAgentId, CrmAgentRunLog } from "@/lib/crm-agent/types";
import { processChat } from "@/lib/ai/chat-service";
import { runCascade } from "@/lib/ai/cascade";

async function ctx() {
  const c = await getUserContext();
  if (!c.empresa_id) return null;
  return c;
}

export async function listAgentCatalogAction() {
  return { success: true, catalog: AGENT_CATALOG };
}

export async function agentSearchCrmAction(q: string) {
  const c = await ctx();
  if (!c) return { success: false, error: "Sessão expirada.", rows: [] as any[] };
  const admin = await getSupabaseAdmin();
  if (!admin) return { success: false, error: "Admin ausente.", rows: [] as any[] };
  const term = `%${String(q || "").trim()}%`;
  const { data } = await admin
    .from("crm_negocios")
    .select("id, cliente_nome, status, valor_total, protocolo_cnj, cliente_telefone, updated_at")
    .eq("empresa_id", c.empresa_id)
    .or(`cliente_nome.ilike.${term},protocolo_cnj.ilike.${term}`)
    .limit(25);
  return { success: true, rows: data || [] };
}

export async function agentListOutstandingAction() {
  const c = await ctx();
  if (!c) return { success: false, error: "Sessão.", atrasados: [] as any[], silencio: [] as any[] };
  const admin = await getSupabaseAdmin();
  if (!admin) return { success: false, error: "Admin.", atrasados: [] as any[], silencio: [] as any[] };

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
    .select("id, cliente_nome, status, valor_total, protocolo_cnj, updated_at, cliente_telefone")
    .eq("empresa_id", c.empresa_id)
    .not("status", "in", '("concluido","cancelado")')
    .lt("updated_at", cutoff)
    .limit(40);

  return { success: true, atrasados: rec || [], silencio: neg || [] };
}

export async function agentReadHistoryAction(input: { negocioId?: string; protocolo?: string }) {
  const c = await ctx();
  if (!c) return { success: false, error: "Sessão." };
  const admin = await getSupabaseAdmin();
  if (!admin) return { success: false, error: "Admin." };

  let negocio: any = null;
  let processo: any = null;

  if (input.negocioId) {
    const { data } = await admin
      .from("crm_negocios")
      .select("*")
      .eq("empresa_id", c.empresa_id)
      .eq("id", input.negocioId)
      .maybeSingle();
    negocio = data;
  }

  const proto = String(input.protocolo || negocio?.protocolo_cnj || "").trim();
  if (proto) {
    const dig = proto.replace(/\D/g, "");
    const { data } = await admin
      .from("processos")
      .select(
        "id, protocolo_ref, cliente_nome, status, tribunal, proximo_retorno, ultimo_retorno, observacoes, escritorio, advogado"
      )
      .eq("empresa_id", c.empresa_id)
      .or(
        dig.length >= 10
          ? `protocolo_ref.ilike.%${dig}%`
          : `protocolo_ref.ilike.%${proto}%,cliente_nome.ilike.%${proto}%`
      )
      .limit(3);
    processo = (data || [])[0] || null;
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
  const { error } = await admin.from("crm_agent_tasks").insert({
    empresa_id: c.empresa_id,
    agent_id: input.agent_id,
    status: "due",
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    payload: { note: input.note || "", via: "schedule_recheck" },
    due_at: due,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, due_at: due };
}

export async function listAgentTasksAction() {
  const c = await ctx();
  if (!c) return { success: false, tasks: [] as any[], error: "Sessão." };
  const admin = await getSupabaseAdmin();
  if (!admin) return { success: false, tasks: [] as any[], error: "Tabela ausente." };
  const { data, error } = await admin
    .from("crm_agent_tasks")
    .select("*")
    .eq("empresa_id", c.empresa_id)
    .order("due_at", { ascending: true })
    .limit(80);
  if (error) return { success: false, tasks: [], error: error.message };
  return { success: true, tasks: data || [] };
}

function formatOutstanding(atrasados: any[], silencio: any[]) {
  const lines: string[] = [];
  lines.push("## Régua / a receber");
  if (!atrasados.length) lines.push("Nenhum título pendente/atrasado na amostra.");
  else {
    atrasados.slice(0, 15).forEach((r, i) => {
      lines.push(
        `${i + 1}. ${r.cliente_nome || "—"} · R$ ${r.valor ?? "?"} · venc. ${r.vencimento || "—"} · ${r.status}`
      );
    });
  }
  lines.push("");
  lines.push("## Silêncio comercial (>14 dias sem update)");
  if (!silencio.length) lines.push("Nenhum negócio em silêncio na amostra.");
  else {
    silencio.slice(0, 15).forEach((r, i) => {
      lines.push(
        `${i + 1}. ${r.cliente_nome || "—"} · ${r.protocolo_cnj || "sem CNJ"} · status ${r.status} · upd ${String(r.updated_at || "").slice(0, 10)} · tel ${r.cliente_telefone || "—"}`
      );
    });
  }
  lines.push("");
  lines.push("## Próximas ações sugeridas");
  lines.push("1. Ligar/WhatsApp nos 5 primeiros de cada lista.");
  lines.push("2. Registrar atendimento no Lexis (para sair do silêncio).");
  lines.push("3. Se for cobrança: tom educado + comprovante/pix da assessoria.");
  return lines.join("\n");
}


/** KPIs reais da carteira jurídica (processos) — não só crm_negocios */
export async function agentCarteiraKpisAction() {
  const c = await ctx();
  if (!c) return { success: false as const, error: "Sessão." };
  try {
    const { getStoredCasesForEmpresa } = await import("@/lib/server-db");
    const { isCasoEncerrado } = await import("@/lib/status-encerrado");
    const cases = await getStoredCasesForEmpresa(c.empresa_id!, true);
    let total = cases.length;
    let vencidos = 0;
    let hoje = 0;
    let atencao = 0;
    let noPrazo = 0;
    let arquivados = 0;
    let novidades = 0;
    for (const raw of cases) {
      const x: any = raw;
      if (isCasoEncerrado(x) || /arquiv|encerr/i.test(String(x.status || x.situacao || ""))) {
        arquivados++;
        continue;
      }
      const st = String(x.status || "");
      if (st === "Vencido" || /vencid/i.test(st)) vencidos++;
      else if (st === "É Hoje" || /é hoje|e hoje/i.test(st)) hoje++;
      else if (st === "Atenção" || /aten/i.test(st)) atencao++;
      else noPrazo++;
      if (x.tem_novo_andamento || x.novo_andamento) novidades++;
    }
    return {
      success: true as const,
      total,
      ativos: total - arquivados,
      vencidos,
      hoje,
      atencao,
      noPrazo,
      arquivados,
      novidades,
    };
  } catch (e: any) {
    return { success: false as const, error: e?.message || "falha KPIs" };
  }
}

function formatCarteiraKpis(k: any) {
  if (!k?.success) return "Não foi possível ler a carteira de processos.";
  return [
    "## Carteira jurídica (processos reais)",
    `Total: **${k.total}**`,
    `Ativos: **${k.ativos}** · Arquivados/encerrados: **${k.arquivados}**`,
    `Vencidos: **${k.vencidos}**`,
    `É hoje: **${k.hoje}** · Atenção: **${k.atencao}** · No prazo: **${k.noPrazo}**`,
    `Novidades (flag): **${k.novidades}**`,
    "",
    "Fonte: tabela processos / processarCaso (mesma base do Dashboard).",
  ].join("\n");
}


/** Run com fallback determinístico + timeout na IA */
export async function runCrmAgentAction(input: {
  agent_id: CrmAgentId;
  prompt?: string;
  negocioId?: string;
  protocolo?: string;
  cnpj?: string;
  /** Se true, chama MiniMax/Claude/Grok mesmo em agente determinístico */
  useIa?: boolean;
  /** auto | minimax | claude | xai | groq | omni */
  preferredEngine?: string;
}): Promise<{ success: boolean; content: string; logs: CrmAgentRunLog[]; error?: string }> {
  const c = await ctx();
  const logs: CrmAgentRunLog[] = [];
  const now = () => new Date().toISOString();
  if (!c) return { success: false, content: "", logs, error: "Sessão expirada. Faça login de novo." };

  const agentId = (input.agent_id in AGENT_CATALOG ? input.agent_id : "livre") as CrmAgentId;
  const agent = AGENT_CATALOG[agentId];

  const outstanding = await agentListOutstandingAction();
  logs.push({
    agent_id: agentId,
    tool: "list_outstanding_work",
    ok: !!outstanding.success,
    summary: `atrasados=${(outstanding.atrasados || []).length} silencio=${(outstanding.silencio || []).length}`,
    at: now(),
  });

  const kpis = await agentCarteiraKpisAction();
  logs.push({
    agent_id: agentId,
    tool: "carteira_kpis",
    ok: !!kpis.success,
    summary: kpis.success
      ? `total=${kpis.total} vencidos=${kpis.vencidos} ativos=${kpis.ativos}`
      : (kpis as any).error || "falha",
    at: now(),
  });

  // Perguntas diretas sobre a carteira → resposta imediata (ex.: "quantos vencidos")
  const q = String(input.prompt || "").toLowerCase();
  if (
    /vencid|quantos|carteira|pendente|arquiv|novidade|kpi|indicador/.test(q) ||
    agentId === "followup-operacional"
  ) {
    if (kpis.success && (/vencid|quantos|kpi|indicador|carteira|pendente/.test(q) || agentId === "followup-operacional")) {
      const base = formatCarteiraKpis(kpis);
      const extra =
        agentId === "followup-operacional" || /follow|ligar|whats|prioridade/.test(q)
          ? "\n\n" + formatOutstanding(outstanding.atrasados || [], outstanding.silencio || [])
          : "";
      if (/vencid|quantos|kpi|indicador|carteira/.test(q) || agentId === "followup-operacional") {
        // ainda tenta IA curta, mas já devolve KPIs se IA falhar
        if (/vencid/.test(q) && !/follow|ligar/.test(q)) {
          return {
            success: true,
            content: base + `\n\n**Resposta direta:** há **${(kpis as any).vencidos}** processos vencidos na carteira ativa.`,
            logs,
          };
        }
      }
    }
  }

  // CNPJ enrich
  if (agentId === "enriquecer-contato" || /\d{14}/.test(String(input.cnpj || input.prompt || "").replace(/\D/g, ""))) {
    const raw = input.cnpj || input.prompt || "";
    const cnpj = String(raw).replace(/\D/g, "").slice(0, 14);
    if (cnpj.length === 14) {
      const br = await agentBrasilApiCnpjAction(cnpj);
      logs.push({
        agent_id: agentId,
        tool: "brasilapi_cnpj",
        ok: !!br.success,
        summary: br.success ? br.observed?.razao_social || "ok" : br.error || "falha",
        at: now(),
      });
      if (br.success) {
        return {
          success: true,
          content:
            "## Contato enriquecido (BrasilAPI)\n\n" +
            JSON.stringify(br.observed, null, 2) +
            "\n\nFonte: brasilapi.com.br (público). Não é LinkedIn.",
          logs,
        };
      }
    }
  }

  let history: any = null;
  if (input.negocioId || input.protocolo) {
    history = await agentReadHistoryAction({
      negocioId: input.negocioId,
      protocolo: input.protocolo,
    });
    logs.push({
      agent_id: agentId,
      tool: "read_crm_history",
      ok: !!history.success,
      summary: history?.processo
        ? `processo=${history.processo.protocolo_ref || history.processo.cliente_nome}`
        : history?.negocio
          ? `negocio=${history.negocio.cliente_nome}`
          : "sem registro",
      at: now(),
    });
  }

  // Deterministic agents: resposta imediata sem depender de LLM
  // Se useIa=true, grava base e segue para cascade (MiniMax/Claude/…)
  if (agent.deterministic && agentId !== "livre" && !input.useIa) {
    if (agentId === "enriquecer-cnj" && history?.processo) {
      const p = history.processo;
      return {
        success: true,
        content: [
          "## Processo na carteira",
          `Cliente: ${p.cliente_nome || "—"}`,
          `CNJ: ${p.protocolo_ref || "—"}`,
          `Tribunal: ${p.tribunal || "—"}`,
          `Status: ${p.status || "—"}`,
          `Último retorno: ${p.ultimo_retorno || "—"}`,
          `Próximo: ${p.proximo_retorno || "—"}`,
          `Escritório/Adv: ${p.escritorio || "—"} / ${p.advogado || "—"}`,
          "",
          "Próximo passo: confirmar com o cliente se já foi orientado sobre o status acima.",
        ].join("\n"),
        logs,
      };
    }

    if (
      agentId === "silencio-comercial" ||
      agentId === "atraso-regua" ||
      agentId === "followup-operacional"
    ) {
      return {
        success: true,
        content:
          formatCarteiraKpis(kpis) +
          "\n\n" +
          formatOutstanding(outstanding.atrasados || [], outstanding.silencio || []),
        logs,
      };
    }

    if (agentId === "recheck") {
      const sch = await agentScheduleRecheckAction({
        agent_id: agentId,
        subject_type: "empresa",
        subject_id: "carteira",
        days: 7,
        note: input.prompt || "recheck",
      });
      return {
        success: !!sch.success,
        content: sch.success
          ? `Recheck agendado para ${sch.due_at}. Motivo: ${input.prompt || "recheck semanal"}.`
          : sch.error || "Falha ao agendar (tabela crm_agent_tasks?).",
        logs,
      };
    }
  }


  // ── IA opcional (não bloqueia resposta útil) ─────────────────────────
  // Cascata real do Lexis: MiniMax → Claude → xAI → Omni → Groq → …
  // Determinísticos já retornaram acima; aqui só livre / e-mail / pedido explícito.
  const wantIa =
    agentId === "livre" ||
    agentId === "email-cliente" ||
    agentId === "brief-negocio" ||
    agentId === "anotar-carteira" ||
    !!input.useIa ||
    /\b(com ia|use ia|claude|minimax|grok|analise profunda|análise profunda)\b/i.test(
      String(input.prompt || "")
    );

  const kpiBlock = formatCarteiraKpis(kpis);
  const baseDet =
    kpiBlock +
    "\n\n" +
    formatOutstanding(outstanding.atrasados || [], outstanding.silencio || []);

  if (!wantIa) {
    logs.push({
      agent_id: agentId,
      tool: "skip_ia",
      ok: true,
      summary: "resposta determinística (IA não solicitada)",
      at: now(),
    });
    return {
      success: true,
      content:
        baseDet +
        "\n\n_Sem IA neste run. Marque «Enriquecer com IA» ou use Agente livre / diga «com Claude» ou «com MiniMax»._",
      logs,
    };
  }

  const preferred =
    String(input.preferredEngine || "auto").toLowerCase().trim() || "auto";
  // auto = MiniMax + Claude + Grok + Omni (runCascade)
  const system = [
    ALL_SKILLS,
    "Você é o agente Lexis do gabinete. Use só os números/KPIs fornecidos.",
    "Português do Brasil. Objetivo, operacional. Não invente CNJ/telefone/valores.",
  ].join("\n");

  const userMsg = [
    `Agente: ${agent.nome}`,
    `Função: ${agent.faz}`,
    `Pedido: ${input.prompt || "(rotina)"}`,
    "",
    "KPIs carteira (processos reais):",
    kpis.success ? JSON.stringify(kpis) : "indisponível",
    "",
    "CRM financeiro (pode estar vazio):",
    `atrasados=${(outstanding.atrasados || []).length} silencio=${(outstanding.silencio || []).length}`,
    JSON.stringify(
      {
        atrasados: (outstanding.atrasados || []).slice(0, 8),
        silencio: (outstanding.silencio || []).slice(0, 8),
      },
      null,
      2
    ),
    history
      ? `Histórico:\n${JSON.stringify(history, null, 2).slice(0, 3500)}`
      : "",
  ].join("\n");

  try {
    const iaPromise = runCascade({
      preferred,
      system,
      messages: [{ role: "user", content: userMsg }],
      temperature: 0.2,
      max_tokens: 2048,
    });
    const timeout = new Promise<{ text?: string; engineId?: string; error?: string }>(
      (resolve) =>
        setTimeout(
          () => resolve({ error: "timeout_ia_50s" }),
          50000
        )
    );
    const res = (await Promise.race([iaPromise, timeout])) as any;

    if (res?.text && !res?.error) {
      logs.push({
        agent_id: agentId,
        tool: "cascade_ia",
        ok: true,
        summary: `engine=${res.engineId || preferred} model=${res.model || "?"} ms=${res.latencyMs || res.latency || "?"}`,
        at: now(),
      });
      return {
        success: true,
        content:
          kpiBlock +
          `\n\n_Motor: **${res.engineId || preferred}**${res.model ? ` · ${res.model}` : ""}_\n\n---\n\n` +
          String(res.text).trim(),
        logs,
      };
    }

    // Fallback: processChat (xai/groq/airforce) se cascade falhou
    try {
      const fb = await Promise.race([
        processChat({
          message: `${system}\n\n${userMsg}`,
          contextType: "legal",
          temperature: 0.2,
          preferredProvider: "xai",
        }),
        new Promise<any>((r) =>
          setTimeout(() => r({ success: false, error: "timeout_processChat" }), 35000)
        ),
      ]);
      if (fb?.success && fb?.content) {
        logs.push({
          agent_id: agentId,
          tool: "processChat_fallback",
          ok: true,
          summary: `provider=${fb.provider} model=${fb.model}`,
          at: now(),
        });
        return {
          success: true,
          content:
            kpiBlock +
            `\n\n_Motor: **${fb.provider}** · ${fb.model}_\n\n---\n\n` +
            fb.content,
          logs,
        };
      }
    } catch {
      /* ignore */
    }

    logs.push({
      agent_id: agentId,
      tool: "cascade_ia",
      ok: false,
      summary: res?.error || "falha cascade",
      at: now(),
    });

    return {
      success: true,
      content:
        baseDet +
        "\n\n_IA indisponível no momento (MiniMax/Claude/Grok). Números acima são da carteira real — sem inventar._",
      logs,
    };
  } catch (e: any) {
    return {
      success: true,
      content: baseDet + `\n\n_Erro IA: ${e?.message || e}_`,
      logs,
    };
  }
}

export async function agentBrasilApiCnpjAction(cnpjRaw: string) {
  const c = await ctx();
  if (!c) return { success: false, error: "Sessão." };
  const cnpj = String(cnpjRaw || "").replace(/\D/g, "");
  if (cnpj.length !== 14) return { success: false, error: "CNPJ inválido (14 dígitos)." };
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return { success: false, error: `BrasilAPI HTTP ${res.status}` };
    const data = await res.json();
    return {
      success: true,
      observed: {
        cnpj,
        razao_social: data.razao_social || data.nome || null,
        nome_fantasia: data.nome_fantasia || null,
        situacao: data.descricao_situacao_cadastral || null,
        cnae: data.cnae_fiscal_descricao || null,
        municipio: data.municipio || null,
        uf: data.uf || null,
        source: "brasilapi.com.br",
      },
    };
  } catch (e: any) {
    return { success: false, error: e?.message || "Falha BrasilAPI" };
  }
}

export async function agentDraftEmailAction(input: {
  to?: string;
  cliente?: string;
  protocolo?: string;
  contexto?: string;
}) {
  const c = await ctx();
  if (!c) return { success: false, error: "Sessão.", subject: "", body: "" };

  // Template rápido sem IA (sempre funciona)
  const subject = `Atualização — ${input.protocolo || input.cliente || "seu processo"}`;
  const body = [
    `Olá${input.cliente ? `, ${input.cliente}` : ""}!`,
    "",
    "Passando para atualizar você sobre o andamento do seu caso" +
      (input.protocolo ? ` (processo ${input.protocolo})` : "") +
      ".",
    "",
    input.contexto
      ? `Resumo: ${input.contexto.slice(0, 500)}`
      : "Nossa equipe analisou os últimos andamentos e está à disposição para orientar os próximos passos.",
    "",
    "Qualquer dúvida, responda esta mensagem.",
    "",
    "Atenciosamente,",
    "Equipe de atendimento",
  ].join("\n");

  // Tenta melhorar com IA (timeout 12s)
  try {
    const prompt = `${ALL_SKILLS}\n\nJSON {"subject","body"} para e-mail ao cliente.\nPara: ${input.to || "—"}\nCliente: ${input.cliente || "—"}\nCNJ: ${input.protocolo || "—"}\nContexto: ${input.contexto || ""}`;
    const ia = await Promise.race([
      processChat({ message: prompt, contextType: "case_swot", temperature: 0.3 }),
      new Promise<{ success: false }>((r) => setTimeout(() => r({ success: false }), 12000)),
    ]);
    if (ia.success && (ia as any).content) {
      const m = String((ia as any).content).match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]);
        return {
          success: true,
          subject: String(j.subject || subject),
          body: String(j.body || body),
        };
      }
    }
  } catch {
    /* template */
  }
  return { success: true, subject, body };
}

export async function agentSendEmailAction(input: {
  to: string;
  subject: string;
  body: string;
  send?: boolean;
}) {
  const c = await ctx();
  if (!c) return { success: false, error: "Sessão." };
  const to = String(input.to || "").trim();
  if (!to.includes("@")) return { success: false, error: "E-mail destino inválido." };

  const key = process.env.RESEND_API_KEY || process.env.LEXIS_RESEND_API_KEY;
  // RESEND_FROM deve ser e-mail, NÃO URL (ex: Lexis <onboarding@resend.dev>)
  let from = process.env.RESEND_FROM || process.env.LEXIS_EMAIL_FROM || "LexisPredict <onboarding@resend.dev>";
  if (/^https?:\/\//i.test(from)) {
    from = "LexisPredict <onboarding@resend.dev>";
  }

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(input.body)}`;

  if (!input.send) {
    return { success: true, mode: "draft_only" as const, mailto, message: "Rascunho pronto (mailto)." };
  }
  if (!key) {
    return {
      success: true,
      mode: "mailto_fallback" as const,
      mailto,
      message: "Sem RESEND_API_KEY. Use mailto. RESEND_FROM deve ser e-mail (não URL do site).",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject: input.subject, text: input.body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data?.message || `Resend HTTP ${res.status}` };
    return { success: true, mode: "sent" as const, id: data?.id };
  } catch (e: any) {
    return { success: false, error: e?.message || "Falha envio" };
  }
}
