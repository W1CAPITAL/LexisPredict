'use server';
/**
 * @fileOverview Motor de Extração de Dados Jurídicos v800.0 ELITE
 * Estratégia: Fatiamento de Contexto para evitar Erro de Buffer e Fallback Quaternário.
 * Proprietário: W1 Capital | Fundador: Davi Alves Figueredo
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BANCA_DATA = {
  "DIEGO GOMES DIAS": {
    oabs: { "BA": "77510/BA", "CE": "52996-A/CE", "MT": "34044-A/MT", "PI": "22858/PI", "RN": "21766A/RN", "SP": "370.898/SP" },
    endereco: "Av. São Miguel, nº 4810 – Jardim Cotinha – São Paulo – SP – CEP: 03870-100",
    email: "diego_gomesdias@yahoo.com.br",
    genero: "M"
  },
  "LETICIA ALVES GODOY DA CRUZ": {
    oabs: { "TO": "12.528-A/TO", "AC": "6572/AC", "RS": "131831A/RS", "PB": "31888 A/PB", "PA": "36417-A/PA", "SP": "490.641/SP" },
    endereco: "Rua Amazonas, nº 439 – Sala 20/28 – Centro – São Caetano do Sul – SP – CEP: 09520-070",
    email: "leticiagodoy.adv@gmail.com",
    genero: "F"
  },
  "PABLO MATHEUS SILVA BASTOS PEREIRA": {
    oabs: { "SP": "520783/SP", "RN": "520783/SP", "PI": "520783/SP", "MT": "520783/SP", "CE": "520783/SP", "BA": "520783/SP", "MG": "249550/MG", "SC": "520783/SP", "ES": "520783/SP", "MS": "520783/SP", "PR": "520783/PR" },
    endereco: "Rua Amazonas, nº 439 – Sala 20/28 – Centro – São Caetano do Sul – SP – CEP: 09520-071",
    email: "pablobastos@adv.oabsp.org.br",
    genero: "M"
  },
  "INGRID MICHAELLY TELES PACHECO OLIVEIRA ALVES": {
    oabs: { "MA": "490.641/SP", "RO": "13.438/RO", "AP": "5.819-A/AP", "SE": "1.601A/SE", "RR": "844-A/RR", "GO": "70699/GO", "SP": "490.641/SP" },
    endereco: "Rua Amazonas, nº 439 – Sala 20/28 – Centro – São Caetano do Sul – SP – CEP: 09520-070",
    email: "pachecoingrid.adv@gmail.com",
    genero: "F"
  },
  "LUCAS DOS SANTOS DE JESUS": {
    oabs: { "DF": "78116/DF", "AL": "21512A/AL", "AM": "A2373/AM", "PE": "66465/PE", "RJ": "261767/RJ", "SP": "520783/SP" },
    endereco: "Rua Amazonas, nº 439 – Sala 20/28 – Centro – São Caetano do Sul – SP – CEP: 09520-070",
    email: "lucassj.adv01@gmail.com",
    genero: "M"
  }
};

const API_KEYS = {
  XAI: process.env.XAI_API_KEY || process.env.GROK_API_KEY || '',
  AIRFORCE: process.env.AIRFORCE_API_KEY || '',
  GROQ: process.env.GROQ_API_KEY || ''
};

const SYSTEM_PROMPT = `Você é o Arquiteto Jurídico da W1 Capital. Extraia os dados do contrato.
RETORNE APENAS JSON PLANO. Sem markdown.
{
  "cliente": { "nome": "", "estadoCivil": "", "profissao": "", "rg": "", "cpf": "", "endereco": "", "email": "", "genero": "M"|"F" },
  "processos": [{ "banco": "", "cnpjBanco": "", "numero": "", "acao": "AÇÃO DE REVISÃO CONTRATUAL COM PEDIDO DE TUTELA DE URGÊNCIA", "estado": "UF" }]
}`;

function cleanJsonResponse(text: string): any {
  if (!text) return null;
  try {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    }
    return null;
  } catch (e) { return null; }
}

async function fetchWithTimeout(url: string, options: any, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    return null;
  }
}

async function callXAI(text: string) {
  const res = await fetchWithTimeout('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEYS.XAI}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grok-4.5',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: `CONTRATO: ${text}` }],
      response_format: { type: 'json_object' }
    })
  }, 10000);
  if (!res?.ok) return null;
  const data = await res.json();
  return cleanJsonResponse(data?.choices?.[0]?.message?.content);
}

async function callAirforce(text: string) {
  const res = await fetchWithTimeout('https://api.airforce/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEYS.AIRFORCE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-v3',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: `CONTRATO: ${text}` }]
    })
  }, 10000);
  if (!res?.ok) return null;
  const data = await res.json();
  return cleanJsonResponse(data?.choices?.[0]?.message?.content);
}

async function callGroq(text: string) {
  const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEYS.GROQ}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: `CONTRATO: ${text}` }],
      response_format: { type: 'json_object' }
    })
  }, 10000);
  if (!res?.ok) return null;
  const data = await res.json();
  return cleanJsonResponse(data?.choices?.[0]?.message?.content);
}

export const documentFlow = ai.defineFlow(
  { name: 'documentFlow', inputSchema: z.any(), outputSchema: z.any() },
  async (input) => {
    // BLINDAGEM DE BUFFER: Fatiar contrato para evitar erro de serialização
    const slicedText = (input.text || "").substring(0, 6000);
    
    let parsed: any = null;
    const engines = [
      { id: 'xai', call: callXAI },
      { id: 'airforce', call: callAirforce },
      { id: 'grok', call: callGroq }
    ];

    const pref = input.preferredModel || 'xai';
    const sorted = [engines.find(e => e.id === pref) || engines[0], ...engines.filter(e => e.id !== pref)].filter(Boolean);

    for (const engine of sorted) {
      console.log(`[DocumentFlow] Tentando motor: ${engine!.id.toUpperCase()}`);
      try {
        parsed = await engine!.call(slicedText);
        if (parsed && (parsed.cliente || parsed.processos)) break;
      } catch (e) { continue; }
    }

    if (!parsed) return { error: true, code: "SISTEMA_INDISPONIVEL" };

    const targetLawyer = input.preferredLawyer || "PABLO MATHEUS SILVA BASTOS PEREIRA";
    const lawyerInfo = (BANCA_DATA as any)[targetLawyer] || BANCA_DATA["PABLO MATHEUS SILVA BASTOS PEREIRA"];
    const processosArray = Array.isArray(parsed.processos) ? parsed.processos : parsed.processo ? [parsed.processo] : [];
    const finalState = (input.preferredState || processosArray[0]?.estado || "SP").toUpperCase();
    const selectedOAB = (lawyerInfo.oabs as any)[finalState] || (lawyerInfo.oabs as any)["SP"];

    return {
      cliente: {
        nome: (parsed.cliente?.nome || "NÃO IDENTIFICADO").toUpperCase(),
        estadoCivil: parsed.cliente?.estadoCivil || "casado(a)",
        profissao: parsed.cliente?.profissao || "autônomo(a)",
        rg: parsed.cliente?.rg || "---",
        cpf: parsed.cliente?.cpf || "---",
        endereco: parsed.cliente?.endereco || "Não localizado",
        email: parsed.cliente?.email || "",
        genero: parsed.cliente?.genero || 'M',
      },
      advogado: {
        nome: targetLawyer.toUpperCase(),
        oab: selectedOAB,
        endereco: lawyerInfo.endereco,
        email: lawyerInfo.email,
        cargo: lawyerInfo.genero === 'F' ? 'advogada' : 'advogado',
      },
      processos: processosArray.map((p: any) => ({
        banco: (p.banco || "BANCO").toUpperCase(),
        cnpjBanco: p.cnpjBanco || '',
        numero: p.numero || "S/N",
        acao: p.acao || 'AÇÃO DE REVISÃO CONTRATUAL COM PEDIDO DE TUTELA DE URGÊNCIA',
        estado: finalState
      }))
    };
  }
);

export async function extrairDadosProcuracao(input: any) {
  return await documentFlow(input);
}
