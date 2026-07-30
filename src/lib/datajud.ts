
/**
 * @fileOverview Serviço de Integração com a API Pública do DataJud (CNJ) v2900.0 ELITE
 * Otimizado com Retries, Query Match e Timeouts robustos.
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

export async function fetchDataJud(cnj: string, attempt = 1): Promise<any> {
  const cnjLimpo = cnj.replace(/\D/g, '');
  
  if (cnjLimpo.length !== 20) {
    return { 
      numeroProcesso: cnj, 
      movimentos: [], 
      error: true, 
      message: "Número CNJ inválido (deve conter 20 dígitos)." 
    };
  }

  const aliasPart = `${cnjLimpo[13]}.${cnjLimpo.substring(14, 16)}`;
  let alias = COURT_ALIASES[aliasPart];
  
  if (!alias) {
    console.warn(`[DataJud] Tribunal ${aliasPart} não mapeado. Fallback TJSP.`);
    alias = "tjsp";
  }

  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;
  const startTime = Date.now();

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
      // Aumentado para 45s conforme rito de infraestrutura
      signal: AbortSignal.timeout(45000)
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { error: true, movimentos: [], message: "Falha de autenticação no DataJud. Verifique a chave da API." };
      }
      throw new Error(`HTTP_${response.status}`);
    }

    const data = await response.json();
    const source = data.hits?.hits?.[0]?._source;

    console.log(`[DataJud] ${alias.toUpperCase()} | ${cnjLimpo} | Hits: ${data.hits?.total?.value || 0} | ${duration}ms`);

    if (!source) {
      return { 
        numeroProcesso: cnjLimpo, 
        movimentos: [], 
        error: false, 
        message: "Processo não localizado no sistema unificado do DataJud." 
      };
    }

    return {
      numeroProcesso: source.numeroProcesso || cnjLimpo,
      classe: source.classe?.nome || 'N/A',
      tribunal: source.tribunal || alias.toUpperCase(),
      movimentos: Array.isArray(source.movimentos) ? source.movimentos : [],
      dataAjuizamento: source.dataAjuizamento || null,
      error: false
    };
  } catch (e: any) {
    const isTimeout = e.name === 'AbortError' || e.name === 'TimeoutError' || e.message?.includes('timeout');
    
    if (isTimeout && attempt < 2) {
      console.warn(`[DataJud] Timeout na tentativa 1 para ${cnjLimpo}. Retrying...`);
      await sleep(1000);
      return fetchDataJud(cnj, attempt + 1);
    }

    console.error(`[DataJud] Falha Crítica: ${e.message} | Attempt: ${attempt}`);
    return { 
      numeroProcesso: cnjLimpo, 
      movimentos: [], 
      error: true, 
      message: isTimeout ? "Tempo esgotado na consulta ao CNJ. Tente novamente em instantes." : "Falha na comunicação com o tribunal." 
    };
  }
}
