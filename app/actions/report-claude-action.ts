'use server';

/**
 * Parecer Claude AI para relatório / dossiê operacional agregado.
 * Obrigatório: useClaude sempre true. Sem fallback local para o texto oficial.
 */

export type RelatorioClaudeInput = {
  /** Texto consolidado: métricas + top críticos + BA + cumprimento + mérito */
  resumoCarteira: string;
  /** Ignorado — Claude sempre ativo neste endpoint */
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

function isClaudeUnavailable(text: string, engineId?: string): boolean {
  const t = (text || '').toLowerCase();
  const e = (engineId || '').toLowerCase();
  if (e === 'error') return true;
  if (t.includes('claude ai indisponível')) return true;
  if (t.includes('motor claude indisponível')) return true;
  if (t.includes('http 404') || t.includes('http 402')) return true;
  if (t.includes('no active credentials') || t.includes('configure anthropic')) return true;
  return false;
}

export async function generateRelatorioClaudeAction(
  input: RelatorioClaudeInput
): Promise<RelatorioClaudeResult> {
  const blob = String(input?.resumoCarteira || '').trim();
  if (blob.length < 40) {
    return {
      success: false,
      error: 'Resumo da carteira insuficiente para gerar o parecer Claude.',
    };
  }

  try {
    const { runClaudeSurface } = await import('@/lib/ai/claude-surfaces');

    const r = await runClaudeSurface({
      surface: 'relatorio',
      content: blob.slice(0, 14000),
      enabled: true,
      preferred: 'claude',
      maxTokens: 1600,
      extraSystem: `Você redige o parecer oficial do DOSSIÊ OPERACIONAL LexisPredict.
Use apenas os números e nomes fornecidos no resumo.
Estruture em tópicos curtos:
1) Situação geral da carteira
2) Riscos críticos (prazos, BA, andamentos)
3) Mérito (procedente/improcedente/cumprimento) quando houver contagem
4) Prioridades de ação para o gabinete nas próximas 24–48h
Não invente processos. Se faltar dado, diga o que falta.
Inicie com: "Análise Claude AI — Relatório:"`,
    });

    if (!r || !String(r.text || '').trim()) {
      return {
        success: false,
        error:
          'Claude sem resposta. Configure Anthropic no painel OmniRoute (Providers) e OMNIROUTE_BASE_URL no Vercel.',
        engineLabel: r?.engineLabel,
      };
    }

    const text = r.text.trim();
    if (isClaudeUnavailable(text, r.engineId)) {
      return {
        success: false,
        error:
          text.slice(0, 400) ||
          'Claude indisponível (404/402). Configure Anthropic no painel OmniRoute (Providers).',
        engineLabel: r.engineLabel,
      };
    }

    console.info('[relatorio-claude]', r.logLine);
    return {
      success: true,
      texto: text,
      engineLabel: r.engineLabel || 'Claude AI (OmniRoute)',
      logLine: r.logLine,
    };
  } catch (e: any) {
    const msg = e?.message || 'Falha Claude';
    return {
      success: false,
      error: `${msg}. Se for 404/402: configure Anthropic no painel OmniRoute (Providers).`,
    };
  }
}
