"use server";

/**
 * Auto-encerrar: DataJud+DJEN + dados salvos.
 * Fila = baixa/arquivado/encerrado no tribunal (coluna OU teor).
 * NÃO usa isCasoEncerrado para montar a fila (isso zerava tudo).
 */
import { getUserContext, getSupabaseAdmin, updateCaseDataJudSystem } from "@/lib/server-db";
import { scanSingleCaseAction } from "@/app/actions/case-actions";
import { decidirEncerramentoScan, aplicarDecisaoNoPatch } from "@/lib/auto-encerrar-scan";
import {
  isBaixaTribunal,
  isCandidatoAutoEncerrarTribunal,
  textoBaixaOuArquivoTribunal,
} from "@/lib/status-encerrado";

const PAGE = 30;

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
    datajud_encerrado_tribunal: !!(
      row.datajud_encerrado_tribunal || dados.datajud_encerrado_tribunal
    ),
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

function jaAutoScan(row: any): boolean {
  const d = row.dados && typeof row.dados === "object" ? row.dados : {};
  if (truthy(d.via_scan_auto_encerrar)) return true;
  if (d?.operacao_sistema?.tipo === "SCAN_AUTO_ENCERRAR") return true;
  return false;
}

/** Candidato: sinal de fim no tribunal e ainda não auto-scan */
function isCandidato(row: any): boolean {
  if (jaAutoScan(row)) return false;
  const t = rowToTarget(row);
  // 1) flag DataJud
  if (t.datajud_encerrado_tribunal) return true;
  // 2) helper oficial
  try {
    if (isCandidatoAutoEncerrarTribunal(t)) return true;
  } catch {
    /* */
  }
  // 3) isBaixaTribunal (mesmo critério do card 310)
  try {
    if (isBaixaTribunal(t)) return true;
  } catch {
    /* */
  }
  // 4) teor cru
  const blob = [
    t.datajud_encerrado_motivo,
    t.datajud_ultimo_nome,
    t.djen_ultimo_resumo,
    t.evento_resumo,
    t.situacao,
    t.status,
  ]
    .map((x) => String(x || ""))
    .join(" ");
  return textoBaixaOuArquivoTribunal(blob);
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

    // Contagem rápida pela coluna (sempre)
    let colBaixa = 0;
    try {
      const { count } = await admin
        .from("processos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresa_id)
        .eq("datajud_encerrado_tribunal", true);
      colBaixa = count ?? 0;
    } catch {
      colBaixa = 0;
    }

    // Amostra para isBaixaTribunal + candidatos
    const { data, error } = await admin
      .from("processos")
      .select(
        "id, dados, status, status_interno, datajud_encerrado_tribunal, datajud_encerrado_motivo, datajud_ultimo_nome, em_cumprimento_sentenca, cumprimento_pendente_necessario, djen_ultimo_resumo, procedente_motivo"
      )
      .eq("empresa_id", empresa_id)
      .limit(8000);

    if (error) {
      return {
        success: false,
        baixaAtivos: 0,
        outrosAtivos: 0,
        totalPendentes: 0,
        baixasTribunalTotal: colBaixa,
        error: error.message,
      };
    }

    let baixaAtivos = 0;
    let baixasTribunalTotal = 0;
    let outrosAtivos = 0;
    for (const row of data || []) {
      const t = rowToTarget(row);
      let baixa = false;
      try {
        baixa = isBaixaTribunal(t) || !!t.datajud_encerrado_tribunal;
      } catch {
        baixa = !!t.datajud_encerrado_tribunal;
      }
      if (baixa) baixasTribunalTotal++;
      if (isCandidato(row)) baixaAtivos++;
      else if (!baixa) outrosAtivos++;
    }

    // Preferir o maior entre coluna e varredura (não subestimar)
    baixasTribunalTotal = Math.max(baixasTribunalTotal, colBaixa);

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
  /** true = só coluna datajud_encerrado_tribunal (mais rápido, menos zeros) */
  soColunaDatajud?: boolean;
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
    const limit = Math.min(Math.max(opts?.limit ?? PAGE, 5), 40);
    const soBaixa = opts?.soBaixaTribunal !== false;
    const soColuna = opts?.soColunaDatajud !== false; // default: prioriza coluna
    const fast = opts?.fast !== false;
    const afterId = opts?.afterId ?? null;
    const admin = await getSupabaseAdmin();

    // ——— Passo A: buscar DIRETO quem tem datajud_encerrado_tribunal = true ———
    let q = admin
      .from("processos")
      .select(
        "id, protocolo_ref, dados, datajud_encerrado_tribunal, datajud_encerrado_motivo, datajud_ultimo_nome, is_procedente, procedente_motivo, em_cumprimento_sentenca, cumprimento_pendente_necessario, cumprimento_encerrado, status, status_interno, djen_ultimo_resumo, indicio_busca_apreensao"
      )
      .eq("empresa_id", empresa_id)
      .order("id", { ascending: true })
      .limit(limit * 15);

    if (soBaixa && soColuna) {
      q = q.eq("datajud_encerrado_tribunal", true);
    }
    if (afterId != null) q = q.gt("id", afterId);

    const { data: rows, error } = await q;
    if (error) return { ...empty, error: error.message };

    const targets: any[] = [];
    let nextAfter: number | null = afterId;
    let skipped = 0;

    for (const row of rows || []) {
      const rid = typeof row.id === "number" ? row.id : Number(row.id);
      if (Number.isFinite(rid)) nextAfter = Math.max(nextAfter ?? 0, rid);

      if (!isCandidato(row)) {
        skipped++;
        continue;
      }
      const proto = String(row.protocolo_ref || "").trim();
      if (!proto) {
        skipped++;
        continue;
      }
      targets.push(row);
      if (targets.length >= limit) break;
    }

    // Se coluna datajud não achou ninguém nesta página, tenta sem filtro de coluna
    // (teor de baixa no JSON) — uma vez por cursor
    if (targets.length === 0 && soColuna && soBaixa) {
      let q2 = admin
        .from("processos")
        .select(
          "id, protocolo_ref, dados, datajud_encerrado_tribunal, datajud_encerrado_motivo, datajud_ultimo_nome, is_procedente, procedente_motivo, em_cumprimento_sentenca, cumprimento_pendente_necessario, cumprimento_encerrado, status, status_interno, djen_ultimo_resumo, indicio_busca_apreensao"
        )
        .eq("empresa_id", empresa_id)
        .order("id", { ascending: true })
        .limit(limit * 20);
      if (afterId != null) q2 = q2.gt("id", afterId);
      const { data: rows2 } = await q2;
      for (const row of rows2 || []) {
        const rid = typeof row.id === "number" ? row.id : Number(row.id);
        if (Number.isFinite(rid)) nextAfter = Math.max(nextAfter ?? 0, rid);
        if (!isCandidato(row)) continue;
        const proto = String(row.protocolo_ref || "").trim();
        if (!proto) continue;
        targets.push(row);
        if (targets.length >= limit) break;
      }
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

        // 1) Dados salvos
        if (fase === "db" || fase === "full") {
          const decisaoDb = decidirEncerramentoScan({
            target,
            patch: {
              datajud_encerrado_tribunal: true, // candidato já é baixa tribunal
              datajud_encerrado_motivo: target.datajud_encerrado_motivo,
              is_procedente: target.is_procedente,
              em_cumprimento_sentenca: target.em_cumprimento_sentenca,
              cumprimento_pendente_necessario: target.cumprimento_pendente_necessario,
              cumprimento_encerrado: target.cumprimento_encerrado,
              indicio_busca_apreensao: target.indicio_busca_apreensao,
              djen_ultimo_resumo: target.djen_ultimo_resumo,
            },
          });

          if (decisaoDb.acao === "nenhuma") {
            // força auto se é baixa tribunal sem residual forte (decidir pode retornar nenhuma se flag off)
            // deixa tribunal tentar
          } else if (decisaoDb.acao === "auto_encerrar" || decisaoDb.acao === "revisao_fila") {
            const patch = aplicarDecisaoNoPatch({}, target, decisaoDb);
            const saved = await updateCaseDataJudSystem(row.id, patch);
            if (saved?.success) {
              decided = true;
              if (decisaoDb.acao === "auto_encerrar") {
                autoEncerrados++;
                if (samples.length < 15) samples.push(`${proto} · AUTO/DB`);
              } else {
                revisao++;
                if (samples.length < 15) samples.push(`${proto} · REVISAR/DB`);
              }
            } else {
              lastError = (saved as any)?.error || "falha ao salvar";
            }
          }
        }

        // 2) Scanner DataJud + DJEN (mesmo do app)
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
            if (samples.length < 15) samples.push(`${proto} · AUTO/TRIB`);
            continue;
          }
          if (p.precisa_revisar_encerramento || dados.precisa_revisar_encerramento) {
            revisao++;
            if (samples.length < 15) samples.push(`${proto} · REVISAR/TRIB`);
            continue;
          }
          if (!scanRes.success) {
            failed++;
            lastError = String(scanRes.error || "scan fail");
            continue;
          }

          const target2 = {
            ...target,
            ...p,
            datajud_encerrado_tribunal:
              p.datajud_encerrado_tribunal ?? target.datajud_encerrado_tribunal,
            dados: { ...target.dados, ...dados },
          };
          const decisao2 = decidirEncerramentoScan({
            target: target2,
            patch: { ...p, datajud_encerrado_tribunal: true },
          });
          if (decisao2.acao === "auto_encerrar" || decisao2.acao === "revisao_fila") {
            const patch2 = aplicarDecisaoNoPatch(p, target2, decisao2);
            const saved2 = await updateCaseDataJudSystem(row.id, patch2);
            if (saved2?.success) {
              if (decisao2.acao === "auto_encerrar") {
                autoEncerrados++;
                if (samples.length < 15) samples.push(`${proto} · AUTO/TRIB+M`);
              } else {
                revisao++;
                if (samples.length < 15) samples.push(`${proto} · REVISAR/TRIB+M`);
              }
            }
          } else if (samples.length < 10) {
            samples.push(`${proto} · sem-acao`);
          }
        }
      } catch (e: any) {
        failed++;
        lastError = e?.message || String(e);
      }
    }

    const rowsRead = (rows || []).length;
    // hasMore: ainda há linhas depois do cursor
    const hasMore = rowsRead > 0 && nextAfter != null && rowsRead >= limit * 5;

    return {
      success: true,
      scanned,
      autoEncerrados,
      revisao,
      skipped,
      failed,
      offset: opts?.offset ?? 0,
      nextOffset: (opts?.offset ?? 0) + Math.max(scanned, 1),
      afterId: nextAfter,
      totalCandidates: targets.length,
      hasMore: targets.length > 0 ? hasMore || targets.length >= limit : hasMore,
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
