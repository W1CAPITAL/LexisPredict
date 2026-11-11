import 'server-only';
/**
 * Ponte opcional: usa fetchResilient sem reescrever datajud.ts.
 * Scanner antigo continua intacto; novos callers podem usar isto.
 */
import { fetchResilient } from './http-resilient';
import {isDataJudUseAuthorized} from './datajud-policy';
import {resolveDataJudAlias} from './datajud-aliases';
import {resolveCurrentDataJudKey} from './datajud';

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
  if (!isDataJudUseAuthorized()) {
    return { ok:false, latencyMs:0, error:'DataJud desativado até autorização expressa do CNJ para o uso pretendido.' };
  }
  const alias = resolveDataJudAlias(digits);
  if (!alias) return { ok:false, latencyMs:0, error:'Tribunal não reconhecido no CNJ; nenhum endpoint foi presumido.' };
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;
  const key = resolveCurrentDataJudKey();

  const res = await fetchResilient(url, {
    method: 'POST',
    timeoutMs: 20_000,
    retries: 2,
    label: `datajud:${alias}`,
    headers: {
      Authorization: `APIKey ${key}`,
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
