
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
'use server';

import { ai, z } from '@/ai/genkit';
import { fetchDataJud } from '@/lib/datajud';

const API_KEYS = {
  XAI: process.env.XAI_API_KEY,
  AIRFORCE: process.env.AIRFORCE_API_KEY,
  GROQ: process.env.GROQ_API_KEY
};

const XAI_MODEL = process.env.XAI_MODEL || 'grok-2-1212';

const SYSTEM_INSTRUCTIONS = `Você é o Veredito AI Elite v7.0. 
Sua missão é realizar uma Auditoria Técnica de dados processuais e retornar um parecer jurídico rigoroso em JSON.

REGRAS CRÍTICAS DE AUDITORIA:
1. Baseie-se APENAS nos movimentos fornecidos. Nunca invente andamentos ou fases.
2. PRECEDÊNCIA DE ENCERRAMENTO: Se existir "Trânsito em Julgado", "Baixa Definitiva", "Arquivado Definitivamente", "Extinto" ou "Definitivo" nos movimentos, o processo está ENCERRADO. Nunca diga que está em instrução ou andamento intermediário nestes casos.
3. MÉRITO: Diferencie "Improcedente" (derrota) de "Procedente" (vitória).
4. RECURSO: Se houver "Provimento" em 2º grau, identifique a reforma da sentença.
5. RECOMENDAÇÃO: Se o processo estiver em fase final, inclua sempre: "Conferir no PJe/Site do Tribunal eventuais custas pendentes ou petições recentes não listadas no DataJud".

FORMATO JSON OBRIGATÓRIO:
{ 
  "resumoTecnico": "string", 
  "analiseRisco": "string", 
  "proximosPassos": "string", 
  "mensagemCliente": "string",
  "conclusaoEncerramento": "string"
 }`;

const VereditoInputSchema = z.object({
  cnj: z.string(),
  preferredModel: z.string().optional()
});

const VereditoOutputSchema = z.object({
  resumoTecnico: z.string(),
  analiseRisco: z.string(),
  proximosPassos: z.string(),
  mensagemCliente: z.string(),
  conclusaoEncerramento: z.string().optional(),
  success: z.boolean(),
  dataJudRaw: z.any().optional(),
  error: z.boolean().optional(),
  message: z.string().optional(),
  isDeterministic: z.boolean().optional(),
  engineUsed: z.string().optional()
});

function cleanJsonResponse(text: string): any {
  if (!text) return null;
  try {
    let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      const jsonContent = clean.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonContent);
      if (parsed.resumoTecnico) return parsed;
    }
    return null;
  } catch { return null; }
}

/**
 * Motor Determinístico Avançado (Fallback de Segurança)
 */
function gerarParecerDeterministico(data: any) {
  const movs = data.movimentos || [];
  const sortedMovs = [...movs].sort((a, b) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime());
  const lastMov = (sortedMovs[0]?.nome || "Sem andamento recente").toUpperCase();
  const allText = sortedMovs.slice(0, 25).map((m: any) => m.nome).join(' ').toUpperCase();
  
  let resumo = `Parecer gerado via triagem técnica local (Regras de Gabinete). Tribunal: ${data.tribunal}.`;
  let risco = "Monitoramento operacional de rotina mantido.";
  let steps = "Continuar acompanhando publicações oficiais e conferir o site do tribunal (PJe) para verificar petições recentes.";
  let statusFim = "Processo em andamento regular.";

  // Detecção de Encerramento (Case-insensitive via uppercase)
  const isFinalizado = /(TRÂNSITO EM JULGADO|TRANSITO EM JULGADO|BAIXA DEFINITIVA|ARQUIVADO DEFINITIVAMENTE|DEFINITIVO|EXTINTO|EXTINÇÃO)/.test(allText);

  if (isFinalizado) {
    resumo += " PROCESSO ENCERRADO/BAIXADO. Identificado rito de finalização definitiva nos autos.";
    risco = "Nenhum risco processual ativo (Feito encerrado).";
    steps = "Realizar o arquivamento interno e conferir no PJe eventuais custas finais ou diligências pendentes de baixa.";
    statusFim = "Processo encerrado com trânsito em julgado/baixa.";
  } else if (allText.includes('ACORDO') || allText.includes('HOMOLOGAÇÃO')) {
    resumo += " Composição amigável (Acordo) identificada entre as partes.";
    risco = "Risco de descumprimento de prazos de pagamento se houver parcelamento.";
    steps = "Acompanhar a quitação das obrigações e o arquivamento posterior.";
    statusFim = "Processo em fase de encerramento por acordo.";
  } else if (allText.includes('IMPROCEDENTE') || allText.includes('IMPROCEDÊNCIA')) {
    resumo += " Sentença de improcedência (derrota) prolatada.";
    risco = "ALTO. Risco de sucumbência e encerramento desfavorável.";
    steps = "Avaliar fundamentos da decisão no PJe para interposição de Recurso.";
    statusFim = "Decisão desfavorável de mérito atingida.";
  } else if (allText.includes('PROCEDENTE')) {
    resumo += " Sentença de procedência (vitória) identificada.";
    risco = "Risco de recurso pela parte contrária.";
    steps = "Aguardar prazo recursal ou iniciar cumprimento de sentença.";
    statusFim = "Vitória de mérito atingida em primeiro grau.";
  }

  return {
    resumoTecnico: `[MODO TÉCNICO LOCAL] ${resumo}`,
    analiseRisco: risco,
    proximosPassos: steps,
    mensagemCliente: `Setor Processual: Olá! Informamos que seu processo teve uma nova atualização intitulada "${lastMov}". Nossa equipe já está realizando a conferência técnica detalhada.`,
    conclusaoEncerramento: statusFim,
    success: true,
    isDeterministic: true
  };
}

async function callEngineWithRetry(url: string, key: string | undefined, model: string, context: string) {
  if (!key) return null;
  
  try {
    const messages = [
      { role: 'system', content: SYSTEM_INSTRUCTIONS },
      { role: 'user', content: `DADOS DO PROCESSO PARA AUDITORIA (DATAJUD):\n${context}` }
    ];

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.1 }),
      signal: AbortSignal.timeout(45000)
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return content ? cleanJsonResponse(content) : null;
  } catch (e: any) {
    return null;
  }
}

export const vereditoAIFlow = ai.defineFlow(
  { 
    name: 'vereditoAIFlow', 
    inputSchema: VereditoInputSchema, 
    outputSchema: VereditoOutputSchema 
  },
  async input => {
    const { cnj, preferredModel = 'xai' } = input;
    
    if (!API_KEYS.XAI && !API_KEYS.GROQ && !API_KEYS.AIRFORCE) {
       return { 
         resumoTecnico: "Nenhuma API key configurada no servidor (XAI_API_KEY/GROQ_API_KEY).",
         analiseRisco: "Motores offline.",
         proximosPassos: "Configure as variáveis de ambiente.",
         mensagemCliente: "",
         success: false, 
         error: true 
       };
    }

    const dataJudData = await fetchDataJud(cnj);
    
    if (!dataJudData || dataJudData.error) {
       return { 
         resumoTecnico: "Não localizado na base pública DataJud.",
         analiseRisco: "Informação indisponível no sistema unificado do CNJ no momento.",
         proximosPassos: "Consulte diretamente o site do tribunal (PJe/e-SAJ) para obter o status atual.",
         mensagemCliente: "",
         success: false, 
         error: true, 
         message: dataJudData?.message || "Erro de rede no DataJud.",
         dataJudRaw: dataJudData
       };
    }

    const movementsContext = dataJudData.movimentos
      .sort((a: any, b: any) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime())
      .slice(0, 25)
      .map((m: any) => `- ${m.dataHora ? new Date(m.dataHora).toLocaleDateString() : 'S/D'}: ${m.nome}`)
      .join('\n');

    const compactContext = `
      NÚMERO: ${dataJudData.numeroProcesso}
      TRIBUNAL: ${dataJudData.tribunal}
      CLASSE: ${dataJudData.classe}
      CRONOLOGIA RECENTE (ÚLTIMOS 25 MOVIMENTOS):
      ${movementsContext}
    `;
    
    const engines = [
      { id: 'xai', url: 'https://api.x.ai/v1/chat/completions', key: API_KEYS.XAI, model: XAI_MODEL },
      { id: 'airforce', url: 'https://api.airforce/v1/chat/completions', key: API_KEYS.AIRFORCE, model: 'deepseek-v3' },
      { id: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: API_KEYS.GROQ, model: 'llama-3.3-70b-versatile' }
    ];

    const prioritized = [...engines];
    const idx = prioritized.findIndex(e => e.id === preferredModel);
    if (idx > -1) {
      const [fav] = prioritized.splice(idx, 1);
      prioritized.unshift(fav);
    }

    for (const engine of prioritized) {
      if (!engine.key) continue;
      const result = await callEngineWithRetry(engine.url, engine.key, engine.model, compactContext);
      if (result) {
        return {
          ...result,
          success: true,
          error: false,
          dataJudRaw: dataJudData,
          isDeterministic: false,
          engineUsed: engine.id.toUpperCase()
        };
      }
    }

    const deterministicResult = gerarParecerDeterministico(dataJudData);
    return {
      ...deterministicResult,
      dataJudRaw: dataJudData,
      engineUsed: "DETERMINISTIC_CORE"
    };
  }
);

export async function executarVereditoAI(input: any) {
  return await vereditoAIFlow(input);
}
