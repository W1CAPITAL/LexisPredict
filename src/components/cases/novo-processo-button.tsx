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
import { createOneCaseAction } from "@/app/actions/case-save-actions";
import { processarCaso, type LegalCase } from "@/lib/case-logic";
import { formatNewProcessCnj } from "@/lib/new-process-input";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  onCreated?: () => void | Promise<void>;
};

const EMPTY_FORM = {
  protocolo: "",
  cliente: "",
  advogado: "",
  escritorio: "",
  telefone: "",
  proximoPrazo: "",
  observacao: "",
};

export function NovoProcessoButton({ className, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { toast } = useToast();

  const reset = () => setForm(EMPTY_FORM);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const protocolo = formatNewProcessCnj(form.protocolo);
    if (!protocolo) {
      toast({
        title: "CNJ inválido",
        description: "Informe os 20 dígitos e confira os dígitos verificadores do CNJ.",
        variant: "destructive",
      });
      return;
    }

    const cliente = form.cliente.trim();
    if (!cliente) {
      toast({
        title: "Informe o cliente",
        description: "O nome do cliente é obrigatório para cadastrar o processo.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const novo = processarCaso({
        id: `tmp-${Date.now()}`,
        protocolo,
        cliente: cliente.toUpperCase(),
        advogado: form.advogado.trim() || "NÃO ATRIBUÍDO",
        escritorio: form.escritorio.trim(),
        telefone: form.telefone.trim(),
        proximoPrazo: form.proximoPrazo,
        situacao: "EM ANDAMENTO",
        observacao: form.observacao.trim(),
        ultimoRetorno: "",
        statusManual: "Automatico",
      }) as LegalCase;

      const result = await createOneCaseAction(novo);
      if (!result.success) {
        toast({
          title: result.message.includes("já cadastrado") ? "Processo já cadastrado" : "Não foi possível criar",
          description: result.message || "Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      setOpen(false);
      reset();
      toast({
        title: "Processo adicionado",
        description: `${novo.cliente} · ${protocolo}`,
      });

      try {
        await onCreated?.();
      } catch {
        toast({
          title: "Processo salvo",
          description: "A lista não atualizou automaticamente. Use Atualizar para recarregar.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao adicionar processo",
        description: error instanceof Error ? error.message : "Falha inesperada.",
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
        data-lexis-add-process
        disabled={saving}
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

      <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl z-[100]">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle className="font-black uppercase text-sm tracking-widest">
                Adicionar processo
              </DialogTitle>
              <DialogDescription className="text-xs">
                O processo será inserido individualmente na carteira desta empresa. Um CNJ já cadastrado não será sobrescrito.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-4 text-xs">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">CNJ / Protocolo *</Label>
                <Input
                  value={form.protocolo}
                  onChange={(event) => setForm({ ...form, protocolo: event.target.value })}
                  className="h-11 rounded-xl font-mono text-sm"
                  placeholder="0000000-00.0000.0.00.0000"
                  maxLength={25}
                  required
                  autoFocus
                />
                <p className="text-[10px] text-muted-foreground">São necessários exatamente 20 dígitos.</p>
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Cliente *</Label>
                <Input
                  value={form.cliente}
                  onChange={(event) => setForm({ ...form, cliente: event.target.value })}
                  className="h-10 rounded-xl"
                  placeholder="Nome completo do cliente"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Advogado</Label>
                  <Input
                    value={form.advogado}
                    onChange={(event) => setForm({ ...form, advogado: event.target.value })}
                    className="h-10 rounded-xl"
                    placeholder="Responsável"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Escritório</Label>
                  <Input
                    value={form.escritorio}
                    onChange={(event) => setForm({ ...form, escritorio: event.target.value })}
                    className="h-10 rounded-xl"
                    placeholder="Escritório"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Telefone</Label>
                  <Input
                    value={form.telefone}
                    onChange={(event) => setForm({ ...form, telefone: event.target.value })}
                    className="h-10 rounded-xl"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Próximo retorno</Label>
                  <Input
                    type="date"
                    value={form.proximoPrazo}
                    onChange={(event) => setForm({ ...form, proximoPrazo: event.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Observação</Label>
                <Input
                  value={form.observacao}
                  onChange={(event) => setForm({ ...form, observacao: event.target.value })}
                  className="h-10 rounded-xl"
                  placeholder="Informações iniciais (opcional)"
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
                {saving ? "Salvando..." : "Salvar na carteira"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
