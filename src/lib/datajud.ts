/**
 * @fileOverview Serviço DataJud (CNJ) v480 — BOTH não sacrifica o tribunal
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { perfCached, PerfKeys, perfLog, perfNow } from '@/lib/performance-motor';
import { resolveDataJudTimeoutMs } from '@/lib/datajud-time-budget';

export const COURT_ALIASES: Record<string, string> = {
  "8.01": "tjac", "8.02": "tjal", "8.03": "tjap", "8.04": "tjam", "8.05": "tjba",
  "8.06": "tjce", "8.07": "tjdft", "8.08": "tjes", "8.09": "tjgo", "8.10": "tjma",
  "8.11": "tjmt", "8.12": "tjms", "8.13": "tjmg", "8.14": "tjpa", "8.15": "tjpb",
  "8.16": "tjpr", "8.17": "tjpe", "8.18": "tjpi", "8.19": "tjrj", "8.20": "tjrn",
  "8.21": "tjrs", "8.22": "tjro", "8.23": "tjrr", "8.24": "tjsc", "8.25": "tjse",
  "8.26": "tjsp", "8.27": "tjto", "4.01": "trf1", "4.02": "trf2", "4.03": "trf3",
  "4.04": "trf4", "4.05": "trf5", "4.06": "trf6",
  "5.01": "trt1", "5.02": "trt2", "5.03": "trt3", "5.04": "trt4", "5.05": "trt5",
  "5.06": "trt6", "5.07": "trt7", "5.08": "trt8", "5.09": "trt9", "5.10": "trt10",
  "5.11": "trt11", "5.12": "trt12", "5.13": "trt13", "5.14": "trt14", "5.15": "trt15",
  "5.16": "trt16", "5.17": "trt17", "5.18": "trt18", "5.19": "trt19", "5.20": "trt20",
  "5.21": "trt21", "5.22": "trt22", "5.23": "trt23", "5.24": "trt24",
  "2.00": "stj", "2.01": "stj", "3.00": "tst", "3.01": "tst",
  "6.00": "tse", "7.00": "stm"
};

/** Resolve o alias DataJud a partir do CNJ, cobrindo TJ/TRF/TRT/superiores. */
export function resolveDataJudAlias(cnj: string): string | null {
  const digits = String(cnj || "").replace(/\D/g, "");
  if (digits.length !== 20) return null;
  const aliasPart = `${digits[13]}.${digits.substring(14, 16)}`;
  const direct = COURT_ALIASES[aliasPart];
  if (direct) return direct;
  const justice = digits[13];
  const tribunal = Number(digits.substring(14, 16));
  if (justice === "5" && tribunal >= 1 && tribunal <= 24) return `trt${tribunal}`;
  if (justice === "2" && (tribunal === 0 || tribunal === 1)) return "stj";
  if (justice === "3" && (tribunal === 0 || tribunal === 1)) return "tst";
  if (justice === "6" && tribunal === 0) return "tse";
  if (justice === "7" && tribunal === 0) return "stm";
  return null;
}

/** Chave pública vigente publicada pelo CNJ. Ela pode ser rotacionada sem aviso. */
const DATAJUD_PUBLIC_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
const DATAJUD_API_KEY = normalizeDataJudApiKey(process.env.DATAJUD_API_KEY || process.env.CNJ_API_KEY || '') || DATAJUD_PUBLIC_KEY;
let liveDataJudKey:{value:string;until:number}|null=null;

/** Normaliza tanto o valor bruto quanto o cabeçalho completo copiado da Wiki do CNJ. */
export function normalizeDataJudApiKey(value:unknown):string{
 return String(value||'').trim()
  .replace(/^Authorization\s*:\s*/i,'')
  .replace(/^APIKey\s+/i,'')
  .trim();
}

/** Extrai a chave pública atual do conteúdo oficial da Wiki do CNJ. */
export function extractDataJudPublicKey(page:string):string|null{
 const text=String(page||'').replace(/&nbsp;|&#160;/gi,' ');
 const match=text.match(/(?:Authorization\s*:\s*)?APIKey\s+([A-Za-z0-9_+/=-]{30,})/i);
 return match?.[1]||null;
}

/** Ativação apenas após autorização expressa do CNJ para o uso pretendido. */
export function isDataJudUseAuthorized():boolean{
 return process.env.DATAJUD_USE_AUTHORIZED==='true';
}

/** Uses only the public API key published by CNJ; never stores keys in logs. */
export function resolveCurrentDataJudKey():string{
 return liveDataJudKey?.until && liveDataJudKey.until>Date.now()?liveDataJudKey.value:DATAJUD_API_KEY;
}

/** CNJ rotates its public key; refresh it once on HTTP 401/403 instead of repeating an expired key. */
export async function refreshPublicDataJudKey():Promise<string|null>{
 if(liveDataJudKey&&liveDataJudKey.until>Date.now())return liveDataJudKey.value;
 try{
  const response=await fetch('https://datajud-wiki.cnj.jus.br/api-publica/acesso/',{
   signal:AbortSignal.timeout(8000),cache:'no-store',
   headers:{Accept:'text/html','User-Agent':'LexisPredict/1.0 public-key-rotation'}
  });
  if(!response.ok)return null;
  const page=(await response.text()).slice(0,150000);
  const key=extractDataJudPublicKey(page);
  if(!key)return null;
  liveDataJudKey={value:key,until:Date.now()+6*60*60*1000};
  return key;
 }catch{return null;}
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface DataJudOptions {
  /** true = scanner em lote (ainda tenta de verdade o tribunal) */
  fast?: boolean;
  /** One short HTTP attempt for serverless cloud micro-batches. */
  cloudBudget?: boolean;
  /** Consulta solicitada manualmente no painel: ignora cache recente de leitura. */
  forceRefresh?: boolean;
  /** Explicit bounded timeout override for a single Hermes consultation. */
  timeoutMs?: number;
}

/** Extrai nomes de polo ativo e passivo a partir do array partes do DataJud. */
export function extrairPolos(partes: any[]): { ativo: string[]; passivo: string[]; outros: string[] } {
  const ativo: string[] = [];
  const passivo: string[] = [];
  const outros: string[] = [];
  for (const p of partes || []) {
    const nome = String(
      p?.nome || p?.nomeParte || p?.razaoSocial || p?.nomePessoa || p?.pessoa?.nome || ''
    ).trim();
    if (!nome || nome.length < 3) continue;
    // ignora advogados listados como "parte"
    const tipoParte = String(p?.tipo || p?.tipoParte || p?.qualificacao || '').toUpperCase();
    if (/ADVOGADO|OAB|PROCURADOR|REPRESENTANTE/.test(tipoParte) && !/AUTOR|R[EÉ]U|REQUER/.test(tipoParte)) {
      if (!outros.includes(nome)) outros.push(nome);
      continue;
    }
    const poloRaw = p?.polo ?? p?.tipoPolo ?? p?.codigoPolo ?? p?.poloProcessual ?? '';
    const polo =
      typeof poloRaw === 'object'
        ? String(poloRaw?.codigo || poloRaw?.nome || poloRaw?.descricao || '').toUpperCase()
        : String(poloRaw).toUpperCase();
    if (/ATIVO|^A$|^AT$|AUTOR|REQUERENTE|EXEQUENTE|APELANTE|AGRAVANTE|IMPETRANTE|RECLAMANTE|POLO\s*AT/.test(polo)) {
      if (!ativo.includes(nome)) ativo.push(nome);
    } else if (/PASSIVO|^P$|^PA$|R[EÉ]U|REQUERIDO|EXECUTADO|APELADO|AGRAVADO|IMPETRADO|RECLAMADO|POLO\s*PA/.test(polo)) {
      if (!passivo.includes(nome)) passivo.push(nome);
    } else if (polo.includes('AT') && !polo.includes('PA')) {
      if (!ativo.includes(nome)) ativo.push(nome);
    } else if (polo.includes('PA') || polo === 'P') {
      if (!passivo.includes(nome)) passivo.push(nome);
    } else {
      if (!outros.includes(nome)) outros.push(nome);
    }
  }
  // Se so ha "outros", heuristica: primeiro pessoa fisica ~ ativo, juridica/banco ~ passivo
  if (!ativo.length && !passivo.length && outros.length) {
    const isBank = (n: string) => /BANCO|S\.?A\.?|LTDA|FINANCEIRA|CREDITO|SEGURADORA|CAIXA ECON/.test(n.toUpperCase());
    for (const n of outros) {
      if (isBank(n)) {
        if (!passivo.includes(n)) passivo.push(n);
      } else if (!ativo.includes(n)) {
        ativo.push(n);
      }
    }
  }
  return { ativo, passivo, outros };
}

/**
 * A API Pública do DataJud não disponibiliza campos de CPF/CNPJ/OAB ou nome
 * das partes para pesquisa. Localize a pessoa no CRM e consulte o CNJ.
 */
export async function searchDataJudByNome(
  nome:string,
  _opts?:{aliases?:string[];size?:number;classeCodigo?:number}
):Promise<{success:boolean;items:any[];error?:string}>{
 const query=String(nome||'').trim();
 return {success:false,items:[],error:query
  ?'A API pública do DataJud não oferece pesquisa por nome de parte. Localize o processo no CRM/tribunal e consulte pelo CNJ.'
  :'Nome não informado.'};
}

export async function searchDataJudByCpf(
  documento:string,
  _opts?:{aliases?:string[];size?:number;onlyBA?:boolean}
):Promise<{success:boolean;items:any[];error?:string}>{
 const digits=String(documento||'').replace(/\D/g,'');
 return {success:false,items:[],error:digits
  ?'A API pública do DataJud não oferece pesquisa por CPF/CNPJ/OAB. Localize o processo no CRM/tribunal e consulte pelo CNJ.'
  :'Documento não informado.'};
}

export async function fetchDataJud(cnj: string, attempt = 1, options: DataJudOptions = {}): Promise<any> {
  // Cache + dedupe só na 1ª tentativa (retries ficam fora do cache hit)
  if (attempt === 1 && options.forceRefresh !== true) {
    const key = PerfKeys.datajud(cnj, options.fast === true) + (options.cloudBudget ? ':cloud' : '');
    return perfCached(key, () => fetchDataJudUncached(cnj, 1, options), options.fast ? 60_000 : 120_000);
  }
  return fetchDataJudUncached(cnj, attempt, options);
}

async function fetchDataJudUncached(cnj: string, attempt = 1, options: DataJudOptions = {}, overrideKey?:string): Promise<any> {
  const cnjLimpo = cnj.replace(/\D/g, '');
  const startTime = Date.now();

  if (cnjLimpo.length !== 20) {
    return { numeroProcesso: cnj, movimentos: [], error: true, message: "CNJ inválido.", errorCode:'invalid_cnj', attempts: attempt };
  }
  if (!isDataJudUseAuthorized()) {
    return {
      numeroProcesso:cnjLimpo,movimentos:[],error:true,errorCode:'terms_restricted',
      message:'Consulta DataJud desativada: os termos vigentes vedam uso comercial dos dados. É necessária autorização expressa do CNJ para este uso.',
      attempts:attempt,
    };
  }

  const alias = resolveDataJudAlias(cnjLimpo);
  if (!alias) {
    return {
      numeroProcesso:cnjLimpo,movimentos:[],error:true,errorCode:'unknown_jurisdiction',
      message:'Código de tribunal não reconhecido no número CNJ; nenhum endpoint foi presumido.',
      attempts:attempt,
    };
  }
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;

  // O índice público armazena o número sem máscara (20 dígitos).
  // Consulta exata pelo formato recomendado nos exemplos oficiais do CNJ.
  // A consulta exata em dígitos segue o exemplo oficial de pesquisa por CNJ.

  const isFast = options.fast === true;

  // AGORA: fast ainda dá tempo real ao tribunal + 1 retry
  const timeoutMs = options.timeoutMs && Number.isFinite(options.timeoutMs) ? Math.min(46_000,Math.max(5_000,options.timeoutMs)) : resolveDataJudTimeoutMs({cloudBudget:options.cloudBudget,fast:isFast});
  const maxAttempts = options.cloudBudget ? 1 : 3;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${overrideKey || resolveCurrentDataJudKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        size: 1,
        query: { match: { numeroProcesso: cnjLimpo } },
      }),
      signal: controller.signal,
      cache: 'no-store'
    });

    clearTimeout(id);
    const latency = Date.now() - startTime;

    if ((response.status === 401 || response.status === 403) && !overrideKey) {
      const fresh=await refreshPublicDataJudKey();
      if(fresh&&fresh!==resolveCurrentDataJudKey()){
        return fetchDataJudUncached(cnj,attempt,options,fresh);
      }
    }

    if (response.status === 429) {
      // DataJud ES can reject overloaded shards with 429. Immediate retries
      // increase queue pressure; the Hermes shared scheduler honors cooldown.
      const retryHeader=response.headers?.get?.('retry-after') || '';
      const secs=/^\d+$/.test(retryHeader.trim())
        ?Number(retryHeader.trim())
        :retryHeader?Math.ceil((Date.parse(retryHeader)-Date.now())/1000):0;
      const retryAfterSeconds=Number.isFinite(secs)?Math.min(14400,Math.max(0,secs)):0;
      return {
        numeroProcesso: cnjLimpo,
        movimentos: [],
        error: true,
        httpStatus:429,
        errorCode:'rate_limited',
        retryAfterSeconds,
        message: "API pública DataJud sobrecarregada (HTTP 429); consulta adiada.",
        latency,
        attempts: attempt
      };
    }

    if (response.status >= 500 && attempt < maxAttempts) {
      await sleep(800 * attempt);
      return fetchDataJudUncached(cnj, attempt + 1, options);
    }

    if (!response.ok) {
      return {
        numeroProcesso: cnjLimpo,
        movimentos: [],
        error: true,
        message: `HTTP ${response.status}`,
        httpStatus: response.status,
        errorCode:response.status===401||response.status===403?'auth_error':response.status>=500?'server_error':'http_error',
        latency,
        attempts: attempt
      };
    }

    const data = await response.json();

    // A resposta HTTP 200 pode vir do Elasticsearch com timeout interno.
    // Não transformar uma consulta incompleta em "processo não encontrado".
    if (data?.timed_out === true) {
      if (attempt < maxAttempts) {
        await sleep(600);
        return fetchDataJudUncached(cnj, attempt + 1, options);
      }
      return {
        numeroProcesso: cnjLimpo, movimentos: [], error: true,
        message: 'Consulta DataJud excedeu o tempo interno do índice.',
        errorCode:'index_timeout',httpStatus:200,
        latency, attempts: attempt
      };
    }

    if (data._shards?.failed > 0 && (!data.hits?.hits || data.hits.hits.length === 0)) {
      if (attempt < maxAttempts) {
        await sleep(600);
        return fetchDataJudUncached(cnj, attempt + 1, options);
      }
      return {
        numeroProcesso: cnjLimpo,
        movimentos: [],
        error: true,
        message: "Tribunal instável (shard).",
        errorCode:'shard_failure',httpStatus:200,
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
        found: false,
        message: "Não localizado no índice DataJud.",
        errorCode:'not_found',httpStatus:200,
        latency,
        attempts: attempt
      };
    }

    const partesRaw = Array.isArray(source.partes) ? source.partes : [];
    const polos = extrairPolos(partesRaw);

    return {
      numeroProcesso: source.numeroProcesso || cnjLimpo,
      classe: source.classe?.nome || source.classe?.codigo || 'N/A',
      classeCodigo: source.classe?.codigo ?? null,
      grau: source.grau || null,
      tribunal: source.tribunal || alias.toUpperCase(),
      orgaoJulgador: source.orgaoJulgador?.nome || source.orgaoJulgador?.codigo || null,
      movimentos: Array.isArray(source.movimentos) ? source.movimentos : [],
      found: true,
      dataAjuizamento: source.dataAjuizamento || null,
      dataHoraUltimaAtualizacao: source.dataHoraUltimaAtualizacao || null,
      indexTimestamp: source['@timestamp'] || null,
      took: Number.isFinite(data?.took) ? data.took : null,
      shardsFailed: Number.isFinite(data?._shards?.failed) ? data._shards.failed : null,
      partes: partesRaw,
      poloAtivo: polos.ativo,
      poloPassivo: polos.passivo,
      error: false,
      httpStatus:200,
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
      return fetchDataJudUncached(cnj, attempt + 1, options);
    }

    return {
      numeroProcesso: cnjLimpo,
      movimentos: [],
      error: true,
      message: isTimeout ? "Tempo esgotado no tribunal." : "Falha técnica DataJud.",
      errorCode:isTimeout?'timeout':'network_error',
      latency,
      attempts: attempt
    };
  }
}
