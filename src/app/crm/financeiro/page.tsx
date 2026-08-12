"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listReceberAction,
  listPagarAction,
  marcarReceberPagoAction,
  marcarPagarPagoAction,
  upsertReceberAction,
  upsertPagarAction,
  crmDashboardAction,
} from "@/app/actions/crm-actions";
import type { CrmReceber, CrmPagar, CrmDashboard } from "@/lib/crm-types";
import { ArrowLeft, Check, Loader2, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CrmFinanceiroPage() {
  const { toast } = useToast();
  const [receber, setReceber] = useState<CrmReceber[]>([]);
  const [pagar, setPagar] = useState<CrmPagar[]>([]);
  const [dash, setDash] = useState<CrmDashboard | null>(null);
  const [canView, setCanView] = useState(true);
  const [loading, setLoading] = useState(true);
  const [openR, setOpenR] = useState(false);
  const [openP, setOpenP] = useState(false);
  const [formR, setFormR] = useState({ cliente_nome: "", descricao: "", valor: "", vencimento: "" });
  const [formP, setFormP] = useState({
    descricao: "",
    valor: "",
    vencimento: "",
    fornecedor_nome: "",
    categoria: "banca_terceira",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [r, p, d] = await Promise.all([
      listReceberAction(),
      listPagarAction(),
      crmDashboardAction(),
    ]);
    setReceber(r.rows || []);
    setPagar(p.rows || []);
    setDash(d.data);
    setCanView(d.canViewFinance);
    if (!r.success && r.error) toast({ title: "Aviso", description: r.error, variant: "destructive" });
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const payR = async (id: string) => {
    const res = await marcarReceberPagoAction(id, "pix");
    if (!res.success) toast({ title: "Erro", description: res.error, variant: "destructive" });
    else toast({ title: "Marcado como pago" });
    load();
  };

  const payP = async (id: string) => {
    const res = await marcarPagarPagoAction(id);
    if (!res.success) toast({ title: "Erro", description: res.error, variant: "destructive" });
    else toast({ title: "Pagamento registrado" });
    load();
  };

  const saveR = async () => {
    const res = await upsertReceberAction({
      cliente_nome: formR.cliente_nome,
      descricao: formR.descricao,
      valor: Number(formR.valor) || 0,
      vencimento: formR.vencimento || undefined,
    });
    if (!res.success) toast({ title: "Erro", description: res.error, variant: "destructive" });
    else {
      setOpenR(false);
      load();
    }
  };

  const saveP = async () => {
    const res = await upsertPagarAction({
      descricao: formP.descricao,
      valor: Number(formP.valor) || 0,
      vencimento: formP.vencimento || undefined,
      fornecedor_nome: formP.fornecedor_nome,
      categoria: formP.categoria,
    });
    if (!res.success) toast({ title: "Erro", description: res.error, variant: "destructive" });
    else {
      setOpenP(false);
      load();
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/crm">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-black">Financeiro</h1>
                <p className="text-xs text-muted-foreground">Contas a receber e a pagar (bancas, taxas)</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>

          {!canView && (
            <p className="text-xs border border-border rounded-lg p-3 bg-muted/40 text-muted-foreground">
              Consolidado financeiro restrito a admin/supervisor. Você ainda pode operar lançamentos se tiver
              permissão de escrita.
            </p>
          )}

          {dash && canView && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ["Receita mês", brl(Number(dash.receitaMes ?? 0))],
                ["A receber", brl(Number(dash.aReceber ?? 0))],
                ["Atrasados", brl(Number(dash.atrasados ?? 0))],
                ["Bancas (mês)", brl(Number(dash.custoTerceirosMes ?? 0))],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-[9px] font-black uppercase text-muted-foreground">{l}</p>
                  <p className="text-sm font-black tabular-nums text-foreground">{v}</p>
                </div>
              ))}
            </div>
          )}

          <Tabs defaultValue="receber">
            <TabsList>
              <TabsTrigger value="receber">A receber</TabsTrigger>
              <TabsTrigger value="pagar">A pagar</TabsTrigger>
            </TabsList>
            <TabsContent value="receber" className="space-y-2 mt-3">
              <Button size="sm" onClick={() => setOpenR(true)}>
                Nova cobrança
              </Button>
              {loading ? (
                <Loader2 className="animate-spin mx-auto my-8 text-muted-foreground" />
              ) : (
                receber.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-border bg-card p-3 flex flex-wrap justify-between gap-2"
                  >
                    <div>
                      <p className="font-bold text-sm">{r.cliente_nome || r.descricao || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.descricao} · venc. {r.vencimento || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-black tabular-nums">{brl(Number(r.valor))}</p>
                      <Badge variant={r.status === "pago" ? "default" : "secondary"}>{r.status}</Badge>
                      {r.status !== "pago" && (
                        <Button size="sm" variant="outline" onClick={() => payR(r.id)}>
                          <Check className="h-3 w-3 mr-1" /> Pago
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
            <TabsContent value="pagar" className="space-y-2 mt-3">
              <Button size="sm" onClick={() => setOpenP(true)}>
                Nova despesa
              </Button>
              {pagar.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-border bg-card p-3 flex flex-wrap justify-between gap-2"
                >
                  <div>
                    <p className="font-bold text-sm">{p.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.fornecedor_nome || p.categoria || "—"} · venc. {p.vencimento || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-black tabular-nums">{brl(Number(p.valor))}</p>
                    <Badge variant={p.status === "pago" ? "default" : "secondary"}>{p.status}</Badge>
                    {p.status !== "pago" && (
                      <Button size="sm" variant="outline" onClick={() => payP(p.id)}>
                        <Check className="h-3 w-3 mr-1" /> Pago
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Dialog open={openR} onOpenChange={setOpenR}>
        <DialogContent className="bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Nova cobrança</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label>Cliente</Label>
              <Input
                className="mt-1"
                value={formR.cliente_nome}
                onChange={(e) => setFormR({ ...formR, cliente_nome: e.target.value })}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                className="mt-1"
                value={formR.descricao}
                onChange={(e) => setFormR({ ...formR, descricao: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valor</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={formR.valor}
                  onChange={(e) => setFormR({ ...formR, valor: e.target.value })}
                />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={formR.vencimento}
                  onChange={(e) => setFormR({ ...formR, vencimento: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveR}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openP} onOpenChange={setOpenP}>
        <DialogContent className="bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Nova despesa / banca</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label>Descrição</Label>
              <Input
                className="mt-1"
                value={formP.descricao}
                onChange={(e) => setFormP({ ...formP, descricao: e.target.value })}
              />
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input
                className="mt-1"
                value={formP.fornecedor_nome}
                onChange={(e) => setFormP({ ...formP, fornecedor_nome: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valor</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={formP.valor}
                  onChange={(e) => setFormP({ ...formP, valor: e.target.value })}
                />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={formP.vencimento}
                  onChange={(e) => setFormP({ ...formP, vencimento: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveP}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
