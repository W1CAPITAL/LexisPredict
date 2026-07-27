/**
 * @fileOverview Serviço de Integração com a API Pública do DataJud (CNJ) v2800.0
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

const PUBLIC_KEY_FALLBACK = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

export async function fetchDataJud(cnj: string) {
  const envKey = process.env.DATAJUD_API_KEY;
  const apiKey = envKey && envKey !== 'undefined' ? envKey : PUBLIC_KEY_FALLBACK;
  const usingFallback = apiKey === PUBLIC_KEY_FALLBACK;

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
    console.warn(`[DataJud] Tribunal ${aliasPart} desconhecido. Usando fallback tjsp.`);
    alias = "tjsp";
  }

  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;

  try {
    console.log(`[DataJud] Consultando tribunal: ${alias.toUpperCase()} | CNJ: ${cnjLimpo} | Auth: ${usingFallback ? 'Public Fallback' : 'Environment'}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: { term: { "numeroProcesso.keyword": cnjLimpo } }
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      console.error(`[DataJud] Erro HTTP ${response.status} no tribunal ${alias}`);
      return { 
        numeroProcesso: cnj, 
        movimentos: [], 
        error: true, 
        message: `Tribunal ${alias.toUpperCase()} temporariamente indisponível (Erro ${response.status}).` 
      };
    }

    const data = await response.json();
    const source = data.hits?.hits?.[0]?._source;

    if (!source) {
      return { 
        numeroProcesso: cnj, 
        movimentos: [], 
        error: false, 
        message: "Processo não localizado no DataJud." 
      };
    }

    return {
      numeroProcesso: source.numeroProcesso || cnjLimpo,
      classe: source.classe?.nome || 'N/A',
      tribunal: source.tribunal || alias.toUpperCase(),
      movimentos: source.movimentos || [],
      error: false
    };
  } catch (e: any) {
    const isTimeout = e.name === 'TimeoutError' || e.message?.includes('timeout');
    console.error("[DataJud] Erro Crítico:", e.message);
    return { 
      numeroProcesso: cnj, 
      movimentos: [], 
      error: true, 
      message: isTimeout ? "Tempo esgotado na consulta ao tribunal." : "Falha na conexão com o CNJ." 
    };
  }
}
