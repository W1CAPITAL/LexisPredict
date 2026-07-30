
'use server';

/**
 * @fileOverview Motor de Transcrição e OCR Soberano v1.0
 * Camada de ações dedicada para extração de dados sem mexer nas ações de documentos.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { documentFlow } from '@/ai/flows/document-flow';

/**
 * Realiza a extração neural baseada no Protocolo Soberano GET.
 */
export async function extrairDadosSoberanosAction(inputText: string, htmlContent?: string) {
  try {
    const res = await documentFlow({ 
      text: inputText, 
      html: htmlContent 
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
