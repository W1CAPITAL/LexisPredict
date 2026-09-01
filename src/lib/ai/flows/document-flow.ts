/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const API_KEYS = {
  XAI: process.env.XAI_API_KEY,
  GROQ: process.env.GROQ_API_KEY
};

const SYSTEM_PROMPT = `Você é o Arquiteto Jurídico Sênior Elite da W1 Capital. 
Sua missão é extrair dados de QUALQUER documento jurídico, contrato ou lead fornecido.

REGRAS DE EXTRAÇÃO UNIVERSAL:
1. IDENTIDADE: Capture nome completo, CPF e RG. Se o nome estiver colado com a data de nascimento, separe-os.
2. LOCALIZAÇÃO: Extraia o endereço residencial completo do contratante/outorgante.
3. CONTATO: Localize e-mails e números de telefone no texto.
4. BANCO E PROCESSO: Identifique a Instituição Financeira envolvida e o número do processo (CNJ) se disponível.
5. Retorne EXCLUSIVAMENTE um JSON plano no formato:
{
  "cliente": { "nome": "", "cpf": "", "rg": "", "endereco": "", "cep": "", "dataNascimento": "", "email": "", "telefone": "", "estadoCivil": "", "profissao": "", "nacionalidade": "" },
  "processos": [{ "banco": "", "cnpjBanco": "", "numero": "", "acao": "", "estado": "" }]
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

function dumbExtract(text: string) {
  const cpfMatch = text.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/) || text.match(/\d{11}/);
  const rgMatch = text.match(/\d{1,2}\.?\d{3}\.?\d{3}-?[\dX]/i) || text.match(/\d{7,10}/);
  const dateMatch = text.match(/\d{2}\/\d{2}\/\d{4}/);
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/\(\d{2}\)\s?\d{4,5}-\d{4}/) || text.match(/\d{2}\s?\d{8,9}/);
  const bankMatch = text.match(/(?:Banco|Instituição|Reu):\s*([^\n\r]*)/i);
  
  const lines = text.split('\n').map(l => l.trim());
  let nome = "REVISAR DADOS";
  let endereco = "REVISAR MANUALMENTE";
  let dataNasc = dateMatch ? dateMatch[0] : "";

  for (const line of lines) {
    if (line.length > 10 && !line.includes('|') && !line.includes('http') && !line.includes(':')) {
      nome = line.split(/\d/)[0].trim().toUpperCase();
      break;
    }
  }

  for (const line of lines) {
    if ((line.toUpperCase().includes('RUA') || line.toUpperCase().includes('AV')) && line.includes(',')) {
      endereco = line.toUpperCase();
      break;
    }
  }

  return {
    cliente: { 
      nome: nome, 
      cpf: cpfMatch ? cpfMatch[0] : "---", 
      rg: rgMatch ? rgMatch[0] : "---", 
      endereco: endereco, 
      dataNascimento: dataNasc,
      email: emailMatch ? emailMatch[0] : "",
      telefone: phoneMatch ? phoneMatch[0] : "",
      estadoCivil: '', // não normaliza — operador edita no painel
      profissao: "Autônomo(a)",
      nacionalidade: "brasileiro(a)"
    },
    processos: [{ 
      banco: bankMatch ? bankMatch[1].trim() : "BANCO", 
      numero: text.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/)?.[0] || "S/N", 
      acao: "AÇÃO DE REVISÃO CONTRATUAL COM PEDIDO DE TUTELA DE URGÊNCIA",
      cnpjBanco: "00.000.000/0000-00",
      estado: "SP"
    }]
  };
}

async function callNeuralEngine(text: string) {
  const engines = [
    { id: 'xai-grok', url: 'https://api.x.ai/v1/responses', key: API_KEYS.XAI, model: 'grok-4.5' },
    { id: 'groq-llama', url: 'https://api.groq.com/openai/v1/chat/completions', key: API_KEYS.GROQ, model: 'llama-3.3-70b-versatile' }
  ];

  for (const engine of engines) {
    if (!engine.key) continue;
    try {
      const isResponses = engine.url.endsWith('/responses');
      const messages = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: `TEXTO DO DOCUMENTO:\n${text}` }];
      
      const body: any = { model: engine.model, temperature: 0.1 };
      if (isResponses) {
        body.input = messages;
        body.reasoning_effort = "high";
      } else {
        body.messages = messages;
      }

      const res = await fetch(engine.url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${engine.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000)
      });
      
      if (!res.ok) continue;
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || data?.output?.message?.content || data?.output?.[0]?.text;
      const parsed = cleanJsonResponse(content);
      if (parsed) return parsed;
    } catch { continue; }
  }
  return null;
}

export const documentFlow = ai.defineFlow(
  { name: 'documentFlow', inputSchema: z.any(), outputSchema: z.any() },
  async (input) => {
    const text = (input.text || "").substring(0, 30000);
    let parsed = await callNeuralEngine(text);
    if (!parsed) parsed = dumbExtract(text);
    return parsed;
  }
);

export async function extrairDadosProcuracao(input: any) {
  return await documentFlow(input);
}
