/**
 * @fileOverview Serviço DataJud (CNJ) v480 — BOTH não sacrifica o tribunal
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

export const COURT_ALIASES: Record<string, string> = {
  "8.01": "tjac", "8.02": "tjal", "8.03": "tjap", "8.04": "tjam", "8.05": "tjba",
  "8.06": "tjce", "8.07": "tjdft", "8.08": "tjes", "8.09": "tjgo", "8.10": "tjma",
  "8.11": "tjmt", "8.12": "tjms", "8.13": "tjmg", "8.14": "tjpa", "8.15": "tjpb",
  "8.16": "tjpr", "8.17": "tjpe", "8.18": "tjpi", "8.19": "tjrj", "8.20": "tjrn",
  "8.21": "tjrs", "8.22": "tjro", "8.23": "tjrr", "8.24": "tjsc", "8.25": "tjse",
  "8.26": "tjsp", "8.27": "tjto", "4.01": "trf1", "4.02": "trf2", "4.03": "trf3",
  "4.04": "trf4", "4.05": "trf5", "4.06": "trf6"
};

const DATAJUD_API_KEY = process.env.DATAJUD_API_KEY || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface DataJudOptions {
  /** true = scanner em lote (ainda tenta de verdade o tribunal) */
  fast?: boolean;
}

export async function fetchDataJud(cnj: string, attempt = 1, options: DataJudOptions = {}): Promise<any> {
  const cnjLimpo = cnj.replace(/\D/g, '');
  const startTime = Date.now();

  if (cnjLimpo.length !== 20) {
    return { numeroProcesso: cnj, movimentos: [], error: true, message: "CNJ inválido.", attempts: attempt };
  }

  const aliasPart = `${cnjLimpo[13]}.${cnjLimpo.substring(14, 16)}`;
  const alias = COURT_ALIASES[aliasPart] || "tjsp";
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;

  const isFast = options.fast === true;
  // ANTES: fast=15s/1 tentativa → DJEN ganhava e DataJud “sumia”
  // AGORA: fast ainda dá tempo real ao tribunal + 1 retry
  const timeoutMs = isFast ? 28000 : 40000;
  const maxAttempts = isFast ? 2 : 3;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        size: 1,
        query: { match: { numeroProcesso: cnjLimpo } }
      }),
      signal: controller.signal,
      cache: 'no-store'
    });

    clearTimeout(id);
    const latency = Date.now() - startTime;

    if (response.status === 429) {
      if (attempt < maxAttempts) {
        await sleep(1200 * attempt + Math.random() * 400);
        return fetchDataJud(cnj, attempt + 1, options);
      }
      return {
        numeroProcesso: cnjLimpo,
        movimentos: [],
        error: true,
        message: "Taxa excedida (429).",
        latency,
        attempts: attempt
      };
    }

    if (response.status >= 500 && attempt < maxAttempts) {
      await sleep(800 * attempt);
      return fetchDataJud(cnj, attempt + 1, options);
    }

    if (!response.ok) {
      return {
        numeroProcesso: cnjLimpo,
        movimentos: [],
        error: true,
        message: `HTTP ${response.status}`,
        latency,
        attempts: attempt
      };
    }

    const data = await response.json();

    if (data._shards?.failed > 0 && (!data.hits?.hits || data.hits.hits.length === 0)) {
      if (attempt < maxAttempts) {
        await sleep(600);
        return fetchDataJud(cnj, attempt + 1, options);
      }
      return {
        numeroProcesso: cnjLimpo,
        movimentos: [],
        error: true,
        message: "Tribunal instável (shard).",
        latency,
        attempts: attempt
      };
    }

    const source = data.hits?.hits?.[0]?._source;
    if (!source) {
      return {
        numeroProcesso: cnjLimpo,
        movimentos: [],
        error: false,
        message: "Não localizado no DataJud.",
        latency,
        attempts: attempt
      };
    }

    return {
      numeroProcesso: source.numeroProcesso || cnjLimpo,
      classe: source.classe?.nome || 'N/A',
      tribunal: source.tribunal || alias.toUpperCase(),
      movimentos: Array.isArray(source.movimentos) ? source.movimentos : [],
      dataAjuizamento: source.dataAjuizamento || null,
      error: false,
      latency,
      attempts: attempt
    };
  } catch (e: any) {
    const latency = Date.now() - startTime;
    const isTimeout =
      e?.name === 'AbortError' ||
      e?.name === 'TimeoutError' ||
      String(e?.message || '').toLowerCase().includes('timeout');

    if (isTimeout && attempt < maxAttempts) {
      await sleep(700 * attempt);
      return fetchDataJud(cnj, attempt + 1, options);
    }

    return {
      numeroProcesso: cnjLimpo,
      movimentos: [],
      error: true,
      message: isTimeout ? "Tempo esgotado no tribunal." : "Falha técnica DataJud.",
      latency,
      attempts: attempt
    };
  }
}
