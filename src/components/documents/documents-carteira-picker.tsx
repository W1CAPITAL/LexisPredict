"use client";

import { useEffect, useRef, useState } from "react";
import { getDocumentCaseAction, searchDocumentCasesAction, type DocumentCase, type DocumentCaseOption } from "@/app/actions/document-case-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCcw, BriefcaseBusiness } from "lucide-react";

/** Compartilha apenas o ID do processo nesta aba, nunca CPF ou dados pessoais no storage. */
const STORAGE_KEY = "lexispredict.documents.processo_id.v1";
export function DocumentsCarteiraPicker({onSelected}: {onSelected:(value:DocumentCase)=>void}) {
  const callback = useRef(onSelected);
  callback.current = onSelected;
  const sequence = useRef(0);
  const [term,setTerm] = useState("");
  const [options,setOptions] = useState<DocumentCaseOption[]>([]);
  const [selected,setSelected] = useState<DocumentCase|null>(null);
  const [loading,setLoading] = useState(false);
  const [searching,setSearching] = useState(false);
  const [initialTimedOut,setInitialTimedOut] = useState(false);
  const [error,setError] = useState("");
  const [opened,setOpened] = useState(true);
  const [manualMode,setManualMode] = useState(false);

  const select = async (id: string) => {
    const token = ++sequence.current;
    setLoading(true);
    setError("");
    const response = await getDocumentCaseAction(id);
    if (token !== sequence.current) return;
    setLoading(false);
    if (!response.ok || !response.item) {
      sessionStorage.removeItem(STORAGE_KEY);
      setSelected(null);
      setError(response.error || "Não foi possível carregar o processo.");
      return;
    }
    setSelected(response.item);
    setOpened(false);
    sessionStorage.setItem(STORAGE_KEY,response.item.id);
    setManualMode(false);
    callback.current(response.item);
  };
  useEffect(()=>{
    const id = window.sessionStorage.getItem(STORAGE_KEY);
    if (id && /^\d+$/.test(id)) void select(id);
    return ()=>{sequence.current+=1;};
  },[]);
  useEffect(()=>{
    if(!opened || term.trim()) return;
    let live=true;
    setSearching(true);
    const timeout=window.setTimeout(()=>{if(live){setSearching(false);setInitialTimedOut(true);setError("Consulta demorada. Pesquise pelo nome ou CNJ, ou tente novamente.");}},8000);
    void searchDocumentCasesAction("").then(result=>{
      if(live){window.clearTimeout(timeout);setOptions(result.options);setSearching(false);setInitialTimedOut(false);if(!result.ok)setError(result.error||"Falha ao listar a carteira.");}
    }).catch(()=>{if(live){setSearching(false);setError("Erro ao carregar clientes.");}});
    return ()=>{live=false;window.clearTimeout(timeout);};
  },[opened]);
  useEffect(()=>{
    if(term.trim().length<2){setSearching(false);return;}
    let live=true;
    const timer=window.setTimeout(()=>{
      setSearching(true);
      const searchTerm=term;
      void searchDocumentCasesAction(searchTerm).then(result=>{
        if(!live)return;
        setSearching(false);
        setOptions(result.options);
        setError(result.ok?"":result.error||"Erro na pesquisa.");
      }).catch(()=>{
        if(live){setSearching(false);setError("Falha de conexão na pesquisa.");}
      });
    },350);
    return ()=>{live=false;window.clearTimeout(timer);};
  },[term]);

  const missing = selected ? ([
    ["CPF",selected.cpf],["RG",selected.rg],["endereço",selected.endereco],
    ["classe da ação",selected.classeAcao],["comarca",selected.comarca],
  ] as Array<[string,string]>).filter(([,v])=>!v).map(([k])=>k) : [];

  return <div className="mx-auto my-3 w-full max-w-6xl border-2 border-[#6f1d2b] bg-white p-4 text-[#291c21] shadow-[4px_4px_0px_#111] lg:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6f1d2b]"><BriefcaseBusiness size={16}/>Preencher a partir da carteira</p>
        {selected ? <p className="mt-1 break-words text-sm"><b>{selected.cliente}</b> · processo {selected.cnj}</p>
          : <p className="mt-1 text-xs text-[#615656]">Busque o cliente ou CNJ. Se houver vários processos, escolha o correto.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={manualMode?"default":"outline"} size="sm" onClick={()=>setManualMode(x=>!x)} className={manualMode?"bg-[#6f1d2b] text-white":"border-[#b89b5e]"}>
          {manualMode?"Edição manual ativa":"Editar dados manualmente"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={()=>{setOpened(x=>!x);setError("");}} className="border-[#b89b5e]">
        <Search size={14} className="mr-1"/>{selected?"Trocar cliente / processo":"Selecionar cliente"}
        </Button>
      </div>
    </div>
    {manualMode && <p className="mt-2 border-l-4 border-[#6f1d2b] bg-[#fffaf0] p-3 text-xs">Modo editável: altere livremente os campos do formulário abaixo antes de gerar o documento. O cadastro original da carteira não será modificado. Você pode voltar ao preenchimento automático selecionando o cliente novamente.</p>}
    {loading && <p className="mt-2 flex items-center gap-2 text-xs"><RefreshCcw className="animate-spin" size={13}/>Carregando dados do processo...</p>}
    {selected && missing.length>0 && <p className="mt-2 text-xs text-amber-800">Informações ausentes na carteira: {missing.join(", ")}. Revise antes de assinar ou protocolar.</p>}
    {opened && <div className="mt-3 space-y-2">
      <Input aria-label="Buscar cliente ou CNJ na carteira" value={term} onChange={e=>setTerm(e.target.value)}
        placeholder="Digite o nome ou CNJ; abaixo aparecem os clientes recentes" className="h-11 rounded-none border-[#6f1d2b] bg-white text-sm"/>
      {searching && <p className="text-xs">Pesquisando na empresa...</p>}
      {options.length>0 && <div className="max-h-56 space-y-1 overflow-y-auto rounded border border-[#b89b5e]/30 bg-white p-1">
        {options.map(opt=><button key={opt.id} type="button" onClick={()=>{void select(opt.id);setTerm("");setOptions([]);}}
          className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-amber-50 focus:bg-amber-50">
          <strong>{opt.cliente}</strong><span className="ml-2 text-[#6d6262]">{opt.cnj}</span>
        </button>)}
      </div>}
      {!searching && term.trim().length>=2 && !options.length && !error && <p className="text-xs">Nenhum processo encontrado. Tente outro nome ou CNJ.</p>}
    </div>}
    {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
  </div>;
}
