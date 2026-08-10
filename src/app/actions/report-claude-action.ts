'use server';

/**
 * Parecer de IA para relatório / dossiê operacional.
 * Preferência Claude, mas se faltar token/quota → xAI → Groq → OpenRouter → …
 */

export type RelatorioClaudeInput = {
  resumoCarteira: string;
  useClaude?: boolean;
};

export type RelatorioClaudeResult =
  | {
      success: true;
      texto: string;
      engineLabel: string;
      logLine?: string;
    }
  | {
      success: false;
      error: string;
      engineLabel?: string;
    };

function isUnavailable(text: string, engineId?: string): boolean {
  const t = (text || '').toLowerCase();
  const e = (engineId || '').toLowerCase();
  if (e === 'error') return true;
  if (t.includes('claude ai indisponível') || t.includes('motor claude indisponível')) return true;
  if (t.includes('http 404') || t.includes('http 402') || t.includes('http 429')) return true;
  if (t.includes('no active credentials') || t.includes('configure anthropic')) return true;
  if (t.includes('quota') || t.includes('credit') || t.includes('insufficient')) return true;
  return false;
}

export async function generateRelatorioClaudeAction(
  input: RelatorioClaudeInput
): Promise<RelatorioClaudeResult> {
  const blob = String(input?.resumoCarteira || '').trim();
  if (blob.length < 40) {
    return {
      success: false,
      error: 'Resumo da carteira insuficiente para gerar o parecer.',
    };
  }

  const extraSystem = `Você redige o parecer oficial do DOSSIÊ OPERACIONAL LexisPredict.
Use apenas os números e nomes fornecidos no resumo.
Estruture em tópicos curtos:
1) Situação geral da carteira
2) Riscos críticos (prazos, BA, andamentos)
3) Mérito (procedente/improcedente/cumprimento) quando houver contagem
4) Prioridades de ação para o gabinete nas próximas 24–48h
Não invente processos. Se faltar dado, diga o que falta.
Inicie com: "Análise operacional — Relatório:"`;

  try {
    const { runClaudeSurface } = await import('@/lib/ai/claude-surfaces');
    const { runCascade } = await import('@/lib/ai/cascade');

    // 1) Claude-first (com fallback interno na surface)
    let r = await runClaudeSurface({
      surface: 'relatorio',
      content: blob.slice(0, 14000),
      enabled: true,
      preferred: 'claude',
      maxTokens: 1600,
      extraSystem,
    });

    if (r && String(r.text || '').trim() && !isUnavailable(r.text, r.engineId)) {
      console.info('[relatorio-ia]', r.logLine);
      return {
        success: true,
        texto: r.text.trim(),
        engineLabel: r.engineLabel || 'IA',
        logLine: r.logLine,
      };
    }

    // 2) Cascata aberta: qualquer motor com chave
    const cascade = await runCascade({
      preferred: 'auto',
      forceEngineId: undefined,
      system: extraSystem,
      messages: [{ role: 'user', content: blob.slice(0, 14000) }],
      temperature: 0.2,
      max_tokens: 1600,
    });

    const text = (cascade.text || '').trim();
    if (!text || isUnavailable(text, cascade.engineId)) {
      return {
        success: false,
        error:
          'Nenhum motor de IA disponível no momento (Claude sem crédito e demais falharam). Tente de novo ou configure GROQ_API_KEY / XAI / OPENROUTER.',
        engineLabel: cascade.engineId,
      };
    }

    const engineLabel = `${cascade.engineId}${cascade.model ? ` / ${cascade.model}` : ''}`;
    return {
      success: true,
      texto: text,
      engineLabel,
      logLine: `[${engineLabel}] parecer gerado via fallback`,
    };
  } catch (e: any) {
    return {
      success: false,
      error: `${e?.message || 'Falha IA'}. Configure ao menos um motor (Claude, Groq, xAI ou OpenRouter).`,
    };
  }
}
