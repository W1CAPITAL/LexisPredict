
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

const SYSTEM_INSTRUCTIONS = `Você é o Veredito AI Elite v6.0. 
Sua missão é realizar uma Auditoria Técnica 3D de dados processuais e retornar um parecer jurídico rigoroso em JSON.

REGRAS DE PARECER:
1. Resumo Técnico: Máximo 6 linhas focadas no status atual. Seja específico sobre a fase (Ex: Recursal, Executiva, Conclusos).
2. Análise de Risco: Identifique vulnerabilidades (Ex: prazos, sucumbência, revelia).
3. Próximos Passos: Defina a estratégia operacional clara para o advogado.
4. Mensagem Cliente: Redija um texto profissional e empático para WhatsApp, assinado pelo Setor Processual.
5. Conclusão de Encerramento: Uma análise narrativa (máximo 3 linhas) justificando a probabilidade de fim do processo.

IMPORTANTE: Se houver "Trânsito em Julgado", "Baixa Definitiva" ou "Arquivamento", o processo está ENCERRADO. Nunca diga que está em instrução nestes casos.

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
  const allText = sortedMovs.slice(0, 15).map((m: any) => m.nome).join(' ').toUpperCase();
  
  let resumo = `Parecer gerado via triagem técnica local. Tribunal: ${data.tribunal}. Classe: ${data.classe}.`;
  let risco = "Monitoramento operacional de rotina mantido.";
  let steps = "Continuar acompanhando publicações oficiais no diário e prazos do tribunal.";
  let statusFim = "Processo em andamento regular.";

  // Regras de Precedência Crítica
  if (allText.includes('TRÂNSITO EM JULGADO') || allText.includes('TRANSITO EM JULGADO') || allText.includes('BAIXA DEFINITIVA') || allText.includes('ARQUIVADO DEFINITIVAMENTE')) {
    resumo += " PROCESSO FINALIZADO. Identificado trânsito em julgado ou baixa definitiva.";
    risco = "Nenhum risco processual ativo (Feito encerrado).";
    steps = "Realizar o arquivamento interno no sistema LexisPredict e conferir eventuais custas pendentes.";
    statusFim = "Processo encerrado com trânsito em julgado.";
  } else if (allText.includes('ACORDO') || allText.includes('HOMOLOGAÇÃO DE ACORDO') || allText.includes('HOMOLOGACAO')) {
    resumo += " Composição amigável identificada entre as partes.";
    risco = "Risco de descumprimento de parcelas se houver cronograma de pagamento.";
    steps = "Acompanhar a quitação das obrigações e o arquivamento do feito.";
    statusFim = "Processo em fase de encerramento por acordo.";
  } else if (allText.includes('IMPROCEDENTE')) {
    resumo += " Sentença de improcedência prolatada em primeiro grau.";
    risco = "ALTO. Risco de sucumbência e encerramento desfavorável.";
    steps = "Avaliar fundamentos da sentença para interposição de Recurso de Apelação.";
    statusFim = "Decisão desfavorável de mérito atiginda.";
  } else if (allText.includes('PROCEDENTE')) {
    resumo += " Sentença de procedência identificada.";
    risco = "Risco de recurso pela parte contrária (Banco).";
    steps = "Aguardar prazo recursal ou iniciar fase de cumprimento de sentença.";
    statusFim = "Vitória de mérito atingida em primeiro grau.";
  } else if (allText.includes('CONCLUSOS PARA SENTENÇA') || allText.includes('PARA JULGAMENTO')) {
    resumo += " Processo aguardando decisão final do magistrado.";
    risco = "Expectativa de julgamento iminente.";
    steps = "Acompanhar diariamente a publicação da sentença.";
    statusFim = "Fase decisória de mérito atingida.";
  }

  return {
    resumoTecnico: `[MODO TÉCNICO LOCAL] ${resumo}`,
    analiseRisco: risco,
    proximosPassos: steps,
    mensagemCliente: `Setor Processual: Olá! Informamos que seu processo teve uma nova atualização intitulada "${lastMov}". Nossa equipe já está realizando a conferência técnica.`,
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
      { role: 'user', content: `DADOS DO PROCESSO PARA AUDITORIA:\n${context}` }
    ];

    const body: any = { 
      model,
      messages,
      temperature: 0.2,
      max_tokens: 2000
    };

    // Especialização para xAI (Grok)
    if (url.includes('x.ai')) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${key}`, 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000)
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[AI FAIL] ${model} Status ${res.status}:`, err);
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return content ? cleanJsonResponse(content) : null;
  } catch (e: any) {
    console.error(`[AI ERROR] ${model}: ${e.message}`);
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
    const dataJudData = await fetchDataJud(cnj);
    
    if (!dataJudData || dataJudData.error) {
       return { 
         resumoTecnico: "Falha na conexão com o tribunal.",
         analiseRisco: "Sistema indisponível.",
         proximosPassos: "Tente novamente.",
         mensagemCliente: "",
         success: false, 
         error: true, 
         message: dataJudData?.message || "Erro de rede no DataJud.",
         dataJudRaw: dataJudData
       };
    }

    // Preparação de Contexto (Obrigatório para evitar alucinação)
    const movementsContext = dataJudData.movimentos
      .sort((a: any, b: any) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime())
      .slice(0, 20)
      .map((m: any) => `- ${m.dataHora ? new Date(m.dataHora).toLocaleDateString() : 'S/D'}: ${m.nome}`)
      .join('\n');

    const compactContext = `
      NÚMERO: ${dataJudData.numeroProcesso}
      TRIBUNAL: ${dataJudData.tribunal}
      CLASSE: ${dataJudData.classe}
      CRONOLOGIA RECENTE:
      ${movementsContext}
    `;
    
    const engines = [
      { id: 'xai', url: 'https://api.x.ai/v1/chat/completions', key: API_KEYS.XAI, model: 'grok-4.5' },
      { id: 'airforce', url: 'https://api.airforce/v1/chat/completions', key: API_KEYS.AIRFORCE, model: 'deepseek-v3' },
      { id: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: API_KEYS.GROQ, model: 'llama-3.3-70b-versatile' }
    ];

    const prioritized = [...engines];
    const idx = prioritized.findIndex(e => e.id === preferredModel);
    if (idx > -1) {
      const [fav] = prioritized.splice(idx, 1);
      prioritized.unshift(fav);
    }

    // 1. Tentativa via IA Real
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

    // 2. Fallback Determinístico (Se IA falhar mas houver dados)
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
