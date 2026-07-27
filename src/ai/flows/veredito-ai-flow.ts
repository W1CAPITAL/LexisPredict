
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
  message: z.string().optional()
});

async function callEngineWithRetry(url: string, key: string | undefined, model: string, context: string) {
  if (!key) return null;
  
  try {
    const messages = [
      { role: 'system', content: SYSTEM_INSTRUCTIONS },
      { role: 'user', content: `DADOS DO PROCESSO:\n${context}` }
    ];

    const body: any = { 
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };

    if (url.endsWith('/responses')) {
      body.input = messages;
      body.reasoning_effort = "high";
    } else {
      body.messages = messages;
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
    
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || data?.output?.message?.content || data?.output?.[0]?.text;
    
    if (!content) return null;
    
    let clean = content.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
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
    
    // 1. Coleta DataJud
    const dataJudData = await fetchDataJud(cnj);
    
    // CASO A: Erro crítico de conexão ou Timeout
    if (!dataJudData || dataJudData.error) {
       const isTimeout = dataJudData?.message?.includes("Tempo esgotado");
       return { 
         resumoTecnico: isTimeout ? "Tempo esgotado na triagem do tribunal." : "Falha na coleta de dados oficiais.",
         analiseRisco: "Triagem técnica interrompida por instabilidade na rede nacional.",
         proximosPassos: isTimeout ? "O tribunal demorou a responder. Tente realizar a busca novamente em instantes." : (dataJudData?.message || "Tente novamente ou verifique se o número CNJ possui 20 dígitos."),
         mensagemCliente: "",
         success: false, 
         error: true, 
         message: dataJudData?.message || "Falha na triagem do tribunal.",
         dataJudRaw: dataJudData
       };
    }

    // CASO B: Processo não localizado na base nacional
    if (!dataJudData.movimentos || dataJudData.movimentos.length === 0) {
       return {
         resumoTecnico: "Atenção: Processo sem histórico cronológico detectado.",
         analiseRisco: "Inexistência de dados na base unificada nacional.",
         proximosPassos: "Confirme se o CNJ está correto e se o processo não corre em segredo de justiça absoluto.",
         mensagemCliente: "Setor Processual: No momento, não localizamos atualizações recentes para este protocolo no sistema unificado.",
         success: true,
         error: false,
         message: dataJudData.message || "Processo não localizado.",
         dataJudRaw: dataJudData
       };
    }

    // CASO C: Sucesso com dados reais
    const context = JSON.stringify(dataJudData);
    
    const engines = [
      { id: 'xai', url: 'https://api.x.ai/v1/responses', key: API_KEYS.XAI, model: 'grok-4.5' },
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
      const result = await callEngineWithRetry(engine.url, engine.key, engine.model, context);
      if (result && result.resumoTecnico) {
        return {
          ...result,
          success: true,
          error: false,
          dataJudRaw: dataJudData
        };
      }
    }

    return {
      resumoTecnico: "Falha na análise neural profunda.",
      analiseRisco: "Motores em recalibração.",
      proximosPassos: "Tente alternar o motor de IA ou tente novamente em instantes.",
      mensagemCliente: "",
      success: false,
      error: true,
      message: "Limite de processamento neural atingido ou falha na resposta da IA.",
      dataJudRaw: dataJudData
    };
  }
);

export async function executarVereditoAI(input: any) {
  return await vereditoAIFlow(input);
}
