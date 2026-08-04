/**
 * Módulo Busca e Apreensão — varredura DJEN + cruzamento carteira/banca
 */
"use client";

import React, { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";

export default function BuscaApreensaoPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<BaHit[]>([]);
  const [onlyMatches, setOnlyMatches] = useState(true);
  const [scanCarteira, setScanCarteira] = useState(false);
  const [dias, setDias] = useState(30);
  const [meta, setMeta] = useState<{
    carteiraSize?: number;
    bancaSize?: number;
    periodo?: { dataInicio: string; dataFim: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runBuscaApreensaoDjenAction({
        dias,
        varreduraCarteira: scanCarteira,
        limiteCarteira: 25,
      });
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
        carteiraSize: res.carteiraSize,
        bancaSize: res.bancaSize,
        periodo: res.periodo,
      });
      const comMatch = (res.hits || []).filter((h) => h.matches.length > 0).length;
      toast({
        title: "Varredura concluída",
        description: `${res.hits?.length || 0} publicações BA · ${comMatch} com match na carteira/banca`,
      });
    } finally {
      setLoading(false);
    }
  };

  const visible = onlyMatches ? hits.filter((h) => h.matches.length > 0) : hits;

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
                DJEN · teor da publicação · cruzamento carteira / banca
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
              Varrer DJEN
            </Button>
          </div>
        </header>

        <div className="px-4 sm:px-8 py-3 border-b border-border/40 flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={onlyMatches}
              onCheckedChange={(v) => setOnlyMatches(!!v)}
            />
            Só com match (cliente / banca / advogado do processo)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={scanCarteira}
              onCheckedChange={(v) => setScanCarteira(!!v)}
            />
            + Varredura CNJ da carteira (até 25 ativos)
          </label>
          {meta && (
            <span className="text-muted-foreground">
              Carteira {meta.carteiraSize} · Banca {meta.bancaSize}
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
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-8 space-y-3">
          {error && (
            <div className="p-4 border-2 border-red-600 rounded-xl bg-red-50 text-sm font-bold text-red-800">
              {error}
            </div>
          )}

          {!loading && visible.length === 0 && !error && (
            <div className="text-center py-20 space-y-2">
              <Gavel className="mx-auto text-muted-foreground" size={32} />
              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                Nenhuma publicação listada
              </p>
              <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                Clique em <strong>Varrer DJEN</strong>. O sistema busca teor
                &quot;busca e apreensão&quot; e cruza com nomes de clientes e
                advogados da sua empresa.
              </p>
            </div>
          )}

          {visible.map((h) => (
            <div
              key={h.id}
              className={cn(
                "border-2 rounded-xl p-4 sm:p-5 bg-card/50 space-y-3",
                h.matches.length > 0 ? "border-red-600 shadow-[4px_4px_0_#dc2626]" : "border-border"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-red-600 text-white font-black uppercase text-[8px]">
                      {h.motivoBa}
                    </Badge>
                    <Badge variant="outline" className="font-black uppercase text-[8px]">
                      {h.fonte === "carteira_cnj" ? "Carteira CNJ" : "Teor DJEN"}
                    </Badge>
                    {h.tribunal && (
                      <Badge variant="outline" className="font-mono text-[8px]">
                        {h.tribunal}
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-xs font-bold">
                    {h.processo || "Processo não informado"}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">
                    {h.data || "—"} · {h.orgao || "Órgão n/d"}
                  </p>
                </div>
                {h.link && (
                  <Button asChild variant="outline" size="sm" className="rounded-xl text-[9px] font-black uppercase">
                    <a href={h.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={12} className="mr-1" /> DJEN
                    </a>
                  </Button>
                )}
              </div>

              {h.matches.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {h.matches.map((m, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="font-black uppercase text-[8px] gap-1"
                    >
                      {m.tipo === "cliente" && <User size={10} />}
                      {m.tipo === "advogado_banca" && <Briefcase size={10} />}
                      {m.tipo === "advogado_processo" && <Gavel size={10} />}
                      {m.tipo.replace("_", " ")}: {m.nome}
                      {m.protocolo ? ` · ${m.protocolo}` : ""}
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
