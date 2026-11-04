/** Date filter semantics for Processos da Empresa.
 * No fallback from 'Distribuição' to another event: different dates mean different things.
 * Calendar comparisons use the America/Sao_Paulo business day (inclusive).
 */
export const PROCESSOS_DATE_FIELDS = {
  movimento: { column:'datajud_ultimo_movimento', label:'Última movimentação (DataJud)', timestamp:true },
  atualizacao: { column:'updated_at', label:'Atualização do cadastro', timestamp:true },
  'ultimo-retorno': { column:'ultimo_retorno', label:'Último retorno ao cliente', timestamp:false },
  'proximo-retorno': { column:'proximo_retorno', label:'Próximo retorno ao cliente', timestamp:false },
  cadastro: { column:'created_at', label:'Data do cadastro', timestamp:true },
  distribuicao: { column:'data_distribuicao', label:'Distribuição do processo', timestamp:false },
} as const;
export type ProcessoDateField = keyof typeof PROCESSOS_DATE_FIELDS;

export function isProcessDateField(value: string): value is ProcessoDateField {
  return Object.prototype.hasOwnProperty.call(PROCESSOS_DATE_FIELDS, value);
}
export function isValidProcessDate(value:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [y,m,d]=value.split('-').map(Number);
  if(y<1900 || y>2200 || m<1 || m>12 || d<1 || d>31)return false;
  const parsed=new Date(Date.UTC(y,m-1,d));
  return parsed.getUTCFullYear()===y && parsed.getUTCMonth()+1===m && parsed.getUTCDate()===d;
}
export function validateProcessDateRange(from:string,to:string):string|null {
  if(from&&!isValidProcessDate(from))return 'Data inicial inválida.';
  if(to&&!isValidProcessDate(to))return 'Data final inválida.';
  if(from&&to&&from>to)return 'A data inicial deve ser anterior ou igual à data final.';
  return null;
}
export function nextProcessDay(iso:string):string {
  if(!isValidProcessDate(iso))throw new Error('Data inválida');
  const [y,m,d]=iso.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10);
}
export function dateOnlyBrazil(value:unknown):string|null {
  const raw=String(value??'').trim();
  if(!raw)return null;
  const br=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(br){const iso=`${br[3]}-${br[2]}-${br[1]}`;return isValidProcessDate(iso)?iso:null;}
  const match=raw.match(/^(\d{4}-\d{2}-\d{2})(?:$|[ T])/);
  if(!match||!isValidProcessDate(match[1]))return null;
  if(!/[T ]\d{2}:\d{2}/.test(raw))return match[1];
  const d=new Date(raw);
  if(Number.isNaN(d.getTime()))return null;
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const num=(type:string)=>parts.find(p=>p.type===type)?.value||'';
  return `${num('year')}-${num('month')}-${num('day')}`;
}
export function matchesProcessDateRange(
  item: Record<string,unknown>, field: ProcessoDateField, from: string, to: string
):boolean {
  if(validateProcessDateRange(from,to))return false;
  if(!from&&!to)return true;
  const values: Record<ProcessoDateField,unknown>={
    movimento:item.datajud_ultimo_movimento,
    atualizacao:item.updated_at,
    'ultimo-retorno':item.ultimoRetorno??item.ultimo_retorno,
    'proximo-retorno':item.proximoPrazo??item.proximo_retorno,
    cadastro:item.created_at,
    distribuicao:item.dataDistribuicao??item.data_distribuicao,
  };
  const key=dateOnlyBrazil(values[field]);
  return !!key&&(!from||key>=from)&&(!to||key<=to);
}
