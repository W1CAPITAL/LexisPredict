/** Compactação somente de visualização: a origem da notificação permanece
 * no banco para auditoria, mas uma publicação para o mesmo processo/data/hora
 * toma o lugar do cartão genérico anterior.
 */
export type AudienciaVisivel={
 id:number;processo_id:number;tipo:string;data_evento:string|null;
 hora_local:string|null;situacao:string;fonte:string;
};
const sourceRank=(source:string)=>source==='DJEN'||source==='TJPR PROJUDI'?4:source==='DataJud'?3:source==='NOTIFICACAO'?1:0;
function sameEvent<T extends AudienciaVisivel>(a:T,b:T):boolean{
 return a.processo_id===b.processo_id&&
 a.data_evento!==null&&a.data_evento===b.data_evento&&
 a.hora_local!==null&&a.hora_local===b.hora_local&&
 (a.tipo===b.tipo||a.tipo==='audiencia'||b.tipo==='audiencia');
}
export function compactarAudienciasVisiveis<T extends AudienciaVisivel>(rows:readonly T[]):T[]{
 const dated=rows.filter(r=>r.data_evento&&r.situacao!=='cancelada');
 const visible:T[]=[];
 for(const row of rows){
  if(row.situacao==='data_pendente'&&
    dated.some(d=>d.processo_id===row.processo_id&&d.tipo===row.tipo))continue;
  const same=visible.findIndex(r=>sameEvent(r,row));
  if(same===-1){visible.push(row);continue;}
  const old=visible[same];
  if(sourceRank(row.fonte)>sourceRank(old.fonte))visible[same]=row;
 }
 return visible;
}
