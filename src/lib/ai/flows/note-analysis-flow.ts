
'use server';
/**
 * @fileOverview Motor de Auditoria Operacional Jurídica v2700.0 ELITE
 * Analisa anotações para extrair pontos fortes e riscos detectados.
 * Motor: Grok 4.5.
 * Proprietário: W1 Capital | Fundador: Davi Alves Figueredo
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const API_KEYS = {
  XAI: process.env.XAI_API_KEY,
  AIRFORCE: process.env.AIRFORCE_API_KEY
};

/**
 * Filtro de evidências locais (Regex + Keywords)
 * Executa antes da rede neural para reduzir custo e latência.
 */
export async function analisarEvidenciasLocais(notas: string[]) {
  const pontosFortes: string[] = [];
  const riscosDetectados: string[] = [];

  const textoUnificado = notas.join('\n')
    .replace(/\d{2}\/\d{2}\/\d{4},\s\d{2}:\d{2}:\d{2}/g, '')
    .replace(/(dia\s+)?\d{2}\/\d{2}\/\d{4}/gi, '');

  const linhas = textoUnificado.split('\n')
    .map(l => l.trim().replace(/^-\s*/, ''))
    .filter(l => l.length > 5);

  const keywordsRisco = [
    'falha', 'erro', 'critico', 'crítico', 'atrasado', 'reclamar', 
    'reclame aqui', 'não assinou', 'busca e apreensão', 'vencido', 'problema',
    'negado', 'indeferido', 'extinto', 'atraso', 'urgente'
  ];

  const keywordsForca = [
    'atendido', 'respondido', 'resolvido', 'enviado', 'procurações', 
    'procuração', 'ia criada', 'implementado', 'atualização', 
    'melhoria', 'manutenção', 'ajudando', 'suporte', 'crescimento',
    'vitoria', 'ganhou', 'deferido', 'concedido', 'pago'
  ];

  linhas.forEach(linha => {
    const linhaMinuscula = linha.toLowerCase();
    const ehRisco = keywordsRisco.some(kw => linhaMinuscula.includes(kw));
    const ehForca = keywordsForca.some(kw => linhaMinuscula.includes(kw));

    if (ehRisco) {
      riscosDetectados.push(linha);
    } else if (ehForca) {
      pontosFortes.push(linha);
    }
  });

  return {
    pontosFortes: pontosFortes.length > 0 ? pontosFortes : ["Monitoramento de rotina mantido."],
    riscosDetectados: riscosDetectados.length > 0 ? riscosDetectados : ["Nenhum risco operacional crítico identificado."]
  };
}

const SYSTEM_PROMPT = `Você é um Auditor Operacional Jurídico da W1 Capital.
Analise exclusivamente o relatório de atividades fornecido.
O texto contém registros internos de trabalho, atendimento ao cliente e manutenção.

Ignore completamente:
- datas automáticas repetidas;
- horários gerados pelo sistema;
- palavras como "Note Attachment" ou códigos JSON;
- títulos vazios como "Atualização sem Título".

Sua função é identificar PONTOS FORTES e RISCOS DETECTADOS de forma resumida e executiva.
FOQUE NO STATUS PROCESSUAL E SATISFAÇÃO DO CLIENTE.

RETORNE EXCLUSIVAMENTE JSON PLANO:
{
 "pontosFortes": ["ponto 1", "ponto 2"],
 "riscosDetectados": ["risco 1", "risco 2"]
}`;

function cleanJsonResponse(text: string): any {
  if (!text) return null;
  try {
    let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
    }
    return null;
  } catch { return null; }
}

async function callNeuralEngine(text: string) {
  // Limite de segurança para tokens (aprox 15k caracteres para o prompt)
  const safeText = text.substring(0, 15000);

  try {
    if (!API_KEYS.XAI) throw new Error("XAI_OFFLINE");
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEYS.XAI}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'grok-4.5',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: `RELATÓRIO:\n${safeText}` }],
        response_format: { type: 'json_object' }
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = await res.json();
    return cleanJsonResponse(data?.choices?.[0]?.message?.content);
  } catch (err) {
    console.error("[Auditoria IA] Falha no motor principal, tentando fallback...", err);
    try {
      if (!API_KEYS.AIRFORCE) return null;
      const res = await fetch('https://api.airforce/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEYS.AIRFORCE}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-v3',
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: `RELATÓRIO:\n${safeText}` }]
        }),
        signal: AbortSignal.timeout(30000)
      });
      const data = await res.json();
      return cleanJsonResponse(data?.choices?.[0]?.message?.content);
    } catch (e) { 
      console.error("[Auditoria IA] Todos os motores offline.");
      return null; 
    }
  }
}

export const noteAnalysisFlow = ai.defineFlow(
  { 
    name: 'noteAnalysisFlow', 
    inputSchema: z.object({
      notes: z.array(z.object({
        title: z.string().optional(),
        content: z.string()
      }))
    }), 
    outputSchema: z.any() 
  },
  async (input) => {
    const rawNotes = input.notes.map((n: any) => `${n.title || 'Nota'}: ${n.content}`);
    
    // 1. Auditoria Local (Rápida)
    const localResult = await analisarEvidenciasLocais(rawNotes);
    
    // 2. Auditoria Neural (Profunda) se houver conteúdo suficiente
    const textToAnalyze = rawNotes.join('\n');
    if (textToAnalyze.trim().length > 10) {
      const neuralResult = await callNeuralEngine(textToAnalyze);
      
      if (neuralResult && (neuralResult.pontosFortes?.length || neuralResult.riscosDetectados?.length)) {
        // Mesclar resultados removendo duplicatas e mensagens de fallback "Nenhum..."
        return {
          pontosFortes: Array.from(new Set([...localResult.pontosFortes, ...(neuralResult.pontosFortes || [])]))
            .filter(s => !s.toLowerCase().includes("monitoramento") && !s.toLowerCase().includes("nenhum")),
          riscosDetectados: Array.from(new Set([...localResult.riscosDetectados, ...(neuralResult.riscosDetectados || [])]))
            .filter(s => !s.toLowerCase().includes("nenhum"))
        };
      }
    }

    return localResult;
  }
);

export async function analisarNotasIA(notes: any[]) {
  // Chamada de ponte para o servidor
  return await noteAnalysisFlow({ notes });
}
