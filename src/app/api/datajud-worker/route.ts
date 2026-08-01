/**
 * @fileOverview Worker de Auditoria Automática DataJud v3.0 (HYBRID EDITION)
 * Otimizado para micro-lotes assíncronos com suporte nativo a Auditoria 3D (DataJud + DJEN).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { NextResponse } from 'next/server';
import { 
  getGlobalPendingProcessesSystem, 
  updateCaseDataJudSystem
} from '@/lib/server-db';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno, detectarEncerradoNoTribunal, gerarHashAuditoria, detectarCumprimentoSentenca } from '@/lib/datajud-sync';
import { analisarBuscaApreensao } from '@/lib/busca-apreensao';
import { detectarNovaComunicacaoDjen } from '@/lib/djen-sync';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 5; 
const CONCURRENCY = 2; 
const MAX_RUNTIME_MS = 55000; // Aumentado para suportar auditoria dupla

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

  // Base URL para chamadas internas de Proxy
  const host = request.headers.get('host');
  const protocol = host?.includes('localhost') ? 'http' : 'https';
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${protocol}://${host}`;

  const start = Date.now();
  console.log(`[Omni Worker] Lote Empresa ${empresa_id} Iniciado: ${new Date().toLocaleTimeString()}`);

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
        console.warn("[Omni Worker] Tempo limite atingido. Interrompendo lote.");
        break;
      }

      const chunk = casesToAudit.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (caseItem) => {
        const ok = await auditHybridProcess(caseItem, baseUrl);
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
    console.error("[Omni Worker] Falha Crítica:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function auditHybridProcess(c: any, baseUrl: string): Promise<boolean> {
  const patch: any = {
    datajud_consultado_em: new Date().toISOString()
  };

  let hasData = false;

  try {
    // PASSO 1: DATAJUD (TRIBUNAL)
    const dataJud = await fetchDataJud(c.protocolo, 1, { fast: true });

    if (dataJud && !dataJud.error && dataJud.movimentos) {
      const movimentos = dataJud.movimentos;
      const enc = detectarEncerradoNoTribunal(movimentos);
      const upd = detectarAtualizacaoPosRetorno(c.ultimoRetorno, movimentos);
      const ba = analisarBuscaApreensao(dataJud);
      const cump = detectarCumprimentoSentenca(movimentos);
      const newHash = gerarHashAuditoria(movimentos);

      Object.assign(patch, {
        datajud_ultimo_movimento: upd.dataUltimo,
        datajud_ultimo_nome: upd.nomeUltimo,
        tem_atualizacao_pos_retorno: !!upd.alerta, 
        datajud_encerrado_tribunal: !!enc.encerrado,
        datajud_encerrado_motivo: enc.motivo,
        datajud_hash: newHash,
        indicio_busca_apreensao: !!ba.indicio,
        busca_apreensao_confianca: ba.confianca,
        busca_apreensao_motivo: ba.motivo,
        busca_apreensao_consultado_em: ba.indicio ? new Date().toISOString() : null,
        em_cumprimento_sentenca: !enc.encerrado && cump.ativo,
        cumprimento_sentenca_motivo: !enc.encerrado ? cump.motivo : null,
        cumprimento_sentenca_consultado_em: new Date().toISOString(),
        tribunal: dataJud.tribunal || c.tribunal
      });
      hasData = true;
    }

    // PASSO 2: DJEN (DIÁRIO OFICIAL) - Via Proxy gru1
    try {
      const secret = process.env.DATAJUD_WORKER_SECRET;
      const djenRes = await fetch(`${baseUrl}/api/djen-proxy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolo: c.protocolo }),
        signal: AbortSignal.timeout(20000)
      });

      if (djenRes.ok) {
        const data = await djenRes.json();
        if (data.success) {
          const check = detectarNovaComunicacaoDjen(c.ultimoRetorno, data.items);
          Object.assign(patch, {
            djen_consultado_em: new Date().toISOString(),
            djen_nova_comunicacao: !!check.alerta,
            djen_ultima_data: check.dataUltima,
            djen_ultimo_resumo: check.resumo,
            djen_ultimo_link: check.link,
            djen_count: data.count
          });
          hasData = true;
        }
      }
    } catch (e) {
      console.warn(`[Omni Worker] Falha DJEN (Silenciosa) para ${c.protocolo}`);
    }

    if (hasData) {
      const res = await updateCaseDataJudSystem(c.db_id || c.id, patch);
      return res.success;
    }

    return false;

  } catch (e) {
    return false;
  }
}
