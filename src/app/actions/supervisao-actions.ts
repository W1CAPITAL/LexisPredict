'use server';

/**
 * Supervisão — snapshot operacional da empresa inteira.
 * Mostra atendimentos no GERAL (não apenas da última semana):
 * total de retornos registrados, por operador, por semana e por tribunal.
 */

import { getUserContext, getStoredCasesForEmpresa } from '@/lib/server-db';
import { parseUltimoAtendimento, weekBounds } from '@/lib/atendimento-semana';
import { isCasoEncerrado } from '@/lib/status-encerrado';

export type SupervisaoSnapshot = {
  total: number;
  ativos: number;
  encerrados: number;
  vencidos: number;
  novidades: number;
  ba: number;
  cumprimento: number;
  atendimentosTotais: number;
  atendidosSemana: number;
  semRetorno: number;
  operadores: {
    nome: string;
    total: number;
    ativos: number;
    encerrados: number;
    vencidos: number;
    novidades: number;
    atendimentos: number;
    atendidosSemana: number;
    semRetorno: number;
    ba: number;
  }[];
  timelineSemanal: { label: string; atendidos: number }[];
  porTribunal: { label: string; value: number }[];
  porStatus: { label: string; value: number }[];
  porEscritorio: { label: string; value: number }[];
};

export async function getSupervisaoSnapshotAction(): Promise<{
  success: boolean;
  snapshot?: SupervisaoSnapshot;
  error?: string;
}> {
  try {
    const ctx = await getUserContext();
    if (!ctx.empresa_id) return { success: false, error: 'Sessão expirada.' };

    const cases = await getStoredCasesForEmpresa(ctx.empresa_id, false);
    if (!cases || !cases.length) {
      return {
        success: true,
        snapshot: {
          total: 0,
          ativos: 0,
          encerrados: 0,
          vencidos: 0,
          novidades: 0,
          ba: 0,
          cumprimento: 0,
          atendimentosTotais: 0,
          atendidosSemana: 0,
          semRetorno: 0,
          operadores: [],
          timelineSemanal: [],
          porTribunal: [],
          porStatus: [],
          porEscritorio: [],
        },
      };
    }

    const now = new Date();
    const semana = weekBounds(now);

    let ativos = 0,
      encerrados = 0,
      vencidos = 0,
      novidades = 0,
      ba = 0,
      cumprimento = 0,
      atendimentosTotais = 0,
      atendidosSemana = 0,
      semRetorno = 0;

    const opMap = new Map<string, SupervisaoSnapshot['operadores'][number]>();
    const tjMap = new Map<string, number>();
    const statusMap = new Map<string, number>();
    const escMap = new Map<string, number>();

    // Timeline: 8 semanas atrás até agora
    const weekBuckets: { start: Date; end: Date; atendidos: number; label: string }[] = [];
    for (let w = 7; w >= 0; w--) {
      const start = new Date(now);
      const dow = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - dow - w * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      const from = `${start.getDate()}/${start.getMonth() + 1}`;
      const to = `${end.getDate()}/${end.getMonth() + 1}`;
      weekBuckets.push({ start, end, atendidos: 0, label: `${from}–${to}` });
    }

    for (const c of cases as any[]) {
      const encerrado = isCasoEncerrado(c);
      if (encerrado) encerrados++;
      else ativos++;

      const status = String(c.status || 'Sem Prazo');
      if (/vencido|cr[ií]tico/i.test(status)) vencidos++;
      if (c.tem_novo_andamento || c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao) novidades++;
      if (c.indicio_busca_apreensao || c.evento_tipo === 'ba') ba++;
      if (c.em_cumprimento_sentenca || c.evento_tipo === 'cumprimento_sentenca') cumprimento++;

      const retorno = String(c.ultimoRetorno || c.ultimo_retorno || '').trim();
      const retornoDate = retorno ? parseUltimoAtendimento(retorno) : null;
      if (retornoDate) {
        atendimentosTotais++;
        if (retornoDate >= semana.start && retornoDate <= semana.end) atendidosSemana++;
        for (const wk of weekBuckets) {
          if (retornoDate >= wk.start && retornoDate <= wk.end) wk.atendidos++;
        }
      } else {
        semRetorno++;
      }

      const opNome = String(c.assistente || c.atendente || '').trim() || 'Sem responsável';
      let op = opMap.get(opNome);
      if (!op) {
        op = { nome: opNome, total: 0, ativos: 0, encerrados: 0, vencidos: 0, novidades: 0, atendimentos: 0, atendidosSemana: 0, semRetorno: 0, ba: 0 };
        opMap.set(opNome, op);
      }
      op.total++;
      if (encerrado) op.encerrados++;
      else op.ativos++;
      if (/vencido|cr[ií]tico/i.test(status)) op.vencidos++;
      if (c.tem_novo_andamento || c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao) op.novidades++;
      if (c.indicio_busca_apreensao) op.ba++;
      if (retornoDate) {
        op.atendimentos++;
        if (retornoDate >= semana.start && retornoDate <= semana.end) op.atendidosSemana++;
      } else {
        op.semRetorno++;
      }

      const tj = String(c.tribunal || '—');
      tjMap.set(tj, (tjMap.get(tj) || 0) + 1);
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
      const esc = String(c.escritorio || 'Sem escritório');
      escMap.set(esc, (escMap.get(esc) || 0) + 1);
    }

    const toLabelVal = (m: Map<string, number>) =>
      [...m.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);

    return {
      success: true,
      snapshot: {
        total: cases.length,
        ativos,
        encerrados,
        vencidos,
        novidades,
        ba,
        cumprimento,
        atendimentosTotais,
        atendidosSemana,
        semRetorno,
        operadores: [...opMap.values()].sort((a, b) => b.total - a.total),
        timelineSemanal: weekBuckets.map((w) => ({ label: w.label, atendidos: w.atendidos })),
        porTribunal: toLabelVal(tjMap),
        porStatus: toLabelVal(statusMap),
        porEscritorio: toLabelVal(escMap),
      },
    };
  } catch (e: any) {
    console.error('[supervisao]', e);
    return { success: false, error: e?.message || 'Falha ao carregar supervisão.' };
  }
}
