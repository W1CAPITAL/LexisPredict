/**
 * Superfícies Claude (OmniRoute) — PDF DJEN, dossiê, relatório, auditoria 3D, OCR, WhatsApp.
 * Só chama API quando o caller passa enabled/useClaude = true.
 */
import { runCascade } from '@/lib/ai/cascade';

export type ClaudeSurface =
  | 'djen_pdf'
  | 'dossie'
  | 'relatorio'
  | 'audit3d'
  | 'ocr'
  | 'whatsapp'
  | 'custas'
  | 'scan';

function labelEngine(engineId: string, model: string) {
  const e = `${engineId}:${model}`.toLowerCase();
  if (e.includes('omni') || e.includes('claude') || e.includes('anthropic')) {
    return 'Claude AI (OmniRoute)';
  }
  return `${engineId}${model ? ` / ${model}` : ''}`;
}

export type ClaudeSurfaceResult = {
  text: string;
  engineLabel: string;
  engineId: string;
  model: string;
  logLine: string;
};

const SYSTEMS: Record<ClaudeSurface, string> = {
  djen_pdf: `Você é analista forense de diário oficial (DJEN).
Explique a publicação em português claro (5–8 linhas): o que o juízo comunicou, prazos, custas/guias, BA só se mandado real, efeito prático para o gabinete.
Não invente valores nem decisões de mérito ausentes no texto.
Inicie com a linha: "Análise Claude AI:"`,

  dossie: `Você é analista de gabinete jurídico.
Resuma risco operacional do processo (5–10 linhas): status real, cumprimento, mérito se houver, custas, BA só se vinculada ao CNJ, prioridade e próximo passo interno.
Sem inventar. Inicie com "Análise Claude AI:"`,

  relatorio: `Você é auditor operacional de carteira.
Em 6–12 linhas: riscos críticos, baixas, cumprimento, custas em aberto, BA reais, prioridades da fila.
Tom institucional. Inicie com "Análise Claude AI — Relatório:"`,

  audit3d: `Você audita a cronologia DataJud + DJEN.
Liste o que é relevante agora, o que está encerrado, cumprimento, mérito, custas, e se sobe na fila crítica.
Resposta objetiva em tópicos. Inicie com "Claude AI — Auditoria 3D:"`,

  ocr: `Você organiza texto de OCR de peça judicial brasileira.
Corrija ruído óbvio, extraia: partes, CNJ se houver, juízo, pedidos, valores, prazos.
Não invente. Inicie com "Claude AI — OCR:"`,

  whatsapp: `Você redige mensagem WhatsApp curta e profissional para cliente de assessoria financeira/jurídica.
Máx. 800 caracteres, sem juridiquês excessivo, sem inventar resultado de processo.
Inicie com o texto da mensagem (sem prefixo longo).`,

  custas: `Você classifica custas processuais no texto DJEN/DataJud.
Indique se há guia gerada, intimação para recolher, valor se explícito, prazo se houver.
JSON opcional no fim. Inicie com "Claude AI — Custas:"`,

  scan: `Classifique andamentos processuais (DataJud/DJEN) com flags precisas.`,
};

/**
 * Chama Claude via cascade (OmniRoute prioritário).
 * Retorna null se disabled ou sem conteúdo.
 */
export async function runClaudeSurface(opts: {
  surface: ClaudeSurface;
  content: string;
  enabled?: boolean;
  preferred?: string;
  maxTokens?: number;
  extraSystem?: string;
}): Promise<ClaudeSurfaceResult | null> {
  if (opts.enabled === false) return null;
  const content = String(opts.content || '').trim();
  if (content.length < 20) return null;

  const system = [SYSTEMS[opts.surface], opts.extraSystem].filter(Boolean).join('\n\n');
  const preferred = opts.preferred || process.env.SCAN_AI_PREFERRED || 'claude';

  try {
    const r = await runCascade({
      preferred,
      forceEngineId: preferred === 'auto' ? undefined : preferred,
      surface: opts.surface === 'scan' ? 'scan' : opts.surface,
      system,
      messages: [{ role: 'user', content: content.slice(0, 14000) }],
      temperature: 0.15,
      max_tokens: opts.maxTokens ?? 700,
    });

    const engineLabel = labelEngine(r.engineId, r.model);
    const text = (r.text || '').trim();
    if (!text) return null;

    return {
      text,
      engineLabel,
      engineId: r.engineId,
      model: r.model,
      logLine: `[${engineLabel}] ${text.slice(0, 180).replace(/\s+/g, ' ')}…`,
    };
  } catch (e: any) {
    return {
      text: `Claude AI indisponível: ${e?.message || e}`,
      engineLabel: 'Claude AI (falha)',
      engineId: 'error',
      model: '',
      logLine: `[Claude AI] falha: ${e?.message || e}`,
    };
  }
}

/** Explicação de publicação DJEN para PDF */
export async function explainDjenWithClaude(
  data: {
    texto?: string;
    teor?: string;
    processo?: string;
    tribunal?: string;
    nomeParte?: string;
    dataDisponibilizacao?: string;
  },
  enabled = true
) {
  const body = [
    `Processo: ${data.processo || '—'}`,
    `Tribunal: ${data.tribunal || '—'}`,
    `Parte: ${data.nomeParte || '—'}`,
    `Disponibilização: ${data.dataDisponibilizacao || '—'}`,
    `Teor:\n${(data.texto || data.teor || '').slice(0, 10000)}`,
  ].join('\n');
  return runClaudeSurface({ surface: 'djen_pdf', content: body, enabled });
}

/** Parecer curto para dossiê / relatório / audit */
export async function analyzeCaseWithClaude(
  blob: string,
  surface: 'dossie' | 'relatorio' | 'audit3d' | 'custas' = 'dossie',
  enabled = true
) {
  return runClaudeSurface({ surface, content: blob, enabled });
}

/** Pós-OCR */
export async function structureOcrWithClaude(ocrText: string, enabled = true) {
  return runClaudeSurface({ surface: 'ocr', content: ocrText, enabled, maxTokens: 900 });
}

/** Mensagem WhatsApp */
export async function draftWhatsAppWithClaude(
  context: string,
  enabled = true
) {
  return runClaudeSurface({ surface: 'whatsapp', content: context, enabled, maxTokens: 400 });
}
