
"use client";

/**
 * Radar de litigância / advocacia potencialmente predatória
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert,
  Search,
  ExternalLink,
  Loader2,
  Info,
  Scale,
} from "lucide-react";
import { JudicialNumpad } from "@/components/ui/judicial-numpad";
import {
  analisarAdvogadoPredatoriaAction,
  analisarTextoPredatoriaAction,
  type PredatoriaReport,
} from "@/app/actions/predatoria-actions";
import { cn } from "@/lib/utils";
import Link from "next/link";

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export default function InvestigacaoPredatoriaPage() {
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [oabUf, setOabUf] = useState("SP");
  const [oabNumero, setOabNumero] = useState("");
  const [textoLivre, setTextoLivre] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<PredatoriaReport | null>(null);
  const [textRisk, setTextRisk] = useState<any>(null);

  const run = async () => {
    if (!nome.trim() && !oabNumero.trim()) {
      toast({
        title: "Informe nome ou OAB",
        description: "Pelo menos um dos dois é necessário.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setReport(null);
    try {
      const r = await analisarAdvogadoPredatoriaAction({
        nome: nome.trim() || undefined,
        oabUf,
        oabNumero,
      });
      setReport(r);
      if (!r.success) {
        toast({ title: "Falha", description: r.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const runText = async () => {
    if (!textoLivre.trim()) return;
    setLoading(true);
    try {
      const r = await analisarTextoPredatoriaAction(textoLivre);
      setTextRisk(r.risk);
    } finally {
      setLoading(false);
    }
  };

  const bandColor = (b?: string) =>
    b === "critico"
      ? "bg-red-600 text-white"
      : b === "elevado"
        ? "bg-orange-500 text-white"
        : b === "atencao"
          ? "bg-amber-100 text-amber-900"
          : "bg-emerald-100 text-emerald-900";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <header className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="text-primary" size={22} />
              <h1 className="text-xl font-semibold tracking-tight">
                Radar de litigância predatória
              </h1>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Ferramenta operacional para cruzar <strong>nome/OAB</strong> com a{" "}
              <strong>sua carteira</strong> e textos já capturados (DataJud/DJEN).
              Não existe API pública que liste advogados sob investigação disciplinar
              sigilosa na OAB — este painel <strong>não inventa</strong> isso.
            </p>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-950 dark:text-amber-100 flex gap-2">
              <Info size={16} className="shrink-0 mt-0.5" />
              <span>
                Uso legítimo: proteção da banca e triagem de risco em processos da
                carteira. Não use para assédio, doxxing ou exposição indevida de
                profissionais.
              </span>
            </div>
          </header>

          <section className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Scale size={16} /> Consulta por advogado
              </h2>
              <div className="space-y-2">
                <Label>Nome do advogado</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: MARIA SILVA"
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label>UF OAB</Label>
                  <select
                    className="w-full h-10 rounded-xl border border-input bg-background px-2 text-sm"
                    value={oabUf}
                    onChange={(e) => setOabUf(e.target.value)}
                  >
                    {UFS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Número OAB</Label>
                  <Input
                    value={oabNumero}
                    onChange={(e) => setOabNumero(e.target.value.replace(/\D/g, "").slice(0, 7))}
                    placeholder="123456"
                    className="rounded-xl font-mono"
                  />
                </div>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Numpad (OAB) — útil no tablet
                </p>
                <JudicialNumpad
                  mode="oab"
                  value={oabNumero}
                  onChange={setOabNumero}
                />
              </div>
              <Button
                className="w-full h-11 rounded-xl font-semibold gap-2"
                onClick={() => void run()}
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                Analisar carteira + CNA
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold">Colar despacho / DJEN</h2>
              <Textarea
                value={textoLivre}
                onChange={(e) => setTextoLivre(e.target.value)}
                placeholder="Cole aqui trecho de sentença, despacho ou publicação que mencione predatória, OAB, NUMOPEDE…"
                className="min-h-[140px] rounded-xl text-sm"
              />
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => void runText()}
                disabled={loading || !textoLivre.trim()}
              >
                Escanear texto
              </Button>
              {textRisk && (
                <div className="space-y-2">
                  <Badge className={cn("text-[10px] uppercase", bandColor(textRisk.band))}>
                    Score {textRisk.score} · {textRisk.band}
                  </Badge>
                  <p className="text-xs text-muted-foreground">{textRisk.summary}</p>
                  <ul className="text-xs space-y-1">
                    {(textRisk.signals || []).map((s: any) => (
                      <li key={s.code}>
                        • {s.label}
                        {s.evidence ? ` (“${s.evidence}”)` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {report && (
            <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={cn("text-[11px] uppercase px-3 py-1", bandColor(report.risk.band))}>
                  Risco {report.risk.score}/100 · {report.risk.band}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {report.casesMatched} processo(s) na carteira
                </span>
              </div>
              <p className="text-sm leading-relaxed">{report.risk.summary}</p>
              <p className="text-[11px] text-muted-foreground border-l-2 border-border pl-3">
                {report.disclaimer}
              </p>

              {report.oab && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">CNA / OAB:</span>
                  {report.oab.nome && <span>{report.oab.nome}</span>}
                  {report.oab.situacao && (
                    <Badge variant="outline">{report.oab.situacao}</Badge>
                  )}
                  {report.oab.error && (
                    <span className="text-muted-foreground text-xs">{report.oab.error}</span>
                  )}
                  <a
                    href={report.oab.consultaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary text-xs font-semibold hover:underline"
                  >
                    Abrir CNA <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {report.risk.signals.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    Sinais detectados
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {report.risk.signals.map((s) => (
                      <Badge key={s.code} variant="outline" className="text-[10px]">
                        {s.label} (+{s.weight})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {report.hits.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase text-muted-foreground border-b">
                        <th className="py-2 pr-2">Cliente</th>
                        <th className="py-2 pr-2">CNJ</th>
                        <th className="py-2 pr-2">Sinais</th>
                        <th className="py-2">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.hits.map((h) => (
                        <tr key={h.protocolo} className="border-b border-border/40">
                          <td className="py-2 pr-2 font-medium max-w-[160px] truncate">
                            {h.cliente}
                          </td>
                          <td className="py-2 pr-2 font-mono text-[11px]">{h.protocolo}</td>
                          <td className="py-2 pr-2 text-[11px] text-muted-foreground">
                            {h.signals.length
                              ? h.signals.map((s) => s.label).join(", ")
                              : "— volume / vínculo"}
                          </td>
                          <td className="py-2">
                            <Button variant="ghost" size="sm" className="h-8 text-[11px]" asChild>
                              <Link href={`/cases?search=${encodeURIComponent(h.protocolo)}`}>
                                Abrir
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
