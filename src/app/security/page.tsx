"use client";

/**
 * Segurança — Security Center com os motores:
 * Code Security · OWASP Top 10 · Trail of Bits · Security Review · Audit Codebase · Ponytail.
 * Acesso restrito a Superadmin.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { checkIfSuperAdmin, checkIfSupervisor } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Bug,
  ScanSearch,
  FileSearch,
  Search,
  Gauge,
  FileDown,
  Download,
  RefreshCw,
  Lock, Crosshair, Swords, Terminal } from "lucide-react";
import {
  runSecurityScanAction,
  exportSecurityXlsxAction,
} from "@/app/actions/security-actions"
import { runLiveIntrusionProbeAction } from "@/app/actions/security-live-actions";
import { gerarPecaTextoPDFAction } from "@/app/actions/document-actions";
import { downloadBase64File } from "@/lib/download-export";

type MotorId = "code" | "owasp" | "tob" | "review" | "audit" | "ponytail" | "all";

const MOTORES: { id: MotorId; title: string; desc: string; icon: any }[] = [
  { id: "code", title: "Code Security", desc: "Análise estática: segredos, injection, XSS, execução de comandos, criptografia fraca.", icon: Bug },
  { id: "owasp", title: "OWASP Security", desc: "Mapeamento OWASP Top 10 (2021) com evidências do próprio codebase.", icon: ShieldCheck },
  { id: "tob", title: "Trail of Bits", desc: "Revisão profunda de segurança: auth, escopo, headers, segredos, dependências.", icon: ScanSearch },
  { id: "review", title: "Security Review", desc: "Score de exposição, grade A–F, top achados e recomendações priorizadas.", icon: FileSearch },
  { id: "audit", title: "Audit Codebase", desc: "Auditoria completa do repositório: segurança + engenharia.", icon: Search },
  { id: "ponytail", title: "Ponytail", desc: "Auditoria de over-engineering: código morto, duplicação, dependências não usadas.", icon: Gauge },
];

const SEV_TONE: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-500 text-black",
  low: "bg-yellow-200 text-black",
  info: "bg-muted text-muted-foreground",
};

const STATUS_TONE: Record<string, string> = {
  PASS: "bg-emerald-600 text-white",
  WARN: "bg-amber-500 text-black",
  REVIEW: "bg-blue-500 text-white",
  FAIL: "bg-red-600 text-white",
};

function statusBadge(status?: string) {
  return status ? (
    <Badge className={cn("text-[9px] uppercase", STATUS_TONE[status] || "bg-muted text-muted-foreground")}>
      {status}
    </Badge>
  ) : null;
}

export default function SecurityPage() {
  const { profile, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [results, setResults] = useState<Record<string, any>>({});
  const [running, setRunning] = useState<MotorId | null>(null);
  const [exporting, setExporting] = useState(false);
  const [liveRunning, setLiveRunning] = useState(false);
  const [liveReport, setLiveReport] = useState<any>(null);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const { toast } = useToast();

  React.useEffect(() => {
    if (authLoading || !profile) return;
    try {
      setIsAdmin(!!checkIfSuperAdmin(profile));
    } catch {
      setIsAdmin(false);
    }
  }, [authLoading, profile]);

  const runMotor = async (id: MotorId) => {
    setRunning(id);
    const res = await runSecurityScanAction(id);
    setRunning(null);
    if (!res?.success) {
      toast({ title: "Erro no motor", description: res?.error || "Falha ao executar.", variant: "destructive" });
      return;
    }
    setResults((prev) => ({ ...prev, [id]: res.result }));
    const total = res.result?.total ?? res.result?.totalFindings;
    if (typeof total === "number") {
      toast({ title: `${(MOTORES.find((m) => m.id === id)?.title) || "Varredura"} concluída`, description: `${total} achado(s).` });
    }
  };

  const runLiveProbe = async () => {
    setLiveRunning(true);
    setLiveLog(["[…] Inicializando sonda ativa (somente Superadmin)…"]);
    setLiveReport(null);
    try {
      const res = await runLiveIntrusionProbeAction();
      if (!res?.success) {
        toast({ title: "Sonda bloqueada", description: res?.error || "Falha", variant: "destructive" });
        setLiveLog((l) => [...l, `[ERR] ${res?.error || "Falha"}`]);
        return;
      }
      setLiveReport(res.report);
      setLiveLog(res.report.narrative || []);
      const s = res.report.summary;
      toast({
        title: s.FAIL ? "Pentest: falhas encontradas" : "Pentest: defesas resistiram",
        description: res.report.executiveSummary || `PASS ${s.PASS} · FAIL ${s.FAIL} · WARN ${s.WARN}`,
        variant: s.FAIL ? "destructive" : "default",
      });
    } catch (e: any) {
      toast({ title: "Erro na sonda", description: e?.message || "Falha", variant: "destructive" });
    } finally {
      setLiveRunning(false);
    }
  };

  const exportar = async (tipo: "xlsx" | "pdf") => {

    setExporting(true);
    try {
      if (tipo === "xlsx") {
        const res = await exportSecurityXlsxAction();
        if (!res?.success) throw new Error(res?.error || "Falha ao exportar.");
        const a = document.createElement("a");
        a.href = `data:${res.mime};base64,${res.base64}`;
        a.download = res.filename;
        a.click();
        toast({ title: "Exportado", description: res.filename });
      } else {
        const full = results.all || results.audit || results.code;
        if (!full) {
          toast({ title: "Execute a varredura completa primeiro", variant: "destructive" });
          return;
        }
        const texto = buildReportText(results);
        const res = await gerarPecaTextoPDFAction({ texto, titulo: "Security Report" });
        if (!res?.success) throw new Error(res?.error || "Falha ao gerar PDF.");
        downloadBase64File(res.base64, `security-report-${new Date().toISOString().slice(0, 10)}.pdf`, "application/pdf");
        toast({ title: "PDF gerado", description: "Relatório de segurança baixado." });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const review = results.review || results.all?.review;

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Faça login para acessar.</p>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Acesso restrito a Superadmin.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <ShieldAlert className="h-6 w-6 text-primary" /> Segurança
                </h1>
                <p className="text-xs text-muted-foreground">
                  Motores de análise estática do codebase: Code Security, OWASP, Trail of Bits, Review, Audit e Ponytail.
                </p>
              </div>
              {review && (
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="gap-1 text-[10px] uppercase">
                    <Lock className="h-3 w-3 text-primary" /> Score: {review.score}/100
                  </Badge>
                  <Badge className={cn("text-[10px] uppercase", review.grade === "A" || review.grade === "B" ? "bg-emerald-600 text-white" : review.grade === "C" ? "bg-amber-500 text-black" : "bg-red-600 text-white")}>
                    Grade {review.grade}
                  </Badge>
                  {statusBadge(review.status)}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => runMotor("all")} disabled={!!running}>
                {running === "all" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                Executar tudo
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportar("xlsx")} disabled={exporting || !Object.keys(results).length}>
                {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
                Exportar XLSX
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportar("pdf")} disabled={exporting || !Object.keys(results).length}>
                {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                Relatório PDF
              </Button>
            </div>

                        {/* Sonda ativa — quebra defesas ao vivo (mesmo origin) */}
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-red-600 dark:text-red-400">
                    <Swords className="h-4 w-4" /> Intrusão controlada (ao vivo)
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-2xl">
                    Agente de sonda ativa: tenta quebrar headers, guarda de login, arquivos sensíveis e clickjacking
                    <strong> apenas no próprio domínio</strong>. Não é pentest externo genérico — valida se as correções
                    estão de pé em produção. Somente Superadmin.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  disabled={liveRunning}
                  onClick={runLiveProbe}
                >
                  {liveRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                  {liveRunning ? "Pentest em curso…" : "Executar pentest controlado"}
                </Button>
              </div>
              {liveReport?.executiveSummary ? (
                <div className="rounded-xl border border-border bg-card p-4 text-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Resumo executivo</p>
                  <p className="leading-relaxed">{liveReport.executiveSummary}</p>
                  {liveReport.findings?.length ? (
                    <p className="mt-2 text-[11px] text-red-600 font-bold">
                      {liveReport.findings.length} achado(s) acionável(is) — veja Ataque / Impacto / Proteger abaixo.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {liveLog.length > 0 && (
                <div className="rounded-lg bg-slate-950 text-slate-100 p-3 font-mono text-[11px] max-h-40 overflow-y-auto space-y-0.5">
                  <div className="flex items-center gap-1 text-slate-400 mb-1"><Terminal className="h-3 w-3" /> Console</div>
                  {liveLog.map((line, i) => (
                    <div key={i} className={
                      line.includes("[FAIL]") ? "text-red-400" :
                      line.includes("[PASS]") ? "text-emerald-400" :
                      line.includes("[ERR]") ? "text-orange-400" : "text-slate-300"
                    }>{line}</div>
                  ))}
                </div>
              )}
              {liveReport?.steps?.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {liveReport.steps.map((st: any) => (
                    <div key={st.id} className="rounded-lg border border-border/60 bg-background/80 p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge className={
                          st.status === "PASS" ? "bg-emerald-600 text-white" :
                          st.status === "FAIL" ? "bg-red-600 text-white" :
                          st.status === "WARN" ? "bg-amber-500 text-black" :
                          "bg-muted text-muted-foreground"
                        }>{st.status}</Badge>
                        <span className="font-bold">{st.title}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{st.detail}</p>
                      {st.severity && st.status !== "PASS" ? (
                        <Badge variant="outline" className="mt-1 text-[9px] uppercase">{st.severity}</Badge>
                      ) : null}
                      {st.attack ? (
                        <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed">
                          <p><span className="font-black uppercase text-red-600">Ataque: </span>{st.attack}</p>
                          {st.impact ? <p><span className="font-black uppercase text-amber-600">Impacto: </span>{st.impact}</p> : null}
                          {st.reproduction ? <p className="font-mono text-[10px] bg-muted/50 p-2 rounded"><span className="font-black uppercase not-italic">Reproduzir: </span>{st.reproduction}</p> : null}
                          {(st.remediation || st.fix) ? <p><span className="font-black uppercase text-emerald-600">Proteger: </span>{st.remediation || st.fix}</p> : null}
                          {st.evidence ? <p className="text-muted-foreground">Evidência: {st.evidence}</p> : null}
                        </div>
                      ) : st.fix ? (
                        <p className="mt-0.5 text-emerald-600 dark:text-emerald-400 text-[11px]">Fix: {st.fix}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {MOTORES.map((m) => {
                const r = results[m.id];
                const Icon = m.icon;
                const counts = r?.counts;
                const status = r?.status;
                return (
                  <Card key={m.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" /> {m.title}
                        {r && statusBadge(status || motorStatus(r))}
                      </CardTitle>
                      <CardDescription className="text-[11px]">{m.desc}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-2">
                      {r ? (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(counts || {}).filter(([k, v]) => (v as number) > 0).map(([k, v]) => (
                            <Badge key={k} className={cn("text-[9px] uppercase", SEV_TONE[k] || "bg-muted text-muted-foreground")}>
                              {k === "moderate" ? "média" : k} {String(v)}
                            </Badge>
                          ))}
                          {typeof r.total === "number" && (
                            <Badge variant="outline" className="text-[9px] uppercase">{r.total} total</Badge>
                          )}
                          {typeof r.scannedFiles === "number" && (
                            <Badge variant="outline" className="text-[9px] uppercase">{r.scannedFiles} arquivos</Badge>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Não executado ainda.</p>
                      )}
                      <div className="mt-auto pt-2">
                        <Button size="sm" variant="outline" className="w-full" onClick={() => runMotor(m.id)} disabled={!!running}>
                          {running === m.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                          {r ? "Reexecutar" : "Executar"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {results.all && (
              <Card className="border-primary/40">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Resultado — Varredura completa
                    <Badge variant="outline" className="ml-auto text-[9px] uppercase">{results.all.scannedFiles} arquivos</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ReviewPanel review={results.all.review} />
                  <FindingsPanel title="Code Security" findings={results.all.engines?.codeSecurity?.findings || []} total={results.all.engines?.codeSecurity?.total} />
                  <OwaspPanel categories={results.all.engines?.owasp?.categories || []} />
                  <TobPanel checks={results.all.engines?.trailOfBits?.checks || []} />
                  <FindingsPanel title="Ponytail" findings={results.all.engines?.ponytail?.findings || []} total={results.all.engines?.ponytail?.total} />
                </CardContent>
              </Card>
            )}

            {!results.all && Object.keys(results).filter((k) => k !== "all").map((id) => {
              const r = results[id];
              return (
                <Card key={id}>
                  <CardHeader>
                    <CardTitle className="text-sm">{MOTORES.find((m) => m.id === id)?.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {id === "owasp" ? <OwaspPanel categories={r?.categories || []} />
                      : id === "tob" ? <TobPanel checks={r?.checks || []} />
                      : id === "review" ? <ReviewPanel review={r} />
                      : <FindingsPanel title="" findings={r?.findings || []} total={r?.total} />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}

function motorStatus(r: any): string {
  if (r?.status) return r.status;
  if (r?.counts) {
    if (r.counts.critical || r.counts.high) return "FAIL";
    if (r.counts.medium) return "WARN";
    if (r.counts.low || r.counts.info) return "REVIEW";
    return "PASS";
  }
  return "REVIEW";
}

function ReviewPanel({ review }: { review: any }) {
  if (!review) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn("text-[10px] uppercase", review.grade === "A" || review.grade === "B" ? "bg-emerald-600 text-white" : review.grade === "C" ? "bg-amber-500 text-black" : "bg-red-600 text-white")}>
          Grade {review.grade}
        </Badge>
        <Badge variant="outline" className="text-[10px] uppercase">Score {review.score}/100</Badge>
        {statusBadge(review.status)}
        <Badge variant="outline" className="text-[10px] uppercase">{review.totalFindings} achados</Badge>
        <Badge variant="outline" className="text-[10px] uppercase">{review.owaspFail} OWASP com falha</Badge>
      </div>
      {review.recommendations?.length ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-xs space-y-1">
          <p className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">Recomendações prioritárias</p>
          {review.recommendations.map((r: string, i: number) => (
            <p key={i} className="flex gap-2"><span className="text-primary font-black">{i + 1}.</span> {r}</p>
          ))}
        </div>
      ) : null}
      {review.top?.length ? (
        <div className="rounded-xl border border-border/70 p-3 text-xs space-y-1">
          <p className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">Top achados</p>
          {review.top.map((t: any, i: number) => (
            <p key={i} className="flex items-center gap-2">
              <Badge className={cn("text-[8px] uppercase", SEV_TONE[t.severity])}>{t.severity}</Badge>
              <span className="font-mono">{t.file}:{t.line}</span>
              <span className="text-muted-foreground">{t.label}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FindingsPanel({ title, findings, total }: { title: string; findings: any[]; total?: number }) {
  if (!findings.length) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
        <p className="font-black uppercase tracking-widest text-[10px] text-emerald-600 dark:text-emerald-400">
          {title || "Resultado"} — nenhum achado
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">
          {title || "Achados"} {typeof total === "number" ? `(${total})` : `(${findings.length})`}
        </p>
      </div>
      <ScrollArea className="h-[320px] pr-2">
        <div className="space-y-1.5">
          {findings.map((f, i) => (
            <div key={i} className="rounded-lg border border-border/70 p-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("text-[8px] uppercase", SEV_TONE[f.severity] || "bg-muted text-muted-foreground")}>{f.severity || "info"}</Badge>
                <span className="font-mono text-[11px]">{f.file}:{f.line}</span>
                <span className="font-bold">{f.label}</span>
              </div>
              {f.match ? <p className="mt-1 text-muted-foreground font-mono text-[10px] break-all">{String(f.match).slice(0, 140)}</p> : null}
              {f.fix ? <p className="mt-0.5 text-emerald-600 dark:text-emerald-400 text-[11px]">Fix: {f.fix}</p> : null}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function OwaspPanel({ categories }: { categories: any[] }) {
  if (!categories.length) {
    return <p className="text-xs text-muted-foreground">Sem categorias.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">OWASP Top 10</p>
      <div className="space-y-1.5">
        {categories.map((c) => (
          <div key={c.id} className="rounded-lg border border-border/70 p-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(c.status)}
              <span className="font-black">{c.id} {c.name}</span>
            </div>
            <p className="mt-1 text-muted-foreground">{c.summary}</p>
            {c.evidence?.length ? (
              <div className="mt-1 space-y-0.5">
                {c.evidence.map((e: string, i: number) => (
                  <p key={i} className="font-mono text-[10px] text-muted-foreground/80">• {e}</p>
                ))}
              </div>
            ) : null}
            {c.recommendation ? <p className="mt-1 text-emerald-600 dark:text-emerald-400">Recomendação: {c.recommendation}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function TobPanel({ checks }: { checks: any[] }) {
  if (!checks.length) {
    return <p className="text-xs text-muted-foreground">Sem checks.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">Trail of Bits — revisão profunda</p>
      <div className="space-y-1.5">
        {checks.map((c, i) => (
          <div key={i} className="rounded-lg border border-border/70 p-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(c.status)}
              <span className="font-bold">{c.title}</span>
            </div>
            <p className="mt-1 text-muted-foreground">{c.detail}</p>
            {c.files?.length ? (
              <div className="mt-1 space-y-0.5">
                {c.files.map((f: string, j: number) => (
                  <p key={j} className="font-mono text-[10px] text-muted-foreground/80">• {f}</p>
                ))}
              </div>
            ) : null}
            {c.fix ? <p className="mt-1 text-emerald-600 dark:text-emerald-400">Fix: {c.fix}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildReportText(results: Record<string, any>): string {
  const L: string[] = [];
  const review = results.all?.review || results.review;
  if (review) {
    L.push(`SCORE DE EXPOSICAO: ${review.score}/100 (grade ${review.grade}) — ${review.status}`);
    L.push(`Total de achados: ${review.totalFindings}`);
    L.push(`Categorias OWASP com falha: ${review.owaspFail}`);
    L.push("");
    if (review.recommendations?.length) {
      L.push("RECOMENDACOES PRIORITARIAS:");
      review.recommendations.forEach((r: string, i: number) => L.push(`${i + 1}. ${r}`));
      L.push("");
    }
  }

  const codeFindings = results.all?.engines?.codeSecurity?.findings || results.code?.findings || [];
  if (codeFindings.length) {
    L.push("ACHADOS — CODE SECURITY:");
    for (const f of codeFindings.slice(0, 60)) {
      L.push(`[${f.severity.toUpperCase()}] ${f.file}:${f.line} — ${f.label}`);
      if (f.match) L.push(`    Trecho: ${String(f.match).slice(0, 100)}`);
      if (f.fix) L.push(`    Fix: ${f.fix}`);
    }
    L.push("");
  }

  const cats = results.all?.engines?.owasp?.categories || results.owasp?.categories || [];
  if (cats.length) {
    L.push("OWASP TOP 10:");
    for (const c of cats) L.push(`${c.id} ${c.name}: ${c.status} — ${c.summary}`);
    L.push("");
  }

  const checks = results.all?.engines?.trailOfBits?.checks || results.tob?.checks || [];
  if (checks.length) {
    L.push("TRAIL OF BITS — REVISAO PROFUNDA:");
    for (const c of checks) L.push(`${c.status} — ${c.title}: ${c.detail}`);
    L.push("");
  }

  const pony = results.all?.engines?.ponytail?.findings || results.ponytail?.findings || results.audit?.findings || [];
  if (pony.length) {
    L.push("PONYTAIL — AUDITORIA DE ENGENHARIA:");
    for (const f of pony.slice(0, 60)) {
      L.push(`[${f.severity.toUpperCase()}] ${f.file}:${f.line} — ${f.label}`);
      if (f.fix) L.push(`    Fix: ${f.fix}`);
    }
  }

  return L.join("\n");
}
