/** Proveniência temporal da API pública DataJud.
 * Os carimbos pertencem ao índice e à origem, nunca ao horário do cron.
 * A API não é webhook nem fonte de prazo judicial.
 */
export type DataJudSourceRevision={
  indexedAt:string|null;
  updatedAt:string|null;
};

function normalizedStamp(value:unknown):string|null{
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT/.test(value))return null;
 const t=Date.parse(value);
 return Number.isFinite(t)?new Date(t).toISOString():null;
}

export function extractDataJudSourceRevision(
 data:unknown
):DataJudSourceRevision|null{
 const source=data as Record<string,unknown>|null;
 if(!source||source.error!==false||source.found!==true)return null;
 return {
  indexedAt:normalizedStamp(source.indexadoEm),
  updatedAt:normalizedStamp(source.dataHoraUltimaAtualizacao),
 };
}

function newest(a:string|null|undefined,b:string|null|undefined):string|null{
 const old=normalizedStamp(a),fresh=normalizedStamp(b);
 if(old&&fresh)return Date.parse(fresh)>Date.parse(old)?fresh:old;
 return fresh||old;
}

/** Preserve source evidence on 429/timeout/DJEN-only. Do not overwrite
 * confirmed index timestamp with a request's execution timestamp.
 */
export function retainDataJudSourceRevision(
 previous:DataJudSourceRevision|null|undefined,
 current:DataJudSourceRevision|null|undefined
):DataJudSourceRevision{
 return {
  indexedAt:newest(previous?.indexedAt,current?.indexedAt),
  updatedAt:newest(previous?.updatedAt,current?.updatedAt),
 };
}
