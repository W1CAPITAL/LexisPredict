/**
 * Ponte opcional: usa fetchResilient sem reescrever datajud.ts.
 * Scanner antigo continua intacto; novos callers podem usar isto.
 */
import { fetchResilient } from './http-resilient';
import { resolveDataJudAlias } from './datajud';

const COURT_ALIASES: Record<string, string> = {
  '8.26': 'tjsp',
  '8.19': 'tjrj',
  '8.13': 'tjmg',
  '8.21': 'tjrs',
  '8.16': 'tjpr',
  '8.24': 'tjsc',
  '8.05': 'tjba',
  '8.06': 'tjce',
  '8.17': 'tjpe',
  '8.07': 'tjdft',
};

export async function probeDataJudHost(cnjDigits: string): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
  rateLimited?: boolean;
}> {
  const digits = cnjDigits.replace(/\D/g, '');
  if (digits.length !== 20) {
    return { ok: false, latencyMs: 0, error: 'CNJ inválido' };
  }
  const aliasPart = `${digits[13]}.${digits.substring(14, 16)}`;
  const alias = COURT_ALIASES[aliasPart] || resolveDataJudAlias(digits);
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;
  const key =
    process.env.DATAJUD_API_KEY ||
    process.env.CNJ_API_KEY ||
    '';

  const res = await fetchResilient(url, {
    method: 'POST',
    timeoutMs: 20_000,
    retries: 2,
    label: `datajud:${alias}`,
    headers: {
      Authorization: key ? `APIKey ${key}` : '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      size: 1,
      query: { match: { numeroProcesso: digits } },
    }),
  });

  return {
    ok: res.ok,
    latencyMs: res.latencyMs,
    error: res.error,
    rateLimited: res.rateLimited,
  };
}
