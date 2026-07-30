
/**
 * @fileOverview Worker de Auditoria Automática DataJud v1.4
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

// Configuração de Lote Estratégico (Pequeno para garantir resposta rápida ao navegador)
const BATCH_SIZE = 10; 
const CONCURRENCY = 2;

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const workerSecret = process.env.DATAJUD_WORKER_SECRET;

  if (!workerSecret || authHeader !== `Bearer ${workerSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  console.log(`[DataJud Worker] Lote Iniciado: ${new Date().toLocaleTimeString()}`);

  try {
    const start = Date.now();
    
    // 2. Seleção de Fila por Carência
    const casesToAudit = await getGlobalPendingProcessesSystem(BATCH_SIZE);

    if (casesToAudit.length === 0) {
      return NextResponse.json({ 
        success: true, 
        processed: 0, 
        successCount: 0, 
        message: "Fila de carência limpa.",
        remainingEstimate: 0 
      });
    }

    let successCount = 0;
    let failedCount = 0;

    // 3. Processamento Paralelo Limitado
    for (let i = 0; i < casesToAudit.length; i += CONCURRENCY) {
      const chunk = casesToAudit.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (caseItem) => {
        const ok = await auditSingleProcess(caseItem);
        if (ok) successCount++; else failedCount++;
      }));
    }

    // 4. Estimativa de Trabalho Restante (Query Rápida)
    const admin = await getSupabaseAdmin();
    const { count } = await admin
      .from('processos')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '("ENCERRADO","Arquivado","EXTINTO","SUSPENSO","IMOVEL","IMÓVEL")');

    const duration = Date.now() - start;
    
    return NextResponse.json({ 
      success: true,
      processed: casesToAudit.length, 
      successCount, 
      failedCount,
      remainingEstimate: (count || 0),
      duration: `${duration}ms`
    });

  } catch (error: any) {
    console.error("[DataJud Worker] Falha Crítica:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function auditSingleProcess(c: any): Promise<boolean> {
  try {
    const dataJud = await fetchDataJud(c.protocolo, 1, { fast: true });

    if (!dataJud || dataJud.error) return false;

    const movimentos = dataJud.movimentos || [];
    const enc = detectarEncerradoNoTribunal(movimentos);
    const upd = detectarAtualizacaoPosRetorno(c.ultimoRetorno, movimentos);
    const ba = analisarBuscaApreensao(dataJud);
    const newHash = gerarHashAuditoria(movimentos);

    // O alerta de novidade só deve ser limpo se o processo for baixado.
    // Caso contrário, se já houver novidade (true), mantemos true até o operador ler.
    let novoStatusNovidade = c.tem_atualizacao_pos_retorno || !!upd.alerta || newHash !== c.datajud_hash;
    if (enc.encerrado) novoStatusNovidade = false;

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

    const res = await updateCaseDataJudSystem(c.db_id || c.id, patch);
    return res.success;

  } catch (e) {
    return false;
  }
}
