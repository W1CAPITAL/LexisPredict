"use server";

/**
 * Assistente operacional — motores selecionáveis + consulta CNJ (DataJud + DJEN).
 */
import { extractCnjFromText } from "@/lib/ai/motors";
import { callOpenAICompatible, buildEngineList } from "@/lib/ai/cascade";

async function tryScanCnj(protocolo: string): Promise<{
  ok: boolean;
  brief: string;
  raw?: any;
}> {
  try {
    // import dinâmico para não quebrar se action mudar de path
    const mod = await import("@/app/actions/case-actions");
    const scan =
      (mod as any).scanSingleCaseAction ||
      (mod as any).scanCaseAction ||
      null;
    if (!scan) {
      return { ok: false, brief: "Função de varredura não disponível neste deploy." };
    }
    const res = await scan(protocolo, { mode: "both" });
    if (!res?.success && !res?.case) {
      return { ok: false, brief: res?.error || "Falha ao consultar tribunal." };
    }
    const c = res.case || {};
    const movs = (res.movimentos || []).slice(0, 8);
    const djen = (res.comunicacoes || res.djenComunicacoes || []).slice(0, 5);
    const lines = [
      `CNJ: ${c.protocolo || protocolo}`,
      `Cliente: ${c.cliente || "—"}`,
      `Evento unificado: ${c.evento_tipo || "—"} | ${c.evento_resumo || "—"}`,
      `Flags: novo=${!!c.tem_novo_andamento} BA=${!!c.indicio_busca_apreensao} baixaTJ=${!!c.datajud_encerrado_tribunal} cumprimento=${!!c.em_cumprimento_sentenca}`,
      `Último retorno CRM: ${c.ultimoRetorno || "—"}`,
      "Movimentos recentes (DataJud):",
      ...movs.map(
        (m: any) =>
          `- ${m.dataHora || m.data || ""} | ${m.nome || m.movimento || ""} ${m.complemento || ""}`
      ),
      djen.length ? "Publicações DJEN:" : "",
      ...djen.map((d: any) => {
        const txt = String(d.texto || d.conteudo || d.resumo || "").slice(0, 280);
        return `- ${d.data_disponibilizacao || d.data || ""} | ${txt}`;
      }),
    ].filter(Boolean);
    return { ok: true, brief: lines.join("\n"), raw: res };
  } catch (e: any) {
    return { ok: false, brief: e?.message || "Erro na varredura CNJ." };
  }
}

export async function perguntarChatbotIndependente(
  pergunta: string,
  historico: { role: string; content: string }[] = [],
  preferredModel: string = "xai"
) {
  const cnj = extractCnjFromText(pergunta);
  let processContext = "";
  if (cnj) {
    const scanned = await tryScanCnj(cnj);
    processContext = scanned.ok
      ? `\n\n[DADOS REAIS DO TRIBUNAL — DataJud + DJEN]\n${scanned.brief}\n[/DADOS]`
      : `\n\n[AVISO] Não foi possível enriquecer o CNJ ${cnj}: ${scanned.brief}`;
  }

  if (preferredModel === "local_only") {
    return {
      sucesso: true,
      resposta: cnj
        ? `Consulta local (sem API). CNJ detectado: ${cnj}.${processContext}\n\nUse a aba Processos/Tarefas para scripts ao cliente. Ative xAI/Groq em Configurações para redação por IA.`
        : "Motor local ativo: faça perguntas com o número CNJ para eu puxar DataJud/DJEN, ou selecione xAI/Groq em Configurações.",
      engineUtilizada: "LOCAL",
    };
  }

  if (preferredModel === "puter") {
    return {
      sucesso: false,
      resposta:
        "O motor Puter roda no navegador (User-Pays). Selecione xAI/Groq/OpenRouter no seletor, ou use Puter pelo botão client-side.",
      engineUtilizada: "PUTER_CLIENT_ONLY",
    };
  }

  const system = `Você é o assistente operacional do LexisPredict (gabinete).
- Responda em português do Brasil, objetivo.
- Se houver bloco [DADOS REAIS DO TRIBUNAL], baseie-se nele; não invente andamentos.
- Não cite marcas de assessoria; use "setor processual".
- Para mensagem ao cliente, seja prudente (sem prometer resultado).
- Se não houver dados de tribunal e a pergunta for sobre um processo específico, peça o CNJ.`;

  const messages = [
    { role: "system", content: system },
    ...historico.slice(-12).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })),
    {
      role: "user",
      content: `${pergunta}${processContext}`,
    },
  ];

  const engines = buildEngineList(preferredModel);
  let lastErr = "nenhum motor";
  for (const eng of engines) {
    try {
      const res = await callOpenAICompatible(eng, messages, { temperature: 0.45, max_tokens: 2048 });
      return {
        sucesso: true,
        resposta: res.text,
        engineUtilizada: res.engineId.toUpperCase(),
      };
    } catch (e: any) {
      lastErr = e?.message || String(e);
      continue;
    }
  }

  return {
    sucesso: false,
    resposta: `Motores indisponíveis (${lastErr}).${processContext ? "\n\nMesmo assim, dados do tribunal:\n" + processContext : ""}`,
    engineUtilizada: "FALLBACK",
  };
}
