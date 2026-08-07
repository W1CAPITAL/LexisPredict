"use client";

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * Processos da Empresa — todos os perfis enxergam todos os processos da empresa
 * e a trilha de auditoria: quem atendeu, quem editou, quem apagou.
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { fetchCompanyProcessosAction } from "@/app/actions/case-actions";
import { countAtendidosNestaSemana, labelSemanaAtual } from "@/lib/atendimento-semana";
import { isCasoEncerrado } from "@/lib/status-encerrado";
import { LegalCase } from "@/lib/case-logic";
import {
  Briefcase,
  Activity,
  CheckCircle2,
  ShieldAlert,
  CalendarClock,
  Search,
  Loader2,
  RefreshCcw,
  Eye,
  Pencil,
  Trash2,
  PhoneCall,
  FilePlus2,
  Users,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type AuditEntry = {
  id: string;
  user_nome?: string;
  action?: string;
  protocolo_ref?: string;
  created_at?: string;
  detalhes?: any;
};

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
  atendimento: { label: "Atendeu", icon: <PhoneCall size={13} />, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" },
  edicao: { label: "Editou", icon: <Pencil size={13} />, tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25" },
  exclusao: { label: "Apagou", icon: <Trash2 size={13} />, tone: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25" },
  criacao: { label: "Criou", icon: <FilePlus2 size={13} />, tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/25" },
};

function statusTone(status?: string) {
  if (!status) return "bg-muted text-muted-foreground border-border";
  if (status === "Vencido" || status === "Caso Crítico") return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25";
  if (status === "É Hoje") return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25";
  if (status === "Atenção") return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25";
  if (status === "No Prazo") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
  return "bg-muted text-muted-foreground border-border";
}

function Kpi({ icon, label, value, hint, tone = "default" }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "ok" | "danger" | "primary";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    ok: "text-emerald-600 dark:text-emerald-400",
    danger: "text-red-600 dark:text-red-400",
    primary: "text-primary",
  };
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md p-4 sm:p-5 shadow-sm hover:border-primary/40 transition-all">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <span className="text-muted-foreground/50">{icon}</span>
      </div>
      <p className={cn("mt-3 text-2xl sm:text-3xl font-black tabular-nums tracking-tight", tones[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60">{hint}</p> : null}
    </div>
  );
}

export default function ProcessosEmpresaPage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<{ auth_user_id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetchCompanyProcessosAction();
    setCases(res.cases || []);
    setAudit(res.audit || []);
    setUsers(res.users || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const nomeByAuth = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.auth_user_id, u.nome);
    return m;
  }, [users]);

  const atendidosSemana = useMemo(() => countAtendidosNestaSemana(cases), [cases]);
  const ativos = useMemo(() => cases.filter((c) => !isCasoEncerrado(c)), [cases]);
  const vencidos = useMemo(() => ativos.filter((c) => c.status === "Vencido" || c.status === "Caso Crítico"), [ativos]);

  const lastByProtocolo = useMemo(() => {
    const m = new Map<string, AuditEntry>();
    for (const a of audit) {
      const p = String(a.protocolo_ref || "");
      if (p && !m.has(p)) m.set(p, a);
    }
    return m;
  }, [audit]);

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();
    return cases.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (!query) return true;
      return [c.cliente, c.protocolo, c.advogado, c.escritorio, c.tribunal, String(c.status)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query));
    });
  }, [cases, q, statusFilter]);

  const recentFeed = useMemo(() => audit.slice(0, 24), [audit]);

  const fmtTime = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
      " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

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
              <h1 className="font-black text-sm sm:text-base tracking-tight uppercase">Processos da Empresa</h1>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Visão geral da carteira • quem atendeu, editou e apagou
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="h-8 px-3 rounded-xl font-black uppercase text-[8px] border-primary/40 text-primary">
              <Users size={12} className="mr-1.5" /> {profile?.cargo}
            </Badge>
            <button
              onClick={load}
              className="h-9 rounded-xl border border-border/60 bg-card/60 hover:bg-card text-foreground px-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider transition-colors"
            >
              <RefreshCcw size={14} className={cn(loading && "animate-spin")} /> Atualizar
            </button>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-4 sm:p-8 space-y-8 max-w-[1500px] mx-auto w-full">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={<Briefcase size={16} />} label="Processos" value={loading ? "…" : cases.length} tone="primary" />
              <Kpi icon={<Activity size={16} />} label="Ativos" value={loading ? "…" : ativos.length} />
              <Kpi icon={<CalendarClock size={16} />} label="Atendidos semana" value={loading ? "…" : atendidosSemana} tone="ok" hint={labelSemanaAtual()} />
              <Kpi icon={<ShieldAlert size={16} />} label="Vencidos" value={loading ? "…" : vencidos.length} tone={vencidos.length > 0 ? "danger" : "default"} />
            </div>

            <div className="premium-card overflow-hidden">
              <div className="bg-secondary/40 dark:bg-card/70 px-5 sm:px-7 py-4 border-b border-border/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Eye size={16} className="text-primary" />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">Todos os processos da empresa</h3>
                </div>
                <div className="flex items-center gap-2 flex-1 sm:flex-none sm:min-w-[320px]">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Buscar cliente, protocolo, advogado, tribunal…"
                      className="pl-9 h-9 rounded-xl text-[11px]"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 rounded-xl border border-border/60 bg-card px-3 text-[10px] font-bold uppercase"
                  >
                    <option value="">Todos os status</option>
                    {Array.from(new Set(cases.map((c) => c.status).filter(Boolean))).sort().map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-3">
                  <Loader2 className="animate-spin text-primary" size={28} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Carregando carteira da empresa…</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-24 text-center space-y-3 opacity-60">
                  <Briefcase className="mx-auto" size={40} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Nenhum processo encontrado.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[560px]">
                  <table className="w-full text-left min-w-[980px]">
                    <thead className="bg-secondary/40 dark:bg-card/60 border-b border-border/20 sticky top-0">
                      <tr className="text-[9px] font-black uppercase text-muted-foreground/70 tracking-widest">
                        <th className="px-6 py-3">Cliente / Protocolo</th>
                        <th className="px-4 py-3">Advogado</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Tribunal</th>
                        <th className="px-4 py-3 text-right">Último retorno</th>
                        <th className="px-4 py-3 text-center">Semana</th>
                        <th className="px-4 py-3">Criado por</th>
                        <th className="px-6 py-3">Última atividade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10">
                      {filtered.map((c) => {
                        const last = lastByProtocolo.get(c.protocolo);
                        const meta = last ? ACTION_META[last.action || ""] : null;
                        return (
                          <tr key={c.id || c.protocolo} className="hover:bg-secondary/10 transition-colors group">
                            <td className="px-6 py-3">
                              <Link href={`/cases?search=${encodeURIComponent(c.protocolo)}`} className="hover:text-primary transition-colors">
                                <p className="text-[11px] font-black uppercase leading-tight">{c.cliente}</p>
                                <p className="text-[8px] font-mono text-muted-foreground/60 mt-0.5 truncate max-w-[240px]">{c.protocolo}</p>
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-[10px] font-bold uppercase">{c.advogado}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={cn("text-[8px] font-black uppercase px-2 py-0 border", statusTone(c.status))}>
                                {c.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-[10px] font-bold uppercase">{c.tribunal}</td>
                            <td className="px-4 py-3 text-right text-[11px] font-bold tabular-nums">{c.ultimoRetorno || "—"}</td>
                            <td className="px-4 py-3 text-center">
                              <CheckCircle2
                                size={15}
                                className={cn(
                                  "mx-auto",
                                  c.ultimoRetorno && new Date(`${c.ultimoRetorno.split("/").reverse().join("-")}`).getTime() >= Date.now() - 7 * 864e5 ? "text-emerald-500" : "text-muted-foreground/25"
                                )}
                              />
                            </td>
                            <td className="px-4 py-3 text-[10px] font-bold uppercase">{nomeByAuth.get(String(c.created_by || "")) || "—"}</td>
                            <td className="px-6 py-3">
                              {meta && last ? (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={cn("text-[8px] font-black uppercase px-2 py-0 border gap-1", meta.tone)}>
                                    {meta.icon} {meta.label}
                                  </Badge>
                                  <span className="text-[9px] font-bold uppercase text-muted-foreground/70 truncate max-w-[150px]">
                                    {last.user_nome} · {fmtTime(last.created_at)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[9px] text-muted-foreground/40 uppercase font-bold">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </div>

            <section className="premium-card p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={16} className="text-primary" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">Atividade recente da empresa</h3>
              </div>
              {recentFeed.length === 0 ? (
                <p className="text-[10px] font-black uppercase text-muted-foreground/40 text-center py-10">
                  Nenhum registro de auditoria ainda. Após atender, editar ou apagar um processo, a atividade aparece aqui.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {recentFeed.map((a) => {
                    const meta = ACTION_META[a.action || ""];
                    return (
                      <div key={a.id} className="rounded-xl border border-border/50 bg-secondary/10 p-3.5 flex items-start gap-3">
                        <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", meta ? meta.tone : "bg-muted text-muted-foreground")}>
                          {meta ? meta.icon : <Eye size={13} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase truncate">{a.user_nome || "—"}</p>
                          <p className="text-[9px] font-bold uppercase text-muted-foreground/70 truncate">
                            {meta ? meta.label : a.action} · {a.protocolo_ref}
                          </p>
                          <p className="text-[8px] font-mono text-muted-foreground/50 mt-1">{fmtTime(a.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
