"use client";

import { LexisChartTooltip } from '@/components/charts/lexis-chart-tooltip';

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * Painel de Supervisão — visão geral da operação (não apenas a última semana).
 * Acessível a Supervisor / Administrador / Superadmin.
 */

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { checkIfSuperAdmin, checkIfSupervisor } from "@/lib/supabase";
import { getSupervisaoSnapshotAction, type SupervisaoSnapshot } from "@/app/actions/supervisao-actions";
import {
  Users,
  Briefcase,
  Activity,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Loader2,
  RefreshCcw,
  Sparkles,
  BarChart3,
  Landmark,
  TrendingUp,
  Gavel,
  MessageSquare,
  CalendarClock,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileDown, Printer } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function KpiCard({ icon, label, value, hint, tone = "default" }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "ok" | "danger" | "warn" | "primary";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    ok: "text-emerald-600 dark:text-emerald-400",
    danger: "text-red-600 dark:text-red-400",
    warn: "text-amber-600 dark:text-amber-400",
    primary: "text-primary",
  };
  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-4 sm:p-5 shadow-sm hover:border-primary/40 transition-all group">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <span className="text-muted-foreground/50 group-hover:text-primary transition-colors">{icon}</span>
      </div>
      <p className={cn("mt-3 text-2xl sm:text-3xl font-black tabular-nums tracking-tight", tones[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60">{hint}</p> : null}
    </div>
  );
}

export default function SupervisaoPage() {
  const { profile, loading: authLoading } = useAuth();
  const [snap, setSnap] = useState<SupervisaoSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const isSupervisor = checkIfSupervisor(profile) || checkIfSuperAdmin(profile);
  const allowed = profile?.cargo === "Supervisor" || profile?.cargo === "Administrador" || checkIfSuperAdmin(profile);

  const load = async () => {
    setLoading(true);
    const res = await getSupervisaoSnapshotAction();
    if (res.success) {
      setSnap(res.snapshot || null);
      setError("");
    } else {
      setError(res.error || "Falha ao carregar.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (allowed && !authLoading) load();
  }, [allowed, authLoading]);

  const handleDownloadPdf = async () => {
    if (!snap) return;
    setPdfLoading(true);
    try {
      const [{ downloadPdf }, { SupervisaoPDF }] = await Promise.all([
        import("@/lib/pdf-download"),
        import("@/components/pdf/supervisao-pdf"),
      ]);
      await downloadPdf(
        <SupervisaoPDF
          data={snap}
          geradoEm={new Date().toLocaleString("pt-BR")}
          auditor={profile?.nome}
        />,
        `Supervisao_Operacional_${new Date().toISOString().slice(0, 10)}`
      );
    } catch (e) {
      console.error("Supervisão PDF:", e);
    } finally {
      setPdfLoading(false);
    }
  };

  if (!authLoading && !allowed) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4 border border-border/60 bg-card/60 rounded-2xl p-10">
            <ShieldCheck className="mx-auto text-muted-foreground/40" size={48} />
            <h1 className="font-black uppercase tracking-tight text-lg">Acesso restrito</h1>
            <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">
              O painel de supervisão está disponível para Supervisor, Administrador e Superadmin.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="shrink-0 border-b border-border/60 glass-header p-4 sm:px-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base tracking-tight uppercase">Painel de Supervisão</h1>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Visão geral da empresa • atendimentos, carteira e sinais
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isSupervisor && (
              <Badge variant="outline" className="h-8 px-3 rounded-xl font-black uppercase text-[8px] border-primary/40 text-primary">
                <Users size={12} className="mr-1.5" /> {profile?.cargo}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={load} className="h-9 rounded-xl" disabled={loading}>
              <RefreshCcw size={14} className={cn("mr-1.5", loading && "animate-spin")} /> Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              disabled={!snap}
              className="h-9 rounded-xl print:hidden"
              title="Gera o relatório completo via impressão/Salvar como PDF do dispositivo"
            >
              <Printer size={14} className="mr-1.5" />
              Imprimir / PDF completo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={!snap || pdfLoading}
              className="h-9 rounded-xl border-primary/40 text-primary hover:bg-primary/10 print:hidden"
            >
              {pdfLoading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <FileDown size={14} className="mr-1.5" />}
              Extrair PDF
            </Button>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-4 sm:p-8 space-y-8 max-w-[1500px] mx-auto w-full">
            {loading && !snap ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
                  Consolidando visão geral da empresa...
                </p>
              </div>
            ) : error && !snap ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center space-y-3">
                <ShieldAlert className="mx-auto text-red-500" size={32} />
                <p className="text-[11px] font-black uppercase text-red-600">{error}</p>
              </div>
            ) : snap && snap.total === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/40 p-16 text-center space-y-4">
                <Briefcase className="mx-auto text-muted-foreground/30" size={48} />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Nenhum processo na carteira da empresa ainda.
                </p>
              </div>
            ) : snap ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                  <KpiCard icon={<Briefcase size={16} />} label="Processos" value={snap.total} tone="primary" />
                  <KpiCard icon={<Activity size={16} />} label="Ativos" value={snap.ativos} />
                  <KpiCard icon={<CheckCircle2 size={16} />} label="Encerrados" value={snap.encerrados} tone="ok" />
                  <KpiCard icon={<ShieldAlert size={16} />} label="Vencidos" value={snap.vencidos} tone={snap.vencidos > 0 ? "danger" : "default"} />
                  <KpiCard icon={<Sparkles size={16} />} label="Novidades" value={snap.novidades} tone={snap.novidades > 0 ? "warn" : "default"} />
                  <KpiCard icon={<Gavel size={16} />} label="B.A." value={snap.ba} tone={snap.ba > 0 ? "danger" : "default"} />
                  <KpiCard icon={<MessageSquare size={16} />} label="Atend. (geral)" value={snap.atendimentosTotais} tone="ok" hint="todos os retornos registrados" />
                  <KpiCard icon={<CalendarClock size={16} />} label="Atend. semana" value={snap.atendidosSemana} tone="primary" hint="última semana" />
                </div>

                <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 premium-card p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <BarChart3 size={16} className="text-primary" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">Atendimentos nas últimas 8 semanas</h3>
                      </div>
                      <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0 border-primary/40 text-primary">Geral</Badge>
                    </div>
                    {snap.timelineSemanal.every((t) => t.atendidos === 0) ? (
                      <div className="py-16 text-center opacity-40 space-y-2">
                        <CalendarClock className="mx-auto" size={40} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Sem retornos registrados nas últimas semanas.</p>
                      </div>
                    ) : (
                      <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={snap.timelineSemanal} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip cursor={{ fill: "hsl(var(--secondary)/0.4)" }} content={<LexisChartTooltip />} />
                            <Bar dataKey="atendidos" name="Atendidos" radius={[6, 6, 0, 0]} maxBarSize={42}>
                              {snap.timelineSemanal.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  <div className="premium-card p-5 sm:p-6 space-y-6">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={16} className="text-primary" />
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">Distribuição por tribunal</h3>
                    </div>
                    {snap.porTribunal.length === 0 ? (
                      <p className="text-[10px] font-black uppercase text-muted-foreground/50 text-center py-10">Sem dados.</p>
                    ) : (
                      <div className="space-y-3">
                        {snap.porTribunal.slice(0, 6).map((t, i) => {
                          const pct = Math.round((t.value / snap.total) * 100);
                          return (
                            <div key={t.label} className="space-y-1.5">
                              <div className="flex items-center justify-between text-[9px] font-black uppercase">
                                <span className="truncate pr-2">{t.label}</span>
                                <span className="tabular-nums">{t.value} ({pct}%)</span>
                              </div>
                              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>

                <section className="premium-card overflow-hidden">
                  <div className="bg-secondary/50 dark:bg-card/70 px-5 sm:px-7 py-4 border-b border-border/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-primary" />
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">Operadores • desempenho geral</h3>
                    </div>
                    <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0 border-primary/40 text-primary">
                      {snap.operadores.length} responsáveis
                    </Badge>
                  </div>
                  <ScrollArea className="max-h-[420px]">
                    <table className="w-full text-left min-w-[720px]">
                      <thead className="bg-secondary/40 dark:bg-card/60 border-b border-border/20 sticky top-0">
                        <tr className="text-[9px] font-black uppercase text-muted-foreground/70 tracking-widest">
                          <th className="px-6 py-3">Responsável</th>
                          <th className="px-4 py-3 text-right">Processos</th>
                          <th className="px-4 py-3 text-right">Ativos</th>
                          <th className="px-4 py-3 text-right">Vencidos</th>
                          <th className="px-4 py-3 text-right">Novidades</th>
                          <th className="px-4 py-3 text-right">Atend. geral</th>
                          <th className="px-4 py-3 text-right">Atend. semana</th>
                          <th className="px-6 py-3 text-right">Sem retorno</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/10">
                        {snap.operadores.map((op) => (
                          <tr key={op.nome} className="hover:bg-secondary/10 transition-colors group">
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-[10px] uppercase shrink-0">
                                  {op.nome.slice(0, 2)}
                                </div>
                                <span className="text-[11px] font-black uppercase group-hover:text-primary transition-colors">{op.nome}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-black tabular-nums">{op.total}</td>
                            <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">{op.ativos}</td>
                            <td className={cn("px-4 py-3 text-right text-sm font-black tabular-nums", op.vencidos > 0 ? "text-red-600 dark:text-red-400" : "")}>{op.vencidos}</td>
                            <td className={cn("px-4 py-3 text-right text-sm font-black tabular-nums", op.novidades > 0 ? "text-amber-600 dark:text-amber-400" : "")}>{op.novidades}</td>
                            <td className="px-4 py-3 text-right text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">{op.atendimentos}</td>
                            <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">{op.atendidosSemana}</td>
                            <td className={cn("px-6 py-3 text-right text-sm font-black tabular-nums", op.semRetorno > 0 ? "text-red-600 dark:text-red-400" : "")}>{op.semRetorno}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </section>


                {/* Processos separados por usuário do sistema */}
                <section className="premium-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-primary" />
                      <div>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.18em]">Processos por usuário</h3>
                        <p className="text-[9px] text-muted-foreground font-medium">
                          Carteira separada por quem cadastrou / é dono do registro (created_by)
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-black uppercase">
                      {(snap.porUsuario || []).length} usuários
                    </Badge>
                  </div>
                  <div className="divide-y divide-border/30">
                    {(snap.porUsuario || []).length === 0 ? (
                      <p className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">
                        Nenhum agrupamento disponível
                      </p>
                    ) : (
                      (snap.porUsuario || []).map((ug: any) => (
                        <details key={ug.key} className="group">
                          <summary className="cursor-pointer list-none px-5 py-4 flex flex-wrap items-center gap-3 hover:bg-secondary/20 transition-colors">
                            <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-black shrink-0">
                              {String(ug.nome || "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-black uppercase tracking-tight truncate">{ug.nome}</p>
                              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                                {ug.total} processos · {ug.ativos} ativos · {ug.atendidosSemana} atend. semana
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase">
                              {ug.vencidos > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-red-500/15 text-red-600 border border-red-500/25">{ug.vencidos} venc.</span>
                              )}
                              {ug.novidades > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 border border-amber-500/25">{ug.novidades} nov.</span>
                              )}
                              <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                            </div>
                          </summary>
                          <div className="px-3 pb-4 overflow-x-auto">
                            <table className="w-full text-left min-w-[640px]">
                              <thead>
                                <tr className="text-[8px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/30">
                                  <th className="px-3 py-2">Cliente</th>
                                  <th className="px-3 py-2">Protocolo</th>
                                  <th className="px-3 py-2">Status</th>
                                  <th className="px-3 py-2">Último retorno</th>
                                  <th className="px-3 py-2">Tribunal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/15">
                                {(ug.processos || []).map((p: any) => (
                                  <tr key={p.id || p.protocolo} className="text-[10px] hover:bg-secondary/10">
                                    <td className="px-3 py-2 font-bold uppercase max-w-[180px] truncate">{p.cliente}</td>
                                    <td className="px-3 py-2 font-mono text-[9px]">{p.protocolo}</td>
                                    <td className="px-3 py-2">
                                      <span className="text-[8px] font-black uppercase tracking-wide">{p.status}</span>
                                    </td>
                                    <td className="px-3 py-2 tabular-nums">{p.ultimoRetorno}</td>
                                    <td className="px-3 py-2 truncate max-w-[100px]">{p.tribunal}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      ))
                    )}
                  </div>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="premium-card p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Landmark size={15} className="text-primary" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Por status</h3>
                    </div>
                    {snap.porStatus.map((x, i) => (
                      <div key={x.label} className="flex items-center justify-between text-[9px] font-black uppercase border-b border-border/10 last:border-0 py-2">
                        <span className="truncate pr-2">{x.label}</span>
                        <span className="tabular-nums">{x.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="premium-card p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Briefcase size={15} className="text-primary" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Por escritório</h3>
                    </div>
                    {snap.porEscritorio.map((x, i) => (
                      <div key={x.label} className="flex items-center justify-between text-[9px] font-black uppercase border-b border-border/10 last:border-0 py-2">
                        <span className="truncate pr-2">{x.label}</span>
                        <span className="tabular-nums">{x.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="premium-card p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock size={15} className="text-primary" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Sinais de atenção</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-center">
                        <p className="text-2xl font-black text-red-600 dark:text-red-400 tabular-nums">{snap.vencidos}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Vencidos</p>
                      </div>
                      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{snap.ba}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">B.A.</p>
                      </div>
                      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{snap.novidades}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Novidades</p>
                      </div>
                      <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-center">
                        <p className="text-2xl font-black text-red-600 dark:text-red-400 tabular-nums">{snap.semRetorno}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Sem retorno</p>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : null}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
