/**
 * Checklist operacional — “vale instaurar cumprimento / honorários?”
 * Lote 1: localStorage + espelho em dados.checklist_cumprimento (via server action).
 * Não inventa R$; só gates humanos.
 */

export type ChecklistCumprimento = {
  teorLido: boolean;
  dispositivoClaro: boolean;
  honorariosIdentificados: boolean;
  semReciproca: boolean;
  clienteOriginalBanca: boolean;
  revisadoHumano: boolean;
  updatedAt?: string;
  /** e-mail / id de quem aprovou (auditoria) */
  updatedBy?: string | null;
};

export const CHECKLIST_LABELS: Record<
  Exclude<keyof ChecklistCumprimento, "updatedAt" | "updatedBy">,
  string
> = {
  teorLido: "Teor da sentença / DJEN lido pela equipe",
  dispositivoClaro: "Dispositivo legível (quantia, art. 523 ou sucumbência)",
  honorariosIdentificados: "Honorários a receber identificados (não inventados)",
  semReciproca: "Sem sucumbência recíproca / bloqueio",
  clienteOriginalBanca: "Cliente da carteira original (sem captação fria)",
  revisadoHumano: "Revisão humana antes de qualquer valor ao cliente",
};

const PREFIX = "lexis_checklist_cumprimento_v1:";

export function emptyChecklist(): ChecklistCumprimento {
  return {
    teorLido: false,
    dispositivoClaro: false,
    honorariosIdentificados: false,
    semReciproca: false,
    clienteOriginalBanca: true,
    revisadoHumano: false,
  };
}

export function normalizeChecklist(raw: unknown): ChecklistCumprimento {
  const base = emptyChecklist();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    teorLido: o.teorLido === true,
    dispositivoClaro: o.dispositivoClaro === true,
    honorariosIdentificados: o.honorariosIdentificados === true,
    semReciproca: o.semReciproca === true,
    clienteOriginalBanca: o.clienteOriginalBanca !== false,
    revisadoHumano: o.revisadoHumano === true,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined,
    updatedBy: typeof o.updatedBy === "string" ? o.updatedBy : null,
  };
}

/** Preferir servidor (dados do caso) se mais recente que localStorage. */
export function mergeChecklist(
  local: ChecklistCumprimento,
  remote: ChecklistCumprimento | null | undefined
): ChecklistCumprimento {
  if (!remote) return local;
  const lt = local.updatedAt ? Date.parse(local.updatedAt) : 0;
  const rt = remote.updatedAt ? Date.parse(remote.updatedAt) : 0;
  if (rt >= lt) return normalizeChecklist(remote);
  return local;
}

export function loadChecklist(protocolo: string): ChecklistCumprimento {
  if (typeof window === "undefined") return emptyChecklist();
  try {
    const raw = localStorage.getItem(PREFIX + String(protocolo || "").trim());
    if (!raw) return emptyChecklist();
    return normalizeChecklist(JSON.parse(raw));
  } catch {
    return emptyChecklist();
  }
}

export function saveChecklist(protocolo: string, data: ChecklistCumprimento): void {
  if (typeof window === "undefined") return;
  try {
    const next = { ...data, updatedAt: data.updatedAt || new Date().toISOString() };
    localStorage.setItem(PREFIX + String(protocolo || "").trim(), JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

/** Extrai checklist de LegalCase.dados se existir. */
export function checklistFromCase(c: { protocolo?: string; dados?: unknown } | null | undefined): ChecklistCumprimento | null {
  if (!c) return null;
  const d = c.dados && typeof c.dados === "object" ? (c.dados as any) : null;
  if (!d?.checklist_cumprimento) return null;
  return normalizeChecklist(d.checklist_cumprimento);
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
