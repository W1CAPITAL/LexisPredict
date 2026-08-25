"use server";

/**
 * AUTO-ENCERRAR = Scanner DataJud + DJEN
 * + decisão com dados JÁ SALVOS no processo
 * + só candidatos: baixa/arquivado/encerrado no tribunal (flag ou teor).
 *
 * Fluxo por caso:
 * 1) Motor no banco (flags + resumos salvos)
 * 2) Se precisar: scanSingleCaseAction (DataJud + DJEN) — mesmo núcleo do scanner tribunal
 * 3) decidirEncerramentoScan → auto ou revisar
 */
import { getUserContext, getSupabaseAdmin, updateCaseDataJudSystem } from "@/lib/server-db";
import { scanSingleCaseAction } from "@/app/actions/case-actions";
import { decidirEncerramentoScan, aplicarDecisaoNoPatch } from "@/lib/auto-encerrar-scan";
import {
  isBaixaTribunal,
  isCandidatoAutoEncerrarTribunal,
  isCasoEncerrado,
} from "@/lib/status-encerrado";

const PAGE = 40;

function truthy(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "sim" || s === "yes";
}

function rowToTarget(row: any) {
  const dados = row.dados && typeof row.dados === "object" ? row.dados : {};
  return {
    ...dados,
    id: row.id,
    protocolo: row.protocolo_ref || dados.protocolo,
    datajud_encerrado_tribunal: row.datajud_encerrado_tribunal ?? dados.datajud_encerrado_tribunal,
    is_procedente: row.is_procedente ?? dados.is_procedente,
    em_cumprimento_sentenca: row.em_cumprimento_sentenca ?? dados.em_cumprimento_sentenca,
    cumprimento_pendente_necessario:
      row.cumprimento_pendente_necessario ?? dados.cumprimento_pendente_necessario,
    cumprimento_encerrado: row.cumprimento_encerrado ?? dados.cumprimento_encerrado,
    situacao: dados.situacao || row.status_interno,
    status: row.status,
    via_scan_auto_encerrar: dados.via_scan_auto_encerrar,
    procedente_motivo: row.procedente_motivo || dados.procedente_motivo,
    datajud_encerrado_motivo: row.datajud_encerrado_motivo || dados.datajud_encerrado_motivo,
    datajud_ultimo_nome: row.datajud_ultimo_nome || dados.datajud_ultimo_nome,
    djen_ultimo_resumo: row.djen_ultimo_resumo || dados.djen_ultimo_resumo,
    evento_resumo: dados.evento_resumo,
    indicio_busca_apreensao: row.indicio_busca_apreensao ?? dados.indicio_busca_apreensao,
    operacao_sistema: dados.operacao_sistema,
    dados,
  };
}

export async function countAutoEncerrarPendentesAction() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) {
      return {
        success: false,
        baixaAtivos: 0,
        outrosAtivos: 0,
        totalPendentes: 0,
        baixasTribunalTotal: 0,
        error: "Sem sessão",
      };
    }
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from("processos")
      .select(
        "id, dados, status, status_interno, datajud_encerrado_tribunal, datajud_encerrado_motivo, datajud_ultimo_nome, is_procedente, em_cumprimento_sentenca, cumprimento_pendente_necessario, cumprimento_encerrado, protocolo_ref, procedente_motivo, djen_ultimo_resumo, indicio_busca_apreensao"
      )
      .eq("empresa_id", empresa_id)
      .limit(8000);
    if (error) {
      return {
        success: false,
        baixaAtivos: 0,
        outrosAtivos: 0,
        totalPendentes: 0,
        baixasTribunalTotal: 0,
        error: error.message,
      };
    }

    let baixaAtivos = 0; // candidatos ainda não auto-scan
    let outrosAtivos = 0;
    let baixasTribunalTotal = 0;
    for (const row of data || []) {
      const t = rowToTarget(row);
      if (isBaixaTribunal(t)) baixasTribunalTotal++;
      if (isCandidatoAutoEncerrarTribunal(t)) baixaAtivos++;
      else if (!isCasoEncerrado(t) && !isBaixaTribunal(t)) outrosAtivos++;
    }
    return {
      success: true,
      baixaAtivos,
      outrosAtivos,
      totalPendentes: baixaAtivos,
      baixasTribunalTotal,
    };
  } catch (e: any) {
    return {
      success: false,
      baixaAtivos: 0,
      outrosAtivos: 0,
      totalPendentes: 0,
      baixasTribunalTotal: 0,
      error: e?.message || String(e),
    };
  }
}

export async function runAutoEncerrarBatchAction(opts?: {
  limit?: number;
  afterId?: number | null;
  offset?: number;
  soBaixaTribunal?: boolean;
  fase?: "db" | "tribunal" | "full";
  fast?: boolean;
}): Promise<{
  success: boolean;
  scanned: number;
  autoEncerrados: number;
  revisao: number;
  skipped: number;
  failed: number;
  offset: number;
  nextOffset: number;
  afterId: number | null;
  totalCandidates: number;
  hasMore: boolean;
  percentDone: number;
  percentLeft: number;
  fonte: string;
  error?: string;
  samples?: string[];
  lastError?: string;
}> {
  const empty = {
    success: false,
    scanned: 0,
    autoEncerrados: 0,
    revisao: 0,
    skipped: 0,
    failed: 0,
    offset: 0,
    nextOffset: 0,
    afterId: null as number | null,
    totalCandidates: 0,
    hasMore: false,
    percentDone: 0,
    percentLeft: 100,
    fonte: "full",
  };

  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { ...empty, error: "Sem sessão" };

    const fase = opts?.fase || "full";
    const limit = Math.min(Math.max(opts?.limit ?? PAGE, 10), 50);
    const soBaixa = opts?.soBaixaTribunal !== false;
    const fast = opts?.fast !== false;
    const afterId = opts?.afterId ?? null;
    const admin = await getSupabaseAdmin();

    let q = admin
      .from("processos")
      .select(
        "id, protocolo_ref, dados, datajud_encerrado_tribunal, datajud_encerrado_motivo, datajud_ultimo_nome, is_procedente, procedente_motivo, em_cumprimento_sentenca, cumprimento_pendente_necessario, cumprimento_encerrado, status, status_interno, djen_ultimo_resumo, indicio_busca_apreensao"
      )
      .eq("empresa_id", empresa_id)
      .order("id", { ascending: true })
      .limit(limit * 12);

    if (afterId != null) q = q.gt("id", afterId);

    const { data: rows, error } = await q;
    if (error) return { ...empty, error: error.message };

    const targets: any[] = [];
    let nextAfter: number | null = afterId;
    for (const row of rows || []) {
      const rid = typeof row.id === "number" ? row.id : Number(row.id);
      if (Number.isFinite(rid)) nextAfter = Math.max(nextAfter ?? 0, rid);

      const t = rowToTarget(row);
      if (soBaixa) {
        if (!isCandidatoAutoEncerrarTribunal(t)) continue;
      }
      const proto = String(row.protocolo_ref || "").trim();
      if (!proto) continue;
      targets.push(row);
      if (targets.length >= limit) break;
    }

    let autoEncerrados = 0;
    let revisao = 0;
    let failed = 0;
    let scanned = 0;
    let lastError = "";
    const samples: string[] = [];

    for (const row of targets) {
      scanned++;
      const proto = String(row.protocolo_ref || "").trim();
      const target = rowToTarget(row);

      try {
        let decided = false;

        // 1) Dados já salvos
        if (fase === "db" || fase === "full") {
          const decisaoDb = decidirEncerramentoScan({
            target,
            patch: {
              datajud_encerrado_tribunal: target.datajud_encerrado_tribunal,
              datajud_encerrado_motivo: target.datajud_encerrado_motivo,
              is_procedente: target.is_procedente,
              em_cumprimento_sentenca: target.em_cumprimento_sentenca,
              cumprimento_pendente_necessario: target.cumprimento_pendente_necessario,
              cumprimento_encerrado: target.cumprimento_encerrado,
              indicio_busca_apreensao: target.indicio_busca_apreensao,
              djen_ultimo_resumo: target.djen_ultimo_resumo,
              datajud_ultimo_nome: target.datajud_ultimo_nome,
            },
          });
          if (decisaoDb.acao === "auto_encerrar" || decisaoDb.acao === "revisao_fila") {
            const patch = aplicarDecisaoNoPatch({}, target, decisaoDb);
            const saved = await updateCaseDataJudSystem(row.id, patch);
            if (saved?.success) {
              decided = true;
              if (decisaoDb.acao === "auto_encerrar") {
                autoEncerrados++;
                if (samples.length < 20) samples.push(`${proto} · AUTO/DB`);
              } else {
                revisao++;
                if (samples.length < 20) samples.push(`${proto} · REVISAR/DB`);
              }
            } else {
              lastError = (saved as any)?.error || "persist fail";
            }
          }
        }

        // 2) Mesmo scanner DataJud + DJEN
        if (!decided && (fase === "tribunal" || fase === "full")) {
          let scanRes: any = null;
          try {
            scanRes = await scanSingleCaseAction(proto, { mode: "both", fast });
          } catch (e: any) {
            failed++;
            lastError = e?.message || String(e);
            continue;
          }
          if (!scanRes) {
            failed++;
            lastError = "scan vazio";
            continue;
          }
          const p = (scanRes.casePatch || {}) as any;
          const dados = p.dados && typeof p.dados === "object" ? p.dados : {};
          if (p.via_scan_auto_encerrar || dados.via_scan_auto_encerrar) {
            autoEncerrados++;
            if (samples.length < 20) samples.push(`${proto} · AUTO/TRIB`);
          } else if (p.precisa_revisar_encerramento || dados.precisa_revisar_encerramento) {
            revisao++;
            if (samples.length < 20) samples.push(`${proto} · REVISAR/TRIB`);
          } else if (!scanRes.success) {
            failed++;
            lastError = String(scanRes.error || "scan fail");
          } else {
            const target2 = { ...target, ...p, dados: { ...target.dados, ...dados } };
            const decisao2 = decidirEncerramentoScan({ target: target2, patch: p });
            if (decisao2.acao === "auto_encerrar" || decisao2.acao === "revisao_fila") {
              const patch2 = aplicarDecisaoNoPatch(p, target2, decisao2);
              const saved2 = await updateCaseDataJudSystem(row.id, patch2);
              if (saved2?.success) {
                if (decisao2.acao === "auto_encerrar") {
                  autoEncerrados++;
                  if (samples.length < 20) samples.push(`${proto} · AUTO/TRIB+M`);
                } else {
                  revisao++;
                  if (samples.length < 20) samples.push(`${proto} · REVISAR/TRIB+M`);
                }
              }
            }
          }
        }
      } catch (e: any) {
        failed++;
        lastError = e?.message || String(e);
      }
    }

    const rowsRead = (rows || []).length;
    const hasMore = rowsRead >= limit * 12;

    return {
      success: true,
      scanned,
      autoEncerrados,
      revisao,
      skipped: Math.max(0, rowsRead - targets.length),
      failed,
      offset: opts?.offset ?? 0,
      nextOffset: (opts?.offset ?? 0) + Math.max(scanned, 1),
      afterId: nextAfter,
      totalCandidates: 0,
      hasMore,
      percentDone: 0,
      percentLeft: 100,
      fonte: "db+datajud+djen",
      samples,
      lastError: lastError || undefined,
    };
  } catch (e: any) {
    return { ...empty, error: e?.message || String(e) };
  }
}
