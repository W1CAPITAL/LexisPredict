"use client";
import { processarCaso, type LegalCase } from "@/lib/case-logic";
import { supabase } from "@/lib/supabase";
const KEY='lexis_carteira_client_v4';
const TTL_MS=30*60*1000;
type Box={at:number;empresaKey:string;cases:LegalCase[]};
let box:Box|null=null; let inflight:Promise<LegalCase[]>|null=null; let inflightKey='';
function read(key:string):Box|null{try{const p=JSON.parse(localStorage.getItem(KEY)||'null');if(!p||p.empresaKey!==key||!Array.isArray(p.cases))return null;return p;}catch{return null;}}
function write(v:Box){try{localStorage.setItem(KEY,JSON.stringify(v));}catch{}}
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
 * Leitura rápida da carteira direto do Supabase browser.
 * O RLS decide o escopo:
 * - Operador/Administrador: created_by = auth.uid()
 * - Supervisor/Superadmin: empresa inteira
 */
export async function fetchCarteiraPageClient(opts: {
  empresaId: string;
  limit?: number;
  offset?: number;
  onlyAtivos?: boolean;
}): Promise<LegalCase[]> {
  if (!supabase || !opts.empresaId) return [];

  const limit = Math.max(1, Math.min(Number(opts.limit || 200), 500));
  const offset = Math.max(0, Number(opts.offset || 0));

  let query = supabase
    .from("processos")
    .select("*")
    .eq("empresa_id", opts.empresaId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.onlyAtivos) {
    query = query.not(
      "status",
      "in",
      '("Arquivado","ENCERRADO","Extinto","SUSPENSO")'
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(rowToLegalCase);
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
export async function fetchCarteiraAllClient(opts: {
  empresaId: string;
  pageSize?: number;
  onlyAtivos?: boolean;
  onPage?: (cases: LegalCase[], page: number) => void;
}): Promise<LegalCase[]> {
  if (!opts.empresaId) return [];

  const pageSize = Math.max(50, Math.min(Number(opts.pageSize || 300), 500));
  let page = 0;
  let all: LegalCase[] = [];

  while (true) {
    const next = await fetchCarteiraPageClient({
      empresaId: opts.empresaId,
      limit: pageSize,
      offset: page * pageSize,
      onlyAtivos: opts.onlyAtivos,
    });

    all = mergeCarteiraPages(all, next);
    opts.onPage?.(all, page);

    if (next.length < pageSize) break;
    page += 1;

    // Cede o event loop entre páginas para a UI permanecer responsiva.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  return all;
}
