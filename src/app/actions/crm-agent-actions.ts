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
import { chatAIFlow } from "@/ai/flows/chat-ai-flow";

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
    const { diasAtePrazo } = await import("@/lib/prazo-status");
    const cases = await getStoredCasesForEmpresa(c.empresa_id!, true);
    let total = cases.length;
    let vencidos = 0;
    let hoje = 0;
    let atencao = 0;
    let noPrazo = 0;
    let arquivados = 0;
    let novidades = 0;
    const vencidosList: Array<{
      cliente: string;
      protocolo: string;
      prazo: string;
      diasVencido: number;
      tribunal: string;
      advogado: string;
      escritorio: string;
      telefone: string;
    }> = [];

    for (const raw of cases) {
      const x: any = raw;
      if (isCasoEncerrado(x) || /arquiv|encerr/i.test(String(x.status || x.situacao || x.statusInterno || ""))) {
        arquivados++;
        continue;
      }
      const st = String(x.status || "");
      const prazo = String(x.proximoPrazo || x.proximo_retorno || x.proximoRetorno || "").slice(0, 10);
      let dias = typeof x.diasFaltando === "number" ? x.diasFaltando : diasAtePrazo(prazo);
      if (dias == null && prazo) dias = diasAtePrazo(prazo);

      const isVenc =
        st === "Vencido" ||
        /vencid/i.test(st) ||
        (typeof dias === "number" && dias < 0);

      if (isVenc) {
        vencidos++;
        const diasVencido = typeof dias === "number" && dias < 0 ? Math.abs(dias) : 0;
        vencidosList.push({
          cliente: String(x.cliente || x.cliente_nome || "—"),
          protocolo: String(x.protocolo || x.protocolo_ref || "—"),
          prazo: prazo || "—",
          diasVencido,
          tribunal: String(x.tribunal || "—"),
          advogado: String(x.advogado || "—"),
          escritorio: String(x.escritorio || "—"),
          telefone: String(x.telefone || x.phone || "—"),
        });
      } else if (st === "É Hoje" || /é hoje|e hoje/i.test(st) || dias === 0) {
        hoje++;
      } else if (st === "Atenção" || /aten/i.test(st)) {
        atencao++;
      } else {
        noPrazo++;
      }
      if (x.tem_novo_andamento || x.novo_andamento) novidades++;
    }

    vencidosList.sort((a, b) => b.diasVencido - a.diasVencido);

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
      /** Mais tempo vencido primeiro */
      topVencidos: vencidosList.slice(0, 25),
      maisVencido: vencidosList[0] || null,
      menosVencido: vencidosList.length
        ? [...vencidosList].sort((a, b) => a.diasVencido - b.diasVencido)[0]
        : null,
      topMenosVencidos: [...vencidosList]
        .sort((a, b) => a.diasVencido - b.diasVencido)
        .slice(0, 25),
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
    "Fonte: tabela processos (mesma base do Dashboard).",
  ].join("\n");
}

function formatMaisVencido(k: any): string {
  const m = k?.maisVencido;
  if (!m) return "Nenhum processo vencido ativo encontrado na carteira carregada.";
  const lines = [
    "## Cliente com mais tempo vencido",
    `**${m.cliente}**`,
    `CNJ: ${m.protocolo}`,
    `Prazo: ${m.prazo} · **${m.diasVencido} dia(s) em atraso**`,
    `Tribunal: ${m.tribunal}`,
    `Adv/Escritório: ${m.advogado} / ${m.escritorio}`,
    m.telefone && m.telefone !== "—" ? `Telefone: ${m.telefone}` : "",
  ].filter(Boolean);

  const top = (k.topVencidos || []).slice(0, 10);
  if (top.length > 1) {
    lines.push("");
    lines.push("### Ranking (top 10 mais vencidos)");
    top.forEach((r: any, i: number) => {
      lines.push(
        `${i + 1}. **${r.cliente}** · ${r.protocolo} · ${r.diasVencido}d · prazo ${r.prazo}`
      );
    });
  }
  return lines.join("\n");
}

function formatMenosVencido(k: any): string {
  const m = k?.menosVencido;
  if (!m) return "Nenhum processo vencido ativo encontrado na carteira carregada.";
  const lines = [
    "## Cliente com menos tempo vencido (ainda em atraso)",
    `**${m.cliente}**`,
    `CNJ: ${m.protocolo}`,
    `Prazo: ${m.prazo} · **${m.diasVencido} dia(s) em atraso**`,
    `Tribunal: ${m.tribunal}`,
    `Adv/Escritório: ${m.advogado} / ${m.escritorio}`,
    m.telefone && m.telefone !== "—" ? `Telefone: ${m.telefone}` : "",
  ].filter(Boolean);
  const top = (k.topMenosVencidos || []).slice(0, 10);
  if (top.length > 1) {
    lines.push("");
    lines.push("### Ranking (top 10 — menos dias em atraso)");
    top.forEach((r: any, i: number) => {
      lines.push(
        `${i + 1}. **${r.cliente}** · ${r.protocolo} · ${r.diasVencido}d · prazo ${r.prazo}`
      );
    });
  }
  return lines.join("\n");
}

/** Responde o pedido do usuário com dados reais (sem inventar rotina genérica). */
function answerUserPrompt(opts: {
  prompt: string;
  agentId: CrmAgentId;
  agentNome: string;
  kpis: any;
  outstanding: { atrasados?: any[]; silencio?: any[] };
  history?: any;
}): string {
  const raw = String(opts.prompt || "").trim();
  const q = raw.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const k = opts.kpis?.success ? opts.kpis : null;
  const atrasados = opts.outstanding?.atrasados || [];
  const silencio = opts.outstanding?.silencio || [];
  const lines: string[] = [];

  if (!raw && (opts.agentId === "livre" || opts.agentId === "anotar-carteira")) {
    return [
      "Nenhum pedido foi escrito.",
      "Exemplos:",
      "• qual cliente está há menos tempo vencido?",
      "• qual cliente está há mais tempo vencido?",
      "• top 10 vencidos",
      "• quantos vencidos temos?",
      "• quantos ativos?",
      "• resumo do processo 0000000-00.0000.0.00.0000",
    ].join("\n");
  }

  lines.push(`## Pedido`);
  lines.push(raw || `(rotina do agente «${opts.agentNome}»)`);
  lines.push("");

  // CNJ no texto
  if (opts.history?.processo) {
    const p = opts.history.processo;
    lines.push("## Processo encontrado");
    lines.push(`Cliente: ${p.cliente_nome || p.cliente || "—"}`);
    lines.push(`CNJ: ${p.protocolo_ref || p.protocolo || "—"}`);
    lines.push(`Tribunal: ${p.tribunal || "—"}`);
    lines.push(`Status: ${p.status || "—"}`);
    lines.push(`Último retorno: ${p.ultimo_retorno || "—"}`);
    lines.push(`Próximo retorno: ${p.proximo_retorno || p.proximoPrazo || "—"}`);
    lines.push("");
  }

  let answered = false;

  // ── Vencidos: distingue MENOS vs MAIS tempo em atraso ──
  const asksMenosVencido =
    /(menos\s*tempo|menor\s*atraso|menos\s*vencid|menos\s*dias|menos\s*atrasad|vencid.*menos|mais\s*recente.*venc)/i.test(
      q
    ) ||
    /(menos\s*tempo|menor\s*atraso|menos\s*vencid)/i.test(raw);

  const asksMaisVencido =
    !asksMenosVencido &&
    (/(mais\s*tempo|mmais\s*tempo|mais\s*vencid|maior\s*atraso|ha\s*mais\s*tempo|pior\s*prazo|mais\s*atrasad|tempo\s*vencid)/i.test(
      raw
    ) ||
      /(mais\s*tempo|mmais|mais\s*vencid|tempo\s*vencid)/i.test(q) ||
      (/(qual|quem|cliente).*(vencid|atras)/i.test(q) && !/quantos|qtd|quantidade/.test(q)));

  const asksTopVencidos =
    /(top\s*\d*|ranking|lista.*vencid|vencidos.*lista|quais.*vencid)/i.test(raw) ||
    (/(top|ranking|lista)/i.test(q) && /vencid/.test(q));

  if (k && asksMenosVencido) {
    lines.push(formatMenosVencido(k));
    answered = true;
  } else if (
    k &&
    (asksMaisVencido || asksTopVencidos || (opts.agentId === "followup-operacional" && /vencid/.test(q)))
  ) {
    lines.push(formatMaisVencido(k));
    answered = true;
  }

  if (k && /vencid/.test(q) && !answered) {
    lines.push(`**Vencidos na carteira:** ${k.vencidos}`);
    lines.push(`(Ativos ${k.ativos} · total ${k.total} · arquivados/encerrados ${k.arquivados})`);
    if (k.maisVencido) {
      lines.push("");
      lines.push(
        `Maior atraso: **${k.maisVencido.cliente}** (${k.maisVencido.diasVencido}d) · ${k.maisVencido.protocolo}`
      );
    }
    if (k.menosVencido) {
      lines.push(
        `Menor atraso (ainda vencido): **${k.menosVencido.cliente}** (${k.menosVencido.diasVencido}d) · ${k.menosVencido.protocolo}`
      );
    }
    answered = true;
  }

  if (k && /(ativo|em andamento)/.test(q) && !/vencid/.test(q)) {
    lines.push(`**Ativos:** ${k.ativos} de ${k.total} processos`);
    answered = true;
  }
  if (k && /(arquiv|encerr)/.test(q)) {
    lines.push(`**Arquivados / encerrados:** ${k.arquivados}`);
    answered = true;
  }
  if (k && /(novidade|novo andamento)/.test(q)) {
    lines.push(`**Com flag de novidade:** ${k.novidades}`);
    answered = true;
  }
  if (k && /(e hoje|hoje\b)/.test(q) && !/vencid/.test(q)) {
    lines.push(`**É hoje:** ${k.hoje}`);
    answered = true;
  }
  if (k && /(kpi|indicador|resumo da carteira|como esta a carteira)/.test(q)) {
    lines.push(formatCarteiraKpis(k));
    answered = true;
  }

  if (/atraso|cobranca|titulo|receber|regua/.test(q) || opts.agentId === "atraso-regua") {
    lines.push("");
    lines.push(`## Títulos / atraso CRM: ${atrasados.length}`);
    if (!atrasados.length) {
      lines.push("Nenhum título em `crm_receber` (funil financeiro vazio ou sem vencidos).");
    } else {
      atrasados.slice(0, 15).forEach((r: any, i: number) => {
        lines.push(
          `${i + 1}. ${r.cliente_nome || r.descricao || "—"} · R$ ${r.valor ?? "—"} · venc. ${r.data_vencimento || "—"}`
        );
      });
    }
    answered = true;
  }

  if (/silencio|sumiu|parad|sem movimento|follow/.test(q) || opts.agentId === "silencio-comercial") {
    lines.push("");
    lines.push(`## Silêncio comercial CRM: ${silencio.length}`);
    if (!silencio.length) {
      lines.push("Nenhum negócio parado em `crm_negocios`.");
    } else {
      silencio.slice(0, 15).forEach((n: any, i: number) => {
        lines.push(`${i + 1}. ${n.cliente_nome || "—"} · ${n.estagio || "—"}`);
      });
    }
    answered = true;
  }

  if (!raw && opts.agentId === "followup-operacional" && k) {
    lines.push(formatCarteiraKpis(k));
    lines.push("");
    lines.push(formatMaisVencido(k));
    answered = true;
  }

  if (!answered && k) {
    // pedido livre: se mencionar cliente/vencido de qualquer forma, ranking
    if (/cliente|vencid|prazo|atras/.test(q)) {
      if (/(menos\s*tempo|menor\s*atraso|menos\s*vencid)/i.test(q)) {
        lines.push(formatMenosVencido(k));
      } else {
        lines.push(formatMaisVencido(k));
      }
    } else {
      lines.push("## Dados atuais");
      lines.push(
        `**${k.vencidos} vencidos**, **${k.ativos} ativos**, **${k.total} total**.`
      );
      if (k.maisVencido) {
        lines.push(
          `Maior atraso: **${k.maisVencido.cliente}** (${k.maisVencido.diasVencido}d) · ${k.maisVencido.protocolo}`
        );
      }
      lines.push("");
      lines.push(`_Pedido:_ «${raw}» — se não for isso, reformule (ex.: «top 5 vencidos»).`);
    }
  } else if (!answered && !k) {
    lines.push("Não foi possível ler a carteira de processos.");
  }

  return lines.join("\n");
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


  const promptRaw = String(input.prompt || "").trim();
  const q = promptRaw.toLowerCase();

  // Histórico CNJ / negócio se pedido
  let history: any = null;
  if (input.negocioId || input.protocolo || /\d{7}-?\d{2}/.test(promptRaw)) {
    history = await agentReadHistoryAction({
      negocioId: input.negocioId,
      protocolo: input.protocolo || (promptRaw.match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/) || [])[0],
    });
    logs.push({
      agent_id: agentId,
      tool: "read_history",
      ok: !!history?.success,
      summary: history?.processo
        ? `processo=${history.processo.protocolo_ref || history.processo.cliente_nome}`
        : history?.negocio
          ? `negocio=${history.negocio.cliente_nome}`
          : "sem registro",
      at: now(),
    });
  }

  // CNPJ enrich (só se agente ou CNPJ explícito)
  if (agentId === "enriquecer-contato" || (/\d{14}/.test(String(input.cnpj || promptRaw).replace(/\D/g, "")) && /cnpj|empresa|raz[aã]o/.test(q))) {
    const rawC = input.cnpj || promptRaw;
    const cnpj = String(rawC).replace(/\D/g, "").slice(0, 14);
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
            `## Pedido\n${promptRaw || "Enriquecer CNPJ"}\n\n## Contato (BrasilAPI)\n\n` +
            JSON.stringify(br.observed, null, 2),
          logs,
        };
      }
    }
  }

  if (agentId === "recheck" && !input.useIa) {
    const sch = await agentScheduleRecheckAction({
      agent_id: agentId,
      subject_type: "empresa",
      subject_id: "carteira",
      days: 7,
      note: promptRaw || "recheck",
    });
    return {
      success: !!sch.success,
      content: sch.success
        ? `Recheck agendado para ${sch.due_at}. Motivo: ${promptRaw || "recheck semanal"}.`
        : sch.error || "Falha ao agendar (tabela crm_agent_tasks?).",
      logs,
    };
  }

  // Resposta determinística SEMPRE alinhada ao pedido
  const det = answerUserPrompt({
    prompt: promptRaw,
    agentId,
    agentNome: agent.nome,
    kpis,
    outstanding,
    history,
  });
  logs.push({
    agent_id: agentId,
    tool: "answer_prompt",
    ok: true,
    summary: `prompt_len=${promptRaw.length} agent=${agentId}`,
    at: now(),
  });


  // Ranking/KPI / "cliente mais vencido": SEMPRE dados (mesmo com checkbox IA).
  // Evita timeout MiniMax e resposta sumir / errada.
  const promptIsPureData =
    /(mais\s*tempo|menos\s*tempo|mmais\s*tempo|mais\s*vencid|menos\s*vencid|menor\s*atraso|maior\s*atraso|top\s*\d*|quantos|kpi|ranking|lista.*vencid|cliente.*vencid|vencid.*cliente|tempo\s*vencid|quem.*(vencid|atras)|qual.*(vencid|atras))/i.test(
      promptRaw
    );
  if (promptIsPureData && det && det.length > 15) {
    logs.push({
      agent_id: agentId,
      tool: "pure_data_fast",
      ok: true,
      summary: "ranking/KPI só carteira (IA ignorada neste pedido)",
      at: now(),
    });
    return { success: true, content: det, logs };
  }

  const wantIa =
    !!input.useIa ||
    agentId === "email-cliente" ||
    agentId === "brief-negocio" ||
    agentId === "anotar-carteira" ||
    (agentId === "livre" && !!promptRaw && !promptIsPureData) ||
    /\b(com ia|use ia|claude|minimax|grok|analise profunda|análise profunda|redija|escreva)\b/i.test(
      promptRaw
    );

  if (!wantIa) {
    logs.push({
      agent_id: agentId,
      tool: "skip_ia",
      ok: true,
      summary: "resposta ao pedido (sem IA)",
      at: now(),
    });
    return { success: true, content: det, logs };
  }

  // IA = mesmo pipeline do Assistente (chatAIFlow → cascade MiniMax/Claude/Grok…)
  const preferred =
    String(input.preferredEngine || "auto").toLowerCase().trim() || "auto";

  const evidencia = [
    det,
    kpis.success && kpis.maisVencido
      ? `MAIS_VENCIDO_JSON=${JSON.stringify(kpis.maisVencido)}`
      : "",
    kpis.success && kpis.topVencidos
      ? `TOP_VENCIDOS_JSON=${JSON.stringify((kpis.topVencidos || []).slice(0, 10))}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const perguntaAssistente = [
    "Você é o assistente operacional do Lexis. Responda SOMENTE o pedido do usuário.",
    "Use os DADOS DE EVIDÊNCIA (já calculados). Não invente cliente/CNJ/dias.",
    "Se o pedido for 'cliente mais tempo vencido', cite nome, CNJ e dias do MAIS_VENCIDO.",
    "",
    `PEDIDO: ${promptRaw || agent.faz}`,
    "",
    "DADOS DE EVIDÊNCIA:",
    evidencia,
  ].join("\n");

  try {
    const chatPromise = chatAIFlow({
      pergunta: perguntaAssistente,
      preferred,
      preferredModel: preferred,
      temperature: 0.15,
      max_tokens: 1600,
      showThinking: false,
    });
    const timeout = new Promise<any>((resolve) =>
      setTimeout(
        () => resolve({ sucesso: false, resposta: "", engineUtilizada: "timeout" }),
        55000
      )
    );
    const res = await Promise.race([chatPromise, timeout]);

    if (res?.sucesso && res?.resposta) {
      logs.push({
        agent_id: agentId,
        tool: "chatAIFlow",
        ok: true,
        summary: `engine=${res.engineUtilizada || preferred} ms=${res.latencia || "?"}`,
        at: now(),
      });
      return {
        success: true,
        content:
          `## Pedido\n${promptRaw || agent.nome}\n\n` +
          `_Motor (assistente Lexis): **${res.engineUtilizada || preferred}**_\n\n` +
          String(res.resposta).trim(),
        logs,
      };
    }

    // Fallback runCascade direto
    try {
      const cas = await Promise.race([
        runCascade({
          preferred,
          system:
            "Responda só o pedido. Use evidências. Português BR. Não invente.",
          messages: [{ role: "user", content: perguntaAssistente }],
          temperature: 0.15,
          max_tokens: 1600,
        }),
        new Promise<any>((r) => setTimeout(() => r({ error: "timeout" }), 40000)),
      ]);
      if (cas?.text) {
        logs.push({
          agent_id: agentId,
          tool: "runCascade",
          ok: true,
          summary: `engine=${cas.engineId || preferred}`,
          at: now(),
        });
        return {
          success: true,
          content:
            `## Pedido\n${promptRaw || agent.nome}\n\n_Motor: **${cas.engineId}**_\n\n` +
            String(cas.text).trim(),
          logs,
        };
      }
    } catch {
      /* ignore */
    }

    logs.push({
      agent_id: agentId,
      tool: "chatAIFlow",
      ok: false,
      summary: res?.engineUtilizada || "falha IA",
      at: now(),
    });

    // Sem crédito de IA: dados reais ainda respondem o pedido
    return {
      success: true,
      content:
        det +
        "\n\n_IA indisponível (saldo/modelo). Acima está a resposta com dados reais da carteira._",
      logs,
    };
  } catch (e: any) {
    return {
      success: true,
      content: det + `\n\n_Erro IA: ${e?.message || e}_`,
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
