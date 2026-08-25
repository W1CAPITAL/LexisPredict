"use server";

/**
 * Scanner robusto: Banco → (se precisar) DataJud+DJEN → motor auto/revisar.
 * Processa TODOS os ativos com baixa tribunal em lotes (cliente repete).
 * Sem teto de 8 no DJEN (usa scanSingleCaseAction modo both).
 */
import { getUserContext, getSupabaseAdmin, updateCaseDataJudSystem } from "@/lib/server-db";
import { scanSingleCaseAction } from "@/app/actions/case-actions";
import { decidirEncerramentoScan, aplicarDecisaoNoPatch } from "@/lib/auto-encerrar-scan";
import { isCasoEncerrado } from "@/lib/status-encerrado";
import { processarCaso } from "@/lib/case-logic";

const PAGE = 40; // por chamada server (~60s Vercel)

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
    djen_ultimo_resumo: row.djen_ultimo_resumo || dados.djen_ultimo_resumo,
    evento_resumo: dados.evento_resumo,
    indicio_busca_apreensao: row.indicio_busca_apreensao ?? dados.indicio_busca_apreensao,
    dados,
  };
}

function isAtivoRow(row: any): boolean {
  const dados = row.dados && typeof row.dados === "object" ? row.dados : {};
  if (truthy(dados.via_scan_auto_encerrar)) return false;
  try {
    if (isCasoEncerrado(processarCaso(rowToTarget(row)))) return false;
  } catch {
    /* */
  }
  return true;
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
        "id, dados, status, status_interno, datajud_encerrado_tribunal, is_procedente, em_cumprimento_sentenca, cumprimento_pendente_necessario, protocolo_ref, procedente_motivo, datajud_encerrado_motivo, djen_ultimo_resumo, indicio_busca_apreensao"
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
    let baixaAtivos = 0;
    let outrosAtivos = 0;
    let baixasTribunalTotal = 0;
    for (const row of data || []) {
      if (row.datajud_encerrado_tribunal) baixasTribunalTotal++;
      if (!isAtivoRow(row)) continue;
      if (row.datajud_encerrado_tribunal) baixaAtivos++;
      else outrosAtivos++;
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
  /** cursor: último id processado (mais estável que offset) */
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

    // COUNT candidatos (baixa tribunal ainda ativos no gabinete — aproximado no server)
    let totalCandidates = 0;
    try {
      const { count } = await admin
        .from("processos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresa_id)
        .eq("datajud_encerrado_tribunal", true);
      totalCandidates = count ?? 0;
    } catch {
      totalCandidates = 0;
    }

    // Busca fatia generosa e filtra ativos no app
    let q = admin
      .from("processos")
      .select(
        "id, protocolo_ref, dados, datajud_encerrado_tribunal, datajud_encerrado_motivo, is_procedente, procedente_motivo, em_cumprimento_sentenca, cumprimento_pendente_necessario, cumprimento_encerrado, status, status_interno, djen_ultimo_resumo, indicio_busca_apreensao"
      )
      .eq("empresa_id", empresa_id)
      .order("id", { ascending: true })
      .limit(limit * 8);

    if (soBaixa) q = q.eq("datajud_encerrado_tribunal", true);
    if (afterId != null) q = q.gt("id", afterId);

    const { data: rows, error } = await q;
    if (error) {
      return { ...empty, error: error.message };
    }

    const targets: any[] = [];
    let lastSeenId: number | null = afterId;
    for (const row of rows || []) {
      lastSeenId = typeof row.id === "number" ? row.id : Number(row.id) || lastSeenId;
      if (!isAtivoRow(row)) continue;
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
    let maxIdInBatch = afterId;

    for (const row of targets) {
      scanned++;
      const proto = String(row.protocolo_ref || "").trim();
      const target = rowToTarget(row);
      const rid = typeof row.id === "number" ? row.id : Number(row.id);
      if (Number.isFinite(rid)) maxIdInBatch = Math.max(maxIdInBatch ?? 0, rid);

      try {
        let decided = false;

        // Motor 1: banco
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
              lastError = (saved as any)?.error || "persist db fail";
            }
          }
        }

        // Motor 2: tribunal completo (DataJud + DJEN) se ainda não decidiu
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
            lastError = "scan retornou vazio";
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
            // Tribunal rodou mas motor não decidiu — força decisão no patch atualizado
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
            } else if (samples.length < 10) {
              samples.push(`${proto} · ok-sem-acao`);
            }
          }
        }
      } catch (e: any) {
        failed++;
        lastError = e?.message || String(e);
      }
    }

    const rowsRead = (rows || []).length;
    const nextAfter = maxIdInBatch ?? lastSeenId;
    const hasMore = rowsRead > 0 && targets.length > 0 && nextAfter != null;
    // se leu menos que o pedido de fetch, acabou a tabela
    const hasMoreFinal = rowsRead >= limit * 8 ? true : rowsRead > 0 && (targets.length >= limit || (rows || []).some((r) => isAtivoRow(r) && Number(r.id) > (afterId ?? 0)));

    // hasMore: ainda há linhas depois do cursor
    const hasMore2 = rowsRead > 0 && nextAfter != null && rowsRead >= limit * 4;

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
      totalCandidates,
      hasMore: hasMore2 || (targets.length >= limit && rowsRead > 0),
      percentDone: 0, // cliente calcula pela meta
      percentLeft: 100,
      fonte: fase === "db" ? "supabase" : fase === "tribunal" ? "datajud+djen" : "db+datajud+djen",
      samples,
      lastError: lastError || undefined,
    };
  } catch (e: any) {
    return { ...empty, error: e?.message || String(e) };
  }
}
