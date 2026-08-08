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
import { listFornecedoresAction, upsertFornecedorAction } from "@/app/actions/crm-actions";
import type { CrmFornecedor } from "@/lib/crm-types";
import { ArrowLeft, Loader2, Plus, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CrmFornecedoresPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CrmFornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: "",
    nome: "",
    cnpj: "",
    contato: "",
    telefone: "",
    email: "",
    especialidade: "",
    observacao: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listFornecedoresAction();
    setRows(res.rows || []);
    if (!res.success && res.error) toast({ title: "Aviso", description: res.error, variant: "destructive" });
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    const res = await upsertFornecedorAction({
      id: form.id || undefined,
      nome: form.nome,
      cnpj: form.cnpj,
      contato: form.contato,
      telefone: form.telefone,
      email: form.email,
      especialidade: form.especialidade,
      observacao: form.observacao,
      ativo: true,
    });
    setSaving(false);
    if (!res.success) {
      toast({ title: "Erro", description: res.error, variant: "destructive" });
      return;
    }
    setOpen(false);
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
                <h1 className="text-lg font-black">Fornecedores jurídicos</h1>
                <p className="text-xs text-muted-foreground">
                  Escritórios terceiros contratados (não equipe interna de OAB)
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setForm({
                    id: "",
                    nome: "",
                    cnpj: "",
                    contato: "",
                    telefone: "",
                    email: "",
                    especialidade: "",
                    observacao: "",
                  });
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Nova banca
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((f) => (
                <li
                  key={f.id}
                  className="rounded-xl border border-border bg-card p-4 flex flex-wrap justify-between gap-2"
                >
                  <div>
                    <p className="font-bold">{f.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.especialidade || "Geral"} · {f.contato || "—"} · {f.telefone || "—"}
                    </p>
                    {f.cnpj && <p className="text-[10px] font-mono text-muted-foreground mt-1">{f.cnpj}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={f.ativo ? "default" : "secondary"}>{f.ativo ? "Ativo" : "Off"}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setForm({
                          id: f.id,
                          nome: f.nome,
                          cnpj: f.cnpj || "",
                          contato: f.contato || "",
                          telefone: f.telefone || "",
                          email: f.email || "",
                          especialidade: f.especialidade || "",
                          observacao: f.observacao || "",
                        });
                        setOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                  </div>
                </li>
              ))}
              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhuma banca cadastrada.</p>
              )}
            </ul>
          )}
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-background text-foreground max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar fornecedor" : "Nova banca"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(
              [
                ["nome", "Nome do escritório"],
                ["cnpj", "CNPJ"],
                ["contato", "Contato"],
                ["telefone", "Telefone"],
                ["email", "E-mail"],
                ["especialidade", "Especialidade"],
                ["observacao", "Observação"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input
                  className="mt-1"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
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
