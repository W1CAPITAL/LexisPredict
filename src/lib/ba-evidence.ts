export function normalizarTextoBa(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[ \t]+/g, ' ');
}

export function isClasseBuscaApreensao(value: unknown): boolean {
  const text = normalizarTextoBa(value);
  return /\bBUSCA\s+E\s+APREENSAO\b/.test(text) && !/REVISIONAL|CRIMINAL|PENAL|INQUERITO/.test(text);
}

/** The action must belong to the decision, not a quoted precedent or request. */
export function evidenciaOrdemBa(texto: unknown): string | null {
  let text = normalizarTextoBa(texto).replace(/[“«][\s\S]*?[”»]/g, ' ');
  const device = [...text.matchAll(/ANTE O EXPOSTO|ISTO POSTO|DIANTE DO EXPOSTO|PASSO A DECIDIR|DISPOSITIVO/g)].at(-1);
  if (device?.index !== undefined) text = text.slice(device.index);
  const segments = text.split(/\n+|(?<=[.;!?])\s+/);
  for (const segment of [...segments].reverse()) {
    if (/JURISPRUDENCIA|PRECEDENTE|EMENTA|CONFORME JULGADO|NESSE SENTIDO|NO MESMO SENTIDO|REQUER(?:EU)?\b|PLEITEIA/.test(segment)) continue;
    if (/INDEFIRO|INDEFERID|REVOGAD|REVOGO|NAO\s+(?:DEFIRO|DEFERID|EXPED|CUMPR)|SUSPEND[OA]|SUSPENSA/.test(segment) && /BUSCA|APREENSAO|MANDADO|LIMINAR/.test(segment)) return null;
    if (!/BUSCA\s+E\s+APREENSAO|APREENSAO\s+DO\s+(?:VEICULO|BEM)|MANDADO\s+DE\s+BUSCA\s+(?:EXPEDIDO|CUMPRIDO)/.test(segment)) continue;
    if (/\bDEFIRO\b|\bDETERMINO\b|EXPECA[- ]SE|CUMPRA[- ]SE|EXPEDICAO\s+DE\s+MANDADO|MANDADO.{0,70}(EXPEDIDO|CUMPRIDO)|LIMINAR.{0,60}DEFERIDA|DEFERIDA.{0,60}LIMINAR/.test(segment)) return segment.trim().slice(0, 700);
  }
  return null;
}
