/** Consulta legada: o responsável pode estar na coluna ou em uma das chaves JSON. */
export const LAWYER_SEARCH_COLUMNS=['advogado','dados->>advogado','dados->>ADVOGADO'] as const;
export type LawyerSearchField=typeof LAWYER_SEARCH_COLUMNS[number];
export type LawyerSearchRow={
 id:string|number;updated_at?:string|null;advogado?:string|null;
 advogado_json?:string|null;advogado_alt?:string|null;
 [field:string]:unknown;
};
export function mergeLawyerSearchResults<T extends LawyerSearchRow>(
 groups:readonly (readonly T[])[],limit=60
):{rows:T[];partial:boolean}{
 const byId=new Map<string,T>();
 for(const group of groups)for(const row of group)if(!byId.has(String(row.id)))byId.set(String(row.id),row);
 const sorted=Array.from(byId.values()).sort(
   (a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))
 );
 return {rows:sorted.slice(0,limit),partial:sorted.length>limit||groups.some(g=>g.length>limit)};
}
