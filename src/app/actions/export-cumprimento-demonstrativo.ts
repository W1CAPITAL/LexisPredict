'use server';

/**
 * Demonstrativo comercial — fila de cumprimento / honorários (Lote 6).
 * XLSX tabular sem inventar R$ (colunas de score e flags apenas).
 */

import { getStoredCasesForEmpresa, getUserContext } from '@/lib/server-db';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { reconciliarFlagsCumprimento } from '@/lib/reconciliar-cumprimento-flags';
import { extrairCreditoSentenca } from '@/lib/credito-sentenca-extract';
import { getLimiarCobranca } from '@/lib/oportunidade-cumprimento';

function aoaToCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? '');
          if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(';')
    )
    .join('\n');
}

export async function exportDemonstrativoCumprimentoAction(opts?: {
  limiar?: number;
  onlyParceiro?: boolean;
}): Promise<{ success: boolean; csv?: string; filename?: string; count?: number; error?: string }> {
  try {
    const { empresa_id, isSuperAdmin, isSupervisor } = await getUserContext();
    if (!empresa_id) return { success: false, error: 'Sessão expirada' };
    const limiar = getLimiarCobranca(opts?.limiar ?? null);
    const cases = await getStoredCasesForEmpresa(empresa_id, !!(isSuperAdmin || isSupervisor));
    const header = [
      'protocolo',
      'cliente',
      'tribunal',
      'status_executivo',
      'is_procedente',
      'pendente_instaurar',
      'em_cumprimento',
      'score',
      'elegivel',
      'tipo_credito',
      'acima_limiar',
      'texto_pobre',
      'art523',
      'sucumbencia_reu',
      'encontro_contas',
      'valores_no_teor',
      'honorarios_pct',
      'ultimo_retorno',
      'telefone',
    ];
    const rows: (string | number)[][] = [header];

    for (const c of cases) {
      if (isCasoEncerrado(c) && !(c as any).cumprimento_pendente_necessario) {
        // ainda inclui se flags executivas
      }
      const dados = (c as any).dados && typeof (c as any).dados === 'object' ? (c as any).dados : {};
      const r = reconciliarFlagsCumprimento({
        cumprimento_pendente_necessario: c.cumprimento_pendente_necessario,
        em_cumprimento_sentenca: c.em_cumprimento_sentenca,
        cumprimento_ativo: (c as any).cumprimento_ativo,
        cumprimento_encerrado: (c as any).cumprimento_encerrado,
        status_executivo: (c as any).status_executivo || dados.status_executivo,
        is_procedente: c.is_procedente,
        dados,
      });
      const op =
        (c as any).oportunidade_instaurar ||
        dados.oportunidade_instaurar ||
        dados.detalhes_execucao?.oportunidade_instaurar;
      const score = Number((c as any).oportunidade_score ?? op?.score ?? 0);
      const elegivel = !!(c as any).oportunidade_elegivel || !!op?.elegivel;
      const tipo = String((c as any).oportunidade_tipo_credito || op?.tipo_credito || '');
      if (opts?.onlyParceiro) {
        if (!elegivel || score < limiar) continue;
        if (tipo !== 'sucumbencia' && tipo !== 'ambos') continue;
        if (r.status_executivo === 'ativo' || r.status_executivo === 'encerrado') continue;
      } else {
        // fila operacional: pendente, procedente, elegível ou em cumprimento
        const keep =
          r.status_executivo === 'pendente' ||
          r.status_executivo === 'procedente' ||
          r.status_executivo === 'ativo' ||
          elegivel ||
          !!c.is_procedente ||
          !!c.cumprimento_pendente_necessario ||
          !!c.em_cumprimento_sentenca;
        if (!keep) continue;
      }

      const blob = [
        (c as any).datajud_ultimo_nome,
        dados.datajud_ultimo_nome,
        (c as any).djen_ultimo_resumo,
        dados.djen_ultimo_resumo,
        ...(Array.isArray(dados.djen_textos) ? dados.djen_textos : []),
      ]
        .filter(Boolean)
        .join('\n');
      const extrato = extrairCreditoSentenca(blob);

      rows.push([
        c.protocolo || '',
        c.cliente || '',
        c.tribunal || '',
        r.status_executivo,
        c.is_procedente ? '1' : '0',
        r.cumprimento_pendente_necessario ? '1' : '0',
        r.em_cumprimento_sentenca ? '1' : '0',
        score,
        elegivel ? '1' : '0',
        tipo,
        elegivel && score >= limiar ? '1' : '0',
        op?.texto_pobre || (c as any).texto_pobre ? '1' : '0',
        extrato.art523 ? '1' : '0',
        extrato.sucumbenciaReu ? '1' : '0',
        extrato.encontroContas ? '1' : '0',
        extrato.valoresDetectados.join(' | '),
        extrato.honorariosPercentual ?? '',
        (c as any).ultimoRetorno || '',
        (c as any).telefone || '',
      ]);
    }

    const csv = '\uFEFF' + aoaToCsv(rows);
    const tag = opts?.onlyParceiro ? 'parceiro' : 'operacional';
    return {
      success: true,
      csv,
      filename: `demonstrativo-cumprimento-${tag}-${new Date().toISOString().slice(0, 10)}.csv`,
      count: rows.length - 1,
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha no demonstrativo' };
  }
}
