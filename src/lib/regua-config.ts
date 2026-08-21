/**
 * Régua configurável por empresa (D-3, D0, D+3, D+7, crítico…).
 * Persistência: localStorage (cliente) ou tabela empresa_settings no futuro.
 */

export type ReguaEtapaId = "D-3" | "D0" | "D+3" | "D+7" | "critico";

export type ReguaEtapaConfig = {
  id: ReguaEtapaId;
  /** diaRelativo mínimo (inclusive) */
  minDia: number;
  /** diaRelativo máximo (inclusive); null = sem teto */
  maxDia: number | null;
  label: string;
  prioridade: number;
  canalSugerido: "interno" | "whatsapp_manual" | "email_manual" | "ligacao";
  scriptTemplate: string; // {{cliente}} {{valor}} {{vencimento}} {{dias}}
};

export type ReguaEmpresaConfig = {
  etapas: ReguaEtapaConfig[];
  /** Chave Pix estática da empresa (copia-e-cola) */
  pixChave?: string;
  pixNome?: string;
  pixCidade?: string;
};

export const REGUA_DEFAULT: ReguaEmpresaConfig = {
  etapas: [
    {
      id: "D-3",
      minDia: -3,
      maxDia: -1,
      label: "Lembrete (antes do vencimento)",
      prioridade: 40,
      canalSugerido: "whatsapp_manual",
      scriptTemplate:
        "Olá {{cliente}}, lembrando que o valor de {{valor}} vence em {{vencimento}}. Qualquer dúvida estamos à disposição.",
    },
    {
      id: "D0",
      minDia: 0,
      maxDia: 0,
      label: "Vence hoje",
      prioridade: 70,
      canalSugerido: "ligacao",
      scriptTemplate:
        "Olá {{cliente}}, o valor de {{valor}} vence hoje ({{vencimento}}). Pode confirmar o pagamento?",
    },
    {
      id: "D+3",
      minDia: 1,
      maxDia: 3,
      label: "Atraso leve",
      prioridade: 85,
      canalSugerido: "whatsapp_manual",
      scriptTemplate:
        "Olá {{cliente}}, identificamos atraso de {{dias}} dia(s) no valor {{valor}} (venc. {{vencimento}}). Segue Pix para regularização.",
    },
    {
      id: "D+7",
      minDia: 4,
      maxDia: 7,
      label: "Atraso 1 semana",
      prioridade: 95,
      canalSugerido: "ligacao",
      scriptTemplate:
        "Olá {{cliente}}, o título de {{valor}} está há {{dias}} dias em atraso. Precisamos regularizar hoje para evitar medidas adicionais.",
    },
    {
      id: "critico",
      minDia: 8,
      maxDia: null,
      label: "Atraso crítico",
      prioridade: 100,
      canalSugerido: "ligacao",
      scriptTemplate:
        "URGENTE — {{cliente}}: {{valor}} vencido há {{dias}} dias ({{vencimento}}). Favor retornar imediatamente.",
    },
  ],
  pixChave: "",
  pixNome: "",
  pixCidade: "SAO PAULO",
};

const STORAGE_KEY = "lexis_regua_config_v1";

export function loadReguaConfig(): ReguaEmpresaConfig {
  if (typeof window === "undefined") return REGUA_DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return REGUA_DEFAULT;
    const parsed = JSON.parse(raw) as ReguaEmpresaConfig;
    return {
      ...REGUA_DEFAULT,
      ...parsed,
      etapas: parsed.etapas?.length ? parsed.etapas : REGUA_DEFAULT.etapas,
    };
  } catch {
    return REGUA_DEFAULT;
  }
}

export function saveReguaConfig(cfg: ReguaEmpresaConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function resolverEtapa(
  diaRelativo: number,
  cfg: ReguaEmpresaConfig = REGUA_DEFAULT
): ReguaEtapaConfig | null {
  for (const e of cfg.etapas) {
    const okMin = diaRelativo >= e.minDia;
    const okMax = e.maxDia == null ? true : diaRelativo <= e.maxDia;
    if (okMin && okMax) return e;
  }
  return null;
}

export function renderScript(
  template: string,
  vars: { cliente: string; valor: string; vencimento: string; dias: string }
): string {
  return template
    .replace(/\{\{cliente\}\}/g, vars.cliente)
    .replace(/\{\{valor\}\}/g, vars.valor)
    .replace(/\{\{vencimento\}\}/g, vars.vencimento)
    .replace(/\{\{dias\}\}/g, vars.dias);
}
