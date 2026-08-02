/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
'use server';

import { ai, z } from '@/ai/genkit';
import { fetchDataJud } from '@/lib/datajud';

const API_KEYS = {
  XAI: process.env.XAI_API_KEY,
  GROQ: process.env.GROQ_API_KEY
};

const XAI_MODEL = process.env.XAI_MODEL || 'grok-4.5';

const SYSTEM_INSTRUCTIONS = `Você é o Veredito AI Elite v8.0. 
Sua missão é realizar uma Auditoria Técnica de dados processuais e retornar um parecer jurídico rigoroso em JSON.

REGRAS CRÍTICAS DE AUDITORIA (FIDELIDADE DE MÉRITO):
1. NATUREZA DA BAIXA: Nunca diga apenas que o processo "acabou". Identifique se foi Vitória (Procedente), Derrota (Improcedente) ou Falha Técnica (Não Conhecido/Deserto/Cancelado).
2. FALHA TÉCNICA: Detecte especificamente se o recurso foi negado por "falta de preparo", "não recolhimento de custas" ou "ausência de pressupostos". Informe isso claramente.
3. PASSIVO FINANCEIRO: Verifique se houve majoração de honorários de sucumbência (ex: de 10% para 15%). Isso é um passivo para o cliente e deve ser alertado.
4. PRECEDÊNCIA: Se existir "Baixa" ou "Trânsito", mas o histórico anterior for de "Improcedência", o parecer DEVE focar na derrota.
5. RECOMENDAÇÃO: Sempre oriente a conferência no PJe oficial para ritos de custas finais.

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


/** Parecer determinístico a partir dos movimentos — funciona sem API key. */
function analisarDeterministico(dataJudData: any) {
  const movs = Array.isArray(dataJudData?.movimentos) ? [...dataJudData.movimentos] : [];
  movs.sort((a: any, b: any) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime());
  const texto = movs.slice(0, 40).map((m: any) => `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`).join(' || ').toUpperCase();
  const classe = String(dataJudData?.classe || dataJudData?.classeProcessual || '').toUpperCase();

  let merito = 'Em andamento / sem sentença clara nos últimos movimentos.';
  let risco = 'Monitorar próximos atos no tribunal oficial (PJe).';
  let passos = '1) Conferir autos no PJe.\n2) Verificar prazos de recurso ou cumprimento.\n3) Registrar retorno no CRM.';
  let cliente = 'Seu processo está sob monitoramento. Em breve retornamos com orientações.';
  let conclusao = 'Sem encerramento confirmado.';

  const temBaixa = /BAIXA DEFINITIVA|TRÂNSITO EM JULGADO|ARQUIVAMENTO/.test(texto);
  const temImproc = /IMPROCEDENTE|IMPROCEDÊNCIA|NEGADO PROVIMENTO/.test(texto);
  const temProc = /JULGADO PROCEDENTE|JULGADA PROCEDENTE|PROCEDENTE/.test(texto) && !temImproc;
  const temParcial = /PARCIALMENTE PROCEDENTE|PROCEDÊNCIA PARCIAL/.test(texto);
  const temCustas = /CUSTAS|PREPARO|DESERTO|FALTA DE PREPARO/.test(texto);
  const temHonor = /MAJORO|MAJORAÇÃO|HONORÁRIOS.*15%|15%.*HONOR/.test(texto);

  if (temParcial) merito = 'Há indício de sentença parcialmente procedente.';
  else if (temImproc) merito = 'Há indício de sentença/recurso IMPROCEDENTE (derrota no mérito ou recurso).';
  else if (temProc) merito = 'Há indício de sentença PROCEDENTE.';

  if (temBaixa) {
    conclusao = temImproc
      ? 'Baixa/trânsito com histórico de improcedência — provável encerramento desfavorável.'
      : temProc
        ? 'Baixa/trânsito com histórico de procedência — conferir se houve êxito efetivo.'
        : 'Baixa definitiva ou trânsito em julgado detectado no tribunal.';
    passos = '1) Confirmar trânsito e baixa no PJe.\n2) Verificar custas finais e honorários.\n3) Orientar o cliente sobre o desfecho.\n4) Arquivar no CRM após validação.';
    cliente = temImproc
      ? 'Informamos que o processo teve desfecho desfavorável e segue para baixa. Estamos conferindo eventuais custas e próximos passos.'
      : 'Informamos que o processo apresenta baixa/trânsito no tribunal. Estamos validando o desfecho e retornamos com a orientação completa.';
  }

  if (temCustas) {
    risco = (risco + ' Atenção: há menção a custas/preparo — risco de ônus ou deserção.').trim();
  }
  if (temHonor) {
    risco = (risco + ' Possível majoração de honorários de sucumbência — passivo financeiro.').trim();
  }

  const ultimos = movs.slice(0, 8).map((m: any) => {
    const d = m.dataHora ? new Date(m.dataHora).toLocaleDateString('pt-BR') : 'S/D';
    return `- ${d}: ${m.nome || 'Movimento'}${m.complemento ? ' — ' + m.complemento : ''}`;
  }).join('\n');

  return {
    resumoTecnico: `Classe: ${classe || 'N/D'}\n${merito}\n\nÚltimos movimentos:\n${ultimos || 'Sem movimentos.'}`,
    analiseRisco: risco,
    proximosPassos: passos,
    mensagemCliente: cliente,
    conclusaoEncerramento: conclusao,
    success: true,
    isDeterministic: true,
    engineUsed: 'local-deterministico',
    dataJudRaw: dataJudData,
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
    
    const dataJudData = await fetchDataJud(cnj);

    if (!dataJudData || dataJudData.error) {
       return { 
         resumoTecnico: "Não localizado no DataJud.",
         analiseRisco: "Informação indisponível no CNJ.",
         proximosPassos: "Consulte o PJe oficial.",
         mensagemCliente: "",
         success: false, 
         error: true, 
         message: dataJudData?.message || "Erro de rede.",
         dataJudRaw: dataJudData
       };
    }

    // Sem API key: parecer determinístico completo (sempre útil)
    if (!API_KEYS.XAI && !API_KEYS.GROQ) {
       return analisarDeterministico(dataJudData);
    }

    const movementsContext = dataJudData.movimentos
      .sort((a: any, b: any) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime())
      .slice(0, 30)
      .map((m: any) => `- ${m.dataHora ? new Date(m.dataHora).toLocaleDateString() : 'S/D'}: ${m.nome} | ${m.complemento || ''}`)
      .join('\n');

    const compactContext = `
      NÚMERO: ${dataJudData.numeroProcesso}
      CLASSE: ${dataJudData.classe}
      CRONOLOGIA RECENTE:
      ${movementsContext}
    `;
    
    const engines = [
      { id: 'xai', url: 'https://api.x.ai/v1/chat/completions', key: API_KEYS.XAI, model: XAI_MODEL },
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

    // IA offline/falhou → parecer determinístico a partir do DataJud
    return analisarDeterministico(dataJudData);
  }
);

export async function executarVereditoAI(input: any) {
  return await vereditoAIFlow(input);
}
