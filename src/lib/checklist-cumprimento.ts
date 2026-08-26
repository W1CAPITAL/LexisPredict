/**
 * Checklist "vale a pena instaurar?" — gravado no browser por CNJ.
 */

export type ChecklistCumprimento = {
  meritoComQuantiaOuHonorarios: boolean | null;
  transitoOuTitulo: boolean | null;
  naoHaCumprimentoAtivo: boolean | null;
  naoSucumbenciaRuim: boolean | null;
  teorSuficiente: boolean | null;
  reuExecutavel: boolean | null;
  revisadoHumano: boolean | null;
  updatedAt?: string;
};

export const CHECKLIST_LABELS: Record<keyof Omit<ChecklistCumprimento, 'updatedAt'>, string> = {
  meritoComQuantiaOuHonorarios: 'Mérito com quantia ou honorários a cargo do réu',
  transitoOuTitulo: 'Há trânsito / título executivo formado',
  naoHaCumprimentoAtivo: 'Ainda não há cumprimento ativo',
  naoSucumbenciaRuim: 'Sem sucumbência recíproca / a cargo do autor',
  teorSuficiente: 'Teor da decisão legível o bastante',
  reuExecutavel: 'Réu com solvência prática (ex.: banco)',
  revisadoHumano: 'Revisão humana concluída',
};

const KEY = 'lexis_checklist_cumprimento_v1';

export function loadChecklist(protocolo: string): ChecklistCumprimento {
  const empty: ChecklistCumprimento = {
    meritoComQuantiaOuHonorarios: null,
    transitoOuTitulo: null,
    naoHaCumprimentoAtivo: null,
    naoSucumbenciaRuim: null,
    teorSuficiente: null,
    reuExecutavel: null,
    revisadoHumano: null,
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const all = JSON.parse(raw) as Record<string, ChecklistCumprimento>;
    return { ...empty, ...(all[protocolo] || {}) };
  } catch {
    return empty;
  }
}

export function saveChecklist(protocolo: string, data: ChecklistCumprimento) {
  try {
    const raw = localStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, ChecklistCumprimento>) : {};
    all[protocolo] = { ...data, updatedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function checklistAprovado(c: ChecklistCumprimento): boolean {
  const keys = Object.keys(CHECKLIST_LABELS) as (keyof typeof CHECKLIST_LABELS)[];
  return keys.every((k) => c[k] === true);
}
