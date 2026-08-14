/**
 * KPIs de carteira — separa telemetria de tribunal vs status operacional.
 * - Baixa tribunal: DataJud/DJEN (datajud_encerrado_tribunal / isBaixaTribunal)
 * - Encerrado carteira: situacao/status ENCERRADO|ARQUIVADO|… (isCasoEncerrado)
 */
import { isCasoEncerrado, isBaixaTribunal } from '@/lib/status-encerrado';

export type CarteiraKpis = {
  total: number;
  ativos: number;
  /** Marcados ENCERRADO/ARQUIVADO/etc. na operação (gabinete). */
  encerradosCarteira: number;
  /** Baixa/trânsito detectado no tribunal (DataJud/DJEN) — em qualquer status operacional. */
  baixasTribunal: number;
  /** Interseção: encerrado no gabinete E baixa no tribunal. */
  encerradosComBaixaTribunal: number;
  /** Baixa no tribunal ainda em carteira ativa (não arquivado no gabinete). */
  baixasTribunalAindaAtivos: number;
};

export function computeCarteiraKpis(cases: any[]): CarteiraKpis {
  let ativos = 0;
  let encerradosCarteira = 0;
  let baixasTribunal = 0;
  let encerradosComBaixaTribunal = 0;
  let baixasTribunalAindaAtivos = 0;

  for (const c of cases || []) {
    if (!c) continue;
    const enc = isCasoEncerrado(c);
    const baixa =
      isBaixaTribunal(c) ||
      !!(c as any).datajud_encerrado_tribunal ||
      (c as any).evento_tipo === 'transito_ou_baixa' ||
      (c as any).evento_tipo === 'transito_baixa';

    if (enc) encerradosCarteira++;
    else ativos++;

    if (baixa) {
      baixasTribunal++;
      if (enc) encerradosComBaixaTribunal++;
      else baixasTribunalAindaAtivos++;
    }
  }

  return {
    total: (cases || []).length,
    ativos,
    encerradosCarteira,
    baixasTribunal,
    encerradosComBaixaTribunal,
    baixasTribunalAindaAtivos,
  };
}
