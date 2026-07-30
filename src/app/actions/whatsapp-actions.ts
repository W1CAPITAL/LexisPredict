
'use server';

/**
 * @fileOverview Motor de Disparo Programático WhatsApp (Evolution API Elite)
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { sendTextMessage } from '@/lib/evolution-api';
import { getWhatsAppHistory } from '@/lib/server-db';

/**
 * Envia mensagens via Evolution API e atualiza o estado local.
 */
export async function sendWhatsAppAction(to: string, message: string) {
  const cleanPhone = to.replace(/\D/g, '');
  let finalPhone = cleanPhone;
  
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    finalPhone = `55${cleanPhone}`;
  }

  try {
    const result = await sendTextMessage(finalPhone, message);
    return { 
      success: true, 
      data: result,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('[Evolution API] Delivery Failure:', error.message);
    return { 
      success: false, 
      message: error.message || 'Erro ao processar envio via Evolution API' 
    };
  }
}

/**
 * Recupera o histórico de mensagens reais do banco de dados (Supabase).
 * URL: https://segjskjlbeydlljnefai.supabase.co/rest/v1/whatsapp_messages
 */
export async function fetchWhatsAppHistoryAction(phone: string) {
  try {
    const messages = await getWhatsAppHistory(phone);
    return { success: true, messages };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
