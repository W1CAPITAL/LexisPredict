"use client";

/**
 * Conciliação CSV de extrato — Open Finance “lite”, 100% grátis.
 */

import React, { useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  crmConciliarCsvAction,
  crmAplicarConciliacaoAltaAction,
} from "@/app/actions/crm-actions";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CrmConciliacaoPage() {
  const { toast } = useToast();
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [applying, setApplying] = useState(false);

  const run = async () => {
    setLoading(true);
    const res = await crmConciliarCsvAction(csv);
    setLoading(false);
    if (!res.success) {
      toast({ title: "Erro", description: res.error, variant: "destructive" });
      return;
    }
    setMatches(res.matches || []);
    toast({
      title: "Conciliação",
      description: `${res.totalLinhas} linha(s) · ${
        (res.matches || []).filter((m: any) => m.confianca === "alta" || m.confianca === "media").length
      } match(es)`,
    });
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    setCsv(text);
  };

  const aplicarAltas = async () => {
    const ids = matches
      .filter((m) => m.confianca === "alta" && m.receber_id)
      .map((m) => m.receber_id as string);
    if (!ids.length) {
      toast({ title: "Nenhum match alta", variant: "destructive" });
      return;
    }
    setApplying(true);
    const res = await crmAplicarConciliacaoAltaAction(ids);
    setApplying(false);
    toast({
      title: res.success ? "Baixas aplicadas" : "Erro",
      description: res.success ? `${res.pagos} título(s) marcados pagos` : res.error,
      variant: res.success ? "default" : "destructive",
    });
    if (res.success) run();
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/crm">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-black">Conciliação CSV</h1>
              <p className="text-xs text-muted-foreground">
                Cole ou envie extrato do banco (data;valor;descrição) — sem Open Finance pago
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex">
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] || null)}
              />
              <Button type="button" variant="outline" size="sm" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-1" /> Arquivo CSV
                </span>
              </Button>
            </label>
            <Button size="sm" onClick={run} disabled={loading || !csv.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conciliar"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={aplicarAltas}
              disabled={applying || !matches.some((m) => m.confianca === "alta")}
            >
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Baixar matches ALTA"}
            </Button>
          </div>

          <Textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={"data;valor;descricao\n08/08/2026;150,00;PIX JOAO\n2026-08-07;89.90;BOLETO"}
            className="min-h-[140px] font-mono text-xs"
          />

          <ul className="space-y-2">
            {matches.map((m, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-xl border p-3 text-sm",
                  m.confianca === "alta"
                    ? "border-emerald-300 dark:border-emerald-800"
                    : m.confianca === "media"
                      ? "border-amber-300 dark:border-amber-800"
                      : "border-border"
                )}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-xs">
                    {m.extrato.data} · {brl(m.extrato.valor)}
                  </span>
                  <Badge variant="outline">{m.confianca}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{m.extrato.descricao}</p>
                <p className="text-xs mt-1">
                  {m.receber_id
                    ? `→ ${m.cliente_nome || m.receber_id} · ${m.motivo}`
                    : m.motivo}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
