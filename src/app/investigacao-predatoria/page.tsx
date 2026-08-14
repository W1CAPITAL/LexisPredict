"use client";

import React, { useCallback, useEffect, useState } from "react";
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
  type AdvogadoBancaRadar,
  type PredatoriaReport,
  type PredatoriaHitCase,
} from "@/app/actions/predatoria-actions";
import { JudicialNumpad } from "@/components/ui/judicial-numpad";
import { Loader2, Search, ShieldAlert, Scale, ExternalLink, CheckSquare, Square, Radar, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const UFS = ["SP","RJ","MG","RS","PR","SC","BA","GO","PE","CE","DF","ES","MT","MS","PA","AM","MA","PB","RN","AL","SE","PI","TO","RO","AC","AP","RR"];

export default function InvestigacaoPredatoriaPage() {
  const { toast } = useToast();
  const [banca, setBanca] = useState<AdvogadoBancaRadar[]>([]);
  const [orfaos, setOrfaos] = useState<Array<{ label: string; total: number }>>([]);
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
      if (r.success) {
        setBanca(r.advogados);
        setOrfaos(r.orfaos || []);
      } else toast({ title: "Banca", description: r.error || "Falha", variant: "destructive" });
    } finally {
      setLoadingBanca(false);
    }
  }, [toast]);

  useEffect(() => { void loadBanca(); }, [loadBanca]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

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
        toast({ title: "Sem NUMOPEDE", description: "Nenhum hit para este filtro." });
    } finally {
      setLoading(false);
    }
  };

  const runBanca = async (aplicarFlags: boolean) => {
    setLoading(true);
    setReport(null);
    try {
      const keys = selected.size ? Array.from(selected) : undefined;
      const r = await escanearBancaNumopedeAction({ lawyerKeys: keys, aplicarFlags });
      if (!r.success) {
        toast({ title: "Varredura", description: r.error || "Falha", variant: "destructive" });
        return;
      }
      setBulkHits(r.hits);
      setByLawyer(r.byLawyer);
      setFlagged(r.flagged);
      toast({
        title: aplicarFlags ? "Flags aplicadas" : "Varredura NUMOPEDE",
        description: `${r.hits.length} processo(s)`,
      });
      if (aplicarFlags) void loadBanca();
    } finally {
      setLoading(false);
    }
  };

  const hits = report?.hits?.length ? report.hits : bulkHits;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Radar className="text-violet-600" size={22} /> Radar NUMOPEDE
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Lista a <strong>banca do Supabase</strong> (nome + OAB) e associa ao campo livre dos processos
            (ex.: MATHEUS → MATHEUS SANTOS DIAS). Sem isso o radar não enxerga a carteira.
          </p>
        </header>

        <div className="grid lg:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Scale size={16} /> Banca cadastrada</h2>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set(banca.map((a) => a.id || a.key)))}>Todos</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Limpar</Button>
              </div>
            </div>
            {loadingBanca ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : (
              <ul className="max-h-[360px] overflow-y-auto space-y-1 text-sm">
                {banca.map((a) => (
                  <li key={a.id || a.key}>
                    <button
                      type="button"
                      onClick={() => toggle(a.id || a.key)}
                      onDoubleClick={() => { setNome(a.nome); if (a.oabUf) setOabUf(a.oabUf); if (a.oabNumero) setOabNumero(a.oabNumero); setSelected(new Set([a.id || a.key])); }}
                      className={cn(
                        "w-full flex flex-col gap-0.5 rounded-xl px-3 py-2 text-left hover:bg-muted/60",
                        selected.has(a.id || a.key) && "bg-violet-500/10 ring-1 ring-violet-500/30"
                      )}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {selected.has(a.id || a.key) ? <CheckSquare size={16} className="text-violet-600 shrink-0" /> : <Square size={16} className="text-muted-foreground shrink-0" />}
                        <span className="flex-1 min-w-0 truncate font-medium">{a.nome}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{a.totalProcessos}</span>
                        {a.numopedeHits > 0 ? <Badge className="bg-violet-700 text-white text-[9px]">{a.numopedeHits} NUM</Badge> : null}
                      </div>
                      <div className="pl-6 flex flex-wrap gap-1">
                        {a.oabLabel ? <Badge variant="outline" className="text-[9px] font-mono">{a.oabLabel}</Badge> : null}
                        {a.aliases.slice(0, 4).map((al) => (
                          <Badge key={al} variant="secondary" className="text-[8px]">processos: {al}</Badge>
                        ))}
                        {a.totalProcessos === 0 ? <span className="text-[9px] text-amber-600">sem match no campo advogado</span> : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="flex-1 rounded-xl" disabled={loading} onClick={() => void runBanca(false)}>
                {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Search size={16} className="mr-2" />}
                Varrer NUMOPEDE
              </Button>
              <Button variant="secondary" className="flex-1 rounded-xl" disabled={loading} onClick={() => void runBanca(true)}>
                <ShieldAlert size={16} className="mr-2" /> Gravar flags
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">Consulta pontual</h2>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>UF</Label>
                <select className="w-full h-10 rounded-xl border border-input bg-background px-2 text-sm" value={oabUf} onChange={(e) => setOabUf(e.target.value)}>
                  {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>OAB</Label>
                <Input value={oabNumero} onChange={(e) => setOabNumero(e.target.value.replace(/\D/g, "").slice(0, 7))} className="rounded-xl font-mono" />
              </div>
            </div>
            <JudicialNumpad mode="oab" value={oabNumero} onChange={setOabNumero} />
            <Button className="w-full rounded-xl" onClick={() => void runOne()} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />} Analisar
            </Button>
            {report?.oab?.consultaUrl && (
              <a href={report.oab.consultaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
                CNA/OAB <ExternalLink size={12} />
              </a>
            )}
            {orfaos.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1 text-amber-800 dark:text-amber-200">
                  <AlertTriangle size={14} /> Valores em processos sem match na banca
                </p>
                <ul className="text-[10px] space-y-0.5 max-h-28 overflow-y-auto">
                  {orfaos.slice(0, 12).map((o) => (
                    <li key={o.label} className="flex justify-between gap-2">
                      <span className="truncate">{o.label}</span>
                      <span>{o.total}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        {byLawyer.length > 0 && (
          <section className="rounded-2xl border p-4 space-y-2">
            <h3 className="text-sm font-semibold">Por advogado {flagged > 0 ? `· ${flagged} flags` : ""}</h3>
            <ul className="text-sm space-y-1">
              {byLawyer.map((l) => (
                <li key={l.nome} className="flex justify-between border-b py-1">
                  <span className="truncate">{l.nome}</span>
                  <Badge className="bg-violet-700 text-white">{l.hits}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hits.length > 0 && (
          <section className="rounded-2xl border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Processos NUMOPEDE ({hits.length})</h3>
            <ul className="space-y-2 max-h-[400px] overflow-y-auto">
              {hits.map((h) => (
                <li key={h.protocolo} className="rounded-xl border p-3 text-sm">
                  <div className="flex justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium">{h.cliente}</p>
                      <p className="text-xs font-mono text-muted-foreground">{h.protocolo}</p>
                      <p className="text-xs text-muted-foreground">
                        Campo: {h.advogado}{h.bancaNome ? ` → ${h.bancaNome}` : ""}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="h-8">
                      <Link href={`/cases?search=${encodeURIComponent(h.protocolo)}`}>Abrir</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
