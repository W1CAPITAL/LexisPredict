"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { processarCaso } from "@/lib/case-logic";

export function NovoProcessoButton({
  onCreated,
  syncRepoCases,
}: {
  onCreated?: (c: any) => void | Promise<void>;
  syncRepoCases: (cases: any[]) => Promise<{ success?: boolean; error?: string } | any>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    protocolo: "",
    cliente: "",
    advogado: "",
    escritorio: "",
    telefone: "",
    proximoPrazo: "",
    situacao: "EM ANDAMENTO",
    observacao: "",
  });
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const protocolo = form.protocolo.trim();
    if (!protocolo) {
      toast({ title: "Informe o CNJ/protocolo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const novo = processarCaso({
        protocolo,
        cliente: form.cliente.toUpperCase() || "CLIENTE",
        advogado: form.advogado || "NÃO ATRIBUÍDO",
        escritorio: form.escritorio || "",
        telefone: form.telefone || "",
        proximoPrazo: form.proximoPrazo || "",
        situacao: form.situacao,
        observacao: form.observacao || "",
        ultimoRetorno: "",
        statusManual: "Automatico",
      });

      if (onCreated) {
        await onCreated(novo);
        setOpen(false);
        setForm({
          protocolo: "",
          cliente: "",
          advogado: "",
          escritorio: "",
          telefone: "",
          proximoPrazo: "",
          situacao: "EM ANDAMENTO",
          observacao: "",
        });
      } else {
        const res = await syncRepoCases([novo]);
        if (res?.success) {
          toast({ title: "Processo salvo" });
          setOpen(false);
        } else {
          toast({
            title: "Falha ao salvar",
            description: res?.error || "Passe onCreated com merge da lista completa.",
            variant: "destructive",
          });
        }
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 rounded-xl font-black uppercase text-[9px] tracking-widest gap-1"
      >
        <Plus size={14} /> Novo processo
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle className="font-black uppercase text-sm tracking-widest">
                Adicionar processo
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4 text-xs">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">CNJ / Protocolo *</Label>
                <Input
                  value={form.protocolo}
                  onChange={(e) => setForm({ ...form, protocolo: e.target.value })}
                  className="h-10 rounded-xl font-mono"
                  placeholder="0000000-00.0000.0.00.0000"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Cliente</Label>
                <Input
                  value={form.cliente}
                  onChange={(e) => setForm({ ...form, cliente: e.target.value.toUpperCase() })}
                  className="h-10 rounded-xl uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Advogado</Label>
                  <Input value={form.advogado} onChange={(e) => setForm({ ...form, advogado: e.target.value })} className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Escritório</Label>
                  <Input value={form.escritorio} onChange={(e) => setForm({ ...form, escritorio: e.target.value })} className="h-10 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Próximo prazo</Label>
                  <Input value={form.proximoPrazo} onChange={(e) => setForm({ ...form, proximoPrazo: e.target.value })} className="h-10 rounded-xl" placeholder="dd/mm/aaaa" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Observação</Label>
                <Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="h-10 rounded-xl" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving} className="w-full h-11 font-black uppercase text-[10px] rounded-xl">
                {saving ? <Loader2 className="animate-spin" size={16} /> : "Salvar processo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
