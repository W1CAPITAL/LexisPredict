"use client";
import {useState,type FormEvent} from "react";
import type {LegalCase} from "@/lib/case-logic";
import {formatDateToISO} from "@/lib/case-logic";
import {saveOneCaseAction} from "@/app/actions/case-save-actions";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Button} from "@/components/ui/button";
import {Loader2,Pencil} from "lucide-react";

export function TarefaEditDialog({processo,onClose,onSaved}:{processo:LegalCase|null;onClose:()=>void;onSaved:(item:LegalCase)=>void}){
 const [cliente,setCliente]=useState(processo?.cliente||"");
 const [advogado,setAdvogado]=useState(processo?.advogado||"");
 const [escritorio,setEscritorio]=useState(processo?.escritorio||"");
 const [telefone,setTelefone]=useState(processo?.telefone||"");
 const [proximo,setProximo]=useState(formatDateToISO(processo?.proximoPrazo||"")||"");
 const [observacao,setObservacao]=useState(processo?.observacao||"");
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 async function save(e:FormEvent){
  e.preventDefault();
  if(!processo?.protocolo||saving)return;
  if(!cliente.trim()){setError("Preencha o nome do cliente.");return;}
  setSaving(true);setError("");
  try{
   const patch:LegalCase={...processo,cliente:cliente.trim(),advogado:advogado.trim(),escritorio:escritorio.trim(),
     telefone:telefone.trim(),proximoPrazo:proximo||"",observacao:observacao.trim()};
   const r=await saveOneCaseAction(patch);
   if(!r.success||!r.case){setError(r.message||"O servidor não confirmou a edição.");return;}
   onSaved(r.case);
  }catch(err){setError(err instanceof Error?err.message:"Não foi possível confirmar a edição.");}
  finally{setSaving(false);}
 }
 return <Dialog open={!!processo} onOpenChange={open=>{if(!open&&!saving)onClose();}}>
  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
   <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4"/>Editar processo — Tarefas</DialogTitle></DialogHeader>
   <p className="text-xs font-mono text-muted-foreground">{processo?.protocolo}</p>
   <p className="text-xs text-muted-foreground">A edição atualiza o processo, mas não registra atendimento ao cliente. Para isso, use “Registrar atendimento”.</p>
   <form className="space-y-3" onSubmit={save}>
    <label className="block text-xs font-semibold">Cliente<Input value={cliente} onChange={e=>setCliente(e.target.value)} required /></label>
    <label className="block text-xs font-semibold">Advogado<Input value={advogado} onChange={e=>setAdvogado(e.target.value)}/></label>
    <label className="block text-xs font-semibold">Escritório<Input value={escritorio} onChange={e=>setEscritorio(e.target.value)}/></label>
    <label className="block text-xs font-semibold">Telefone<Input value={telefone} onChange={e=>setTelefone(e.target.value)}/></label>
    <label className="block text-xs font-semibold">Próximo retorno<Input type="date" value={proximo} onChange={e=>setProximo(e.target.value)}/></label>
    <label className="block text-xs font-semibold">Observações do processo<Textarea rows={4} value={observacao} onChange={e=>setObservacao(e.target.value)}/></label>
    {error?<p role="alert" className="rounded-lg border border-red-300/50 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300">{error}</p>:null}
    <DialogFooter>
     <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button>
     <Button type="submit" disabled={saving}>{saving?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null}Salvar alteração</Button>
    </DialogFooter>
   </form>
  </DialogContent>
 </Dialog>;
}
