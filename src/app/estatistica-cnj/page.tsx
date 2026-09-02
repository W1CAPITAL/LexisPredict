"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import {
  coletarLoteExtincaoAction,
  exportarAmostraCnjCsvAction,
  listarAmostraCnjAction,
  resumoAmostraCnjAction,
} from "@/app/actions/amostra-cnj-actions";
import { Loader2, Download, Play } from "lucide-react";

type Row = {
  cnj: string;
  cnj_fmt?: string;
  tribunal?: string;
  classe_nome?: string;
  assunto_nome?: string;
  data_baixa?: string | null;
  flag_veiculo_ou_bancario?: boolean;
};

export default function EstatisticaCnjPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [veiculo, setVeiculo] = useState(0);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

  const refresh = async () => {
    const [r, list] = await Promise.all([resumoAmostraCnjAction(), listarAmostraCnjAction(100)]);
    setTotal(r.total);
    setVeiculo(r.veiculo);
    setRows(list as Row[]);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const run = async () => {
    setBusy(true);
    setLog("Consultando DataJud (só movimento + classe)…");
    try {
      const r = await coletarLoteExtincaoAction({ alvo: 10000 });
      setLog(r.message || "");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const exp = async () => {
    const r = await exportarAmostraCnjCsvAction();
    if (!r.success || !r.csv) return;
    const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "amostra-cnj-estatistica.csv";
    a.click();
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 p-6 space-y-4 overflow-y-auto">
        <header>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Amostra analítica
          </p>
          <h1 className="text-2xl font-black">CNJ · extinção sem mérito</h1>
          <p className="text-sm text-muted-foreground max-w-2xl mt-1">
            Só número do processo + tribunal/classe/data. Sem nome, telefone, CPF.
            Não usar esta lista para ofertar. Lote de até 10 mil CNJs novos por
            clique — já coletados não voltam.
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border px-4 py-3">
            <p className="text-[10px] uppercase text-muted-foreground">CNJs únicos</p>
            <p className="text-2xl font-black">{total}</p>
          </div>
          <div className="rounded-xl border px-4 py-3">
            <p className="text-[10px] uppercase text-muted-foreground">Classe veículo/bancário</p>
            <p className="text-2xl font-black">{veiculo}</p>
          </div>
          <div className="rounded-xl border px-4 py-3">
            <p className="text-[10px] uppercase text-muted-foreground">% nessa marca</p>
            <p className="text-2xl font-black">
              {total ? Math.round((veiculo / total) * 100) : 0}%
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void run()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Buscar lote (até 10.000 novos)
          </Button>
          <Button type="button" variant="outline" onClick={() => void exp()} disabled={!total}>
            <Download className="mr-2 h-4 w-4" />
            CSV sem dados pessoais
          </Button>
        </div>
        {log ? <p className="text-[12px] text-muted-foreground">{log}</p> : null}

        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2">CNJ</th>
                <th className="p-2">Tribunal</th>
                <th className="p-2">Classe</th>
                <th className="p-2">Baixa</th>
                <th className="p-2">Veíc./banc.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cnj} className="border-b last:border-0">
                  <td className="p-2 font-mono">{r.cnj_fmt || r.cnj}</td>
                  <td className="p-2">{r.tribunal}</td>
                  <td className="p-2">{r.classe_nome}</td>
                  <td className="p-2">{r.data_baixa || "—"}</td>
                  <td className="p-2">{r.flag_veiculo_ou_bancario ? "sim" : "não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
