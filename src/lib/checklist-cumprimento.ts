/**
 * Checklist operacional — “vale instaurar cumprimento / honorários?”
 * Persistência local (localStorage) por CNJ. Não inventa R$; só gates humanos.
 */

export type ChecklistCumprimento = {
  teorLido: boolean;
  dispositivoClaro: boolean;
  honorariosIdentificados: boolean;
  semReciproca: boolean;
  clienteOriginalBanca: boolean;
  revisadoHumano: boolean;
  updatedAt?: string;
};

export const CHECKLIST_LABELS: Record<Exclude<keyof ChecklistCumprimento, "updatedAt">, string> = {
  teorLido: "Teor da sentença / DJEN lido pela equipe",
  dispositivoClaro: "Dispositivo legível (quantia, art. 523 ou sucumbência)",
  honorariosIdentificados: "Honorários a receber identificados (não inventados)",
  semReciproca: "Sem sucumbência recíproca / bloqueio",
  clienteOriginalBanca: "Cliente da carteira original (sem captação fria)",
  revisadoHumano: "Revisão humana antes de qualquer valor ao cliente",
};

const PREFIX = "lexis_checklist_cumprimento_v1:";

function empty(): ChecklistCumprimento {
  return {
    teorLido: false,
    dispositivoClaro: false,
    honorariosIdentificados: false,
    semReciproca: false,
    clienteOriginalBanca: true,
    revisadoHumano: false,
  };
}

export function loadChecklist(protocolo: string): ChecklistCumprimento {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(PREFIX + String(protocolo || "").trim());
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as ChecklistCumprimento;
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

export function saveChecklist(protocolo: string, data: ChecklistCumprimento): void {
  if (typeof window === "undefined") return;
  try {
    const next = { ...data, updatedAt: new Date().toISOString() };
    localStorage.setItem(PREFIX + String(protocolo || "").trim(), JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

/** Aprovado para operação comercial (sem liberar R$ sozinho — precisa também teor+contrato). */
export function checklistAprovado(c: ChecklistCumprimento | null | undefined): boolean {
  if (!c) return false;
  return (
    c.teorLido === true &&
    c.dispositivoClaro === true &&
    c.honorariosIdentificados === true &&
    c.semReciproca === true &&
    c.clienteOriginalBanca === true &&
    c.revisadoHumano === true
  );
}
