"use client";
import { DocumentsCarteiraPicker } from "@/components/documents/documents-carteira-picker";
import type { DocumentCase } from "@/app/actions/document-case-actions";
import { clientAsParte } from "@/lib/documents/document-case-prefill";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileSearch, Plus, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Fonte = { id: string; titulo: string; orgao: string; url: string; consulta: string; fato: string; cnj: string; endereco: string; enderecoOriginal: string; local: string; resumo: string; revisao: string };
const novo = (): Fonte => ({ id:"",titulo:"",orgao:"",url:"",consulta:"",fato:"",cnj:"",endereco:"",enderecoOriginal:"",local:"",resumo:"",revisao:"pendente" });
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function checkAddress(a: Fonte) {
  if (!a.endereco || !a.enderecoOriginal) return "Não confrontado";
  const ignore = new Set(["rua","avenida","av","de","da","do","dos","das"]);
  const terms=normalize(a.endereco).split(" ").filter(x=>x.length>1&&!ignore.has(x));
  const original=new Set(normalize(a.enderecoOriginal).split(" "));
  if (!terms.length) return "Não confrontado";
  return terms.filter(x=>original.has(x)).length >= Math.ceil(terms.length*0.8) && (!a.local || normalize(a.enderecoOriginal).includes(normalize(a.local))) ? "Compatível no texto, não confirmado no mapa" : "Divergente";
}
function report(objeto: string, fontes: Fonte[]) {
  const lines=["# Dossiê preliminar — investigação documental","", "Objeto: "+(objeto||"[PREENCHER]"),"",
    "Método God-Eye adaptado: fontes, datas, cruzamento por CNJ e precisão conservadora de endereços.",
    "Atenção: todas as informações foram inseridas pelo operador. Nenhuma fonte foi autenticada automaticamente; correlação não comprova culpa ou irregularidade.", ""];
  const byProcess = new Map<string, Fonte[]>();
  for(const x of fontes){const key=x.cnj.replace(/\D/g,"");if(key.length===20)byProcess.set(key,[...(byProcess.get(key)||[]),x]);}
  lines.push("## Cruzamentos por processo");
  for(const [cnj,records] of byProcess) if(records.length>1)lines.push(cnj+": "+records.length+" registros / "+new Set(records.map(x=>normalize(x.orgao))).size+" fontes declaradas");
  if(![...byProcess.values()].some(x=>x.length>1))lines.push("Sem correspondências repetidas.");
  fontes.forEach((x,i)=>lines.push("","## "+(i+1)+". "+x.titulo,"Fonte: "+x.orgao,"URL: "+(x.url||"[DOCUMENTO LOCAL]"),
    "Consultado em: "+(x.consulta||"[PENDENTE]")+" | Fato: "+(x.fato||"[PENDENTE]"),
    "Processo: "+(x.cnj||"[NÃO INFORMADO]"),"Endereço: "+(x.endereco||"[NÃO INFORMADO]"),
    "Conferência textual de endereço: "+checkAddress(x),"Situação declarada: "+x.revisao,"Descrição: "+x.resumo));
  lines.push("","Conclusão: verificar a integridade e o contexto dos documentos originais antes de formular afirmações jurídicas.");
  return lines.join("\n");
}
function download(name:string,value:string,mime:string){
  const url=URL.createObjectURL(new Blob([value],{type:mime}));
  const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function InvestigacaoDocumentalPage() {
  const {toast}=useToast();
  const [objeto,setObjeto]=useState("");
  const [current,setCurrent]=useState<Fonte>(novo);
  const [items,setItems]=useState<Fonte[]>([]);
  const [show,setShow]=useState(false);
  const memo=useMemo(()=>report(objeto,items),[objeto,items]);
  const set=(key:keyof Fonte,val:string)=>setCurrent(old=>({...old,[key]:val}));
  const add=()=>{
    if(!current.titulo.trim()||!current.orgao.trim()||!current.resumo.trim()){toast({title:"Informe título, fonte e descrição",variant:"destructive"});return;}
    if(current.cnj && current.cnj.replace(/\D/g,"").length!==20){toast({title:"CNJ deve conter 20 dígitos",variant:"destructive"});return;}
    if(current.url&&!/^https?:\/\/\S+$/i.test(current.url)){toast({title:"URL inválida",variant:"destructive"});return;}
    if(items.some(x=>current.url?x.url===current.url:normalize(x.titulo+x.orgao+x.fato)===normalize(current.titulo+current.orgao+current.fato))){
      toast({title:"Provável duplicidade",variant:"destructive"});return;
    }
    setItems(old=>[...old,{...current,id:Date.now().toString(36)+Math.random().toString(36).slice(2)}]);
    setCurrent(novo());
    toast({title:"Fonte registrada"});
  };
  const importJson=async (file?:File)=>{
    if(!file)return;
    try {
      if(file.size>1024*1024)throw Error("Máximo 1 MB");
      const raw:unknown=JSON.parse(await file.text());
      if(!raw||typeof raw!=="object"||!("items" in raw)||!Array.isArray(raw.items)||raw.items.length>200)throw Error("Formato inválido");
      const result=raw.items.map((x:unknown,i:number)=>{
        if(!x||typeof x!=="object")throw Error("Registro inválido");
        const found=x as Record<string,unknown>;const safe=novo();
        for(const key of Object.keys(safe) as Array<keyof Fonte>) if(typeof found[key]==="string")(safe as unknown as Record<string,string>)[key]=String(found[key]).slice(0,12000);
        if(!safe.titulo||!safe.orgao||!safe.resumo||(safe.cnj && safe.cnj.replace(/\D/g,"").length!==20))throw Error("Registro "+(i+1)+" inválido");
        if(safe.url && !/^https?:\/\/\S+$/i.test(safe.url))throw Error("URL inválida no registro "+(i+1));
        if(!["pendente","revisada","divergente"].includes(safe.revisao))safe.revisao="pendente";
        return {...safe,id:String(i)+"-"+Date.now()};
      });
      setItems(result);
      setObjeto("objeto" in raw && typeof raw.objeto==="string"?raw.objeto.slice(0,300):"");
      toast({title:"Dados carregados"});
    }catch(error){toast({title:"Falha na importação",description:error instanceof Error?error.message:"JSON inválido",variant:"destructive"});}
  };
  return <div className="flex min-h-screen bg-[#f3efe4] text-[#241b17]"><Sidebar/><main className="min-w-0 flex-1">
        <DocumentsCarteiraPicker onSelected={(item: DocumentCase) => {
          setObjeto([item.cliente,item.cnj].filter(Boolean).join(" · "));
          setCurrent(prev=>({...prev,cnj:item.cnj}));
        }} />
    <header className="border-b border-[#b89b5e] bg-[#fffaf0] p-5 lg:px-8">
      <Link href="/documents" className="inline-flex items-center gap-1 text-xs underline"><ArrowLeft size={14}/> Documentos</Link>
      <h1 className="mt-2 flex items-center gap-2 text-xl font-black text-[#6f1d2b]"><FileSearch/>Investigação documental · método God-Eye</h1>
      <p className="text-sm">Fontes, cronologia, correlação de processos e checagem conservadora de endereços, sem mapa pesado.</p>
    </header>
    <div className="mx-auto max-w-7xl space-y-5 p-4 lg:p-8">
      <p className="border-l-4 border-amber-500 bg-amber-50 p-4 text-sm"><b>Atenção:</b> informações inseridas manualmente; fontes externas não são consultadas nem verificadas automaticamente. Coincidência de nomes ou endereços não prova ilícito.</p>
      <div className="flex flex-wrap gap-3 text-xs underline">
        <a href="https://github.com/W1CAPITAL/God-Eye" target="_blank" rel="noopener noreferrer">Código God-Eye ↗</a>
        <a href="https://www.cnj.jus.br/" target="_blank" rel="noopener noreferrer">Portal CNJ ↗</a>
        <Link href="/investigacao-predatoria">Radar NUMOPEDE ↗</Link>
        <label className="cursor-pointer">Importar dossiê JSON<input type="file" accept=".json" className="hidden" onChange={e=>{void importJson(e.target.files?.[0]);e.target.value="";}}/></label>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <section className="space-y-3 rounded-lg border border-[#b89b5e] bg-[#fffaf0] p-5">
          <h2 className="font-black text-[#6f1d2b]">1. Registrar fonte</h2>
          <div><Label>Objeto da investigação</Label><Input maxLength={300} value={objeto} onChange={e=>setObjeto(e.target.value)}/></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["titulo","Título do achado *"],["orgao","Origem / documento *"],["url","URL da fonte (opcional)"],
              ["cnj","Processo CNJ"],["consulta","Data da consulta"],["fato","Data do fato"],
              ["endereco","Endereço pesquisado"],["enderecoOriginal","Endereço literal da fonte"],["local","Município"],
            ] as Array<[keyof Fonte,string]>).map(([key,label])=><div key={key}><Label>{label}</Label><Input type={key==="consulta"||key==="fato"?"date":"text"} value={current[key]} onChange={e=>set(key,e.target.value)}/></div>)}
            <div><Label>Situação</Label><select value={current.revisao} onChange={e=>set("revisao",e.target.value)} className="h-10 w-full rounded border bg-white px-3"><option value="pendente">Pendente</option><option value="revisada">Revisada manualmente</option><option value="divergente">Divergente</option></select></div>
          </div>
          {current.endereco&&<p className="text-xs">Confronto textual: <b>{checkAddress(current)}</b>. Endereço compatível não é prova geográfica.</p>}
          <div><Label>Descrição do que o documento realmente mostra *</Label><Textarea rows={6} value={current.resumo} onChange={e=>set("resumo",e.target.value)}/></div>
          <Button className="w-full bg-[#6f1d2b]" onClick={add}><Plus className="mr-2" size={16}/>Adicionar registro</Button>
        </section>
        <aside className="space-y-5">
          <section className="space-y-3 rounded-lg border border-[#b89b5e] bg-[#fffaf0] p-5">
            <h2 className="font-black text-[#6f1d2b]">2. Evidências ({items.length})</h2>
            {!items.length&&<p className="text-sm">Registre um documento para iniciar o dossiê.</p>}
            {items.map((x,i)=><div key={x.id} className="rounded border bg-white p-3 text-sm">
              <div className="flex justify-between gap-3"><b>{i+1}. {x.titulo}</b><Button variant="ghost" size="sm" onClick={()=>setItems(old=>old.filter(y=>y.id!==x.id))}><Trash2 size={16}/></Button></div>
              <p className="text-xs">{x.orgao} · {x.consulta||"sem data"} · {x.revisao}</p>
              {x.cnj&&<p className="break-all text-xs">{x.cnj}</p>}
              {x.url&&<a className="break-all text-xs underline" href={x.url} target="_blank" rel="noopener noreferrer">Consultar fonte ↗</a>}
            </div>)}
          </section>
          <section className="space-y-3 rounded-lg border border-[#b89b5e] bg-[#fffaf0] p-5">
            <h2 className="font-black text-[#6f1d2b]">3. Relatório preliminar</h2>
            <Button variant="outline" className="w-full" onClick={()=>setShow(x=>!x)}>{show?"Ocultar":"Visualizar"} dossiê</Button>
            {show&&<Textarea readOnly value={memo} rows={14} aria-label="Relatório preliminar" className="font-mono text-xs"/>}
            <Button className="w-full bg-[#6f1d2b]" onClick={()=>download("dossie-investigacao.md",memo,"text/markdown;charset=utf-8")}><Download className="mr-2" size={16}/>Baixar relatório .md</Button>
            <Button className="w-full" variant="outline" onClick={()=>download("dossie-investigacao.json",JSON.stringify({objeto,items},null,2),"application/json;charset=utf-8")}>Salvar dossiê JSON</Button>
            <Link href="/documents/generator?tipo=peticao-generica" className="block rounded border p-3 text-center text-xs font-bold">Abrir minuta de petição →</Link>
            <p className="text-xs text-[#655b52]">Os dados permanecem apenas nesta aba. Use o JSON para guardar ou transferir. Nada é salvo automaticamente no Supabase.</p>
          </section>
        </aside>
      </div>
    </div>
  </main></div>;
}
