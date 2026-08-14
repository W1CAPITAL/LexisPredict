/**
 * KPIs de carteira — SEPARAR sempre:
 * - Baixa tribunal: isBaixaTribunal (DataJud/DJEN, telemetria)
 * - Encerrado carteira: isCasoEncerrado (status operacional do gabinete)
 *
 * Não misturar. Não recontar datajud_encerrado cru se isBaixaTribunal
 * já excluiu cumprimento ativo (evita painel ≠ dossiê e sobe/desce no scan).
 */
import { isCasoEncerrado, isBaixaTribunal } from '@/lib/status-encerrado';

export type CarteiraKpis = {
  total: number;
  ativos: number;
  /** Marcados ENCERRADO/ARQUIVADO/etc. na operação (gabinete). */
  encerradosCarteira: number;
  /** Baixa/trânsito no tribunal — regra única isBaixaTribunal. */
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
    const baixa = isBaixaTribunal(c);

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
