'use server';

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */

import React from 'react';
import { extrairDadosProcuracao } from '@/ai/flows/document-flow';

/**
 * Motor de Selagem Digital v850.0
 * Configurado para processamento assíncrono em conformidade com Next.js 15.
 */

async function getRenderToBuffer() {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  return renderToBuffer;
}

export async function generateHabilitacaoPecaPDFAction(data: any) {
  try {
    const renderToBuffer = await getRenderToBuffer();
    const { HabilitacaoPecaPDF } = await import('@/components/pdf/habilitacao-peca-pdf');
    const pdfBuffer = await renderToBuffer(React.createElement(HabilitacaoPecaPDF as any, { data }));
    return { success: true, base64: Buffer.from(pdfBuffer).toString('base64') };
  } catch (e: any) {
    console.error("[Selagem] Falha na Habilitação:", e.message || e);
    return { error: "Falha técnica ao selar a Habilitação. Verifique os dados e tente novamente." };
  }
}

export async function generatePecaSubstabelecimentoPDFAction(data: any) {
  try {
    const renderToBuffer = await getRenderToBuffer();
    const { PecaSubstabelecimentoPDF } = await import('@/components/pdf/peca-substabelecimento-pdf');
    const pdfBuffer = await renderToBuffer(React.createElement(PecaSubstabelecimentoPDF as any, { data }));
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
    const pdfBuffer = await renderToBuffer(React.createElement(ProcuracaoPDF as any, { data }));
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
    const pdfBuffer = await renderToBuffer(React.createElement(SubstabelecimentoPDF as any, { data }));
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
    
    // Verificação de tamanho preventivo no servidor (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return { error: "Arquivo excede o limite de 10MB suportado para transcrição forense." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const pdf = (await import('pdf-parse')).default;
    const data = await pdf(buffer);
    
    if (!data.text || data.text.trim().length < 5) {
      return { 
        error: "Este PDF parece conter apenas imagens (Scans). Utilize a ferramenta 'Motor de OCR' para transcrição visual.",
        isScan: true 
      };
    }
    
    return { success: true, text: data.text };
  } catch (e: any) {
    console.error("[OCR Engine] PDF Extraction Fail:", e.message);
    return { error: "Falha na transcrição forense. O arquivo pode estar em um formato incompatível ou protegido." };
  }
}

export async function extrairDadosProcuracaoAction(inputText: string, lawyer: string, state: string) {
  try {
    const res = await extrairDadosProcuracao({ 
      text: inputText, 
      preferredLawyer: lawyer, 
      preferredState: state 
    });
    
    if (!res) {
       return { success: false, error: "TRIAGEM_INDISPONIVEL_TEMPORARIAMENTE" };
    }
    
    return { success: true, ...res };
  } catch (e: any) {
    console.error("Neural Extraction Action Fail:", e);
    return { success: false, error: e.message || "FALHA_NA_TRIAGEM_TECNICA" };
  }
}
