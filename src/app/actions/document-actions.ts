'use server';

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */

import React from 'react';
import { extrairDadosProcuracao } from '@/ai/flows/document-flow';
import { extractTextResilient } from './knowledge-actions';

/**
 * Motor de Selagem Digital v9.5
 * Unificação de extração e resiliência de parsing.
 */

async function getRenderToBuffer() {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  return renderToBuffer;
}

export async function generateDjenPublicationPDFAction(data: any) {
  try {
    const renderToBuffer = await getRenderToBuffer();
    const { DjenPublicationPDF } = await import('@/components/pdf/djen-publication-pdf');

    // Claude AI explica a publicação (opt-in: data.useClaude !== false se texto houver)
    let analiseClaude: string | null = data?.analiseClaude || null;
    let claudeEngine: string | null = null;
    const wantClaude = data?.useClaude !== false && !!(data?.texto || data?.teor);
    if (wantClaude && !analiseClaude) {
      try {
        const { explainDjenWithClaude } = await import('@/lib/ai/claude-surfaces');
        const r = await explainDjenWithClaude(
          {
            texto: data.texto || data.teor,
            processo: data.protocolo || data.processo,
            tribunal: data.tribunal || data.orgao,
            nomeParte: data.cliente || data.nomeParte,
            dataDisponibilizacao: data.data,
          },
          true
        );
        if (r) {
          analiseClaude = r.text;
          claudeEngine = r.engineLabel;
          console.info('[DJEN-PDF]', r.logLine);
        }
      } catch (e: any) {
        analiseClaude = `Claude AI indisponível: ${e?.message || e}`;
      }
    }

    const payload = { ...data, analiseClaude, claudeEngine };
    const element = React.createElement(DjenPublicationPDF as any, { data: payload }) as any;
    const pdfBuffer = await renderToBuffer(element);
    return {
      success: true,
      base64: Buffer.from(pdfBuffer).toString('base64'),
      analiseClaude,
      claudeEngine,
    };
  } catch (e: any) {
    console.error("[Selagem] Falha no PDF DJEN:", e.message || e);
    return { error: "Falha técnica ao selar a publicação do Diário." };
  }
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
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Reutiliza o motor resiliente de extração unificado
    const extractedText = await extractTextResilient(buffer, file.name);

    return { success: true, text: extractedText };
  } catch (e: any) {
    return { error: e.message || "Erro desconhecido na extração técnica." };
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