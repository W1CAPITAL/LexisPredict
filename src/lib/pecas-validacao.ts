/**
 * Validações de geração de peças (prévia e PDF).
 * Impede lixo curto, CPF/OAB claramente inválidos e prévia vazia.
 */

import type { PecaMeta, ModeloPeca } from '@/lib/pecas-modelos';

const NOME_KEYS: (keyof PecaMeta)[] = [
  'cliente',
  'advogado',
  'advogado2',
  'substabDe',
  'substabPara',
  'parteContraria',
];

const ID_KEYS: (keyof PecaMeta)[] = ['oab', 'oab2', 'substabDeOab', 'substabParaOab', 'cpfCliente', 'cpfAdvogado'];

function isJunkName(v: string): boolean {
  const s = v.trim();
  if (s.length < 3) return true;
  if (/^[a-zA-Z]{1,2}$/.test(s)) return true;
  if (/^\[.*\]$/.test(s)) return true;
  if (/^(teste|test|xxx|asdf)$/i.test(s)) return true;
  return false;
}

function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
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
  const strict = opts?.strictRequired !== false;

  // Nomes obrigatórios do modelo que estão no form
  for (const key of NOME_KEYS) {
    if (!campos.includes(key)) continue;
    const raw = String(meta[key] || '').trim();
    if (!raw) {
      if (strict && (key === 'cliente' || key === 'advogado' || key === 'substabDe' || key === 'substabPara')) {
        // só exige se o modelo lista o campo
        if (key === 'cliente' && campos.includes('cliente')) {
          issues.push({ field: key, message: 'Informe o nome completo do cliente/outorgante (mín. 3 caracteres).' });
        }
        if (key === 'advogado' && campos.includes('advogado')) {
          issues.push({ field: key, message: 'Informe o nome completo do advogado (mín. 3 caracteres).' });
        }
        if ((key === 'substabDe' || key === 'substabPara') && campos.includes(key)) {
          issues.push({ field: key, message: `Informe o nome completo em “${key}”.` });
        }
      }
      continue;
    }
    if (isJunkName(raw)) {
      issues.push({ field: key, message: `“${raw}” não é um nome válido. Use nome completo.` });
    }
  }

  for (const key of ID_KEYS) {
    if (!campos.includes(key)) continue;
    const raw = String(meta[key] || '').trim();
    if (!raw) continue;
    if (raw.length < 3 || isJunkName(raw)) {
      issues.push({ field: key, message: `Campo ${key} inválido ou curto demais.` });
    }
    if (key.startsWith('cpf')) {
      const d = onlyDigits(raw);
      if (d.length > 0 && d.length !== 11) {
        issues.push({ field: key, message: 'CPF deve ter 11 dígitos (pode formatar com pontos).' });
      }
    }
  }

  if (campos.includes('uf') && meta.uf) {
    const uf = meta.uf.trim().toUpperCase();
    if (uf.length !== 2) {
      issues.push({ field: 'uf', message: 'UF da OAB deve ter 2 letras (ex.: SP, GO).' });
    }
  }

  return issues;
}

export function validatePecaPreview(preview: string): PecaValidationIssue[] {
  const t = (preview || '').trim();
  if (t.length < 80) {
    return [{ message: 'Prévia muito curta. Preencha os campos principais e gere o texto de novo.' }];
  }
  // Heurística: ainda só placeholders
  const placeholders = (t.match(/\[[A-ZÁÉÍÓÚÃÕÂÊÔÇ0-9 /]{4,}\]/g) || []).length;
  if (placeholders >= 4) {
    return [{ message: 'Ainda há muitos campos em branco (placeholders). Complete nome, OAB e dados essenciais.' }];
  }
  return [];
}
