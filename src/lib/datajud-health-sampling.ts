/** Seleciona uma única amostra por tribunal para auditoria opcional da rede.
 * O CNJ contém ramo/tribunal nas posições N.JJ; os últimos quatro dígitos
 * identificam a origem e NÃO o tribunal.
 */
export type DataJudHealthSample={cnj:string;courtCode:string};
export function selectDataJudHealthSamples(
 protocols:readonly string[],limit=3
):DataJudHealthSample[]{
 const selected=new Map<string,DataJudHealthSample>();
 const max=Math.max(0,Math.min(3,Math.trunc(limit)));
 for(const proto of protocols||[]){
  if(selected.size>=max)break;
  const cnj=String(proto||'').replace(/\D/g,'');
  if(cnj.length!==20)continue;
  const justice=cnj[13],court=Number(cnj.slice(14,16));
  const supported=
   (justice==='8'&&court>=1&&court<=27)||
   (justice==='4'&&court>=1&&court<=6)||
   (justice==='5'&&court>=1&&court<=24)||
   (justice==='2'&&(court===0||court===1))||
   (justice==='3'&&(court===0||court===1))||
   (justice==='6'&&court===0)||
   (justice==='7'&&court===0);
  if(!supported)continue;
  const courtCode=justice+'.'+cnj.slice(14,16);
  if(!selected.has(courtCode))selected.set(courtCode,{cnj,courtCode});
 }
 return [...selected.values()];
}
