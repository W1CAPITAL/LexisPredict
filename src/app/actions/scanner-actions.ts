'use server';

/**
 * @fileOverview Server Actions do Módulo Process Scanner v1.0
 * Ponte de execução entre a UI soberana e o serviço MNI.
 */

import { ScannerService } from '@/modules/process-scanner/services/scanner-service';
import { getUserContext, getStoredCases } from '@/lib/server-db';

export async function startFullScannerJobAction() {
  const { empresa_id } = await getUserContext();
  
  if (!empresa_id) {
    return { success: false, error: "401_SESSAO_EXPIRADA" };
  }

  try {
    // Recupera CNJs para o lote inicial
    const cases = await getStoredCases();
    const cnjs = cases.map(c => c.protocolo).filter(p => p.length >= 20);

    if (cnjs.length === 0) {
      return { success: true, processed: 0, message: "Nenhum CNJ válido para processamento." };
    }

    const scanner = new ScannerService();
    const results = await scanner.scanLote(cnjs, empresa_id);

    return { 
      success: true, 
      processed: results.length,
      results: results.filter(Boolean),
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("[Scanner Action Fail]", error.message);
    return { success: false, error: error.message };
  }
}
