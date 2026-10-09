"use client";
import { processarCaso, type LegalCase } from "@/lib/case-logic";

const KEY='lexis_carteira_client_v4';
const TTL_MS=30*60*1000;
type Box={at:number;empresaKey:string;cases:LegalCase[]};
let box:Box|null=null; let inflight:Promise<LegalCase[]>|null=null; let inflightKey='';
function read(_key:string):Box|null{return null;}
function write(_v:Box){/* Avoid blocking localStorage serialization of legal records. */}
export function peekCarteiraClientCache(empresaKey='default'):LegalCase[]|null{const b=box&&box.empresaKey===empresaKey?box:read(empresaKey);if(!b)return null;box=b;return Date.now()-b.at<TTL_MS?b.cases:null;}
export function seedCarteiraClientCache(cases:LegalCase[],empresaKey='default'){box={at:Date.now(),empresaKey,cases:Array.isArray(cases)?cases:[]};if(box.cases.length)write(box);}
export function invalidateCarteiraClientCache(){box=null;inflight=null;inflightKey='';try{localStorage.removeItem(KEY);}catch{}}
export async function fetchCarteiraDeduped(fetchFn:()=>Promise<LegalCase[]|null|undefined>,opts?:{force?:boolean;empresaKey?:string}):Promise<LegalCase[]>{
 const key=opts?.empresaKey||'default'; const cached=peekCarteiraClientCache(key);
 if(!opts?.force&&cached)return cached;
 if(inflight&&inflightKey===key)return inflight;
 inflightKey=key; inflight=(async()=>{try{const raw=(await fetchFn())||[];const cases=Array.isArray(raw)?raw:[];if(cases.length)seedCarteiraClientCache(cases,key);return cases;}finally{inflight=null;inflightKey='';}})();return inflight;
}


function rowToLegalCase(item: any): LegalCase {
  const dados =
    item?.dados && typeof item.dados === "object" ? item.dados : {};

  return processarCaso({
    ...dados,
    id: String(item.id),
    db_id: String(item.id),
    empresa_id: item.empresa_id,
    created_by: item.created_by,
    protocolo:
      item.protocolo_ref ||
      dados.protocolo ||
      dados.PROTOCOLO ||
      "",
    cliente: dados.cliente || dados.CLIENTE || "SEM NOME",
    advogado: item.advogado ?? dados.advogado ?? dados.ADVOGADO ?? "NÃO ATRIBUÍDO",
    escritorio: item.escritorio ?? dados.escritorio ?? null,
    situacao: item.status_interno ?? dados.situacao ?? dados.status ?? "EM ANDAMENTO",
    statusManual: dados.statusManual ?? dados.status_manual ?? "Automatico",
    status_interno: item.status_interno ?? dados.status_interno ?? null,
    proximoPrazo: item.proximo_retorno ?? dados.proximoPrazo ?? dados.proximo_retorno ?? null,
    ultimoRetorno: item.ultimo_retorno ?? dados.ultimoRetorno ?? dados.ultimo_retorno ?? null,
    telefone: item.telefone ?? dados.telefone ?? "",
    observacao: item.observacoes ?? dados.observacao ?? dados.observacoes ?? "",
    atendido_por: item.atendido_por ?? dados.atendido_por ?? null,
    atendido_em: item.atendido_em ?? dados.atendido_em ?? null,
    datajud_ultimo_movimento: item.datajud_ultimo_movimento ?? dados.datajud_ultimo_movimento,
    datajud_ultimo_nome: item.datajud_ultimo_nome ?? dados.datajud_ultimo_nome,
    datajud_consultado_em: item.datajud_consultado_em ?? dados.datajud_consultado_em,
    tem_atualizacao_pos_retorno: item.tem_atualizacao_pos_retorno ?? dados.tem_atualizacao_pos_retorno,
    datajud_encerrado_tribunal: item.datajud_encerrado_tribunal ?? dados.datajud_encerrado_tribunal,
    datajud_encerrado_motivo: item.datajud_encerrado_motivo ?? dados.datajud_encerrado_motivo,
    indicio_busca_apreensao: item.indicio_busca_apreensao ?? dados.indicio_busca_apreensao,
    busca_apreensao_confianca: item.busca_apreensao_confianca ?? dados.busca_apreensao_confianca,
    busca_apreensao_motivo: item.busca_apreensao_motivo ?? dados.busca_apreensao_motivo,
    em_cumprimento_sentenca: item.em_cumprimento_sentenca ?? dados.em_cumprimento_sentenca,
    cumprimento_pendente_necessario:
      item.cumprimento_pendente_necessario ?? dados.cumprimento_pendente_necessario,
    is_procedente: item.is_procedente ?? dados.is_procedente,
    status_executivo: item.status_executivo ?? dados.status_executivo,
    djen_nova_comunicacao: item.djen_nova_comunicacao ?? dados.djen_nova_comunicacao,
    djen_ultimo_resumo: item.djen_ultimo_resumo ?? dados.djen_ultimo_resumo,
    djen_ultimo_link: item.djen_ultimo_link ?? dados.djen_ultimo_link,
    djen_ultima_data: item.djen_ultima_data ?? dados.djen_ultima_data,
    dados,
  });
}

/**
 * Leitura leve via endpoint HTTP autenticado. O servidor define tenant e dono:
 * a solicitacao nunca transmite um empresa_id ou responsavel confiavel.
 */
export async function fetchCarteiraPageClient(opts: {
  empresaId: string;
  limit?: number;
  offset?: number;
  onlyAtivos?: boolean;
  includeDetails?: boolean;
  scope?: 'mine' | 'empresa';
}): Promise<LegalCase[]> {
  if (!opts.empresaId) return [];
  const limit = Math.max(1, Math.min(Number(opts.limit || 200), 400));
  const offset = Math.max(0, Number(opts.offset || 0));
  const qs = new URLSearchParams({
    scope: opts.scope || 'mine',
    limit: String(limit),
    offset: String(offset),
    details: opts.includeDetails ? '1' : '0',
    summary: '0', // nao calcular as mesmas contagens a cada pagina
  });
  const response = await fetch('/api/carteira/fast?' + qs.toString(), {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(25000),
  });
  if (!(response.headers.get('content-type') || '').includes('application/json')) {
    throw new Error('A consulta retornou um formato inesperado. Tente recarregar a pagina.');
  }
  const result = await response.json();
  if (!response.ok || !result?.ok || !Array.isArray(result.cases)) {
    throw new Error(result?.error || 'Falha ao consultar a carteira.');
  }
  return result.cases as LegalCase[];
}

export function mergeCarteiraPages(
  current: LegalCase[],
  next: LegalCase[]
): LegalCase[] {
  const out: LegalCase[] = [];
  const seen = new Set<string>();

  for (const item of [...(current || []), ...(next || [])]) {
    const key = String(
      item?.protocolo ||
      (item as any)?.db_id ||
      item?.id ||
      ""
    );
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}


/**
 * Carteira completa com entrega progressiva.
 * A primeira página libera a UI; páginas seguintes continuam em background.
 */
/**
 * Progressive loading: small first response unlocks the screen. Remaining
 * pages are yielded to React on each chunk, without sending full JSON fields.
 * If an intermediate page fails, keep the already-loaded data on screen.
 */
export async function fetchCarteiraAllClient(opts: {
  empresaId: string;
  pageSize?: number;
  firstPageSize?: number;
  onlyAtivos?: boolean;
  maxRows?: number;
  onPage?: (cases: LegalCase[], page: number) => void;
  onError?: (error: unknown) => void;
  scope?: "mine" | "empresa";
}): Promise<LegalCase[]> {
  if (!opts.empresaId) return [];
  const pageSize = Math.max(40, Math.min(Number(opts.pageSize || 160), 250));
  const firstSize = Math.max(20, Math.min(Number(opts.firstPageSize || 36), pageSize));
  const maxRows = Math.max(firstSize, Math.min(Number(opts.maxRows || 10000), 10000));
  let page = 0;
  let offset = 0;
  let all: LegalCase[] = [];

  while (offset < maxRows) {
    const limit = Math.min(page === 0 ? firstSize : pageSize, maxRows - offset);
    let next: LegalCase[];
    try {
      next = await fetchCarteiraPageClient({
        empresaId: opts.empresaId,
        limit,
        offset,
        onlyAtivos: opts.onlyAtivos,
        scope: opts.scope,
      });
    } catch (error) {
      opts.onError?.(error);
      if (all.length) return all;
      throw error;
    }
    offset += next.length;
    all = mergeCarteiraPages(all, next);
    opts.onPage?.(all, page);
    if (next.length < limit) break;
    page += 1;
    // Break up work so navigation, clicks and paint are not starved.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  return all;
}
