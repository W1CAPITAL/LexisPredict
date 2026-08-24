/**
 * Validações de geração de peças — flexível: OAB 1–2 dígitos ok, edição livre.
 */

import type { PecaMeta, ModeloPeca } from '@/lib/pecas-modelos';
import { cpfValido, cnpjValido } from '@/lib/cpf-cnpj';
export { sanitizePecaTexto } from '@/lib/pecas-sanitize';

const NOME_KEYS: (keyof PecaMeta)[] = [
  'cliente',
  'advogado',
  'advogado2',
  'substabDe',
  'substabPara',
  'parteContraria',
];

const OAB_KEYS: (keyof PecaMeta)[] = ['oab', 'oab2', 'substabDeOab', 'substabParaOab'];
const CPF_KEYS: (keyof PecaMeta)[] = ['cpfCliente', 'cpfAdvogado', 'cpfParteContraria'];

function isJunkName(v: string): boolean {
  const s = v.trim();
  if (!s) return true;
  if (s.length < 2) return true;
  if (/^(teste|test|xxx|asdf)$/i.test(s)) return true;
  if (/^\[.*\]$/.test(s)) return true;
  return false;
}

export type PecaValidationIssue = {
  field?: keyof PecaMeta;
  message: string;
};

export function validatePecaMeta(
  modelo: ModeloPeca,
  meta: PecaMeta,
  opts?: { strictRequired?: boolean }
): PecaValidationIssue[] {
  const issues: PecaValidationIssue[] = [];
  const campos = modelo.campos || [];
  const strict = opts?.strictRequired === true;

  for (const key of NOME_KEYS) {
    if (!campos.includes(key)) continue;
    const raw = String(meta[key] || '').trim();
    if (!raw) {
      if (strict && (key === 'cliente' || key === 'advogado' || key === 'substabDe' || key === 'substabPara')) {
        issues.push({ field: key, message: `Informe o nome em “${key}” (mín. 2 caracteres).` });
      }
      continue;
    }
    if (isJunkName(raw)) {
      issues.push({ field: key, message: `“${raw}” não parece um nome válido.` });
    }
  }

  // OAB: aceita 1+ caracteres (ex.: "12", "3456")
  for (const key of OAB_KEYS) {
    if (!campos.includes(key)) continue;
    const raw = String(meta[key] || '').trim();
    if (!raw) continue;
    if (raw.length < 1) {
      issues.push({ field: key, message: 'Informe a OAB.' });
    }
  }

  for (const key of CPF_KEYS) {
    if (!campos.includes(key)) continue;
    const raw = String(meta[key] || '').trim();
    if (!raw) continue;
    if (!cpfValido(raw)) {
      issues.push({ field: key, message: 'CPF inválido (dígitos verificadores).' });
    }
  }

  if (campos.includes('uf') && meta.uf) {
    const uf = meta.uf.trim().toUpperCase();
    if (uf.length !== 2) {
      issues.push({ field: 'uf', message: 'UF da OAB deve ter 2 letras (ex.: SP, GO).' });
    }
  }

  const includeBanco = (meta as any).includeBanco !== false;
  if (includeBanco && campos.includes('cnpjBanco') && meta.cnpjBanco) {
    if (!cnpjValido(String(meta.cnpjBanco))) {
      issues.push({ field: 'cnpjBanco', message: 'CNPJ do banco inválido.' });
    }
  }

  return issues;
}

export function validatePecaPreview(preview: string): PecaValidationIssue[] {
  const t = (preview || '').trim();
  if (t.length < 40) {
    return [{ message: 'Prévia muito curta. Edite o texto ou preencha os campos.' }];
  }
  return [];
}
