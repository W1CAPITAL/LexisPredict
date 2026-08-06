"use client";

/**
 * Finanças / Honorários — escopo Lexis: valores ligados a cliente/processo da carteira.
 * Não é ERP; é controle operacional de honorários, custas e sucumbência.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
  listHonorariosAction,
  upsertHonorarioAction,
  deleteHonorarioAction,
  resumoFinanceiroAction,
  type HonorarioRow,
} from "@/app/actions/financas-actions";
import { DollarSign, Plus, Loader2, Trash2, RefreshCcw } from "lucide-react";

const emptyForm = {
  id: "",
  protocolo: "",
  cliente: "",
  tipo: "honorario",
  descricao: "",
  valor: "",
  status: "pendente",
  vencimento: "",
  pago_em: "",
  observacao: "",
};

export default function FinancasPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<HonorarioRow[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, sum] = await Promise.all([
      listHonorariosAction({ status: filter }),
      resumoFinanceiroAction(),
    ]);
    if (list.success) setRows(list.rows);
    else {
      setRows([]);
      toast({ title: "Finanças", description: list.error, variant: "destructive" });
    }
    if (sum.success) setResumo(sum.resumo);
    setLoading(false);
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    const res = await upsertHonorarioAction({
      id: form.id || undefined,
      protocolo: form.protocolo || undefined,
      cliente: form.cliente || undefined,
      tipo: form.tipo,
      descricao: form.descricao || undefined,
      valor: parseFloat(form.valor.replace(",", ".")) || 0,
      status: form.status,
      vencimento: form.vencimento || undefined,
      pago_em: form.pago_em || undefined,
      observacao: form.observacao || undefined,
    });
    setSaving(false);
    if (!res.success) {
      toast({ title: "Erro", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Salvo" });
    setOpen(false);
    setForm(emptyForm);
    load();
  };

  const money = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden glass-panel">
        <header className="shrink-0 border-b p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <DollarSign className="text-emerald-600" size={20} />
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest">Finanças / Honorários</h1>
              <p className="text-[10px] text-muted-foreground">
                Valores por cliente e processo — não substitui contabilidade
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-10 w-[140px] rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="pago">Pagos</SelectItem>
                <SelectItem value="vencido">—</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-10 rounded-xl" onClick={load}>
              <RefreshCcw size={14} className="mr-1" /> Atualizar
            </Button>
            <Button
              className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setForm(emptyForm);
                setOpen(true);
              }}
            >
              <Plus size={14} className="mr-1" /> Lançamento
            </Button>
          </div>
        </header>

        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          <div className="rounded-xl border p-3 bg-card">
            <p className="text-[9px] uppercase font-black text-muted-foreground">A receber</p>
            <p className="text-lg font-black text-amber-600">{money(resumo?.a_receber || 0)}</p>
          </div>
          <div className="rounded-xl border p-3 bg-card">
            <p className="text-[9px] uppercase font-black text-muted-foreground">Recebido</p>
            <p className="text-lg font-black text-emerald-600">{money(resumo?.pago || 0)}</p>
          </div>
          <div className="rounded-xl border p-3 bg-card">
            <p className="text-[9px] uppercase font-black text-muted-foreground">Vencido</p>
            <p className="text-lg font-black text-red-600">{money(resumo?.vencido || 0)}</p>
          </div>
          <div className="rounded-xl border p-3 bg-card">
            <p className="text-[9px] uppercase font-black text-muted-foreground">Lançamentos</p>
            <p className="text-lg font-black">{resumo?.total ?? "—"}</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">
              Nenhum lançamento. Crie honorários, custas ou sucumbência vinculados ao processo.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 border rounded-xl p-3 bg-card/80"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">
                      {r.cliente || "—"}{" "}
                      <span className="text-muted-foreground font-mono text-xs">
                        {r.protocolo || ""}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.tipo} · {r.descricao || "sem descrição"}
                      {r.vencimento ? ` · venc. ${r.vencimento}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm">{money(Number(r.valor) || 0)}</span>
                    <Badge variant="outline" className="text-[9px] uppercase">
                      {r.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setForm({
                          id: r.id,
                          protocolo: r.protocolo || "",
                          cliente: r.cliente || "",
                          tipo: r.tipo || "honorario",
                          descricao: r.descricao || "",
                          valor: String(r.valor ?? ""),
                          status: r.status || "pendente",
                          vencimento: r.vencimento || "",
                          pago_em: r.pago_em || "",
                          observacao: r.observacao || "",
                        });
                        setOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        await deleteHonorarioAction(r.id);
                        load();
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar" : "Novo"} lançamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-[10px] uppercase">Cliente</Label>
                <Input
                  value={form.cliente}
                  onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase">Protocolo (CNJ)</Label>
                <Input
                  value={form.protocolo}
                  onChange={(e) => setForm({ ...form, protocolo: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] uppercase">Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="honorario">Honorário</SelectItem>
                      <SelectItem value="custas">Custas</SelectItem>
                      <SelectItem value="sucumbencia">Sucumbência</SelectItem>
                      <SelectItem value="acordo">Acordo</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase">Valor (R$)</Label>
                <Input
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase">Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] uppercase">Vencimento</Label>
                  <Input
                    type="date"
                    value={form.vencimento}
                    onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Pago em</Label>
                  <Input
                    type="date"
                    value={form.pago_em}
                    onChange={(e) => setForm({ ...form, pago_em: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" size={14} /> : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
