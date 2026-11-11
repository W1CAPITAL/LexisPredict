/**
 * @fileOverview Serviço DataJud (CNJ) v480 — BOTH não sacrifica o tribunal
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import 'server-only';
import { perfCached, PerfKeys, perfLog, perfNow } from '@/lib/performance-motor';
import {resolveDataJudAlias} from '@/lib/datajud-aliases';
import {extrairPolos} from '@/lib/datajud-party';
import {isDataJudUseAuthorized} from '@/lib/datajud-policy';
export {COURT_ALIASES,resolveDataJudAlias} from '@/lib/datajud-aliases';
export {extrairPolos} from '@/lib/datajud-party';
export {isDataJudUseAuthorized} from '@/lib/datajud-policy';
import { resolveDataJudTimeoutMs } from '@/lib/datajud-time-budget';

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
 const text=String(page||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ');
 const match=text.match(/(?:Authorization\s*:\s*)?APIKey\s+([A-Za-z0-9_+/=-]{30,})/i);
 return match?.[1]||null;
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

/** A Portaria CNJ 374/2026 prevê polos ativo/passivo apenas quando pessoas jurídicas. */
function extractPublicCorporatePoleNames(value:unknown):string[]{
 const values=Array.isArray(value)?value:value==null?[]:[value];
 const names=values.map(entry=>{
  if(typeof entry==='string')return entry.trim();
  if(!entry||typeof entry!=='object')return '';
  const item=entry as Record<string,unknown>;
  const name=item.razaoSocial||item.nome||item.nomeParte;
  return typeof name==='string'?name.trim():'';
 }).filter(name=>name.length>=3).map(name=>name.slice(0,180));
 return [...new Set(names)].slice(0,50);
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
      const previousKey=resolveCurrentDataJudKey();
      const fresh=await refreshPublicDataJudKey();
      if(fresh&&fresh!==previousKey){
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

    // A API pública não deve ser usada para extrair CPF/CNPJ ou partes físicas.
    // Desde a Portaria CNJ 374/2026, a resposta mínima pode incluir polos
    // somente quando as partes são pessoas jurídicas.
    const poloAtivo=extractPublicCorporatePoleNames(source.poloAtivo);
    const poloPassivo=extractPublicCorporatePoleNames(source.poloPassivo);
    const partesRaw=[
      ...poloAtivo.map(nome=>({nome,polo:'ATIVO',tipo:'PESSOA JURIDICA'})),
      ...poloPassivo.map(nome=>({nome,polo:'PASSIVO',tipo:'PESSOA JURIDICA'})),
    ];
    const polos=extrairPolos(partesRaw);

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