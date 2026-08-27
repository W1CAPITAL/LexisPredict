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
  const q = raw.toLowerCase();
  const k = opts.kpis?.success ? opts.kpis : null;
  const atrasados = opts.outstanding?.atrasados || [];
  const silencio = opts.outstanding?.silencio || [];
  const lines: string[] = [];

  // Sem pedido claro em agente livre
  if (!raw && (opts.agentId === "livre" || opts.agentId === "anotar-carteira")) {
    return [
      "Nenhum pedido foi escrito.",
      "Digite o que você quer, por exemplo:",
      "• quantos vencidos temos na carteira?",
      "• quantos ativos e arquivados?",
      "• resumo do processo 0000000-00.0000.0.00.0000",
      "• monte um e-mail curto para o cliente sobre atraso",
    ].join("\n");
  }

  lines.push(`## Pedido`);
  lines.push(raw || `(rotina do agente «${opts.agentNome}»)`);
  lines.push("");

  // CNJ no texto
  const cnjMatch = raw.match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/);
  if (cnjMatch && opts.history?.processo) {
    const p = opts.history.processo;
    lines.push("## Processo encontrado");
    lines.push(`Cliente: ${p.cliente_nome || "—"}`);
    lines.push(`CNJ: ${p.protocolo_ref || cnjMatch[0]}`);
    lines.push(`Tribunal: ${p.tribunal || "—"}`);
    lines.push(`Status: ${p.status || "—"}`);
    lines.push(`Último retorno: ${p.ultimo_retorno || "—"}`);
    lines.push(`Próximo retorno: ${p.proximo_retorno || "—"}`);
    lines.push("");
  }

  // Respostas focadas (só o que foi perguntado)
  let answered = false;

  if (k && /vencid/.test(q)) {
    lines.push(`**Vencidos na carteira:** ${k.vencidos}`);
    lines.push(`(Ativos ${k.ativos} · total ${k.total} · arquivados/encerrados ${k.arquivados})`);
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
  if (k && /(é hoje|e hoje|hoje\b)/.test(q)) {
    lines.push(`**É hoje:** ${k.hoje}`);
    answered = true;
  }
  if (k && /(aten[cç][aã]o)/.test(q)) {
    lines.push(`**Atenção (prazo):** ${k.atencao}`);
    answered = true;
  }
  if (k && /(kpi|indicador|resumo da carteira|como est[aá] a carteira)/.test(q)) {
    lines.push(formatCarteiraKpis(k));
    answered = true;
  }

  if (/atraso|cobran[cç]a|t[ií]tulo|receber|r[eé]gua/.test(q) || opts.agentId === "atraso-regua") {
    lines.push("");
    lines.push(`## Títulos / atraso CRM: ${atrasados.length}`);
    if (!atrasados.length) {
      lines.push("Nenhum título vencido em `crm_receber` (tabela financeira pode estar vazia).");
    } else {
      atrasados.slice(0, 15).forEach((r: any, i: number) => {
        lines.push(
          `${i + 1}. ${r.cliente_nome || r.descricao || "—"} · R$ ${r.valor ?? "—"} · venc. ${r.data_vencimento || "—"}`
        );
      });
    }
    answered = true;
  }

  if (/sil[eê]ncio|sumiu|parad|sem movimento|follow/.test(q) || opts.agentId === "silencio-comercial") {
    lines.push("");
    lines.push(`## Silêncio comercial CRM: ${silencio.length}`);
    if (!silencio.length) {
      lines.push("Nenhum negócio parado em `crm_negocios` (funil comercial pode estar vazio).");
    } else {
      silencio.slice(0, 15).forEach((n: any, i: number) => {
        lines.push(`${i + 1}. ${n.cliente_nome || "—"} · estágio ${n.estagio || "—"} · ${n.updated_at || ""}`);
      });
    }
    answered = true;
  }

  // Rotina do agente sem prompt específico
  if (!raw && opts.agentId === "followup-operacional" && k) {
    lines.push(formatCarteiraKpis(k));
    lines.push("");
    lines.push(`Prioridade jurídica: **${k.vencidos} vencidos**, **${k.hoje} é hoje**.`);
    lines.push(`CRM: ${atrasados.length} atraso(s), ${silencio.length} silêncio(s).`);
    answered = true;
  }

  if (!answered && k) {
    // Pedido livre sem matcher: responde o pedido + KPIs curtos (não só dump)
    lines.push("## Leitura com dados da carteira");
    lines.push(
      `Não há um relatório automático só para essa frase. Dados atuais: **${k.vencidos} vencidos**, **${k.ativos} ativos**, **${k.total} total**.`
    );
    lines.push("");
    lines.push("Se quiser algo específico, pergunte por número (ex.: vencidos, ativos, novidades) ou informe um CNJ.");
    if (raw) {
      lines.push("");
      lines.push(`_Pedido original mantido:_ «${raw}»`);
    }
  } else if (!answered && !k) {
    lines.push("Não foi possível ler a carteira de processos neste momento.");
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

  const wantIa =
    agentId === "livre" ||
    agentId === "email-cliente" ||
    agentId === "brief-negocio" ||
    agentId === "anotar-carteira" ||
    !!input.useIa ||
    /\b(com ia|use ia|claude|minimax|grok|analise profunda|análise profunda)\b/i.test(promptRaw);

  // Sem IA: devolve só a resposta ao pedido (não dump genérico)
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

  // Com IA: obrigar a responder EXATAMENTE o pedido; dados = evidência
  const preferred =
    String(input.preferredEngine || "auto").toLowerCase().trim() || "auto";

  const system = [
    ALL_SKILLS,
    "Você é um agente operacional do LexisPredict.",
    "REGRA 1: Responda APENAS o que o usuário pediu. Não invente outra pauta.",
    "REGRA 2: Use somente os DADOS DE EVIDÊNCIA abaixo (KPIs, listas, processo). Não invente números.",
    "REGRA 3: Se o pedido for ambíguo, diga o que faltou perguntar em 1 frase.",
    "REGRA 4: Português do Brasil, curto e acionável.",
  ].join("\n");

  const userMsg = [
    `PEDIDO DO USUÁRIO (obrigatório atender):`,
    promptRaw || `(rotina do agente ${agent.nome}: ${agent.faz})`,
    "",
    `Agente selecionado: ${agent.nome}`,
    "",
    "DADOS DE EVIDÊNCIA (já calculados no servidor):",
    det,
    "",
    kpis.success ? `JSON KPIs: ${JSON.stringify(kpis)}` : "KPIs indisponíveis",
    history?.processo
      ? `Processo: ${JSON.stringify({
          protocolo: history.processo.protocolo_ref,
          cliente: history.processo.cliente_nome,
          status: history.processo.status,
          tribunal: history.processo.tribunal,
        })}`
      : "",
  ].join("\n");

  try {
    const iaPromise = runCascade({
      preferred,
      system,
      messages: [{ role: "user", content: userMsg }],
      temperature: 0.15,
      max_tokens: 1800,
    });
    const timeout = new Promise<{ text?: string; error?: string }>((resolve) =>
      setTimeout(() => resolve({ error: "timeout_ia_50s" }), 50000)
    );
    const res = (await Promise.race([iaPromise, timeout])) as any;

    if (res?.text && !res?.error) {
      logs.push({
        agent_id: agentId,
        tool: "cascade_ia",
        ok: true,
        summary: `engine=${res.engineId || preferred} model=${res.model || "?"}`,
        at: now(),
      });
      return {
        success: true,
        content:
          `## Pedido\n${promptRaw || agent.nome}\n\n` +
          `_Motor: **${res.engineId || preferred}**${res.model ? ` · ${res.model}` : ""}_\n\n` +
          String(res.text).trim(),
        logs,
      };
    }

    try {
      const fb = await Promise.race([
        processChat({
          message: `${system}\n\n${userMsg}`,
          contextType: "legal",
          temperature: 0.15,
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
          summary: `provider=${fb.provider}`,
          at: now(),
        });
        return {
          success: true,
          content:
            `## Pedido\n${promptRaw || agent.nome}\n\n_Motor: **${fb.provider}**_\n\n` +
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

    // IA falhou: ainda assim devolve resposta ao pedido (dados)
    return {
      success: true,
      content: det + "\n\n_IA indisponível; acima está a resposta com dados reais ao seu pedido._",
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
