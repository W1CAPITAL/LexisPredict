"use client";

import {useMemo,useState} from 'react';
import {ExternalLink,Search,ShieldCheck} from 'lucide-react';
import {TRIBUNAIS_TJ,type TribunalLink} from '@/lib/tribunais-links';

const systems:Record<TribunalLink['sistema'],string>={
 esaj:'e-SAJ',pje:'PJe',eproc:'eproc',projudi:'Projudi',outro:'Sistema próprio',
};
function officialWebsite(tribunal:TribunalLink){
 return 'https://www.'+tribunal.sigla.toLowerCase()+'.jus.br/';
}
function officialLink(raw:string){
 try{
  const url=new URL(raw);
  return url.protocol==='https:'&&(url.hostname==='jus.br'||url.hostname.endsWith('.jus.br'));
 }catch{return false}
}
/** Catálogo público de abertura manual. Não gera função, consulta robótica,
 * nem marca movimentações como verificadas sem retorno estruturado do tribunal.
 */
export function HermesTjPortalGrid(){
 const [query,setQuery]=useState('');
 const courts=useMemo(()=>{
  const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  const term=normal(query.trim());
  return TRIBUNAIS_TJ.filter(c=>!term||normal([c.sigla,c.nome,c.sistema].join(' ')).includes(term));
 },[query]);
 return <div id="hermes-tj-portal-grid" className="space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <h2 className="text-base font-bold text-foreground">Portais dos Tribunais de Justiça</h2>
    <p className="mt-1 text-xs text-muted-foreground">27 TJs (26 estados e DF). Todos com opção de abrir o portal oficial. A abertura não significa coleta automática dos autos.</p>
   </div>
   <span className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-foreground">
    <ShieldCheck size={14}/> {TRIBUNAIS_TJ.length} tribunais catalogados
   </span>
  </div>
  <label className="flex max-w-md items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
   <Search size={16} className="text-muted-foreground"/>
   <span className="sr-only">Filtrar tribunais por UF, nome ou sistema</span>
   <input className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
    value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar TJ, estado ou sistema..." />
  </label>
  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
   {courts.map(c=><article key={c.codigo} className="rounded-xl border border-border bg-card p-3 text-foreground">
    <div className="flex items-center justify-between gap-2">
     <div className="min-w-0">
      <h3 className="text-sm font-bold">{c.sigla} <span className="font-normal text-muted-foreground">· {c.nome}</span></h3>
      <p className="text-[11px] text-muted-foreground">{systems[c.sistema]} · código CNJ {c.codigo}</p>
     </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-3">
     {officialLink(c.url)&&<a href={c.url} target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-1 text-xs font-semibold text-foreground underline">
       Abrir portal <ExternalLink size={12}/>
     </a>}
     <a href={officialWebsite(c)} target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-1 text-xs text-muted-foreground underline">
       Site oficial
     </a>
     {(c.alternativos||[]).filter(a=>officialLink(a.url)).map(a=><a key={a.url}
       href={a.url} target="_blank" rel="noopener noreferrer"
       className="text-xs text-muted-foreground underline">{a.label||systems[a.sistema]}</a>)}
    </div>
   </article>)}
  </div>
  {!courts.length&&<p className="text-sm text-muted-foreground">Nenhum tribunal corresponde à pesquisa.</p>}
  <p className="text-xs text-muted-foreground">Para CPF/CNPJ/OAB, os campos disponíveis dependem do portal. O DataJud público continua aceitando número CNJ; se houver CAPTCHA, login ou sistema indisponível, a consulta exige acesso humano autorizado. Não há integração privada com o Vigilant.</p>
 </div>;
}
