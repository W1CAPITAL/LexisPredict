/**
 * Portal de Custas TJSP — integração segura (sem robô / sem anti-captcha).
 * URL oficial: https://portaldecustas.tjsp.jus.br/portaltjsp/pages/custas/new
 */

export const PORTAL_CUSTAS_TJSP_NEW =
  'https://portaldecustas.tjsp.jus.br/portaltjsp/pages/custas/new';

export const PORTAL_CUSTAS_TJSP_HOME =
  'https://portaldecustas.tjsp.jus.br/';

export interface CustasPrefill {
  protocolo?: string;
  cpf?: string;
  nome?: string;
  valor?: string; // "192,10" ou "R$ 192,10"
  oab?: string;
}

/** Só dígitos do CNJ */
export function digitsCnj(cnj?: string): string {
  return String(cnj || '').replace(/\D/g, '');
}

export function formatCnjDisplay(cnj?: string): string {
  const d = digitsCnj(cnj);
  if (d.length !== 20) return cnj || '';
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

export function onlyDigitsCpf(cpf?: string): string {
  return String(cpf || '').replace(/\D/g, '').slice(0, 11);
}

/** Texto pronto para colar / checklist do operador */
export function buildCustasChecklist(p: CustasPrefill): string {
  const lines = [
    '— Portal de Custas TJSP —',
    p.protocolo ? `CNJ: ${formatCnjDisplay(p.protocolo)}` : null,
    p.nome ? `Nome: ${p.nome}` : null,
    p.cpf ? `CPF: ${onlyDigitsCpf(p.cpf)}` : null,
    p.valor ? `Valor intimado: ${p.valor}` : null,
    p.oab ? `OAB: ${p.oab}` : null,
    '',
    '1. Abra o portal (botão no app).',
    '2. Resolva o CAPTCHA manualmente (exigência do tribunal).',
    '3. Informe CNJ / parte / código da taxa conforme a intimação.',
    '4. Gere a guia, baixe o PDF e anexe no atendimento do cliente.',
  ].filter((x) => x !== null) as string[];
  return lines.join('\n');
}

/**
 * NÃO automatizamos emissão com CAPTCHA solver.
 * Motivo: ToS do TJSP, risco jurídico e instabilidade do SAJ.
 * Fluxo oficial: operador + CAPTCHA humano.
 */
export function openPortalCustas(): void {
  if (typeof window !== 'undefined') {
    window.open(PORTAL_CUSTAS_TJSP_NEW, '_blank', 'noopener,noreferrer');
  }
}
