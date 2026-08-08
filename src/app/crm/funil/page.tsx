"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listNegociosAction,
  upsertNegocioAction,
  updateNegocioStatusAction,
  listServicosAction,
  listFornecedoresAction,
} from "@/app/actions/crm-actions";
import {
  CRM_FUNIL_STATUS,
  CRM_FUNIL_LABELS,
  type CrmNegocio,
  type CrmServico,
  type CrmFornecedor,
  type CrmFunilStatus,
} from "@/lib/crm-types";
import { ArrowLeft, Loader2, Plus, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const empty = {
  cliente_nome: "",
  cliente_doc: "",
  cliente_telefone: "",
  servico_id: "",
  servico_nome: "",
  status: "lead",
  valor_total: "",
  valor_entrada: "",
  protocolo_cnj: "",
  fornecedor_id: "",
  custo_terceiro: "",
  origem: "",
  observacao: "",
  num_parcelas: "1",
  gerar_parcela: true,
};

export default function CrmFunilPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CrmNegocio[]>([]);
  const [servicos, setServicos] = useState<CrmServico[]>([]);
  const [fornecedores, setFornecedores] = useState<CrmFornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const [filtro, setFiltro] = useState("todos");

  const load = useCallback(async () => {
    setLoading(true);
    const [n, s, f] = await Promise.all([
      listNegociosAction(),
      listServicosAction({ ativosOnly: true }),
      listFornecedoresAction({ ativosOnly: true }),
    ]);
    setRows(n.rows || []);
    setServicos(s.rows || []);
    setFornecedores(f.rows || []);
    if (!n.success && n.error) toast({ title: "Aviso", description: n.error, variant: "destructive" });
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const byStatus = useMemo(() => {
    const map: Record<string, CrmNegocio[]> = {};
    for (const st of CRM_FUNIL_STATUS) map[st] = [];
    for (const r of rows) {
      const k = String(r.status || "lead");
      if (!map[k]) map[k] = [];
      map[k].push(r);
    }
    return map;
  }, [rows]);

  const filtered = filtro === "todos" ? rows : rows.filter((r) => r.status === filtro);

  const save = async () => {
    if (!form.cliente_nome.trim()) return;
    setSaving(true);
    const res = await upsertNegocioAction({
      cliente_nome: form.cliente_nome,
      cliente_doc: form.cliente_doc,
      cliente_telefone: form.cliente_telefone,
      servico_id: form.servico_id || undefined,
      servico_nome: form.servico_nome || undefined,
      status: form.status,
      valor_total: Number(form.valor_total) || 0,
      valor_entrada: Number(form.valor_entrada) || 0,
      protocolo_cnj: form.protocolo_cnj || undefined,
      fornecedor_id: form.fornecedor_id || undefined,
      custo_terceiro: Number(form.custo_terceiro) || 0,
      origem: form.origem || undefined,
      observacao: form.observacao || undefined,
      gerar_parcela: form.gerar_parcela && ["contrato", "execucao", "concluido"].includes(form.status),
      num_parcelas: Number(form.num_parcelas) || 1,
    });
    setSaving(false);
    if (!res.success) {
      toast({ title: "Erro", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Negócio salvo" });
    setOpen(false);
    setForm(empty);
    load();
  };

  const move = async (id: string, status: string) => {
    const res = await updateNegocioStatusAction(id, status);
    if (!res.success) toast({ title: "Erro", description: res.error, variant: "destructive" });
    load();
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/crm">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-black">Funil comercial</h1>
                <p className="text-xs text-muted-foreground">Lead → Proposta → Contrato → Execução → Concluído</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filtro} onValueChange={setFiltro}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Filtro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {CRM_FUNIL_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CRM_FUNIL_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setForm(empty);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Negócio
              </Button>
            </div>
          </div>

          {/* Resumo colunas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {CRM_FUNIL_STATUS.map((s) => (
              <div key={s} className="rounded-lg border border-border bg-card p-2 text-center">
                <p className="text-[9px] font-black uppercase text-muted-foreground">{CRM_FUNIL_LABELS[s]}</p>
                <p className="text-lg font-black tabular-nums">{byStatus[s]?.length || 0}</p>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((n) => (
                <li
                  key={n.id}
                  className="rounded-xl border border-border bg-card p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-foreground">{n.cliente_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {n.servico_nome || "Serviço"} · {n.cliente_telefone || "sem tel."}
                        {n.protocolo_cnj ? ` · CNJ ${n.protocolo_cnj}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black tabular-nums">{brl(Number(n.valor_total))}</p>
                      <Badge className="mt-1">{CRM_FUNIL_LABELS[n.status as CrmFunilStatus] || n.status}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {CRM_FUNIL_STATUS.filter((s) => s !== n.status).map((s) => (
                      <Button
                        key={s}
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={() => move(n.id, s)}
                      >
                        → {CRM_FUNIL_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhum negócio neste filtro.</p>
              )}
            </ul>
          )}
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-background text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo negócio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente *</Label>
              <Input
                className="mt-1"
                value={form.cliente_nome}
                onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>CPF/CNPJ</Label>
                <Input
                  className="mt-1"
                  value={form.cliente_doc}
                  onChange={(e) => setForm({ ...form, cliente_doc: e.target.value })}
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  className="mt-1"
                  value={form.cliente_telefone}
                  onChange={(e) => setForm({ ...form, cliente_telefone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Serviço</Label>
              <Select
                value={form.servico_id || "none"}
                onValueChange={(v) => {
                  const s = servicos.find((x) => x.id === v);
                  setForm({
                    ...form,
                    servico_id: v === "none" ? "" : v,
                    servico_nome: s?.nome || "",
                    valor_total: s ? String(s.preco_base) : form.valor_total,
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {servicos.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome} ({brl(Number(s.preco_base))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valor total</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={form.valor_total}
                  onChange={(e) => setForm({ ...form, valor_total: e.target.value })}
                />
              </div>
              <div>
                <Label>Entrada</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={form.valor_entrada}
                  onChange={(e) => setForm({ ...form, valor_entrada: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_FUNIL_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CRM_FUNIL_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Parcelas</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={form.num_parcelas}
                  onChange={(e) => setForm({ ...form, num_parcelas: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Protocolo CNJ (opcional)</Label>
              <Input
                className="mt-1"
                value={form.protocolo_cnj}
                onChange={(e) => setForm({ ...form, protocolo_cnj: e.target.value })}
              />
            </div>
            <div>
              <Label>Banca terceira (custo)</Label>
              <Select
                value={form.fornecedor_id || "none"}
                onValueChange={(v) => setForm({ ...form, fornecedor_id: v === "none" ? "" : v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Custo do escritório (R$)</Label>
              <Input
                type="number"
                className="mt-1"
                value={form.custo_terceiro}
                onChange={(e) => setForm({ ...form, custo_terceiro: e.target.value })}
              />
            </div>
            <div>
              <Label>Observação</Label>
              <Input
                className="mt-1"
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={form.gerar_parcela}
                onChange={(e) => setForm({ ...form, gerar_parcela: e.target.checked })}
              />
              Gerar parcelas a receber ao salvar em Contrato/Execução/Concluído
            </label>
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
