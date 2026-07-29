
/**
 * @fileOverview Serviço de Integração com a API Pública do DataJud (CNJ) v3000.0 ELITE
 * Otimizado com timeouts curtos (18s) e retry ágil para máxima fluidez de lote.
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

export async function fetchDataJud(cnj: string, attempt = 1, noRetry = false): Promise<any> {
  const cnjLimpo = cnj.replace(/\D/g, '');
  
  if (cnjLimpo.length !== 20) {
    return { 
      numeroProcesso: cnj, 
      movimentos: [], 
      error: true, 
      message: "Número CNJ inválido.",
      attempts: attempt
    };
  }

  const aliasPart = `${cnjLimpo[13]}.${cnjLimpo.substring(14, 16)}`;
  let alias = COURT_ALIASES[aliasPart];
  
  if (!alias) {
    alias = "tjsp";
  }

  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        size: 1,
        query: {
          match: {
            "numeroProcesso": cnjLimpo
          }
        }
      }),
      // Timeout reduzido para 18s para acelerar a fila em casos de falha crônica do tribunal
      signal: AbortSignal.timeout(18000)
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { error: true, message: "Falha de autenticação API Key.", isAuthError: true, attempts: attempt };
      }
      
      // Erros retentáveis
      if ([429, 502, 503, 504].includes(response.status)) {
        throw new Error(`RETRYABLE_HTTP_${response.status}`);
      }
      
      throw new Error(`HTTP_${response.status}`);
    }

    const data = await response.json();
    const source = data.hits?.hits?.[0]?._source;

    if (!source) {
      return { 
        numeroProcesso: cnjLimpo, 
        movimentos: [], 
        error: false, 
        message: "Não localizado no DataJud.",
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
      attempts: attempt
    };

  } catch (e: any) {
    const isTimeout = e.name === 'AbortError' || e.name === 'TimeoutError' || e.message?.includes('timeout');
    const isRetryable = isTimeout || e.message?.startsWith('RETRYABLE_HTTP_') || e.message?.includes('fetch') || e.message?.includes('Network');

    // Rito de Retry: Máximo 2 tentativas totais (1 inicial + 1 retry).
    // Casos "Sem Prazo" não realizam retry para poupar tempo de lote.
    if (isRetryable && attempt < 2 && !noRetry) {
      const waitTime = 1000 + (Math.random() * 300);
      console.warn(`[DataJud] Falha T${attempt}. Retentando em ${Math.round(waitTime)}ms...`);
      await sleep(waitTime);
      return fetchDataJud(cnj, attempt + 1, noRetry);
    }

    return { 
      numeroProcesso: cnjLimpo, 
      movimentos: [], 
      error: true, 
      message: isTimeout ? "Tempo esgotado." : "Falha na comunicação.",
      attempts: attempt
    };
  }
}
