/**
 * Busca e Apreensão — somente processos da carteira (DJEN por CNJ)
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert,
  Loader2,
  Search,
  ExternalLink,
  Gavel,
  User,
  Briefcase,
  RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  runBuscaApreensaoDjenAction,
  type BaHit,
} from "@/app/actions/busca-apreensao-actions";

export default function BuscaApreensaoPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<BaHit[]>([]);
  const [dias, setDias] = useState(30);
  const [limite, setLimite] = useState(80);
  const [meta, setMeta] = useState<{
    scanned?: number;
    carteiraSize?: number;
    filaSize?: number;
    bancaSize?: number;
    periodo?: { dataInicio: string; dataFim: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runBuscaApreensaoDjenAction({ dias, limite });
      if (!res.success) {
        setError(res.error || "Falha");
        setHits(res.hits || []);
        toast({
          title: "Varredura BA",
          description: res.error || "Falha",
          variant: "destructive",
        });
        return;
      }
      setHits(res.hits || []);
      setMeta({
        scanned: res.scanned,
        carteiraSize: res.carteiraSize,
        filaSize: res.filaSize,
        bancaSize: res.bancaSize,
        periodo: res.periodo,
      });
      toast({
        title: "Varredura concluída",
        description: `${res.hits?.length || 0} BA na carteira · ${res.scanned} CNJs consultados`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-transparent font-sans text-foreground overflow-hidden relative z-10">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden glass-panel">
        <header className="border-b border-border/50 bg-card/60 backdrop-blur-xl p-4 sm:px-8 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-600/10 border-2 border-red-600 flex items-center justify-center">
              <ShieldAlert className="text-red-600" size={20} />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest">
                Busca e Apreensão
              </h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">
                Só processos da sua carteira · DJEN por CNJ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              className="h-10 px-3 rounded-xl border-2 border-border bg-background text-[10px] font-black uppercase"
            >
              <option value={7}>7 dias</option>
              <option value={15}>15 dias</option>
              <option value={30}>30 dias</option>
              <option value={60}>60 dias</option>
            </select>
            <select
              value={limite}
              onChange={(e) => setLimite(Number(e.target.value))}
              className="h-10 px-3 rounded-xl border-2 border-border bg-background text-[10px] font-black uppercase"
              title="Quantos processos da carteira consultar"
            >
              <option value={30}>30 CNJs</option>
              <option value={50}>50 CNJs</option>
              <option value={80}>80 CNJs</option>
              <option value={120}>120 CNJs</option>
            </select>
            <Button
              onClick={run}
              disabled={loading}
              className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Varrer carteira
            </Button>
          </div>
        </header>

        <div className="px-4 sm:px-8 py-3 border-b border-border/40 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase text-muted-foreground">
          {meta && (
            <span>
              Consultados {meta.scanned}/{meta.filaSize} · Carteira {meta.carteiraSize} · Banca{" "}
              {meta.bancaSize}
              {meta.periodo
                ? ` · ${meta.periodo.dataInicio} → ${meta.periodo.dataFim}`
                : ""}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg text-[9px] font-black uppercase"
            onClick={run}
            disabled={loading}
          >
            <RefreshCcw className={cn("h-3 w-3 mr-1", loading && "animate-spin")} />
            Atualizar
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase">
            <Link href="/cases?filter=hoje">Processos de hoje</Link>
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-8 space-y-3">
          {error && (
            <div className="p-4 border-2 border-red-600 rounded-xl bg-red-50 text-sm font-bold text-red-800">
              {error}
            </div>
          )}

          {!loading && hits.length === 0 && !error && (
            <div className="text-center py-20 space-y-2">
              <Gavel className="mx-auto text-muted-foreground" size={32} />
              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                Nenhum BA na carteira neste período
              </p>
              <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                A varredura consulta apenas os processos da sua empresa no DJEN
                (não publica de terceiros). Clique em <strong>Varrer carteira</strong>.
              </p>
            </div>
          )}

          {hits.map((h) => (
            <div
              key={h.id}
              className="border-2 border-red-600 rounded-xl p-4 sm:p-5 bg-card/50 space-y-3 shadow-[4px_4px_0_#dc2626]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-red-600 text-white font-black uppercase text-[8px]">
                      {h.motivoBa}
                    </Badge>
                    {h.tribunal && (
                      <Badge variant="outline" className="font-mono text-[8px]">
                        {h.tribunal}
                      </Badge>
                    )}
                  </div>
                  <p className="font-black text-sm uppercase">{h.cliente || "—"}</p>
                  <p className="font-mono text-xs font-bold">{h.processo}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">
                    {h.data || "—"} · {h.orgao || "Órgão n/d"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {h.processo && (
                    <Button asChild variant="outline" size="sm" className="rounded-xl text-[9px] font-black uppercase">
                      <Link href={`/cases?search=${encodeURIComponent(h.processo)}`}>
                        Abrir processo
                      </Link>
                    </Button>
                  )}
                  {h.link && (
                    <Button asChild variant="outline" size="sm" className="rounded-xl text-[9px] font-black uppercase">
                      <a href={h.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={12} className="mr-1" /> DJEN
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {h.matches.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {h.matches.map((m, i) => (
                    <Badge key={i} variant="secondary" className="font-black uppercase text-[8px] gap-1">
                      {m.tipo === "cliente" && <User size={10} />}
                      {m.tipo === "advogado_banca" && <Briefcase size={10} />}
                      {m.tipo === "advogado_processo" && <Gavel size={10} />}
                      {m.tipo.replace(/_/g, " ")}: {m.nome}
                    </Badge>
                  ))}
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap line-clamp-6">
                {h.trecho}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
