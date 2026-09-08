"use client";

import React, { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCnj20, gerarLoteCnj } from "@/lib/gerar-cnj-aleatorio";
import { xlsxSoCnj } from "@/lib/xlsx-lista-cnj";
import { Download, Hash, Loader2 } from "lucide-react";

const TETO = 20000;

export default function GeradorProcessosPage() {
  const [qtd, setQtd] = useState("100");
  const [lista, setLista] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState(false);

  const fmt = useMemo(() => lista.map(formatCnj20), [lista]);

  const gerar = () => {
    const n = Math.max(0, Math.min(TETO, parseInt(String(qtd).replace(/\D/g, ""), 10) || 0));
    if (!n) return;
    setBusy(true);
    setTimeout(() => {
      setLista(gerarLoteCnj(n, TETO));
      setBusy(false);
    }, 20);
  };

  const baixar = async () => {
    if (!fmt.length) return;
    setExp(true);
    try {
      const blob = await xlsxSoCnj(fmt);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `processos-automaticos-${fmt.length}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExp(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 p-6 space-y-6 overflow-y-auto">
        <header className="max-w-2xl space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Ferramenta local
          </p>
          <h1 className="text-2xl font-black tracking-tight">Gerador de processos automáticos</h1>
          <p className="text-sm text-muted-foreground">
            Só o número do processo (CNJ). Não grava no banco. Não traz nome, telefone nem parte.
            Você diz quantos quer, o app sorteia e você baixa o xlsx.
          </p>
        </header>

        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Quantos números
            </span>
            <Input
              inputMode="numeric"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
              className="w-36 h-10"
              maxLength={6}
            />
          </label>
          <Button onClick={gerar} disabled={busy} className="h-10 font-black uppercase text-[10px] tracking-widest">
            {busy ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Hash size={14} className="mr-2" />}
            Gerar
          </Button>
          <Button
            variant="outline"
            onClick={baixar}
            disabled={!fmt.length || exp}
            className="h-10 font-black uppercase text-[10px] tracking-widest"
          >
            {exp ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Download size={14} className="mr-2" />}
            Exportar xlsx
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Máximo {TETO.toLocaleString("pt-BR")} por vez · {fmt.length} na tela · some se recarregar
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Processo
          </div>
          <div className="max-h-[60vh] overflow-auto font-mono text-sm">
            {!fmt.length ? (
              <p className="p-4 text-muted-foreground text-sm font-sans">
                Nada gerado ainda. Digite a quantidade e clique em Gerar.
              </p>
            ) : (
              fmt.map((c) => (
                <div key={c} className="px-4 py-1.5 border-b border-border/60 last:border-0">
                  {c}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
