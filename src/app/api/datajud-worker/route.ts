
/**
 * @fileOverview Worker de Auditoria Automática DataJud v2.1
 * Otimizado para micro-lotes assíncronos com isolamento estrito de empresa.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { NextResponse } from 'next/server';
import { 
  getGlobalPendingProcessesSystem, 
  updateCaseDataJudSystem
} from '@/lib/server-db';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno, detectarEncerradoNoTribunal, gerarHashAuditoria } from '@/lib/datajud-sync';
import { analisarBuscaApreensao } from '@/lib/busca-apreensao';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 5; 
const CONCURRENCY = 2; 
const MAX_RUNTIME_MS = 45000; 

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const empresa_id = searchParams.get('empresa_id');
  
  const authHeader = request.headers.get('Authorization');
  const workerSecret = process.env.DATAJUD_WORKER_SECRET;

  if (!workerSecret || authHeader !== `Bearer ${workerSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!empresa_id) {
    return new Response('Bad Request: empresa_id is required', { status: 400 });
  }

  const start = Date.now();
  console.log(`[DataJud Worker] Lote Empresa ${empresa_id} Iniciado: ${new Date().toLocaleTimeString()}`);

  try {
    const casesToAudit = await getGlobalPendingProcessesSystem(BATCH_SIZE, empresa_id);

    if (casesToAudit.length === 0) {
      return NextResponse.json({ 
        success: true, 
        processed: 0, 
        message: "Fila limpa para esta empresa."
      });
    }

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < casesToAudit.length; i += CONCURRENCY) {
      if (Date.now() - start > MAX_RUNTIME_MS) {
        console.warn("[DataJud Worker] Tempo limite atingido. Interrompendo lote parcialmente.");
        break;
      }

      const chunk = casesToAudit.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (caseItem) => {
        const ok = await auditSingleProcess(caseItem);
        if (ok) successCount++; else failedCount++;
      }));
    }

    return NextResponse.json({ 
      success: true,
      processed: successCount + failedCount, 
      successCount, 
      failedCount,
      duration: `${Date.now() - start}ms`
    });

  } catch (error: any) {
    console.error("[DataJud Worker] Falha Crítica:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function auditSingleProcess(c: any): Promise<boolean> {
  try {
    const dataJud = await fetchDataJud(c.protocolo, 1, { fast: true });

    // Falha em obter movimentos é tratada como erro de auditoria (não audita este CNJ neste ciclo)
    if (!dataJud || dataJud.error || !dataJud.movimentos || dataJud.movimentos.length === 0) return false;

    const movimentos = dataJud.movimentos;
    const enc = detectarEncerradoNoTribunal(movimentos);
    const upd = detectarAtualizacaoPosRetorno(c.ultimoRetorno, movimentos);
    const ba = analisarBuscaApreensao(dataJud);
    const newHash = gerarHashAuditoria(movimentos);

    const patch: any = {
      datajud_ultimo_movimento: upd.dataUltimo,
      datajud_ultimo_nome: upd.nomeUltimo,
      datajud_consultado_em: new Date().toISOString(),
      tem_atualizacao_pos_retorno: !!upd.alerta, // Overwrite estrito (sem OR)
      datajud_encerrado_tribunal: !!enc.encerrado,
      datajud_encerrado_motivo: enc.motivo,
      datajud_hash: newHash,
      indicio_busca_apreensao: !!ba.indicio,
      busca_apreensao_confianca: ba.confianca,
      busca_apreensao_motivo: ba.motivo,
      busca_apreensao_consultado_em: ba.indicio ? new Date().toISOString() : null,
      tribunal: dataJud.tribunal || c.tribunal
    };

    const res = await updateCaseDataJudSystem(c.db_id || c.id, patch);
    return res.success;

  } catch (e) {
    return false;
  }
}
