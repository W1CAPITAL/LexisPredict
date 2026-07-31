
'use server';

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */

import React from 'react';
import { extrairDadosProcuracao } from '@/ai/flows/document-flow';

/**
 * Motor de Selagem Digital v9.0
 * Unificação de extração e resiliência de parsing.
 */

async function getRenderToBuffer() {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  return renderToBuffer;
}

export async function generateSubstabelecimentoSimplesPDFAction(data: any) {
  try {
    const renderToBuffer = await getRenderToBuffer();
    const { SubstabelecimentoSimplesPDF } = await import('@/components/pdf/substabelecimento-simples-pdf');
    const element = React.createElement(SubstabelecimentoSimplesPDF as any, { data }) as any;
    const pdfBuffer = await renderToBuffer(element);
    return { success: true, base64: Buffer.from(pdfBuffer).toString('base64') };
  } catch (e: any) {
    console.error("[Selagem] Falha no Substabelecimento Simples:", e.message || e);
    return { error: "Falha técnica ao selar o Substabelecimento Simples." };
  }
}

export async function generateHabilitacaoPecaPDFAction(data: any) {
  try {
    const renderToBuffer = await getRenderToBuffer();
    const { HabilitacaoPecaPDF } = await import('@/components/pdf/habilitacao-peca-pdf');
    const element = React.createElement(HabilitacaoPecaPDF as any, { data }) as any;
    const pdfBuffer = await renderToBuffer(element);
    return { success: true, base64: Buffer.from(pdfBuffer).toString('base64') };
  } catch (e: any) {
    console.error("[Selagem] Falha na Habilitação:", e.message || e);
    return { error: "Falha técnica ao selar a Habilitação." };
  }
}

export async function generatePecaSubstabelecimentoPDFAction(data: any) {
  try {
    const renderToBuffer = await getRenderToBuffer();
    const { PecaSubstabelecimentoPDF } = await import('@/components/pdf/peca-substabelecimento-pdf');
    const element = React.createElement(PecaSubstabelecimentoPDF as any, { data }) as any;
    const pdfBuffer = await renderToBuffer(element);
    return { success: true, base64: Buffer.from(pdfBuffer).toString('base64') };
  } catch (e: any) {
    console.error("[Selagem] Falha na Peça Substabelecimento:", e.message || e);
    return { error: "Falha técnica ao selar a Peça de Substabelecimento." };
  }
}

export async function generateProcuracaoPDFAction(data: any) {
  try {
    const renderToBuffer = await getRenderToBuffer();
    const { ProcuracaoPDF } = await import('@/components/pdf/procuracao-pdf');
    const element = React.createElement(ProcuracaoPDF as any, { data }) as any;
    const pdfBuffer = await renderToBuffer(element);
    return { success: true, base64: Buffer.from(pdfBuffer).toString('base64') };
  } catch (e: any) {
    console.error("[Selagem] Falha na Procuração:", e.message || e);
    return { error: "Falha técnica ao selar o PDF da Procuração." };
  }
}

export async function generateSubstabelecimentoPDFAction(data: any) {
  try {
    const renderToBuffer = await getRenderToBuffer();
    const { SubstabelecimentoPDF } = await import('@/components/pdf/substabelecimento-pdf');
    const element = React.createElement(SubstabelecimentoPDF as any, { data }) as any;
    const pdfBuffer = await renderToBuffer(element);
    return { success: true, base64: Buffer.from(pdfBuffer).toString('base64') };
  } catch (e: any) {
    console.error("[Selagem] Falha no Substabelecimento:", e.message || e);
    return { error: "Falha técnica ao selar o PDF do Substabelecimento." };
  }
}

export async function extrairTextoDoPDFAction(formData: FormData) {
  try {
    const file = formData.get('pdf') as File;
    if (!file) return { error: "Nenhum arquivo enviado" };
    
    // Unificação de Lógica: Extensão Soberana
    const fileNameLower = file.name.toLowerCase();
    const isPdf = fileNameLower.endsWith('.pdf');
    const isText = fileNameLower.endsWith('.txt') || fileNameLower.endsWith('.md');

    if (!isPdf && !isText) {
      return { error: `Formato não suportado: ${file.name}. Use .pdf, .txt ou .md.` };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let extractedText = "";

    if (isPdf) {
      try {
        const pdf = (await import('pdf-parse')).default;
        const data = await pdf(buffer);
        extractedText = data.text || "";
      } catch (pdfErr: any) {
        // Bloqueio de lixo binário em documentos corrompidos
        return { error: `Erro estrutural no PDF: ${pdfErr.message}. Tente salvar novamente o PDF ou envie em formato .txt.` };
      }
    } else {
      extractedText = buffer.toString('utf-8');
    }

    if (!extractedText || extractedText.trim().length < 5) {
      return { error: "Não foi possível extrair texto útil deste arquivo." };
    }

    return { success: true, text: extractedText };
  } catch (e: any) {
    return { error: e.message || "Erro desconhecido na extração." };
  }
}

export async function extrairDadosProcuracaoAction(inputText: string, lawyer: string, state: string) {
  try {
    const res = await extrairDadosProcuracao({ text: inputText, preferredLawyer: lawyer, preferredState: state });
    if (!res) return { success: false, error: "TRIAGEM_INDISPONIVEL" };
    return { success: true, ...res };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
