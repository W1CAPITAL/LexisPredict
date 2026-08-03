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
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { processarCaso, type LegalCase } from "@/lib/case-logic";
import { syncRepoCases } from "@/app/actions/case-actions";
import { cn } from "@/lib/utils";

type Props = {
  cases: LegalCase[];
  setCases: (c: LegalCase[]) => void;
  className?: string;
};

/**
 * Botão visível na toolbar da Carteira — cadastra processo novo e grava no Supabase.
 */
export function NovoProcessoButton({ cases, setCases, className }: Props) {
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

  const reset = () =>
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const protocolo = form.protocolo.trim().replace(/\s+/g, "");
    if (!protocolo) {
      toast({ title: "Informe o CNJ", variant: "destructive" });
      return;
    }

    const exists = (cases || []).some(
      (c) =>
        String(c.protocolo || "").replace(/\D/g, "") === protocolo.replace(/\D/g, "")
    );
    if (exists) {
      toast({
        title: "Processo já cadastrado",
        description: "Esse CNJ já está na carteira.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const novo = processarCaso({
        id: `tmp-${Date.now()}`,
        protocolo,
        cliente: (form.cliente || "CLIENTE").toUpperCase().trim(),
        advogado: form.advogado.trim() || "NÃO ATRIBUÍDO",
        escritorio: form.escritorio.trim() || "",
        telefone: form.telefone.trim() || "",
        proximoPrazo: form.proximoPrazo.trim() || "",
        situacao: form.situacao || "EM ANDAMENTO",
        observacao: form.observacao.trim() || "",
        ultimoRetorno: "",
        statusManual: "Automatico",
      }) as LegalCase;

      const next = [...(cases || []), novo];
      const res = await syncRepoCases(next);

      if (res?.success) {
        setCases(next);
        toast({
          title: "Processo adicionado",
          description: `${novo.cliente} · ${novo.protocolo}`,
        });
        setOpen(false);
        reset();
      } else {
        toast({
          title: "Falha ao salvar",
          description: (res as any)?.error || (res as any)?.message || "Tente novamente",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro ao adicionar",
        description: err?.message || "Falha inesperada",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest gap-1.5",
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
          className
        )}
      >
        <Plus size={16} strokeWidth={2.5} />
        Novo processo
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl z-[100]">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle className="font-black uppercase text-sm tracking-widest">
                Adicionar processo
              </DialogTitle>
              <DialogDescription className="text-xs">
                Inclui o CNJ na carteira do gabinete. Depois você pode escanear o tribunal.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-4 text-xs">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">CNJ / Protocolo *</Label>
                <Input
                  value={form.protocolo}
                  onChange={(e) => setForm({ ...form, protocolo: e.target.value })}
                  className="h-11 rounded-xl font-mono text-sm"
                  placeholder="0000000-00.0000.0.00.0000"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Cliente</Label>
                <Input
                  value={form.cliente}
                  onChange={(e) =>
                    setForm({ ...form, cliente: e.target.value.toUpperCase() })
                  }
                  className="h-10 rounded-xl uppercase"
                  placeholder="NOME DO CLIENTE"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Advogado</Label>
                  <Input
                    value={form.advogado}
                    onChange={(e) => setForm({ ...form, advogado: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Escritório</Label>
                  <Input
                    value={form.escritorio}
                    onChange={(e) => setForm({ ...form, escritorio: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Telefone</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Próximo prazo</Label>
                  <Input
                    value={form.proximoPrazo}
                    onChange={(e) => setForm({ ...form, proximoPrazo: e.target.value })}
                    className="h-10 rounded-xl"
                    placeholder="dd/mm/aaaa"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Observação</Label>
                <Input
                  value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={saving}
                className="w-full h-12 font-black uppercase text-[10px] tracking-widest rounded-xl"
              >
                {saving ? (
                  <Loader2 className="animate-spin mr-2" size={16} />
                ) : (
                  <Plus className="mr-2" size={16} />
                )}
                Salvar na carteira
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
