"use server";

/**
 * Fila: datajud_encerrado_tribunal = true e SEM via_scan_auto.
 * Cada scanned = 1 scanSingleCaseAction (DataJud+DJEN) real.
 */
import { getUserContext, getSupabaseAdmin, updateCaseDataJudSystem } from "@/lib/server-db";
import { scanSingleCaseAction } from "@/app/actions/case-actions";
import { decidirEncerramentoScan, aplicarDecisaoNoPatch } from "@/lib/auto-encerrar-scan";

const MAX_SCANS = 5;

function truthy(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  return ["true", "1", "sim", "yes", "t"].includes(String(v).trim().toLowerCase());
}

function dadosOf(row: any) {
  return row?.dados && typeof row.dados === "object" ? row.dados : {};
}

function jaAutoScan(row: any): boolean {
  const d = dadosOf(row);
  if (truthy(d.via_scan_auto_encerrar)) return true;
  if (d?.operacao_sistema?.tipo === "SCAN_AUTO_ENCERRAR") return true;
  return false;
}

function protocoloOf(row: any): string {
  const d = dadosOf(row);
  return String(
    row.protocolo_ref || d.protocolo || d.PROTOCOLO || d.numero_cnj || d.cnj || ""
  ).trim();
}

function rowToTarget(row: any) {
  const dados = dadosOf(row);
  return {
    ...dados,
    id: row.id,
    protocolo: protocoloOf(row),
    datajud_encerrado_tribunal: true,
    is_procedente: row.is_procedente ?? dados.is_procedente,
    em_cumprimento_sentenca: row.em_cumprimento_sentenca ?? dados.em_cumprimento_sentenca,
    cumprimento_pendente_necessario:
      row.cumprimento_pendente_necessario ?? dados.cumprimento_pendente_necessario,
    cumprimento_encerrado: row.cumprimento_encerrado ?? dados.cumprimento_encerrado,
    situacao: dados.situacao || row.status_interno,
    status: row.status,
    procedente_motivo: row.procedente_motivo || dados.procedente_motivo,
    datajud_encerrado_motivo: row.datajud_encerrado_motivo || dados.datajud_encerrado_motivo,
    datajud_ultimo_nome: row.datajud_ultimo_nome || dados.datajud_ultimo_nome,
    djen_ultimo_resumo: row.djen_ultimo_resumo || dados.djen_ultimo_resumo,
    evento_resumo: dados.evento_resumo,
    indicio_busca_apreensao: row.indicio_busca_apreensao ?? dados.indicio_busca_apreensao,
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
        bloqueadosViaScan: 0,
        error: "Sem sessão",
      };
    }
    const admin = await getSupabaseAdmin();

    let baixasTribunalTotal = 0;
    try {
      const { count } = await admin
        .from("processos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresa_id)
        .eq("datajud_encerrado_tribunal", true);
      baixasTribunalTotal = count ?? 0;
    } catch {
      baixasTribunalTotal = 0;
    }

    const { data: rows } = await admin
      .from("processos")
      .select("id, dados, protocolo_ref")
      .eq("empresa_id", empresa_id)
      .eq("datajud_encerrado_tribunal", true)
      .limit(5000);

    let baixaAtivos = 0;
    let bloqueadosViaScan = 0;
    for (const row of rows || []) {
      if (jaAutoScan(row)) bloqueadosViaScan++;
      else baixaAtivos++;
    }

    return {
      success: true,
      baixaAtivos,
      outrosAtivos: 0,
      totalPendentes: baixaAtivos,
      baixasTribunalTotal,
      bloqueadosViaScan,
    };
  } catch (e: any) {
    return {
      success: false,
      baixaAtivos: 0,
      outrosAtivos: 0,
      totalPendentes: 0,
      baixasTribunalTotal: 0,
      bloqueadosViaScan: 0,
      error: e?.message || String(e),
    };
  }
}

export async function resetViaScanFlagsBaixasAction(): Promise<{
  success: boolean;
  updated: number;
  error?: string;
}> {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false, updated: 0, error: "Sem sessão" };
    const admin = await getSupabaseAdmin();
    const { data: rows, error } = await admin
      .from("processos")
      .select("id, dados")
      .eq("empresa_id", empresa_id)
      .eq("datajud_encerrado_tribunal", true)
      .limit(5000);
    if (error) return { success: false, updated: 0, error: error.message };

    let updated = 0;
    for (const row of rows || []) {
      const d0 = dadosOf(row);
      const hasFlag =
        truthy(d0.via_scan_auto_encerrar) ||
        d0?.operacao_sistema?.tipo === "SCAN_AUTO_ENCERRAR" ||
        d0.scan_auto_encerrar_motivo != null ||
        d0.scan_auto_encerrado_em != null;
      if (!hasFlag) continue;
      const d = { ...d0 };
      delete d.via_scan_auto_encerrar;
      delete d.scan_auto_encerrado_em;
      delete d.scan_auto_encerrado_dia;
      delete d.scan_auto_encerrar_motivo;
      delete d.precisa_revisar_encerramento;
      delete d.prioridade_revisao_encerrado;
      delete d.scan_revisao_motivo;
      delete d.operacao_sistema;
      d.fila_scan_reaberta_em = new Date().toISOString();
      const { error: upErr } = await admin
        .from("processos")
        .update({ dados: d })
        .eq("id", row.id)
        .eq("empresa_id", empresa_id);
      if (!upErr) updated++;
    }
    return { success: true, updated };
  } catch (e: any) {
    return { success: false, updated: 0, error: e?.message || String(e) };
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
  tribunalCalls: number;
  debug?: string;
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

    const maxScans = Math.min(Math.max(opts?.limit ?? MAX_SCANS, 1), MAX_SCANS);
    const fast = opts?.fast !== false;
    let afterId = opts?.afterId ?? null;
    const admin = await getSupabaseAdmin();

    async function fetchPage(after: number | null, lim: number) {
      let q = admin
        .from("processos")
        .select(
          "id, protocolo_ref, dados, datajud_encerrado_tribunal, datajud_encerrado_motivo, datajud_ultimo_nome, is_procedente, procedente_motivo, em_cumprimento_sentenca, cumprimento_pendente_necessario, cumprimento_encerrado, status, status_interno, djen_ultimo_resumo, indicio_busca_apreensao"
        )
        .eq("empresa_id", empresa_id)
        .eq("datajud_encerrado_tribunal", true)
        .order("id", { ascending: true })
        .limit(lim);
      if (after != null && Number.isFinite(after) && after > 0) {
        q = q.gt("id", after);
      }
      return q;
    }

    // Busca páginas até achar candidatos (máx. 8 páginas de 50)
    const targets: any[] = [];
    let nextAfter: number | null = afterId;
    let skipped = 0;
    let rowsReadTotal = 0;
    let pages = 0;

    while (targets.length < maxScans && pages < 8) {
      pages++;
      const { data: rows, error } = await fetchPage(nextAfter, 50);
      if (error) {
        return { ...empty, error: error.message, debug: `query: ${error.message}` };
      }
      const list = rows || [];
      rowsReadTotal += list.length;
      if (list.length === 0) break;

      for (const row of list) {
        const rid = typeof row.id === "number" ? row.id : Number(row.id);
        if (Number.isFinite(rid)) nextAfter = Math.max(nextAfter ?? 0, rid);

        if (jaAutoScan(row)) {
          skipped++;
          continue;
        }
        const proto = protocoloOf(row);
        if (!proto) {
          skipped++;
          continue;
        }
        targets.push(row);
        if (targets.length >= maxScans) break;
      }

      // Se a página veio cheia mas sem candidatos, continua com cursor
      if (list.length < 50) break;
    }

    // Se afterId inicial “pulou” tudo, tenta do zero uma vez
    if (targets.length === 0 && afterId != null && pages > 0) {
      nextAfter = null;
      const { data: rows2 } = await fetchPage(null, 80);
      for (const row of rows2 || []) {
        const rid = typeof row.id === "number" ? row.id : Number(row.id);
        if (Number.isFinite(rid)) nextAfter = Math.max(nextAfter ?? 0, rid);
        if (jaAutoScan(row)) {
          skipped++;
          continue;
        }
        const proto = protocoloOf(row);
        if (!proto) continue;
        targets.push(row);
        if (targets.length >= maxScans) break;
      }
    }

    let autoEncerrados = 0;
    let revisao = 0;
    let failed = 0;
    let scanned = 0;
    let tribunalCalls = 0;
    let lastError = "";
    const samples: string[] = [];

    for (const row of targets) {
      const proto = protocoloOf(row);
      const target = rowToTarget(row);

      try {
        const t0 = Date.now();
        let scanRes: any = null;
        try {
          scanRes = await scanSingleCaseAction(proto, { mode: "both", fast });
          tribunalCalls++;
        } catch (e: any) {
          failed++;
          lastError = e?.message || String(e);
          samples.push(`${proto} · FALHA ${String(lastError).slice(0, 40)}`);
          continue;
        }
        const ms = Date.now() - t0;
        if (!scanRes) {
          failed++;
          continue;
        }
        scanned++;

        const p = (scanRes.casePatch || {}) as any;
        const dados = p.dados && typeof p.dados === "object" ? p.dados : {};

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
          samples.push(`${proto} · ERR ${ms}ms`);
          continue;
        }

        const target2 = {
          ...target,
          ...p,
          datajud_encerrado_tribunal: true,
          dados: { ...target.dados, ...dados },
        };
        const decisao = decidirEncerramentoScan({
          target: target2,
          patch: { ...p, datajud_encerrado_tribunal: true },
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
          } else failed++;
        } else {
          samples.push(`${proto} · ok ${ms}ms`);
        }
      } catch (e: any) {
        failed++;
        lastError = e?.message || String(e);
      }
    }

    const debug = `pages=${pages} rowsRead=${rowsReadTotal} targets=${targets.length} skipped=${skipped} after=${nextAfter}`;

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
      hasMore: targets.length >= maxScans || rowsReadTotal >= 50,
      percentDone: 0,
      percentLeft: 100,
      fonte: "datajud+djen (real)",
      samples,
      lastError: lastError || undefined,
      tribunalCalls,
      debug,
      error:
        scanned === 0 && targets.length === 0
          ? `SEM_CANDIDATOS:${debug}`
          : undefined,
    };
  } catch (e: any) {
    return { ...empty, error: e?.message || String(e) };
  }
}
