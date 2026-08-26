/**
 * Compliance ético — frases proibidas (CDC arts. 6º, 30, 31, 37, 39).
 * Uso: bloquear scripts WhatsApp / UI antes de copiar ao cliente.
 * LexisPredict · Lote Ética Operacional
 */

export type SeveridadeEtica = "bloqueio" | "alerta";

export type MatchEtica = {
  severidade: SeveridadeEtica;
  padrao: string;
  motivo: string;
  trecho?: string;
};

/** Nunca usar com cliente (publicidade enganosa / expectativa irreal). */
export const FRASES_BLOQUEIO: { re: RegExp; motivo: string }[] = [
  { re: /causa\s+ganha/i, motivo: "Promessa de resultado judicial" },
  { re: /j[aá]\s+(?:houve\s+)?senten[cç]a/i, motivo: "Afirmar sentença sem prova nos autos" },
  { re: /senten[cç]a\s+j[aá]\s+saiu/i, motivo: "Afirmar sentença sem prova nos autos" },
  { re: /p[oó]s[\s-]?julgamento/i, motivo: "Linguagem de fase final enganosa" },
  { re: /fase\s+final/i, motivo: "Expectativa de fim do processo sem base" },
  { re: /cita[cç][aã]o\s*=\s*(?:vit[oó]ria|senten[cç]a|ganhou)/i, motivo: "Citação não é vitória" },
  { re: /cita[cç][aã]o\s+(?:é|significa)\s+(?:vit[oó]ria|senten[cç]a)/i, motivo: "Citação não é vitória" },
  { re: /nome\s+limpo\s+em\s+\d+\s*dias/i, motivo: "Promessa de prazo de restrição" },
  { re: /reduza\s+(?:seus\s+)?juros\s+em\s+\d+\s*%/i, motivo: "Promessa percentual de redução" },
  { re: /garantimos?\s+(?:o\s+)?(?:êxito|ganho|vit[oó]ria)/i, motivo: "Garantia de êxito vedada" },
  { re: /100\s*%\s*(?:de\s+)?(?:sucesso|ganho|proced[eê]ncia)/i, motivo: "Promessa de êxito total" },
  { re: /extrajudicial\s+(?:j[aá]\s+)?(?:virou|vira)\s+judicial/i, motivo: "Mudança de via sem novo consentimento" },
  { re: /pode\s+parar\s+de\s+pagar\s+(?:as\s+)?parcelas/i, motivo: "Orientar inadimplência sem formalização" },
  { re: /j[aá]\s+(?:estamos\s+em\s+)?cumprimento\s+de\s+senten[cç]a/i, motivo: "Afirmar cumprimento sem prova" },
];

/** Aviso: revisar tom, não necessariamente bloquear. */
export const FRASES_ALERTA: { re: RegExp; motivo: string }[] = [
  { re: /em\s+breve\s+(?:teremos|sai)\s+(?:a\s+)?decis[aã]o/i, motivo: "Sugere prazo judicial garantido" },
  { re: /juiz\s+(?:j[aá]\s+)?(?:decidiu|vai\s+decidir)/i, motivo: "Presumir decisão do juiz" },
  { re: /s[oó]\s+falta\s+(?:a\s+)?assinatura/i, motivo: "Minimizar complexidade residual" },
  { re: /processo\s+(?:ganho|vencido)/i, motivo: "Linguagem de vitória antecipada" },
];

export function auditarTextoEtica(texto: string): {
  ok: boolean;
  bloqueios: MatchEtica[];
  alertas: MatchEtica[];
} {
  const t = String(texto || "");
  const bloqueios: MatchEtica[] = [];
  const alertas: MatchEtica[] = [];

  for (const { re, motivo } of FRASES_BLOQUEIO) {
    const m = t.match(re);
    if (m) {
      bloqueios.push({
        severidade: "bloqueio",
        padrao: re.source.slice(0, 48),
        motivo,
        trecho: m[0],
      });
    }
  }
  for (const { re, motivo } of FRASES_ALERTA) {
    const m = t.match(re);
    if (m) {
      alertas.push({
        severidade: "alerta",
        padrao: re.source.slice(0, 48),
        motivo,
        trecho: m[0],
      });
    }
  }

  return { ok: bloqueios.length === 0, bloqueios, alertas };
}

/** Documentos que NUNCA devem ser cobrados (cliente obtém de graça). */
export const DOCUMENTOS_GRATUITOS = [
  { id: "registrato", label: "Extrato Registrato / CCS (BACEN)", como: "registrato.bcb.gov.br" },
  { id: "ir", label: "Declaração de IR (cópia)", como: "e-CAC / app IRPF" },
  { id: "contrato_banco", label: "2ª via do contrato com o banco", como: "app/internet banking ou SAC" },
  { id: "evolucao", label: "Planilha de evolução da dívida", como: "solicitar ao credor / app" },
  { id: "comprovante_renda", label: "Comprovantes de renda que o cliente já possui", como: "próprio cliente" },
] as const;
