"use client";

import { HybridStatusPanel } from "@/components/hybrid/hybrid-status-panel";

/**
 * Plano B — CRM leve sobre planilha (Sheets / XLSX / CSV).
 * Não desliga o Supabase. Quando o banco cair, esta tela continua.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  loadPlanoBFromSheetsAction,
  exportCarteiraSnapshotCsvAction,
} from "@/app/actions/plano-b-actions";
import {
  computePlanoBKpis,
  mapMatrixToPlanoB,
  mapRowsToPlanoB,
  diagnoseHeaders,
  parseCsv,
  planoBToCsv,
  type PlanoBRow,
} from "@/lib/plano-b-sheets";
import {
  FileSpreadsheet,
  Download,
  RefreshCw,
  Loader2,
  Search,
  Upload,
  HardDrive,
} from "lucide-react";

const LS_URL = "lexis_plano_b_sheets_url";
const LS_ACTIVE = "lexis_plano_b_ativo";
const LS_ROWS = "lexis_plano_b_rows_v1";
const DEFAULT_SHEET =
  "https://docs.google.com/spreadsheets/d/1OxvSRDM2W2lbb3tX0YGA0OQu7dY_LDIWTxWH-4pH6r8/edit?usp=sharing";

const PAGE = 100;

export default function PlanoBPage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(DEFAULT_SHEET);
  const [rows, setRows] = useState<PlanoBRow[]>([]);
  const [headerDiag, setHeaderDiag] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ativo, setAtivo] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const [sourceLabel, setSourceLabel] = useState("");

  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem(LS_URL);
      setUrl(savedUrl || DEFAULT_SHEET);
      setAtivo(localStorage.getItem(LS_ACTIVE) === "1");
      const cached = localStorage.getItem(LS_ROWS);
      if (cached) {
        const parsed = JSON.parse(cached) as PlanoBRow[];
        if (Array.isArray(parsed) && parsed.length) {
          setRows(parsed);
          setSourceLabel(`Cache local · ${parsed.length} linhas`);
        }
      }
    } catch {
      /* */
    }
  }, []);

  const persistRows = (list: PlanoBRow[], label: string) => {
    setRows(list);
    setSourceLabel(label);
    setVisible(PAGE);
    try {
      // até ~8k linhas leves; se estourar quota, só mantém em memória
      localStorage.setItem(LS_ROWS, JSON.stringify(list.slice(0, 8000)));
    } catch {
      /* quota */
    }
  };

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
      title: v ? "Plano B ativo (esta tela + cache)" : "Plano B desligado",
      description: v
        ? "Gabinete normal continua no Supabase. Esta aba usa planilha/cache."
        : "Nada mudou no Supabase.",
    });
  };

  const loadFromUrl = useCallback(async () => {
    if (!url.trim()) {
      toast({ title: "Cole o link da planilha", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const r = await loadPlanoBFromSheetsAction(url.trim());
      if (!r.success) {
        toast({
          title: "Falha ao ler URL",
          description:
            (r.error || "") +
            " — Se a planilha for privada, use Upload do XLSX (relatório) abaixo.",
          variant: "destructive",
        });
        return;
      }
      persistRows(r.rows, `Google Sheets · ${r.count} linhas`);
      toast({ title: "Planilha carregada", description: `${r.count} processos` });
    } finally {
      setLoading(false);
    }
  }, [url, toast]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLoading(true);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".csv") || name.endsWith(".txt")) {
        const text = await file.text();
        const { headers, rows: raw } = parseCsv(text);
        const mapped = mapRowsToPlanoB(headers, raw);
        try {
          const d = diagnoseHeaders(headers);
          const comPrazo = mapped.filter((r) => r.proximoRetorno).length;
          setHeaderDiag(
            `Colunas: RETORNO(M)=${d.map.ultimoRetorno} · PRÓXIMO(N)=${d.map.proximoRetorno} · com prazo: ${comPrazo}/${mapped.length}`
          );
        } catch {
          setHeaderDiag("");
        }
        persistRows(mapped, `Arquivo ${file.name} · ${mapped.length}`);
        toast({ title: "CSV importado", description: `${mapped.length} processos` });
        return;
      }
      // XLSX — preferir aba Processos
      const buf = await file.arrayBuffer();
      const { parseWorkbookWithSheetJS } = await import("@/lib/sheetjs-bridge");
      // tenta parse padrão (1ª aba); se sheetjs local expandir, preferimos Processos
      let aoa = await parseWorkbookWithSheetJS(buf);
      // Se a 1ª aba não tiver Protocolo, tenta ler com xlsx direto preferindo Processos
      try {
        const modName = "xlsx";
        const XLSX = await (Function("m", "return import(m)")(modName) as Promise<any>);
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const prefer =
          wb.SheetNames.find((n: string) => /processo/i.test(n)) ||
          wb.SheetNames.find((n: string) => /auditoria/i.test(n)) ||
          wb.SheetNames[0];
        if (prefer) {
          const sheet = wb.Sheets[prefer];
          aoa = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
            raw: false,
          }).map((row: any[]) => row.map((c: any) => String(c ?? "")));
        }
      } catch {
        /* usa aoa do bridge */
      }
      const mapped = mapMatrixToPlanoB(aoa);
      try {
        const headers = (aoa[0] || []).map(String);
        const d = diagnoseHeaders(headers);
        const comPrazo = mapped.filter((r) => r.proximoRetorno).length;
        setHeaderDiag(
          `Colunas: RETORNO=${d.map.ultimoRetorno} · PRÓXIMO=${d.map.proximoRetorno} · com prazo: ${comPrazo}/${mapped.length}`
        );
      } catch {
        setHeaderDiag("");
      }
      if (!mapped.length) {
        toast({
          title: "Nenhuma linha com Protocolo",
          description: "Use a aba Processos do relatório LexisPredict.",
          variant: "destructive",
        });
        return;
      }
      persistRows(mapped, `${file.name} · ${mapped.length}`);
      toast({ title: "XLSX importado", description: `${mapped.length} processos` });
    } catch (err: any) {
      toast({
        title: "Falha no arquivo",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportOnce = async () => {
    setExporting(true);
    try {
      const r = await exportCarteiraSnapshotCsvAction({ maxRows: 5000 });
      if (!r.success || !r.csv) {
        toast({
          title: "Export falhou",
          description: r.error || "Cota ou sessão — use o XLSX do Dossiê se já baixou.",
          variant: "destructive",
        });
        return;
      }
      const blob = new Blob(["\uFEFF" + r.csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `lexis-carteira-plano-b-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      toast({
        title: "CSV baixado",
        description: `${r.count} processos. Suba no Google Sheets ou reabra aqui via Upload.`,
      });
    } finally {
      setExporting(false);
    }
  };

  const downloadCurrent = () => {
    if (!rows.length) return;
    const blob = new Blob(["\uFEFF" + planoBToCsv(rows)], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lexis-plano-b-cache-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const kpis = useMemo(() => computePlanoBKpis(rows), [rows]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!t) return true;
      return [r.protocolo, r.cliente, r.advogado, r.escritorio, r.status, r.criado_por, r.telefone]
        .join(" ")
        .toLowerCase()
        .includes(t);
    });
  }, [rows, q, statusFilter]);

  const statusOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.status || "Sem Prazo"));
    return Array.from(s).sort();
  }, [rows]);

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="max-w-5xl mx-auto w-full px-4 pt-4"><HybridStatusPanel /></div>

        <header className="shrink-0 border-b border-border/60 p-4 sm:px-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base tracking-tight uppercase">
                Plano B · Planilha CRM
              </h1>
              <p className="text-[10px] text-muted-foreground font-medium">
                Fallback operacional · não desliga Supabase · upload XLSX funciona offline
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant={ativo ? "default" : "outline"} className="text-[10px] font-black uppercase">
              {ativo ? "Modo B on" : "Modo B off"}
            </Badge>
            <Button type="button" size="sm" variant={ativo ? "secondary" : "outline"} onClick={() => toggleAtivo(!ativo)}>
              {ativo ? "Desativar" : "Ativar Plano B"}
            </Button>
          </div>
        </header>

        <div className="p-4 sm:px-8 space-y-3 border-b border-border/40">
          <p className="text-[11px] text-muted-foreground max-w-4xl">
            <strong>Agora:</strong> suba o arquivo{" "}
            <code className="text-[10px]">LexisPredict_Relatorio_Carteira_*.xlsx</code> (aba Processos)
            ou publique a planilha Google como CSV. Enquanto o banco tiver cota, o gabinete normal segue;
            se cair, use só esta tela + cache local.
          </p>

          <div className="flex flex-wrap gap-2">
            <Input
              value={url}
              onChange={(e) => saveUrl(e.target.value)}
              placeholder="Link Google Sheets (export CSV ou publicar na web)"
              className="flex-1 min-w-[240px] h-10 rounded-xl"
            />
            <Button type="button" size="sm" disabled={loading} onClick={() => void loadFromUrl()}>
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1">Carregar URL</span>
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />
              <span className="ml-1">Upload XLSX/CSV</span>
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => void onFile(e)}
            />
            <Button type="button" size="sm" variant="outline" disabled={exporting} onClick={() => void exportOnce()}>
              {exporting ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
              <span className="ml-1">Export Supabase 1×</span>
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={!rows.length} onClick={downloadCurrent}>
              <HardDrive className="h-4 w-4" />
              <span className="ml-1">Baixar cache</span>
            </Button>
          </div>

          {sourceLabel ? (
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Fonte: {sourceLabel}
            </p>
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Kpi label="Total" value={kpis.total} />
            <Kpi label="Ativos*" value={kpis.ativos} hint="não arquivados" />
            <Kpi label="Vencidos" value={kpis.vencidos} danger={kpis.vencidos > 0} />
            <Kpi label="Arquivados" value={kpis.arquivados} />
            <Kpi label="Sem telefone" value={kpis.semTel} />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setVisible(PAGE);
                }}
                placeholder="Buscar cliente, CNJ, advogado, telefone…"
                className="pl-9 h-9 rounded-xl"
              />
            </div>
            <select
              className="h-9 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setVisible(PAGE);
              }}
            >
              <option value="">Todos os status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s} ({kpis.byStatus[s] || 0})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:px-8">
          {!rows.length && !loading && (
            <div className="text-sm text-muted-foreground py-12 text-center space-y-2 max-w-lg mx-auto">
              <p>Nenhuma linha no cache.</p>
              <p className="text-[12px]">
                1) Upload do relatório XLSX (mais confiável) · 2) ou publique a planilha Google como CSV e
                Carregar URL · 3) ou Export Supabase 1× enquanto ainda houver cota.
              </p>
            </div>
          )}
          {!!rows.length && (
            <>
            {headerDiag ? (
              <p className="text-[11px] font-mono text-muted-foreground mb-2 px-2 py-1 rounded-md border bg-muted/30">{headerDiag}</p>
            ) : null}
            <div className="rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-muted/40 text-[10px] font-black uppercase tracking-wider text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Cliente / Protocolo</th>
                    <th className="px-3 py-2">Tel</th>
                    <th className="px-3 py-2">Advogado</th>
                    <th className="px-3 py-2">Escritório</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Tribunal</th>
                    <th className="px-3 py-2">Últ. retorno</th>
                    <th className="px-3 py-2">Assistente</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visible).map((r) => (
                    <tr key={r.protocolo + r.cliente} className="border-t border-border/50 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-foreground">{r.cliente || "—"}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{r.protocolo}</div>
                        {r.andamento ? (
                          <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                            {r.andamento}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">{r.telefone || "—"}</td>
                      <td className="px-3 py-2">{r.advogado || "—"}</td>
                      <td className="px-3 py-2">{r.escritorio || "—"}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-bold uppercase">{r.status || "—"}</span>
                      </td>
                      <td className="px-3 py-2">{r.tribunal || "—"}</td>
                      <td className="px-3 py-2">{r.ultimoRetorno || "—"}</td>
                      <td className="px-3 py-2">{r.criado_por || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center gap-2 p-3 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground">
                  Mostrando {Math.min(visible, filtered.length)} de {filtered.length} (filtro) ·{" "}
                  {rows.length} na fonte
                </p>
                {visible < filtered.length ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setVisible((v) => v + PAGE)}>
                    Mais {Math.min(PAGE, filtered.length - visible)}
                  </Button>
                ) : null}
                {visible > PAGE ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setVisible(PAGE)}>
                    Menos
                  </Button>
                ) : null}
              </div>
            </div>
          </>
          )}
        </div>
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: number;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-xl font-black tabular-nums ${danger ? "text-red-600" : "text-foreground"}`}>
        {value}
      </p>
      {hint ? <p className="text-[9px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
