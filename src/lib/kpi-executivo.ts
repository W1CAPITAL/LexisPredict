/**
 * Contagens unificadas: Dashboard ↔ Ações Procedentes ↔ Report.
 * Uma regra só — evita "40 na aba e 12 no painel".
 */
import { isSentencaProcedente, isSentencaImprocedente } from '@/lib/merito-detect';
import { isCasoEncerrado } from '@/lib/status-encerrado';

function dadosOf(c: any): any {
  return c?.dados && typeof c.dados === 'object' ? c.dados : {};
}

export function flagProcedente(c: any): boolean {
  const d = dadosOf(c);
  if (c?.is_procedente || d.is_procedente) return true;
  if (c?.evento_tipo === 'sentenca_procedente' || c?.evento_tipo === 'sentenca_parcial') return true;
  try {
    return isSentencaProcedente(c);
  } catch {
    return false;
  }
}

export function flagImprocedente(c: any): boolean {
  const d = dadosOf(c);
  if (c?.is_improcedente || d.is_improcedente) return true;
  if (c?.evento_tipo === 'sentenca_improcedente') return true;
  try {
    return isSentencaImprocedente(c);
  } catch {
    return false;
  }
}

export function flagCumprimentoAtivo(c: any): boolean {
  const d = dadosOf(c);
  if (c?.cumprimento_encerrado || d.cumprimento_encerrado) return false;
  return !!(
    c?.em_cumprimento_sentenca ||
    d.em_cumprimento_sentenca ||
    c?.evento_tipo === 'cumprimento_sentenca'
  );
}

export function flagCumprimentoEncerrado(c: any): boolean {
  const d = dadosOf(c);
  return !!(c?.cumprimento_encerrado || d.cumprimento_encerrado);
}

export function flagFaltaInstaurar(c: any): boolean {
  const d = dadosOf(c);
  if (flagCumprimentoAtivo(c) || flagCumprimentoEncerrado(c)) return false;
  return !!(
    c?.cumprimento_pendente_necessario ||
    d.cumprimento_pendente_necessario
  );
}

export function oportunidadeOf(c: any): any | null {
  const d = dadosOf(c);
  return (
    c?.oportunidade_instaurar ||
    d.oportunidade_instaurar ||
    c?.detalhes_execucao?.oportunidade_instaurar ||
    d.detalhes_execucao?.oportunidade_instaurar ||
    null
  );
}

export function flagOportunidadeHonorarios(c: any): boolean {
  const op = oportunidadeOf(c);
  if (!op) return false;
  if (op.elegivel === false) return false;
  const score = Number(op.score ?? c?.oportunidade_score ?? 0);
  const tipo = String(op.tipo_credito || op.tipo || '').toLowerCase();
  if (op.acima_limiar_cobranca) return true;
  if (score >= 55) return true;
  if (tipo.includes('sucumb') || tipo === 'ambos') return score >= 40;
  return false;
}

export function flagSucumbencia(c: any): boolean {
  const op = oportunidadeOf(c);
  const tipo = String(op?.tipo_credito || op?.tipo || c?.oportunidade_tipo_credito || '').toLowerCase();
  if (tipo.includes('sucumb') || tipo === 'ambos') return true;
  const blob = `${c?.evento_resumo || ''} ${c?.djen_ultimo_resumo || ''} ${JSON.stringify(op || {})}`.toUpperCase();
  return /SUCUMB[EÊ]NCIA|HONOR[AÁ]RIOS\s+ADVOCAT[IÍ]CIOS|ART\.?\s*85/.test(blob);
}

export type KpiExecutivo = {
  total: number;
  procedentes: number;
  improcedentes: number;
  cumprimentoAtivo: number;
  cumprimentoEncerrado: number;
  faltaInstaurar: number;
  oportunidadeHonorarios: number;
  sucumbencia: number;
  baixasTribunal: number;
  encerradosCarteira: number;
};

/** Fonte única para cards do dashboard / report / aba executiva. */
export function computeKpiExecutivo(cases: any[]): KpiExecutivo {
  const list = cases || [];
  let procedentes = 0;
  let improcedentes = 0;
  let cumprimentoAtivo = 0;
  let cumprimentoEncerrado = 0;
  let faltaInstaurar = 0;
  let oportunidadeHonorarios = 0;
  let sucumbencia = 0;
  let baixasTribunal = 0;
  let encerradosCarteira = 0;

  for (const c of list) {
    if (flagProcedente(c)) procedentes += 1;
    if (flagImprocedente(c)) improcedentes += 1;
    if (flagCumprimentoAtivo(c)) cumprimentoAtivo += 1;
    if (flagCumprimentoEncerrado(c)) cumprimentoEncerrado += 1;
    if (flagFaltaInstaurar(c)) faltaInstaurar += 1;
    if (flagOportunidadeHonorarios(c)) oportunidadeHonorarios += 1;
    if (flagSucumbencia(c)) sucumbencia += 1;
    if (c?.datajud_encerrado_tribunal || dadosOf(c).datajud_encerrado_tribunal) baixasTribunal += 1;
    try {
      if (isCasoEncerrado(c)) encerradosCarteira += 1;
    } catch {
      /* */
    }
  }

  return {
    total: list.length,
    procedentes,
    improcedentes,
    cumprimentoAtivo,
    cumprimentoEncerrado,
    faltaInstaurar,
    oportunidadeHonorarios,
    sucumbencia,
    baixasTribunal,
    encerradosCarteira,
  };
}
