/**
 * Unidade Neural Lexis — cascata de motores + fallback local.
 * Sem crash por quota/token/constraint.
 */
import { z } from 'zod';
import { buildEngineList, callOpenAICompatible, isQuotaOrAuthError } from '@/lib/ai/cascade';

const SYSTEM_PROMPT = `Você é o suporte estratégico do gabinete (setor processual).
1. Português do Brasil, claro e profissional.
2. Nunca invente fatos processuais.
3. Nunca cite marcas ou nomes de assessoria; use "setor processual" / "nossa equipe".
4. Seja objetivo.`;

const LOCAL_FALLBACK =
  'No momento os motores externos estão indisponíveis. Use as mensagens sugeridas do Motor Lexis (scripts) ou tente novamente em instantes.';

export async function chatAIFlow(input: {
  pergunta: string;
  historico?: any[];
  preferredModel?: string;
}): Promise<{
  resposta: string;
  engineUtilizada: string;
  latencia: number;
  tokensConsumidos: number;
  sucesso: boolean;
}> {
  const userPrompt = String(input.pergunta || '').trim();
  const history = Array.isArray(input.historico) ? input.historico : [];
  const preferred = input.preferredModel || 'xai';

  if (preferred === 'local_only') {
    return {
      resposta: LOCAL_FALLBACK,
      engineUtilizada: 'LOCAL_ONLY',
      latencia: 0,
      tokensConsumidos: 0,
      sucesso: true,
    };
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: String(m.role || 'user'),
      content: String(m.content || m.text || ''),
    })),
    { role: 'user', content: userPrompt },
  ].filter((m) => m.content.trim());

  const engines = buildEngineList(preferred);
  let lastError: any = null;

  for (const engine of engines) {
    try {
      const res = await callOpenAICompatible(engine, messages);
      return {
        resposta: res.text,
        engineUtilizada: res.engineId.toUpperCase(),
        latencia: res.latency,
        tokensConsumidos: res.tokens,
        sucesso: true,
      };
    } catch (e: any) {
      lastError = e;
      console.warn(`[Neural] ${engine.id} falhou:`, e?.message);
      // quota → tenta próximo; outros erros também cascateiam
      continue;
    }
  }

  const detail = lastError?.message || 'Motores em recalibração';
  return {
    resposta: isQuotaOrAuthError(detail)
      ? `${LOCAL_FALLBACK} (motivo: limite/quota do provedor).`
      : `${LOCAL_FALLBACK} (${detail})`,
    engineUtilizada: 'FALLBACK_LOCAL',
    latencia: 0,
    tokensConsumidos: 0,
    sucesso: false,
  };
}

export async function perguntarIA(input: any) {
  try {
    return await chatAIFlow(input);
  } catch (e: any) {
    return {
      resposta: LOCAL_FALLBACK,
      engineUtilizada: 'CATCH_ALL',
      latencia: 0,
      tokensConsumidos: 0,
      sucesso: false,
    };
  }
}
