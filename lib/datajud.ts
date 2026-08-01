/**
 * @fileOverview Serviço de Integração com a API Pública do DataJud (CNJ) v470.0 ELITE
 * Otimizado com timeouts de 35s, aliases estritos por tribunal e auditoria de integridade de shards.
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
}

/**
 * Consulta API DataJud com roteamento estrito por alias e proteção contra falhas de cluster.
 */
export async function fetchDataJud(cnj: string, attempt = 1, options: DataJudOptions = {}): Promise<any> {
  const cnjLimpo = cnj.replace(/\D/g, '');
  const startTime = Date.now();
  
  if (cnjLimpo.length !== 20) {
    return { numeroProcesso: cnj, movimentos: [], error: true, message: "CNJ inválido." };
  }

  // Derivação estrita do tribunal via máscara CNJ
  const aliasPart = `${cnjLimpo[13]}.${cnjLimpo.substring(14, 16)}`;
  let alias = COURT_ALIASES[aliasPart] || "tjsp";

  // URL Direta por Índice: Evita wildcard para reduzir latência e erro de busca cruzada
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;

  const isFast = options.fast === true;
  const timeoutMs = isFast ? 15000 : 35000;
  const maxAttempts = isFast ? 1 : 2;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs + 1000);

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
      signal: controller.signal,
      cache: 'no-store'
    });

    clearTimeout(id);
    const latency = Date.now() - startTime;

    // Backoff em caso de Rate Limit
    if (response.status === 429) {
       if (attempt < maxAttempts) { 
         await sleep(1500); 
         return fetchDataJud(cnj, attempt + 1, options); 
       }
       throw new Error("Taxa de requisição excedida (DataJud 429).");
    }

    if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);

    const data = await response.json();
    
    /**
     * Validação de Shards: Se houver falhas no cluster do CNJ, o resultado pode ser falso negativo.
     * Não gravamos 'não localizado' se houver indício de instabilidade parcial.
     */
    if (data._shards?.failed > 0 && (!data.hits?.hits || data.hits.hits.length === 0)) {
       return { 
         numeroProcesso: cnjLimpo, 
         movimentos: [], 
         error: true, 
         message: "Tribunal instável (Shard Fail). Tente novamente em instantes.", 
         latency 
       };
    }

    const source = data.hits?.hits?.[0]?._source;
    if (!source) return { numeroProcesso: cnjLimpo, movimentos: [], error: false, message: "Não localizado.", latency };

    return {
      numeroProcesso: source.numeroProcesso || cnjLimpo,
      classe: source.classe?.nome || 'N/A',
      tribunal: source.tribunal || alias.toUpperCase(),
      movimentos: Array.isArray(source.movimentos) ? source.movimentos : [],
      error: false,
      latency
    };

  } catch (e: any) {
    const latency = Date.now() - startTime;
    const isTimeout = e.name === 'AbortError' || latency >= timeoutMs;

    if (isTimeout) return { numeroProcesso: cnjLimpo, movimentos: [], error: true, message: "Tempo esgotado no tribunal.", latency };
    return { numeroProcesso: cnjLimpo, movimentos: [], error: true, message: "Falha técnica DataJud.", latency };
  }
}
