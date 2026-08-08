/**
 * IA Preditiva (F5) — estatísticas por tribunal/vara/juiz a partir da carteira.
 * Padrões de sentença (procedente × improcedente), risco e tempo médio de baixa.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { LegalCase, isCasoEncerrado } from './case-logic';

export interface GrupoStats {
  chave: string;
  total: number;
  ativos: number;
  vencidos: number;
  novoAndamento: number;
  baixas: number;
  procedentes: number;
  improcedentes: number;
  semDefinicao: number;
  taxaProcedencia: number;
  tempoMedioBaixaDias: number | null;
  risco: number;
}

export interface InsightsResultado {
  geral: {
    total: number;
    ativos: number;
    baixas: number;
    novoAndamento: number;
    taxaProcedenciaGeral: number;
    riscoMedio: number;
    tempoMedioBaixaDias: number | null;
  };
  tribunais: GrupoStats[];
  varas: GrupoStats[];
  insights: {
    tribunalMaiorRisco: GrupoStats | null;
    tribunalMaiorProcedencia: GrupoStats | null;
    tribunalMaisLento: GrupoStats | null;
  };
}

function isProcedente(c: LegalCase): boolean {
  if (c.evento_tipo === 'sentenca_procedente') return true;
  const r = String(c.evento_resumo || '');
  return /PROCEDENTE/i.test(r) && !/IMPROCEDENTE/i.test(r);
}

function isImprocedente(c: LegalCase): boolean {
  if (c.evento_tipo === 'sentenca_improcedente') return true;
  const r = String(c.evento_resumo || c.datajud_ultimo_nome || '');
  return /IMPROCEDENTE/i.test(r);
}

function diasUteisAte(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
}

function agrupar(cases: LegalCase[], chaveFn: (c: LegalCase) => string | null): GrupoStats[] {
  const mapa = new Map<string, LegalCase[]>();
  for (const c of cases) {
    const chave = chaveFn(c);
    if (!chave) continue;
    const arr = mapa.get(chave) || [];
    arr.push(c);
    mapa.set(chave, arr);
  }
  const grupos: GrupoStats[] = [];
  for (const [chave, itens] of mapa) {
    const ativos = itens.filter((c) => !isCasoEncerrado(c));
    const vencidos = itens.filter((c) => c.status === 'Vencido' || c.status === 'Caso Crítico').length;
    const novoAndamento = itens.filter((c) => !!c.tem_novo_andamento || !!c.tem_atualizacao_pos_retorno).length;
    const baixas = itens.filter((c) => !!c.datajud_encerrado_tribunal).length;
    const procedentes = itens.filter(isProcedente).length;
    const improcedentes = itens.filter(isImprocedente).length;
    const semDefinicao = Math.max(0, itens.length - procedentes - improcedentes);
    const taxaProcedencia = procedentes + improcedentes > 0 ? (procedentes / (procedentes + improcedentes)) * 100 : 0;
    const tempoBaixa = itens
      .filter((c) => !!c.datajud_encerrado_tribunal)
      .map((c) => diasUteisAte(c.datajud_consultado_em))
      .filter((d): d is number => d !== null);
    const tempoMedioBaixaDias = tempoBaixa.length
      ? Math.round(tempoBaixa.reduce((a, b) => a + b, 0) / tempoBaixa.length)
      : null;
    const riscoBase = ativos.length
      ? ((vencidos / ativos.length) * 100 + (novoAndamento / ativos.length) * 50)
      : 0;
    const risco = Math.min(100, Math.round(riscoBase));
    grupos.push({
      chave,
      total: itens.length,
      ativos: ativos.length,
      vencidos,
      novoAndamento,
      baixas,
      procedentes,
      improcedentes,
      semDefinicao,
      taxaProcedencia: Math.round(taxaProcedencia * 10) / 10,
      tempoMedioBaixaDias,
      risco,
    });
  }
  return grupos.sort((a, b) => b.total - a.total);
}

export function calcularEstatisticas(cases: LegalCase[]): InsightsResultado {
  const lista = Array.isArray(cases) ? cases : [];
  const tribunais = agrupar(lista, (c) => (c.tribunal ? String(c.tribunal).toUpperCase() : 'NÃO INFORMADO'));
  const varas = agrupar(lista, (c) => (c.orgao_julgador ? String(c.orgao_julgador).toUpperCase() : null));

  const ativos = lista.filter((c) => !isCasoEncerrado(c));
  const procedentes = lista.filter(isProcedente).length;
  const improcedentes = lista.filter(isImprocedente).length;
  const baixas = lista.filter((c) => !!c.datajud_encerrado_tribunal).length;
  const novoAndamento = lista.filter((c) => !!c.tem_novo_andamento || !!c.tem_atualizacao_pos_retorno).length;
  const vencidos = lista.filter((c) => c.status === 'Vencido' || c.status === 'Caso Crítico').length;
  const taxaProcedenciaGeral = procedentes + improcedentes > 0 ? (procedentes / (procedentes + improcedentes)) * 100 : 0;
  const riscoMedio = ativos.length ? Math.min(100, Math.round((vencidos / ativos.length) * 100 + (novoAndamento / ativos.length) * 50)) : 0;

  const tempoBaixa = lista
    .filter((c) => !!c.datajud_encerrado_tribunal)
    .map((c) => diasUteisAte(c.datajud_consultado_em))
    .filter((d): d is number => d !== null);
  const tempoMedioBaixaDias = tempoBaixa.length
    ? Math.round(tempoBaixa.reduce((a, b) => a + b, 0) / tempoBaixa.length)
    : null;

  const comRisco = tribunais.filter((g) => g.total >= 2);
  const tribunalMaiorRisco = comRisco.length ? [...comRisco].sort((a, b) => b.risco - a.risco)[0] : tribunais[0] || null;
  const tribunalMaiorProcedencia = comRisco.length
    ? [...comRisco].sort((a, b) => b.taxaProcedencia - a.taxaProcedencia)[0]
    : tribunais[0] || null;
  const tribunalMaisLento = comRisco.length
    ? [...comRisco].sort((a, b) => (b.tempoMedioBaixaDias || 0) - (a.tempoMedioBaixaDias || 0))[0]
    : tribunais[0] || null;

  return {
    geral: {
      total: lista.length,
      ativos: ativos.length,
      baixas,
      novoAndamento,
      taxaProcedenciaGeral: Math.round(taxaProcedenciaGeral * 10) / 10,
      riscoMedio,
      tempoMedioBaixaDias,
    },
    tribunais,
    varas,
    insights: { tribunalMaiorRisco, tribunalMaiorProcedencia, tribunalMaisLento },
  };
}
