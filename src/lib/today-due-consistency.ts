/**
 * Uma só regra para o card "Retornos para hoje" e a fila É hoje.
 * Usa a carteira já autorizada pela API existente, sem gerar registros.
 */
import {isAtendidoHoje} from './atendimento-semana';
import {isCasoEncerrado} from './status-encerrado';

export type DueSummary<T>={pendingCases:T[];clientCount:number;processCount:number};

export function summarizeActionableDueCases<T extends object>(cases:readonly T[],ref=new Date()):DueSummary<T>{
 const pendingCases:T[]=[];
 const clients=new Set<string>();
 for(const item of cases){
  const row=item as Record<string,unknown>;
  if(isCasoEncerrado(item))continue;
  const last=(row.ultimoRetorno??row.ultimo_retorno) as string|null|undefined;
  const hasNewInfo=Boolean(row.tem_novo_andamento||row.tem_atualizacao_pos_retorno||row.djen_nova_comunicacao);
  if(isAtendidoHoje(last,ref)&&!hasNewInfo)continue;
  pendingCases.push(item);
  // Sem nome não é possível afirmar que existe um cliente distinto.
  const clientName=String(row.cliente??row.cliente_nome??'').trim().replace(/\s+/g,' ').toLocaleUpperCase('pt-BR');
  if(clientName)clients.add(clientName);
 }
 return{pendingCases,clientCount:clients.size,processCount:pendingCases.length};
}

export type DuePage<T>={cases:T[];hasMore:boolean};

/** Nunca retorna páginas parciais como se fossem a carteira completa. */
export async function loadAllDuePages<T>(
 load:(offset:number)=>Promise<DuePage<T>>,
 options?:{maxCases?:number;signal?:AbortSignal}
):Promise<T[]>{
 const maxCases=Math.max(1,Math.min(100_000,Math.trunc(options?.maxCases??20_000)));
 const results:T[]=[];
 let offset=0;
 while(true){
  if(options?.signal?.aborted)throw new Error('Consulta de retornos cancelada.');
  const page=await load(offset);
  if(!page||!Array.isArray(page.cases)||typeof page.hasMore!=='boolean')
   throw new Error('Consulta de retornos incompleta: resposta inválida.');
  if(results.length+page.cases.length>maxCases)
   throw new Error('Consulta de retornos incompleta: limite de registros excedido.');
  results.push(...page.cases);
  if(!page.hasMore)return results;
  if(page.cases.length===0)
   throw new Error('Consulta de retornos incompleta: página vazia.');
  offset+=page.cases.length;
 }
}

/**
 * Busca os retornos diretamente pela empresa autenticada. Não passa pelo
 * adaptador da carteira, que pode transformar/descartar registros com CNJ
 * ausente ou legado. A paginação é validada antes de entregar a fila.
 */
export async function loadAllCompanyDueReturns<T>(
 today: string,
 options?: { maxCases?: number; pageSize?: number; signal?: AbortSignal; fetcher?: typeof fetch },
): Promise<T[]> {
 const fetcher = options?.fetcher ?? fetch;
 const pageSize = Math.max(1, Math.min(1000, Math.trunc(options?.pageSize ?? 1000)));
 return loadAllDuePages<T>(async (offset) => {
  const params = new URLSearchParams({
   ate: today,
   offset: String(offset),
   limit: String(pageSize),
  });
  const response = await fetcher('/api/tarefas/retornos-empresa?' + params.toString(), {
   method: 'GET',
   credentials: 'same-origin',
   cache: 'no-store',
   signal: options?.signal,
  });
  const payload = await response.json().catch(() => null) as {
   ok?: boolean;
   scope?: string;
   cases?: T[];
   hasMore?: boolean;
   error?: string;
  } | null;
  if (!response.ok || payload?.ok !== true || payload.scope !== 'empresa' || !Array.isArray(payload.cases)) {
   throw new Error(payload?.error || 'Não foi possível carregar a fila completa da empresa.');
  }
  return { cases: payload.cases, hasMore: payload.hasMore === true };
 }, { maxCases: options?.maxCases, signal: options?.signal });
}
