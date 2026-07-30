/**
 * @fileOverview Serviço de Integração com a API Pública do DataJud (CNJ) v480.0 ELITE
 * Otimizado com Latência Real e Transparência de Endpoints.
 * Proprietário: W1 Capital | Fundador: Davi Alves Figueredo
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
  fast?: boolean;
  timeoutMs?: number;
}

export async function fetchDataJud(cnj: string, attempt = 1, options: DataJudOptions = {}): Promise<any> {
  const cnjLimpo = cnj.replace(/\D/g, '');
  const startTime = Date.now();
  
  if (cnjLimpo.length !== 20) {
    return { 
      numeroProcesso: cnj, 
      movimentos: [], 
      error: true, 
      message: "CNJ_INVALIDO",
      httpStatus: 400,
      latency: Date.now() - startTime,
      attempts: attempt
    };
  }

  const aliasPart = `${cnjLimpo[13]}.${cnjLimpo.substring(14, 16)}`;
  let alias = COURT_ALIASES[aliasPart] || "tjsp";
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;

  const timeoutMs = options.timeoutMs || 20000; 

  try {
    console.log(`[DATAJUD] [INIT] ${cnjLimpo} -> ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        size: 1,
        query: { match: { "numeroProcesso": cnjLimpo } }
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    const latency = Date.now() - startTime;
    console.log(`[DATAJUD] [DONE] ${cnjLimpo} | Status: ${response.status} | Time: ${latency}ms`);

    if (!response.ok) {
      return { 
        error: true, 
        message: `HTTP_${response.status}`, 
        httpStatus: response.status, 
        latency, 
        endpoint: url,
        attempts: attempt 
      };
    }

    const data = await response.json();
    const source = data.hits?.hits?.[0]?._source;

    if (!source) {
      return { 
        numeroProcesso: cnjLimpo, 
        movimentos: [], 
        error: false, 
        message: "NOT_FOUND",
        httpStatus: 200,
        latency,
        endpoint: url,
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
      httpStatus: 200,
      latency,
      endpoint: url,
      attempts: attempt
    };

  } catch (e: any) {
    const latency = Date.now() - startTime;
    const isTimeout = e.name === 'AbortError' || e.name === 'TimeoutError' || e.message?.includes('timeout');
    
    console.error(`[DATAJUD] [FAIL] ${cnjLimpo} | Error: ${e.message} | Time: ${latency}ms`);

    return { 
      numeroProcesso: cnjLimpo, 
      movimentos: [], 
      error: true, 
      message: isTimeout ? "TIMEOUT_20S" : "NETWORK_ERROR",
      httpStatus: isTimeout ? 408 : 500,
      endpoint: url,
      latency,
      attempts: attempt
    };
  }
}
