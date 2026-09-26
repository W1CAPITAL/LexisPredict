export type QualityGateInput = {
  text: string;
  requireEvidence?: boolean;
  evidenceCount?: number;
};

export type QualityGateResult = {
  ok: boolean;
  issues: string[];
};

const EMPTY_OR_ERROR = [
  /^\s*$/,
  /não consegui concluir/i,
  /falha:.*providers?/i,
  /resposta inv[aá]lida/i,
];

export function runQualityGate(input: QualityGateInput): QualityGateResult {
  const text = String(input.text || '').trim();
  const issues: string[] = [];

  if (EMPTY_OR_ERROR.some((r) => r.test(text))) {
    issues.push('Saída vazia ou mensagem de falha não resolvida.');
  }
  if (text.length > 0 && text.length < 12) {
    issues.push('Saída curta demais para ser considerada substantiva.');
  }
  if (input.requireEvidence && (input.evidenceCount ?? 0) < 1) {
    issues.push('Tarefa exige evidência, mas nenhuma fonte/evidência foi registrada.');
  }
  if (/\b(?:certeza absoluta|100% garantido|sem qualquer risco)\b/i.test(text)) {
    issues.push('Linguagem de certeza excessiva detectada.');
  }

  return { ok: issues.length === 0, issues };
}
