"use server";

/**
 * AUTO-ENCERRAR HONESTO
 * = mesmo scanner DataJud + DJEN (scanSingleCaseAction)
 * + motor de decisão com dados salvos
 * + só candidatos com sinal de baixa/arquivado no tribunal
 *
 * NÃO conta "escaneado" só por ler a linha no banco.
 * Cada "scanned" = 1 chamada real a scanSingleCaseAction (ou 1 auto/revisar
 * gravado após motor no banco quando o teor já é inequívoco — marcado DB).
 *
 * Lote pequeno: Vercel ~60s; DataJud/DJEN ~3–8s por processo.
 */
import { getUserContext, getSupabaseAdmin, updateCaseDataJudSystem } from "@/lib/server-db";
import { scanSingleCaseAction } from "@/app/actions/case-actions";
import { decidirEncerramentoScan, aplicarDecisaoNoPatch } from "@/lib/auto-encerrar-scan";
import {
  isBaixaTribunal,
  isCandidatoAutoEncerrarTribunal,
  textoBaixaOuArquivoTribunal,
} from "@/lib/status-encerrado";

/** Máx. scans REAIS por request (DataJud+DJEN). Cliente repete. */
const MAX_SCANS_POR_LOTE = 5;

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
  return truthy(d.via_scan_auto_encerrar) || d?.operacao_sistema?.tipo === "SCAN_AUTO_ENCERRAR";
}

function isCandidato(row: any): boolean {
  if (jaAutoScan(row)) return false;
  const t = rowToTarget(row);
  if (t.datajud_encerrado_tribunal) return true;
  try {
    if (isCandidatoAutoEncerrarTribunal(t)) return true;
  } catch {
    /* */
  }
  try {
    if (isBaixaTribunal(t)) return true;
  } catch {
    /* */
  }
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

    // Candidatos pendentes: datajud true e sem via_scan
    let pendentesCol = 0;
    try {
      const { data: sample } = await admin
        .from("processos")
        .select("id, dados, datajud_encerrado_tribunal")
        .eq("empresa_id", empresa_id)
        .eq("datajud_encerrado_tribunal", true)
        .limit(2000);
      for (const row of sample || []) {
        if (!jaAutoScan(row)) pendentesCol++;
      }
    } catch {
      pendentesCol = colBaixa;
    }

    return {
      success: true,
      baixaAtivos: pendentesCol,
      outrosAtivos: 0,
      totalPendentes: pendentesCol,
      baixasTribunalTotal: colBaixa,
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
  /** scans que chamaram DataJud/DJEN de verdade */
  tribunalCalls: number;
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
    fonte: "datajud+djen",
    tribunalCalls: 0,
  };

  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { ...empty, error: "Sem sessão" };

    const maxScans = Math.min(
      Math.max(opts?.limit ?? MAX_SCANS_POR_LOTE, 1),
      MAX_SCANS_POR_LOTE
    );
    const fast = opts?.fast !== false;
    const afterId = opts?.afterId ?? null;
    const admin = await getSupabaseAdmin();

    // Só linhas com baixa no tribunal (coluna) — honestidade e performance
    let q = admin
      .from("processos")
      .select(
        "id, protocolo_ref, dados, datajud_encerrado_tribunal, datajud_encerrado_motivo, datajud_ultimo_nome, is_procedente, procedente_motivo, em_cumprimento_sentenca, cumprimento_pendente_necessario, cumprimento_encerrado, status, status_interno, djen_ultimo_resumo, indicio_busca_apreensao"
      )
      .eq("empresa_id", empresa_id)
      .eq("datajud_encerrado_tribunal", true)
      .order("id", { ascending: true })
      .limit(maxScans * 20);

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
      if (targets.length >= maxScans) break;
    }

    let autoEncerrados = 0;
    let revisao = 0;
    let failed = 0;
    let scanned = 0;
    let tribunalCalls = 0;
    let lastError = "";
    const samples: string[] = [];

    for (const row of targets) {
      const proto = String(row.protocolo_ref || "").trim();
      const target = rowToTarget(row);

      try {
        // ——— SEMPRE chama o scanner real DataJud + DJEN ———
        let scanRes: any = null;
        const t0 = Date.now();
        try {
          scanRes = await scanSingleCaseAction(proto, { mode: "both", fast });
          tribunalCalls++;
        } catch (e: any) {
          failed++;
          lastError = e?.message || String(e);
          samples.push(`${proto} · FALHA ${lastError.slice(0, 40)}`);
          continue;
        }
        const ms = Date.now() - t0;

        if (!scanRes) {
          failed++;
          lastError = "scan retornou vazio";
          continue;
        }

        // Só conta escaneado se houve chamada real
        scanned++;

        const p = (scanRes.casePatch || {}) as any;
        const dados = p.dados && typeof p.dados === "object" ? p.dados : {};

        // Já aplicado pelo scanSingleCaseAction (decidirEncerramentoScan dentro)
        if (p.via_scan_auto_encerrar || dados.via_scan_auto_encerrar) {
          autoEncerrados++;
          samples.push(`${proto} · AUTO ${ms}ms`);
          continue;
        }
        if (p.precisa_revisar_encerramento || dados.precisa_revisar_encerramento) {
          revisao++;
          samples.push(`${proto} · REVISAR ${ms}ms`);
          continue;
        }

        if (!scanRes.success) {
          failed++;
          lastError = String(scanRes.error || "scan fail");
          samples.push(`${proto} · ERR ${lastError.slice(0, 30)}`);
          continue;
        }

        // Motor extra com patch do tribunal + dados salvos
        const target2 = {
          ...target,
          ...p,
          datajud_encerrado_tribunal:
            p.datajud_encerrado_tribunal ?? target.datajud_encerrado_tribunal ?? true,
          dados: { ...target.dados, ...dados },
        };
        const decisao = decidirEncerramentoScan({
          target: target2,
          patch: {
            ...p,
            datajud_encerrado_tribunal: true,
          },
        });

        if (decisao.acao === "auto_encerrar" || decisao.acao === "revisao_fila") {
          const patch = aplicarDecisaoNoPatch(p, target2, decisao);
          const saved = await updateCaseDataJudSystem(row.id, patch);
          if (saved?.success) {
            if (decisao.acao === "auto_encerrar") {
              autoEncerrados++;
              samples.push(`${proto} · AUTO/M ${ms}ms`);
            } else {
              revisao++;
              samples.push(`${proto} · REVISAR/M ${ms}ms`);
            }
          } else {
            lastError = (saved as any)?.error || "persist";
            failed++;
          }
        } else {
          samples.push(`${proto} · ok-sem-acao ${ms}ms`);
        }
      } catch (e: any) {
        failed++;
        lastError = e?.message || String(e);
      }
    }

    const rowsRead = (rows || []).length;
    const hasMore =
      rowsRead > 0 &&
      nextAfter != null &&
      (targets.length >= maxScans || rowsRead >= maxScans * 10);

    return {
      success: true,
      scanned,
      autoEncerrados,
      revisao,
      skipped,
      failed,
      offset: opts?.offset ?? 0,
      nextOffset: (opts?.offset ?? 0) + scanned,
      afterId: nextAfter,
      totalCandidates: targets.length,
      hasMore,
      percentDone: 0,
      percentLeft: 100,
      fonte: "datajud+djen (real)",
      samples,
      lastError: lastError || undefined,
      tribunalCalls,
    };
  } catch (e: any) {
    return { ...empty, error: e?.message || String(e) };
  }
}
