
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

const SYSTEM_INSTRUCTIONS = `Você é o Veredito AI Elite v5.0. 
Sua missão é realizar uma Auditoria 3D de dados processuais e retornar um parecer rigoroso em JSON.

REGRAS DE PARECER:
1. Resumo Técnico: Máximo 6 linhas focadas no status atual.
2. Análise de Risco: Identifique vulnerabilidades imediatas.
3. Próximos Passos: Defina a estratégia operacional para o advogado.
4. Mensagem Cliente: Redija um texto profissional para WhatsApp, assinado pelo Setor Processual.
5. Conclusão de Encerramento: Uma análise narrativa (máximo 3 linhas) justificando se o processo está perto do fim ou não, baseada na fase processual.

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
  isDeterministic: z.boolean().optional()
});

/**
 * Limpeza profunda de resposta JSON para lidar com motores instáveis
 */
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
 * Motor de Fallback Determinístico: Gera parecer a partir dos dados se a IA falhar
 */
function gerarParecerDeterministico(data: any) {
  const movs = data.movimentos || [];
  const sortedMovs = [...movs].sort((a, b) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime());
  const lastMov = sortedMovs[0]?.nome || "Sem andamento recente";
  const tribunal = data.tribunal || "Tribunal";
  const classe = data.classe || "Ação";
  
  let risco = "Monitoramento operacional de rotina mantido.";
  let steps = "Continuar acompanhando publicações oficiais e prazos do tribunal.";
  let statusFim = "Processo em fase de instrução/andamento regular.";

  const text = sortedMovs.slice(0, 8).map((m: any) => m.nome).join(' ').toUpperCase();
  
  if (text.includes('IMPROCEDENTE') || text.includes('IMPROCEDENCIA')) {
    risco = "Decisão de improcedência identificada. Risco de sucumbência.";
    steps = "Avaliar fundamentos da sentença para Recurso de Apelação.";
    statusFim = "Processo atingiu fase de mérito desfavorável em 1º grau.";
  } else if (text.includes('PROCEDENTE') || text.includes('PROCEDENCIA')) {
    risco = "Resultado favorável de mérito.";
    steps = "Aguardar trânsito em julgado ou fase de cumprimento.";
    statusFim = "Processo em fase avançada com vitória de mérito.";
  } else if (text.includes('EXTINTO') || text.includes('INDEFERIDO') || text.includes('EXTINCAO')) {
    risco = "Extinção prematura do feito ou indeferimento detectado.";
    steps = "Analisar motivo da extinção para sanar vícios ou recorrer.";
    statusFim = "Processo encerrado ou interrompido.";
  } else if (text.includes('SENTENÇA') || text.includes('SENTENCA')) {
    risco = "Sentença prolatada. Atenção aos prazos recursais.";
    steps = "Leitura técnica da sentença e contato imediato com o cliente.";
    statusFim = "Fase decisória de primeiro grau atingida.";
  } else if (text.includes('EMENDA')) {
    risco = "Necessidade de regularização da petição inicial.";
    steps = "Protocolar emenda atendendo aos requisitos do juiz.";
    statusFim = "Fase inicial de saneamento.";
  } else if (text.includes('ACORDO') || text.includes('HOMOLOG')) {
    risco = "Negociação ou acordo em andamento/homologado.";
    steps = "Verificar termos do acordo e quitação de parcelas.";
    statusFim = "Processo em vias de encerramento por composição.";
  }

  return {
    resumoTecnico: `[MODO SEGURO] Parecer gerado via triagem local. Tribunal: ${tribunal}. Classe: ${classe}. Último andamento registrado: "${lastMov}".`,
    analiseRisco: risco,
    proximosPassos: steps,
    mensagemCliente: `Setor Processual: Olá! Informamos que seu processo teve uma nova movimentação intitulada "${lastMov}". Nossa equipe técnica já está realizando a conferência.`,
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
      { role: 'user', content: `DADOS DO PROCESSO:\n${context}` }
    ];

    const isResponsesEndpoint = url.endsWith('/responses');
    
    const body: any = { 
      model,
      temperature: isResponsesEndpoint ? undefined : 0.1,
      max_tokens: 2048
    };

    if (isResponsesEndpoint) {
      body.input = messages;
      if (model === 'grok-4.5') body.reasoning_effort = "high";
    } else {
      body.messages = messages;
      if (url.includes('x.ai')) {
        body.response_format = { type: 'json_object' };
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${key}`, 
        'Content-Type': 'application/json',
        'User-Agent': 'LexisPredict-Elite/1.1'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000)
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error(`[AI Engine Fail] ${model}: ${res.status}`, errData);
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || 
                    data?.output?.message?.content || 
                    (Array.isArray(data?.output) ? data?.output?.[0]?.text : null) ||
                    data?.message?.content;
    
    if (!content) return null;
    
    return cleanJsonResponse(content);
  } catch (e: any) {
    console.error(`[AI Engine Error] ${model}: ${e.message}`);
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
    
    // 1. Coleta DataJud (Fonte de Verdade)
    const dataJudData = await fetchDataJud(cnj);
    
    if (!dataJudData || dataJudData.error) {
       return { 
         resumoTecnico: "Falha técnica na triagem nacional.",
         analiseRisco: "Instabilidade nos servidores do tribunal ou rede indisponível.",
         proximosPassos: dataJudData?.message || "Tente realizar a busca novamente em alguns instantes.",
         mensagemCliente: "",
         success: false, 
         error: true, 
         message: dataJudData?.message || "Falha na triagem do tribunal.",
         dataJudRaw: dataJudData
       };
    }

    if (!dataJudData.movimentos || dataJudData.movimentos.length === 0) {
       return {
         resumoTecnico: "Protocolo localizado, porém sem histórico cronológico na base unificada.",
         analiseRisco: "Processo pode estar sob segredo de justiça absoluto ou recém-distribuído.",
         proximosPassos: "Confirme o número CNJ. Se correto, o processo pode ainda não ter movimentos públicos indexados.",
         mensagemCliente: "Setor Processual: No momento, não localizamos atualizações públicas para este protocolo no sistema nacional.",
         success: true,
         error: false,
         message: dataJudData.message || "Processo sem movimentos.",
         dataJudRaw: dataJudData
       };
    }

    // 2. Preparação de Contexto Compacto (Redução de Custo e Erro)
    const sortedMovs = [...dataJudData.movimentos]
      .sort((a, b) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime())
      .slice(0, 20)
      .map(m => ({
        d: m.dataHora ? new Date(m.dataHora).toLocaleDateString('pt-BR') : 'S/D',
        n: m.nome
      }));

    const compactContext = JSON.stringify({
      n: dataJudData.numeroProcesso,
      c: dataJudData.classe,
      t: dataJudData.tribunal,
      m: sortedMovs
    });
    
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

    // 3. Orquestração Neural com Fallback
    for (const engine of prioritized) {
      if (!engine.key) continue;
      const result = await callEngineWithRetry(engine.url, engine.key, engine.model, compactContext);
      if (result && result.resumoTecnico) {
        return {
          ...result,
          success: true,
          error: false,
          dataJudRaw: dataJudData,
          isDeterministic: false
        };
      }
    }

    // 4. Última Instância: Fallback Deterministico Soberano
    const deterministicResult = gerarParecerDeterministico(dataJudData);
    return {
      ...deterministicResult,
      dataJudRaw: dataJudData
    };
  }
);

export async function executarVereditoAI(input: any) {
  return await vereditoAIFlow(input);
}
