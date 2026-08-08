"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listServicosAction,
  upsertServicoAction,
  deleteServicoAction,
} from "@/app/actions/crm-actions";
import type { CrmServico } from "@/lib/crm-types";
import { ArrowLeft, Loader2, Plus, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CrmServicosPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CrmServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: "",
    nome: "",
    descricao: "",
    preco_base: "",
    prazo_dias: "30",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listServicosAction();
    setRows(res.rows || []);
    if (!res.success && res.error) {
      toast({ title: "Aviso", description: res.error, variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    const res = await upsertServicoAction({
      id: form.id || undefined,
      nome: form.nome,
      descricao: form.descricao,
      preco_base: Number(form.preco_base) || 0,
      prazo_dias: Number(form.prazo_dias) || 30,
      ativo: true,
    });
    setSaving(false);
    if (!res.success) {
      toast({ title: "Erro", description: res.error, variant: "destructive" });
      return;
    }
    setOpen(false);
    setForm({ id: "", nome: "", descricao: "", preco_base: "", prazo_dias: "30" });
    load();
  };

  const softDelete = async (id: string) => {
    const res = await deleteServicoAction(id);
    if (!res.success) toast({ title: "Erro", description: res.error, variant: "destructive" });
    load();
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/crm">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-black">Catálogo de serviços</h1>
                <p className="text-xs text-muted-foreground">Extrajudicial, quitação, limpa nome, PROCON…</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setForm({ id: "", nome: "", descricao: "", preco_base: "", prazo_dias: "30" });
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Novo
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nenhum serviço. Use “Novo” ou “Seed serviços” no dashboard CRM.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-foreground">{s.nome}</p>
                    <p className="text-xs text-muted-foreground">{s.descricao || "—"}</p>
                    <p className="text-sm font-black tabular-nums mt-1">{brl(Number(s.preco_base))}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.ativo ? "default" : "secondary"}>
                      {s.ativo ? "Ativo" : "Inativo"} · {s.prazo_dias || 30}d
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setForm({
                          id: s.id,
                          nome: s.nome,
                          descricao: s.descricao || "",
                          preco_base: String(s.preco_base),
                          prazo_dias: String(s.prazo_dias || 30),
                        });
                        setOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    {s.ativo && (
                      <Button variant="ghost" size="sm" onClick={() => softDelete(s.id)}>
                        Desativar
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-background text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Preço base (R$)</Label>
                <Input
                  type="number"
                  value={form.preco_base}
                  onChange={(e) => setForm({ ...form, preco_base: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Prazo (dias)</Label>
                <Input
                  type="number"
                  value={form.prazo_dias}
                  onChange={(e) => setForm({ ...form, prazo_dias: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin h-4 w-4" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
