
/**
 * @fileOverview Worker de Auditoria Automática DataJud v1.1
 * Realiza varredura incremental de processos em background (servidor).
 * Otimizado para rito industrial de merge e preservação de dados humanos.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { NextResponse } from 'next/server';
import { 
  getGlobalPendingProcessesSystem, 
  updateCaseDataJudSystem,
  getSupabaseAdmin
} from '@/lib/server-db';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno, detectarEncerradoNoTribunal, gerarHashAuditoria } from '@/lib/datajud-sync';
import { analisarBuscaApreensao } from '@/lib/busca-apreensao';

export const dynamic = 'force-dynamic';

// Configurações de Carga Industrial
const BATCH_SIZE = 15; 
const CONCURRENCY = 2;

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const workerSecret = process.env.DATAJUD_WORKER_SECRET;

  // 1. Validação de Segurança (Bearer Token)
  if (!workerSecret || authHeader !== `Bearer ${workerSecret}`) {
    return new Response('Unauthorized: Token de Gabinete Inválido', { status: 401 });
  }

  try {
    const start = Date.now();
    
    // 2. Seleção de Fila por Prioridade de Carência
    // Prioriza processos nunca consultados ou com a auditoria mais antiga.
    const casesToAudit = await getGlobalPendingProcessesSystem(BATCH_SIZE);

    if (casesToAudit.length === 0) {
      return NextResponse.json({ processed: 0, message: "Sem processos ativos pendentes no momento." });
    }

    let successCount = 0;
    let failedCount = 0;

    // 3. Processamento com Pool de Concorrência 2 (Respeito aos limites do CNJ)
    for (let i = 0; i < casesToAudit.length; i += CONCURRENCY) {
      const chunk = casesToAudit.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (caseItem) => {
        const ok = await auditSingleProcess(caseItem);
        if (ok) successCount++; else failedCount++;
      }));
    }

    // 4. Estimativa de Trabalho Restante (Contagem heads de ativos)
    const admin = await getSupabaseAdmin();
    const { count } = await admin
      .from('processos')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '("ENCERRADO","Arquivado","EXTINTO","SUSPENSO","IMOVEL","IMÓVEL")');

    return NextResponse.json({ 
      processed: casesToAudit.length, 
      success: successCount, 
      failed: failedCount,
      remainingEstimate: (count || 0),
      duration: `${Date.now() - start}ms`
    });

  } catch (error: any) {
    console.error("[DataJud Worker] Falha Crítica na Operação:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Realiza o ciclo de auditoria de um único processo sem sobrescrever dados humanos.
 * PROTOCOLO DE MERGE INCREMENTAL v1.1
 */
async function auditSingleProcess(c: any): Promise<boolean> {
  try {
    // Fast Mode habilitado para o Worker (Economia de tempo de CPU e rede)
    const dataJud = await fetchDataJud(c.protocolo, 1, { fast: true });

    if (!dataJud || dataJud.error) return false;

    const movimentos = dataJud.movimentos || [];
    const enc = detectarEncerradoNoTribunal(movimentos);
    const upd = detectarAtualizacaoPosRetorno(c.ultimoRetorno, movimentos);
    const ba = analisarBuscaApreensao(dataJud);
    const newHash = gerarHashAuditoria(movimentos);

    // LÓGICA DE ALERTA: 
    // Se mudou o hash OU o tribunal disparou alerta, marcamos como novidade.
    // Mas se o processo foi ENCERRADO no tribunal, desativamos o alerta de novidade
    // para limpar a fila de tarefas do operador automaticamente.
    let novoStatusNovidade = c.tem_atualizacao_pos_retorno || !!upd.alerta || newHash !== c.datajud_hash;
    
    if (enc.encerrado) {
      novoStatusNovidade = false;
    }

    const patch: any = {
      datajud_ultimo_movimento: upd.dataUltimo,
      datajud_ultimo_nome: upd.nomeUltimo,
      datajud_consultado_em: new Date().toISOString(),
      tem_atualizacao_pos_retorno: novoStatusNovidade,
      datajud_encerrado_tribunal: !!enc.encerrado,
      datajud_encerrado_motivo: enc.motivo,
      datajud_hash: newHash,
      indicio_busca_apreensao: !!ba.indicio,
      busca_apreensao_confianca: ba.confianca,
      busca_apreensao_motivo: ba.motivo,
      busca_apreensao_consultado_em: ba.indicio ? new Date().toISOString() : null,
      tribunal: dataJud.tribunal || c.tribunal
    };

    // Chamada atômica de update (Merge por cima do blob 'dados')
    const res = await updateCaseDataJudSystem(c.db_id || c.id, patch);
    return res.success;

  } catch (e) {
    return false;
  }
}
