/**
 * Motores expostos na UI — Omni (cascata interna) + Local.
 * Omni tenta todas as APIs configuradas (Claude, Grok, Groq, NVIDIA, OpenRouter…)
 * sem mostrar erro intermediário quando o token de uma acaba.
 */

export type MotorId = "omni" | "local_only";

export type MotorDef = {
  id: MotorId;
  label: string;
  short: string;
  desc: string;
  scope: "server" | "browser" | "local";
  envKey?: string;
};

export const MOTORS: MotorDef[] = [
  {
    id: "omni",
    label: "Omni (cascata automática)",
    short: "Omni",
    desc: "Uma rota: tenta Claude → Grok → Groq → NVIDIA → OpenRouter → Gemini → fallbacks. Se uma API esgota token, passa para a próxima sem erro na tela.",
    scope: "server",
  },
  {
    id: "local_only",
    label: "Motor Lexis (scripts)",
    short: "Local",
    desc: "Scripts determinísticos — sem API, instantâneo.",
    scope: "local",
  },
];

/** Compat: IDs antigos mapeiam para omni */
export function resolveMotorId(id?: string | null): MotorId {
  const s = String(id || "omni").toLowerCase();
  if (s === "local_only" || s === "local" || s === "lexis") return "local_only";
  return "omni";
}
