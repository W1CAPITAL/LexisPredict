/**
 * Formata título/detalhe de alerta para UI — sem tags BA legadas.
 */
import { sanitizeEventoResumo } from './case-logic';
import { getSinalCapa } from './sinal-capa';
import type { LegalCase } from './case-logic';

export function formatAlertaLinha(c: LegalCase): { titulo: string; detalhe: string; prioridade: number } {
  const s = getSinalCapa(c);
  const detalhe =
    sanitizeEventoResumo(s.detalhe) ||
    sanitizeEventoResumo(c.evento_resumo) ||
    s.detalhe ||
    c.datajud_ultimo_nome ||
    c.djen_ultimo_resumo ||
    'Sem detalhe adicional.';
  return {
    titulo: s.titulo,
    detalhe: String(detalhe).slice(0, 200),
    prioridade: s.prioridade,
  };
}
