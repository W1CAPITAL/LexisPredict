"use server";

/**
 * Scanner complementar para Ações · Cumprimentos/Procedentes:
 * DataJud + DJEN (scanSingleCaseAction) + motor de Processos Parados
 * para refinar "falta instaurar cumprimento".
 *
 * Não lista quem já está em cumprimento ativo.
 */
import { getUserContext, getSupabaseAdmin, updateCaseDataJudSystem } from "@/lib/server-db";
import { scanSingleCaseAction } from "@/app/actions/case-actions";
import {
  detectFlagsFase,
  ultimaDataTribunal,
  scoreAcaoParado,
  aindaDaParaAgirNoProcesso,
  type EstadoParado,
} from "@/lib/processos-parados";

const MAX = 8;

function dadosOf(row: any) {
  return row?.dados && typeof row.dados === "object" ? row.dados : {};
}

function isAtivoCumprimento(row: any): boolean {
  const d = dadosOf(row);
  if (row.em_cumprimento_sentenca || d.em_cumprimento_sentenca) return true;
  if (d.cumprimento_ativo || row.cumprimento_ativo) return true;
  const st = String(d.status_executivo || row.status_executivo || "").toLowerCase();
  return st === "ativo";
}

function isCandidatoInstaurar(row: any): boolean {
  if (isAtivoCumprimento(row)) return false;
  const d = dadosOf(row);
  if (d.cumprimento_encerrado || row.cumprimento_encerrado) return false;
  if (row.cumprimento_pendente_necessario || d.cumprimento_pendente_necessario) return true;
  if (row.is_procedente || d.is_procedente) return true;
  if (d.oportunidade_elegivel || d.oportunidade_instaurar?.elegivel) return true;
  const st = String(d.status_executivo || "").toLowerCase();
  return st === "pendente" || st === "procedente";
}

export async function scanInstaurarComParadosBatchAction(opts?: {
  limit?: number;
  afterId?: number | null;
}): Promise<{
  success: boolean;
  scanned: number;
  refined: number;
  skipped: number;
  failed: number;
  afterId: number | null;
  hasMore: boolean;
  samples: string[];
  error?: string;
}> {
  const empty = {
    success: false,
    scanned: 0,
    refined: 0,
    skipped: 0,
    failed: 0,
    afterId: null as number | null,
    hasMore: false,
    samples: [] as string[],
  };

  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { ...empty, error: "Sem sessão" };

    const limit = Math.min(Math.max(opts?.limit ?? MAX, 1), MAX);
    const afterId = opts?.afterId ?? null;
    const admin = await getSupabaseAdmin();

    let q = admin
      .from("processos")
      .select(
        "id, protocolo_ref, dados, status, status_interno, is_procedente, em_cumprimento_sentenca, cumprimento_pendente_necessario, datajud_ultimo_movimento, datajud_ultimo_nome, datajud_consultado_em, djen_ultimo_resumo, djen_ultima_data, datajud_encerrado_tribunal, procedente_motivo"
      )
      .eq("empresa_id", empresa_id)
      .order("id", { ascending: true })
      .limit(limit * 25);

    if (afterId != null && afterId > 0) q = q.gt("id", afterId);

    const { data: rows, error } = await q;
    if (error) return { ...empty, error: error.message };

    const targets: any[] = [];
    let nextAfter = afterId;
    let skipped = 0;

    for (const row of rows || []) {
      const rid = typeof row.id === "number" ? row.id : Number(row.id);
      if (Number.isFinite(rid)) nextAfter = Math.max(nextAfter ?? 0, rid);
      if (!isCandidatoInstaurar(row)) {
        skipped++;
        continue;
      }
      const proto = String(row.protocolo_ref || dadosOf(row).protocolo || "").trim();
      if (!proto) {
        skipped++;
        continue;
      }
      targets.push(row);
      if (targets.length >= limit) break;
    }

    let scanned = 0;
    let refined = 0;
    let failed = 0;
    const samples: string[] = [];

    for (const row of targets) {
      const proto = String(row.protocolo_ref || "").trim();
      const d0 = dadosOf(row);

      try {
        const t0 = Date.now();
        const scanRes = await scanSingleCaseAction(proto, { mode: "both", fast: true });
        scanned++;
        const ms = Date.now() - t0;

        if (!scanRes?.success && !scanRes?.casePatch) {
          failed++;
          samples.push(`${proto} · scan-fail ${ms}ms`);
          continue;
        }

        // Monta caso “pós-scan” para o motor de parados
        const p = (scanRes.casePatch || {}) as any;
        const dadosP = p.dados && typeof p.dados === "object" ? p.dados : {};
        const merged: any = {
          ...d0,
          ...p,
          ...dadosP,
          protocolo: proto,
          datajud_ultimo_movimento:
            p.datajud_ultimo_movimento || row.datajud_ultimo_movimento || d0.datajud_ultimo_movimento,
          datajud_ultimo_nome: p.datajud_ultimo_nome || row.datajud_ultimo_nome || d0.datajud_ultimo_nome,
          djen_ultimo_resumo: p.djen_ultimo_resumo || row.djen_ultimo_resumo || d0.djen_ultimo_resumo,
          djen_ultima_data: p.djen_ultima_data || row.djen_ultima_data || d0.djen_ultima_data,
          is_procedente: p.is_procedente ?? row.is_procedente ?? d0.is_procedente,
          em_cumprimento_sentenca:
            p.em_cumprimento_sentenca ?? row.em_cumprimento_sentenca ?? d0.em_cumprimento_sentenca,
          cumprimento_pendente_necessario:
            p.cumprimento_pendente_necessario ??
            row.cumprimento_pendente_necessario ??
            d0.cumprimento_pendente_necessario,
          datajud_encerrado_tribunal:
            p.datajud_encerrado_tribunal ?? row.datajud_encerrado_tribunal ?? d0.datajud_encerrado_tribunal,
        };

        // Já ativo após o scan → não força instaurar
        if (merged.em_cumprimento_sentenca || merged.cumprimento_ativo) {
          samples.push(`${proto} · já-ativo ${ms}ms`);
          continue;
        }

        const fase = detectFlagsFase(merged as any);
        const ult = ultimaDataTribunal(merged as any);
        const diasParado =
          ult.date != null
            ? Math.max(0, Math.floor((Date.now() - ult.date.getTime()) / 86400000))
            : 0;
        let estado: EstadoParado = !ult.temSinalTribunal
          ? "sem_scan"
          : ult.fonte === "datajud" || ult.fonte === "djen" || ult.fonte === "evento"
            ? "parado_confirmado"
            : "parado_provavel";
        const scoreParados = scoreAcaoParado(diasParado, null, merged as any, estado);
        const acionavel = aindaDaParaAgirNoProcesso(merged as any);

        const faltaInstaurar =
          !!merged.cumprimento_pendente_necessario ||
          (!!merged.is_procedente && !merged.em_cumprimento_sentenca && !fase.cumprimentoRecebido);

        const motor_parados = {
          em: new Date().toISOString(),
          dias_parado_tribunal: diasParado,
          estado,
          fonte_ultima: ult.fonte,
          score_acao: scoreParados,
          acionavel,
          fase: {
            cumprimentoAberto: !!fase.cumprimentoAberto,
            cumprimentoRecebido: !!fase.cumprimentoRecebido,
            temSentenca: !!fase.temSentenca,
            replicaPendente: !!fase.replicaPendente,
          },
          falta_instaurar_cumprimento: faltaInstaurar && !fase.cumprimentoRecebido,
          via: "scan_datajud_djen_parados",
        };

        const patch: Record<string, any> = {
          ...p,
          dados: {
            ...d0,
            ...dadosP,
            motor_parados,
            // reforço legível na aba
            falta_instaurar_cumprimento: motor_parados.falta_instaurar_cumprimento,
            parados_score_acao: scoreParados,
            parados_dias_tribunal: diasParado,
          },
        };

        if (motor_parados.falta_instaurar_cumprimento && !merged.em_cumprimento_sentenca) {
          patch.cumprimento_pendente_necessario = true;
          patch.dados.cumprimento_pendente_necessario = true;
          if (!patch.dados.status_executivo || patch.dados.status_executivo === "nenhum") {
            patch.dados.status_executivo = "pendente";
          }
        }

        const saved = await updateCaseDataJudSystem(row.id, patch);
        if (saved?.success) {
          refined++;
          samples.push(
            `${proto} · ${faltaInstaurar ? "INSTAURAR" : "ok"} · parados=${scoreParados} · ${ms}ms`
          );
        } else {
          failed++;
          samples.push(`${proto} · persist-fail`);
        }
      } catch (e: any) {
        failed++;
        samples.push(`${proto} · ${String(e?.message || e).slice(0, 40)}`);
      }
    }

    const rowsRead = (rows || []).length;
    return {
      success: true,
      scanned,
      refined,
      skipped,
      failed,
      afterId: nextAfter,
      hasMore: rowsRead >= limit * 10 || targets.length >= limit,
      samples,
    };
  } catch (e: any) {
    return { ...empty, error: e?.message || String(e) };
  }
}
