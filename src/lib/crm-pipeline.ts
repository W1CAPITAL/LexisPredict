/**
 * Pipeline helpers inspirados em Twenty (Opportunity.stage/position)
 * e disciplina Comp AI (nada inventado — só dados observados).
 */
import { CRM_FUNIL_STATUS, CRM_FUNIL_LABELS, type CrmFunilStatus, type CrmNegocio } from './crm-types';

export const PIPELINE_STAGES: CrmFunilStatus[] = [...CRM_FUNIL_STATUS];

export function stageLabel(status: string): string {
  return CRM_FUNIL_LABELS[status as CrmFunilStatus] || status;
}

export function groupByStage(negocios: CrmNegocio[]): Record<string, CrmNegocio[]> {
  const map: Record<string, CrmNegocio[]> = {};
  for (const s of PIPELINE_STAGES) map[s] = [];
  for (const n of negocios || []) {
    const st = String(n.status || 'lead');
    if (!map[st]) map[st] = [];
    map[st].push(n);
  }
  // position ASC se existir
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => {
      const pa = Number((a as any).position ?? 9999);
      const pb = Number((b as any).position ?? 9999);
      if (pa !== pb) return pa - pb;
      return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''));
    });
  }
  return map;
}

export function stageValueSum(list: CrmNegocio[]): number {
  return (list || []).reduce((s, n) => s + (Number(n.valor_total) || 0), 0);
}

export function isTerminalStage(status: string): boolean {
  return status === 'concluido' || status === 'cancelado';
}

/** Sugestões determinísticas (Comp AI: só o que os dados mostram) */
export function observedPipelineHints(negocios: CrmNegocio[], receberAtrasados = 0): string[] {
  const hints: string[] = [];
  const leads = (negocios || []).filter((n) => n.status === 'lead').length;
  const prop = (negocios || []).filter((n) => n.status === 'proposta').length;
  const inad = (negocios || []).filter((n) => n.status === 'inadimplente').length;
  if (leads > 5) hints.push(`${leads} leads sem avanço — priorizar contato ou arquivar cancelados.`);
  if (prop > 0) hints.push(`${prop} proposta(s) aberta(s) — definir follow-up de fechamento.`);
  if (inad > 0) hints.push(`${inad} negócio(s) inadimplente(s) — acionar régua de cobrança.`);
  if (receberAtrasados > 0) hints.push(`Há títulos atrasados (R$) — ver Financeiro / Cobrança.`);
  if (!hints.length) hints.push('Pipeline sem alertas observados no momento.');
  return hints;
}
