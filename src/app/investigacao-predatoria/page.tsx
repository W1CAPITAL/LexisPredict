
"use client";

/**
 * Radar NUMOPEDE / litigância predatória — banca de advogados da carteira.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  listarAdvogadosBancaAction,
  analisarAdvogadoPredatoriaAction,
  escanearBancaNumopedeAction,
  type AdvogadoBanca,
  type PredatoriaReport,
  type PredatoriaHitCase,
} from "@/app/actions/predatoria-actions";
import { JudicialNumpad } from "@/components/ui/judicial-numpad";
import {
  Loader2,
  Search,
  ShieldAlert,
  Scale,
  ExternalLink,
  CheckSquare,
  Square,
  Radar,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const UFS = [
  "SP","RJ","MG","RS","PR","SC","BA","GO","PE","CE","DF","ES","MT","MS","PA","AM","MA","PB","RN","AL","SE","PI","TO","RO","AC","AP","RR",
];

export default function InvestigacaoPredatoriaPage() {
  const { toast } = useToast();
  const [banca, setBanca] = useState<AdvogadoBanca[]>([]);
  const [loadingBanca, setLoadingBanca] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [nome, setNome] = useState("");
  const [oabUf, setOabUf] = useState("SP");
  const [oabNumero, setOabNumero] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<PredatoriaReport | null>(null);
  const [bulkHits, setBulkHits] = useState<PredatoriaHitCase[]>([]);
  const [byLawyer, setByLawyer] = useState<Array<{ nome: string; hits: number }>>([]);
  const [flagged, setFlagged] = useState(0);

  const loadBanca = useCallback(async () => {
    setLoadingBanca(true);
    try {
      const r = await listarAdvogadosBancaAction();
      if (r.success) setBanca(r.advogados);
      else toast({ title: "Banca", description: r.error || "Falha", variant: "destructive" });
    } finally {
      setLoadingBanca(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadBanca();
  }, [loadBanca]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const selectAll = () => setSelected(new Set(banca.map((a) => a.key)));
  const clearSel = () => setSelected(new Set());

  const runOne = async () => {
    setLoading(true);
    setBulkHits([]);
    try {
      const r = await analisarAdvogadoPredatoriaAction({
        nome: nome || undefined,
        oabUf: oabNumero ? oabUf : undefined,
        oabNumero: oabNumero || undefined,
      });
      setReport(r);
      if (!r.success) toast({ title: "Radar", description: r.error || "Falha", variant: "destructive" });
      else if (r.casesMatched === 0)
        toast({ title: "Sem NUMOPEDE", description: "Nenhum processo com menção NUMOPEDE/predatória para este filtro." });
    } finally {
      setLoading(false);
    }
  };

  const runBanca = async (aplicarFlags: boolean) => {
    setLoading(true);
    setReport(null);
    try {
      const keys = selected.size ? Array.from(selected) : undefined;
      const r = await escanearBancaNumopedeAction({
        lawyerKeys: keys,
        aplicarFlags,
      });
      if (!r.success) {
        toast({ title: "Varredura", description: r.error || "Falha", variant: "destructive" });
        return;
      }
      setBulkHits(r.hits);
      setByLawyer(r.byLawyer);
      setFlagged(r.flagged);
      toast({
        title: aplicarFlags ? "Flags aplicadas" : "Varredura NUMOPEDE",
        description: `${r.hits.length} processo(s) · ${r.byLawyer.length} advogado(s)${aplicarFlags ? ` · ${r.flagged} flags gravadas` : ""}`,
      });
      if (aplicarFlags) void loadBanca();
    } finally {
      setLoading(false);
    }
  };

  const fillFromLawyer = (a: AdvogadoBanca) => {
    setNome(a.nome);
    if (a.oabUf) setOabUf(a.oabUf);
    if (a.oabNumero) setOabNumero(a.oabNumero);
    setSelected(new Set([a.key]));
  };

  const hits = report?.hits?.length ? report.hits : bulkHits;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Radar className="text-violet-600" size={22} />
            Radar NUMOPEDE
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Usa a banca de advogados já cadastrada na carteira. Alerta apenas processos com menção a NUMOPEDE /
            litigância predatória nos andamentos já capturados. Não consulta investigação sigilosa da OAB.
          </p>
        </header>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Banca */}
          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Scale size={16} /> Banca da carteira
              </h2>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAll} disabled={!banca.length}>
                  Todas OAB / todos
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearSel}>
                  Limpar
                </Button>
              </div>
            </div>
            {loadingBanca ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ul className="max-h-[320px] overflow-y-auto space-y-1 text-sm">
                {banca.map((a) => (
                  <li key={a.key}>
                    <button
                      type="button"
                      onClick={() => toggle(a.key)}
                      onDoubleClick={() => fillFromLawyer(a)}
                      className={cn(
                        "w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-muted/60 transition",
                        selected.has(a.key) && "bg-violet-500/10 ring-1 ring-violet-500/30"
                      )}
                    >
                      {selected.has(a.key) ? (
                        <CheckSquare size={16} className="text-violet-600 shrink-0" />
                      ) : (
                        <Square size={16} className="text-muted-foreground shrink-0" />
                      )}
                      <span className="flex-1 min-w-0 truncate font-medium">{a.nome}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{a.totalProcessos}</span>
                      {a.oabNumero ? (
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {a.oabUf}/{a.oabNumero}
                        </Badge>
                      ) : null}
                      {a.numopedeHits > 0 ? (
                        <Badge className="bg-violet-700 text-white text-[9px]">{a.numopedeHits} NUM</Badge>
                      ) : null}
                    </button>
                  </li>
                ))}
                {!banca.length && (
                  <p className="text-muted-foreground text-xs py-6 text-center">Nenhum advogado na carteira.</p>
                )}
              </ul>
            )}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                className="flex-1 rounded-xl"
                disabled={loading}
                onClick={() => void runBanca(false)}
              >
                {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Search size={16} className="mr-2" />}
                Varrer selecionados / todos
              </Button>
              <Button
                variant="secondary"
                className="flex-1 rounded-xl"
                disabled={loading}
                onClick={() => void runBanca(true)}
              >
                <ShieldAlert size={16} className="mr-2" />
                Varrer e gravar flags
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Flags sobem na fila de contato, aparecem em Processos e penalizam o ranking do advogado (−40 pts/processo).
            </p>
          </section>

          {/* Manual OAB */}
          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">Consulta pontual (nome / OAB)</h2>
            <div className="space-y-2">
              <Label>Nome do advogado</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como está na carteira" className="rounded-xl" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>UF</Label>
                <select
                  className="w-full h-10 rounded-xl border border-input bg-background px-2 text-sm"
                  value={oabUf}
                  onChange={(e) => setOabUf(e.target.value)}
                >
                  {UFS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Número OAB</Label>
                <Input
                  value={oabNumero}
                  onChange={(e) => setOabNumero(e.target.value.replace(/\D/g, "").slice(0, 7))}
                  className="rounded-xl font-mono"
                />
              </div>
            </div>
            <JudicialNumpad mode="oab" value={oabNumero} onChange={setOabNumero} />
            <Button className="w-full rounded-xl" onClick={() => void runOne()} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
              Analisar só NUMOPEDE deste filtro
            </Button>
            {report?.oab?.consultaUrl && (
              <a
                href={report.oab.consultaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary inline-flex items-center gap-1"
              >
                Abrir CNA/OAB <ExternalLink size={12} />
              </a>
            )}
            {report && (
              <div className="rounded-xl bg-muted/40 p-3 text-sm space-y-1">
                <p className="font-medium">
                  Score {report.risk.score} · {report.risk.band} · {report.casesMatched} hit(s)
                </p>
                <p className="text-xs text-muted-foreground">{report.risk.summary}</p>
              </div>
            )}
          </section>
        </div>

        {(byLawyer.length > 0 || flagged > 0) && (
          <section className="rounded-2xl border border-border p-4 space-y-2">
            <h3 className="text-sm font-semibold">Por advogado (só NUMOPEDE)</h3>
            {flagged > 0 && (
              <p className="text-xs text-violet-700 font-medium">{flagged} flag(s) gravadas na carteira</p>
            )}
            <ul className="text-sm space-y-1">
              {byLawyer.map((l) => (
                <li key={l.nome} className="flex justify-between border-b border-border/40 py-1">
                  <span className="truncate">{l.nome}</span>
                  <Badge className="bg-violet-700 text-white">{l.hits}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hits.length > 0 && (
          <section className="rounded-2xl border border-border p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="text-violet-600" size={16} />
              Processos com NUMOPEDE / predatória ({hits.length})
            </h3>
            <ul className="space-y-2 max-h-[420px] overflow-y-auto">
              {hits.map((h) => (
                <li key={h.protocolo + h.cliente} className="rounded-xl border border-border/60 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{h.cliente}</p>
                      <p className="text-xs font-mono text-muted-foreground">{h.protocolo}</p>
                      <p className="text-xs text-muted-foreground">{h.advogado}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge className="bg-violet-700 text-white text-[9px]">NUMOPEDE</Badge>
                      <Button variant="outline" size="sm" asChild className="rounded-lg h-8">
                        <Link href={`/cases?search=${encodeURIComponent(h.protocolo)}`}>Processo</Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild className="rounded-lg h-8">
                        <Link href={`/tarefas?search=${encodeURIComponent(h.protocolo)}`}>Fila</Link>
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {h.signals.map((s) => (
                      <Badge key={s.code} variant="outline" className="text-[9px]">
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-[10px] text-muted-foreground border-t pt-4">
          {report?.disclaimer ||
            "Processos ético-disciplinares da OAB em curso são sigilosos. Este módulo não afirma existência de investigação oficial."}
        </p>
      </main>
    </div>
  );
}
