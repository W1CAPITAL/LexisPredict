"use client";

/**
 * Régua de cobrança — 100% grátis (sem API WhatsApp / gateway).
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { crmReguaCobrancaAction } from "@/app/actions/crm-actions";
import { ArrowLeft, Loader2, RefreshCcw, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CrmCobrancaPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await crmReguaCobrancaAction();
    setItems(res.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyScript = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
      toast({ title: "Script copiado" });
    } catch {
      toast({ title: "Falha ao copiar", variant: "destructive" });
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/crm">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-black">Régua de cobrança</h1>
                <p className="text-xs text-muted-foreground">
                  D-3 · D0 · D+3 · D+7 · crítico — grátis, ação manual pela equipe
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            Não envia WhatsApp automático (API Meta é paga). Use o script do agente, copie e cole no
            WhatsApp Web / ligação. Marque pago em CRM Financeiro após comprovante.
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Nenhum título na janela da régua (D-3 até crítico).
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => (
                <li
                  key={it.receber_id}
                  className={cn(
                    "rounded-2xl border p-4 space-y-2",
                    it.etapa === "critico" || it.etapa === "D+7"
                      ? "border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20"
                      : "border-border bg-card"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm">{it.cliente_nome}</p>
                      <p className="text-xs text-muted-foreground">{it.descricao}</p>
                    </div>
                    <div className="text-right">
                      <Badge>{it.etapa}</Badge>
                      <p className="font-black tabular-nums text-sm mt-1">{brl(it.valor)}</p>
                      <p className="text-[10px] text-muted-foreground">venc. {it.vencimento}</p>
                    </div>
                  </div>
                  <p className="text-xs text-foreground">{it.acaoSugerida}</p>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Canal: {it.canalSugerido}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => copyScript(it.receber_id, it.scriptAgente)}
                  >
                    {copied === it.receber_id ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    Copiar script do agente
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
