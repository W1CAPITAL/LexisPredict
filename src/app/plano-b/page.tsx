"use client";

/**
 * Plano B — visualização da carteira via Google Sheets / CSV.
 * Não altera rotas do gabinete nem desliga o Supabase.
 * Ative só quando precisar operar sem estourar cota.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  loadPlanoBFromSheetsAction,
  exportCarteiraSnapshotCsvAction,
} from "@/app/actions/plano-b-actions";
import type { PlanoBRow } from "@/lib/plano-b-sheets";
import { FileSpreadsheet, Download, RefreshCw, Loader2, Search } from "lucide-react";

const LS_URL = "lexis_plano_b_sheets_url";
const LS_ACTIVE = "lexis_plano_b_ativo";

export default function PlanoBPage() {
  const [url, setUrl] = useState("");
  const [rows, setRows] = useState<PlanoBRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [q, setQ] = useState("");
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    try {
      setUrl(localStorage.getItem(LS_URL) || "");
      setAtivo(localStorage.getItem(LS_ACTIVE) === "1");
    } catch {
      /* */
    }
  }, []);

  const saveUrl = (v: string) => {
    setUrl(v);
    try {
      localStorage.setItem(LS_URL, v);
    } catch {
      /* */
    }
  };

  const toggleAtivo = (v: boolean) => {
    setAtivo(v);
    try {
      localStorage.setItem(LS_ACTIVE, v ? "1" : "0");
    } catch {
      /* */
    }
    toast({
      title: v ? "Plano B ativo (só esta tela)" : "Plano B desligado",
      description: v
        ? "Gabinete continua no Supabase. Esta aba lê a planilha."
        : "Nada mudou no Supabase.",
    });
  };

  const load = useCallback(async () => {
    if (!url.trim()) {
      toast({ title: "Cole o link da planilha", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const r = await loadPlanoBFromSheetsAction(url.trim());
      if (!r.success) {
        toast({ title: "Falha ao ler planilha", description: r.error, variant: "destructive" });
        setRows([]);
        return;
      }
      setRows(r.rows);
      toast({ title: "Planilha carregada", description: `${r.count} linhas` });
    } finally {
      setLoading(false);
    }
  }, [url]);

  const exportOnce = async () => {
    setExporting(true);
    try {
      const r = await exportCarteiraSnapshotCsvAction({ maxRows: 5000 });
      if (!r.success || !r.csv) {
        toast({
          title: "Export falhou",
          description: r.error || "Cota ou sessão",
          variant: "destructive",
        });
        return;
      }
      const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `lexis-carteira-plano-b-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      toast({
        title: "CSV baixado",
        description: `${r.count} processos. Suba no Google Sheets e publique como CSV.`,
      });
    } finally {
      setExporting(false);
    }
  };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.protocolo, r.cliente, r.advogado, r.escritorio, r.status, r.criado_por]
        .join(" ")
        .toLowerCase()
        .includes(t)
    );
  }, [rows, q]);

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-border/60 p-4 sm:px-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base tracking-tight uppercase">
                Plano B · Planilha
              </h1>
              <p className="text-[10px] text-muted-foreground font-medium">
                Fallback Sheets/CSV · não desliga o Supabase · não grava de volta sozinho
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant={ativo ? "default" : "outline"} className="text-[10px] font-black uppercase">
              {ativo ? "Modo B nesta aba" : "Modo B off"}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant={ativo ? "secondary" : "outline"}
              onClick={() => toggleAtivo(!ativo)}
            >
              {ativo ? "Desativar" : "Ativar Plano B"}
            </Button>
          </div>
        </header>

        <div className="p-4 sm:px-8 space-y-3 border-b border-border/40">
          <p className="text-[11px] text-muted-foreground max-w-3xl">
            Use quando a cota do Supabase estiver no limite. Exporte <strong>uma vez</strong>, suba no
            Google Sheets, publique CSV, cole o link aqui. O gabinete normal segue no banco até você
            decidir o contrário.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              value={url}
              onChange={(e) => saveUrl(e.target.value)}
              placeholder="Link Google Sheets (export CSV ou publicar na web)"
              className="flex-1 min-w-[240px] h-10 rounded-xl"
            />
            <Button type="button" size="sm" disabled={loading} onClick={() => void load()}>
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1">Carregar</span>
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={exporting} onClick={() => void exportOnce()}>
              {exporting ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
              <span className="ml-1">Exportar do Supabase (1×)</span>
            </Button>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente, CNJ, advogado…"
              className="pl-9 h-9 rounded-xl"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:px-8">
          {!rows.length && !loading && (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Nenhuma linha. Cole o link e clique Carregar — ou exporte CSV primeiro.
            </p>
          )}
          {!!rows.length && (
            <div className="rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-muted/40 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Cliente / Protocolo</th>
                    <th className="px-3 py-2">Advogado</th>
                    <th className="px-3 py-2">Escritório</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Tribunal</th>
                    <th className="px-3 py-2">Últ. retorno</th>
                    <th className="px-3 py-2">Criado por</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((r) => (
                    <tr key={r.protocolo} className="border-t border-border/50 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <div className="font-semibold">{r.cliente || "—"}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{r.protocolo}</div>
                      </td>
                      <td className="px-3 py-2">{r.advogado || "—"}</td>
                      <td className="px-3 py-2">{r.escritorio || "—"}</td>
                      <td className="px-3 py-2">{r.status || "—"}</td>
                      <td className="px-3 py-2">{r.tribunal || "—"}</td>
                      <td className="px-3 py-2">{r.ultimoRetorno || "—"}</td>
                      <td className="px-3 py-2">{r.criado_por || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-muted-foreground p-2">
                Mostrando {Math.min(500, filtered.length)} de {filtered.length} (filtro) · {rows.length}{" "}
                na planilha
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
