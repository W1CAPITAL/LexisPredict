/** A primeira página do servidor é a fonte de verdade após mutações.
 * Ao revalidar forçadamente, NUNCA mesclar snapshots antigos: eles podem
 * conter processos excluídos ou reatribuídos nesta ou em outra aba.
 */
export function reconcileCompanyPage<T extends {id?:string|number|null;protocolo?:string|null}>(
 fresh:ReadonlyArray<T>,
 current:ReadonlyArray<T>,
 previous:ReadonlyArray<T>,
 force=false,
):T[]{
 const records=force?fresh:[...fresh,...current,...previous];
 const seen=new Set<string>();
 const out:T[]=[];
 for(const item of records){
  const key=String(item.id??item.protocolo??'').trim();
  if(!key || seen.has(key))continue;
  seen.add(key);
  out.push(item);
 }
 return out;
}
