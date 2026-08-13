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
import { fetchCompanyProcessosAction, registrarAuditoriaEventAction, registrarAtendimentoAction, registrarAtendimentoCompletoAction, backfillEncerradosHojeAction } from "@/app/actions/case-actions";
import { saveOneCaseAction } from "@/app/actions/case-save-actions";
import { countAtendidosNestaSemana, labelSemanaAtual, getTopAtendentes, hojeBrasilYmd } from '@/lib/atendimento-semana';
import { countAuditadosHoje, countAuditadosNestaSemana, countAuditadosTribunalSemana, countEditadosAppSemana, labelSemanaAuditoria, patchAtendimentoComEdicao, patchAuditoriaEdicao } from '@/lib/processos-auditados';
import { isCasoEncerrado } from "@/lib/status-encerrado";
import { applyFilaListaToObs, parseFilaListaFromObs, type FilaLista } from "@/lib/fila-listas";
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
  MessageCircle,
  FilePlus2,
  Users,
  ShieldCheck,
  FileDown,
  Plus,
  Filter,
  UserCheck,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Gavel,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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
  encerramento: { label: "Encerrou", icon: <CheckCircle2 size={13} />, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" },
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
  const { toast } = useToast();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<{ auth_user_id: string; nome: string; avatar_url?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [baOnly, setBaOnly] = useState(false);
  const [editing, setEditing] = useState<LegalCase | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attending, setAttending] = useState<LegalCase | null>(null);
  const [attendingOpen, setAttendingOpen] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({
    situacao: "EM ANDAMENTO",
    observacao: "",
    proximoRetorno: "",
    filaLista: "normal" as FilaLista,
  });
  const [visibleCount, setVisibleCount] = useState(25);
  const PAGE_SIZE = 25;

  const load = async () => {
    setLoading(true);
    const res = await fetchCompanyProcessosAction();
    setCases(res.cases || []);
    setAudit(res.audit || []);
    setUsers(res.users || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lexis_processos_filters_v1');
      if (!raw) return;
      const f = JSON.parse(raw);
      if (f.q != null) setQ(String(f.q));
      if (f.statusFilter != null) setStatusFilter(String(f.statusFilter));
      if (typeof f.baOnly === 'boolean') setBaOnly(f.baOnly);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'lexis_processos_filters_v1',
        JSON.stringify({ q, statusFilter, baOnly })
      );
    } catch { /* ignore */ }
  }, [q, statusFilter, baOnly]);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await backfillEncerradosHojeAction();
        if (cancelled || !r?.success || !r.updated) return;
        await load();
        toast({ title: "Encerrados de hoje contabilizados", description: `${r.updated} processo(s)` });
      } catch { /* */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const baCount = useMemo(() => cases.filter((c) => !!c.indicio_busca_apreensao || c.evento_tipo === "ba").length, [cases]);

  const toDateInput = (v?: string) => {
    if (!v) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  };

  const fromDateInput = (v: string) => {
    if (!v) return "";
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const updated: LegalCase = { ...editing };
    const res = await saveOneCaseAction(updated);
    if (res.success) {
      await registrarAuditoriaEventAction("edicao", [editing.protocolo], {
        detalhes: { perfil: profile?.cargo, via: "processos-da-empresa" },
      });
      setEditOpen(false);
      setEditing(null);
      await load();
    }
    setSaving(false);
  };

  const todayBR = () => hojeBrasilYmd(); // YYYY-MM-DD Brasília

  const openAttendance = (c: LegalCase) => {
    setAttending(c);
    setAttendanceForm({
      situacao: c.situacao || "EM ANDAMENTO",
      observacao: c.observacao || "",
      proximoRetorno: c.proximoPrazo || "",
      filaLista: parseFilaListaFromObs(c.observacao),
    });
    setAttendingOpen(true);
  };

  const saveAttendance = async () => {
    if (!attending || attendanceSaving) return;
    setAttendanceSaving(true);
    try {
      const situacao = attendanceForm.situacao === "ENCERRADO" ? "ENCERRADO" : "EM ANDAMENTO";
      const res = await registrarAtendimentoCompletoAction({
        protocolo: attending.protocolo,
        situacao,
        observacao: attendanceForm.observacao.trim() || attending.observacao || "",
        proximoPrazo: situacao === "ENCERRADO" ? "" : attendanceForm.proximoRetorno || attending.proximoPrazo,
        via: "processos-da-empresa",
        filaLista: attendanceForm.filaLista || "normal",
      });
      if (res.success) {
        setAttendingOpen(false);
        setAttending(null);
        await load();
        toast({
          title: "Atendimento registrado",
          description: `${attending.cliente} • ${situacao} • ${(res as any).ultimoRetorno || ""} · sync Tarefas/WhatsApp`,
        });
      } else {
        toast({ title: "Falha ao registrar", description: (res as any).message, variant: "destructive" });
      }
    } finally {
      setAttendanceSaving(false);
    }
  };

  const handleEncerrar = async (c: LegalCase) => {
    if (!confirm(`Marcar "${c.cliente}" como ENCERRADO?\nO processo sai da carteira ativa.`)) return;
    setSaving(true);
    try {
      const updated: LegalCase = {
        ...c,
        situacao: "ENCERRADO",
        ultimoRetorno: todayBR(),
        proximoPrazo: "",
        tem_novo_andamento: false,
        djen_nova_comunicacao: false,
        tem_atualizacao_pos_retorno: false,
      };
      const res = await saveOneCaseAction(updated);
      if (res.success) {
        await registrarAuditoriaEventAction("encerramento", [c.protocolo], {
          detalhes: { perfil: profile?.cargo, via: "processos-da-empresa" },
        });
        await load();
        toast({ title: "Processo encerrado", description: c.cliente });
      } else {
        toast({ title: "Falha ao encerrar", description: res.message, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const head = ["cliente", "protocolo", "advogado", "escritorio", "tribunal", "status", "ultimoRetorno", "indicio_busca_apreensao", "criado_por"];
    const lines = cases.map((c) =>
      [c.cliente, c.protocolo, c.advogado, c.escritorio, c.tribunal, c.status, c.ultimoRetorno, c.indicio_busca_apreensao ? "SIM" : "NAO", nomeByAuth.get(String(c.created_by || "")) || ""]
        .map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`)
        .join(";")
    );
    const csv = [head.join(";"), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Processos_Empresa_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const nomeByAuth = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.auth_user_id, u.nome);
    return m;
  }, [users]);

  const avatarByAuth = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const u of users) {
      if (u.auth_user_id) m.set(u.auth_user_id, u.avatar_url || null);
    }
    return m;
  }, [users]);

  const atendidosSemana = useMemo(() => countAtendidosNestaSemana(cases), [cases]);
  const auditadosSemana = useMemo(() => countAuditadosNestaSemana(cases), [cases]);
  const auditadosTribunal = useMemo(() => countAuditadosTribunalSemana(cases), [cases]);
  const editadosApp = useMemo(() => countEditadosAppSemana(cases), [cases]);
  const auditadosHoje = useMemo(() => countAuditadosHoje(cases), [cases]);
  const ativos = useMemo(() => cases.filter((c) => !isCasoEncerrado(c)), [cases]);
  const vencidos = useMemo(() => ativos.filter((c) => c.status === "Vencido" || c.status === "Caso Crítico"), [ativos]);

  const topAtendentes = useMemo(() => getTopAtendentes(cases, users, 5), [cases, users]);

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
      if (baOnly && !c.indicio_busca_apreensao && c.evento_tipo !== "ba") return false;
      if (!query) return true;
      return [c.cliente, c.protocolo, c.advogado, c.escritorio, c.tribunal, String(c.status)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query));
    });
  }, [cases, q, statusFilter, baOnly]);

  // Ao mudar filtro/busca, volta a mostrar só a 1ª página (não afeta dashboard)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [q, statusFilter, baOnly, cases.length]);

  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;
  const remaining = filtered.length - visibleCount;

  const showMore = (extra: number) => {
    setVisibleCount((prev) => Math.min(prev + extra, filtered.length));
  };
  const showAll = () => setVisibleCount(filtered.length);
  const showLess = () => setVisibleCount(PAGE_SIZE);

  const fmtTime = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
      " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const recentFeed = useMemo(() => audit.slice(0, 24), [audit]);

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden min-h-0">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
            <Link
              href="/cases?new=1"
              className="h-9 rounded-xl bg-black text-white hover:bg-primary hover:text-black px-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider transition-colors"
            >
              <Plus size={14} /> Novo Processo
            </Link>
            <button
              onClick={exportCsv}
              className="h-9 rounded-xl border border-border/60 bg-card/60 hover:bg-card text-foreground px-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider transition-colors"
            >
              <FileDown size={14} /> CSV
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-4 sm:p-8 space-y-8 max-w-[1500px] mx-auto w-full">
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <Kpi icon={<Briefcase size={16} />} label="Processos" value={loading ? "…" : cases.length} tone="primary" />
              <Kpi icon={<Activity size={16} />} label="Ativos" value={loading ? "…" : ativos.length} />
              <Kpi icon={<CalendarClock size={16} />} label="Atendidos semana" value={loading ? "…" : atendidosSemana} tone="ok" hint={labelSemanaAtual()} />
              <Kpi icon={<FileSearch size={16} />} label="Editados app" value={loading ? "…" : auditadosSemana} tone="ok" hint="salvamentos no app" />
              <Kpi icon={<Gavel size={16} />} label="Tribunal (sem.)" value={loading ? "…" : auditadosTribunal} hint="DataJud/DJEN" />
              <Kpi icon={<CheckCircle2 size={16} />} label="Editados app" value={loading ? "…" : editadosApp} hint="salvar no app" />
              <Kpi icon={<ShieldAlert size={16} />} label="Vencidos" value={loading ? "…" : vencidos.length} tone={vencidos.length > 0 ? "danger" : "default"} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Kpi icon={<Users size={16} />} label="Top Atendentes" value={loading ? "…" : topAtendentes.length || "—"} tone="primary" hint={`${topAtendentes.length} ativos`} />
              {topAtendentes.slice(0, 4).map((a, i) => (
                <Kpi key={a.userId} icon={<UserCheck size={16} />} label={a.userNome} value={a.semana} tone="ok" hint={`Dia: ${a.dia} • Mês: ${a.mes}`} />
              ))}
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
                  <button
                    onClick={() => setBaOnly(!baOnly)}
                    className={cn(
                      "h-9 rounded-xl border px-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-colors shrink-0",
                      baOnly
                        ? "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400"
                        : "border-border/60 bg-card/60 hover:bg-card text-muted-foreground"
                    )}
                    title="Filtrar apenas processos com indício de busca e apreensão"
                  >
                    <ShieldAlert size={13} /> B.A. {baCount > 0 ? `(${baCount})` : ""}
                  </button>
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
                <div className="max-h-[min(70vh,640px)] min-h-[200px] overflow-y-auto overflow-x-auto overscroll-contain border border-border/40 rounded-xl">
                  <>
                    <table className="w-full text-left min-w-[980px]">
                      <thead className="bg-secondary/40 dark:bg-card/60 border-b border-border/20 sticky top-0">
                        <tr className="text-[9px] font-black uppercase text-muted-foreground/70 tracking-widest">
                          <th className="px-6 py-3">Cliente / Protocolo</th>
                          <th className="px-4 py-3">Advogado</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Tribunal</th>
                          <th className="px-4 py-3 text-center">B.A.</th>
                          <th className="px-4 py-3 text-right">Último retorno</th>
                          <th className="px-4 py-3 text-center">Semana</th>
                          <th className="px-4 py-3">Criado por</th>
                          <th className="px-4 py-3">Última atividade</th>
                          <th className="px-6 py-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/10">
                        {visibleItems.map((c) => {
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
                            <td className="px-4 py-3 text-center">
                              {(c.indicio_busca_apreensao || c.evento_tipo === "ba") ? (
                                <Badge className="h-5 px-2 rounded-md bg-red-600 text-white font-black uppercase text-[8px] animate-pulse">
                                  <ShieldAlert size={10} className="mr-1" /> B.A.{(c as any).ba_tipo ? ` ${(c as any).ba_tipo}` : ""}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground/30 text-[10px] font-black">—</span>
                              )}
                            </td>
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
                            <td className="px-4 py-3 text-[10px] font-bold uppercase">{(() => {
                              const nm = nomeByAuth.get(String(c.created_by || "")) || "";
                              const av = avatarByAuth.get(String(c.created_by || ""));
                              if (!nm) return "—";
                              return (
                                <span className="inline-flex items-center gap-2 justify-start">
                                  <UserAvatar name={nm} src={av} size="sm" />
                                  <span className="truncate max-w-[120px]">{nm}</span>
                                </span>
                              );
                            })()}</td>
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
                            <td className="px-6 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Link
                                  href={`/whatsapp?protocolo=${encodeURIComponent(c.protocolo || "")}&cliente=${encodeURIComponent(c.cliente || "")}&tel=${encodeURIComponent(c.telefone || "")}`}
                                  className="h-8 w-8 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 inline-flex items-center justify-center transition-colors"
                                  title="Terminal WhatsApp"
                                >
                                  <MessageCircle size={13} />
                                </Link>
                                <button
                                  onClick={() => openAttendance(c)}
                                  className="h-8 w-8 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 inline-flex items-center justify-center transition-colors"
                                  title="Registrar atendimento"
                                >
                                  <UserCheck size={13} />
                                </button>
                                {!isCasoEncerrado(c) && (
                                  <button
                                    onClick={() => handleEncerrar(c)}
                                    disabled={saving}
                                    className="h-8 w-8 rounded-lg border border-border/60 bg-card/60 hover:bg-card hover:text-emerald-600 inline-flex items-center justify-center transition-colors"
                                    title="Marcar como encerrado"
                                  >
                                    <CheckCircle2 size={13} />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setEditing(c);
                                    setEditOpen(true);
                                  }}
                                  className="h-8 w-8 rounded-lg border border-border/60 bg-card/60 hover:bg-card hover:text-primary inline-flex items-center justify-center transition-colors"
                                  title="Editar processo"
                                >
                                  <Pencil size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 pb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Mostrando{" "}
                      <span className="text-foreground tabular-nums">
                        {Math.min(visibleCount, filtered.length)}
                      </span>{" "}
                      de{" "}
                      <span className="text-foreground tabular-nums">{filtered.length}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      {hasMore && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 px-5 rounded-xl font-black uppercase text-[10px] tracking-wider border-primary/40 text-primary hover:bg-primary/5 transition-colors flex items-center gap-2"
                            >
                              <ChevronDown size={14} />
                              Ver mais
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[9px] font-black">
                                {remaining}
                              </span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-56 rounded-xl border-2 border-border">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                              Quantos a mais?
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-[11px] font-bold uppercase cursor-pointer"
                              onClick={() => showMore(25)}
                            >
                              +25 processos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-[11px] font-bold uppercase cursor-pointer"
                              onClick={() => showMore(50)}
                            >
                              +50 processos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-[11px] font-bold uppercase cursor-pointer"
                              onClick={() => showMore(100)}
                            >
                              +100 processos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-[11px] font-bold uppercase cursor-pointer"
                              onClick={() => showMore(200)}
                            >
                              +200 processos
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-[11px] font-black uppercase cursor-pointer text-primary"
                              onClick={showAll}
                            >
                              Ver todos ({filtered.length})
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {visibleCount > PAGE_SIZE && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={showLess}
                          className="h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-wider text-muted-foreground hover:text-foreground"
                        >
                          <ChevronUp size={14} className="mr-1" />
                          Mostrar menos
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              </div>
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
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-widest font-black">
                <Pencil size={15} className="text-primary" /> Editar processo
              </DialogTitle>
            </DialogHeader>
            {editing ? (
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-border bg-secondary/10 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase truncate">{editing.cliente}</p>
                    <p className="text-[9px] font-mono text-muted-foreground/60 truncate">{editing.protocolo}</p>
                  </div>
                  <Badge variant="outline" className={cn("text-[8px] font-black uppercase px-2 py-0 border", statusTone(editing.status))}>
                    {editing.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-[9px] font-black uppercase">Cliente</Label>
                    <Input value={editing.cliente} onChange={(e) => setEditing({ ...editing, cliente: e.target.value })} className="h-10" />
                  </div>
                  <div>
                    <Label className="text-[9px] font-black uppercase">Advogado</Label>
                    <Input value={editing.advogado || ""} onChange={(e) => setEditing({ ...editing, advogado: e.target.value })} className="h-10" />
                  </div>
                  <div>
                    <Label className="text-[9px] font-black uppercase">Escritório</Label>
                    <Input value={editing.escritorio || ""} onChange={(e) => setEditing({ ...editing, escritorio: e.target.value })} className="h-10" />
                  </div>
                  <div>
                    <Label className="text-[9px] font-black uppercase">Tribunal</Label>
                    <Input value={editing.tribunal || ""} onChange={(e) => setEditing({ ...editing, tribunal: e.target.value })} className="h-10" />
                  </div>
                  <div>
                    <Label className="text-[9px] font-black uppercase">Telefone</Label>
                    <Input value={editing.telefone || ""} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} className="h-10" />
                  </div>
                  <div>
                    <Label className="text-[9px] font-black uppercase">Próximo prazo</Label>
                    <Input type="date" value={toDateInput(editing.proximoPrazo)} onChange={(e) => setEditing({ ...editing, proximoPrazo: fromDateInput(e.target.value) })} className="h-10" />
                  </div>
                  <div>
                    <Label className="text-[9px] font-black uppercase">Último retorno</Label>
                    <Input type="date" value={toDateInput(editing.ultimoRetorno)} onChange={(e) => setEditing({ ...editing, ultimoRetorno: fromDateInput(e.target.value) })} className="h-10" />
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-[9px] font-black uppercase">Indícios de B.A.</Label>
                      <p className="text-[8px] font-bold uppercase text-muted-foreground/60">Busca e apreensão relacionada ao processo</p>
                    </div>
                    <Switch
                      checked={!!editing.indicio_busca_apreensao}
                      onCheckedChange={(v) => setEditing({ ...editing, indicio_busca_apreensao: v })}
                    />
                  </div>
                  {editing.indicio_busca_apreensao ? (
                    <div>
                      <Label className="text-[9px] font-black uppercase">Motivo / tipo da B.A.</Label>
                      <Input
                        value={(editing as any).busca_apreensao_motivo || (editing as any).ba_tipo || ""}
                        onChange={(e) => setEditing({ ...editing, busca_apreensao_motivo: e.target.value } as any)}
                        placeholder="Ex: veículo / prisão / penhora / imóvel"
                        className="h-10"
                      />
                    </div>
                  ) : null}
                </div>

                <div>
                  <Label className="text-[9px] font-black uppercase">Observações</Label>
                  <Textarea value={editing.observacao || ""} onChange={(e) => setEditing({ ...editing, observacao: e.target.value })} rows={3} />
                </div>
              </div>
            ) : null}
            
                <div className="space-y-2 rounded-xl border border-border/60 p-3">
                  <Label className="text-[9px] font-black uppercase">Lista da fila</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-[11px] font-bold uppercase"
                    value={parseFilaListaFromObs(editing?.observacao)}
                    onChange={(e) => {
                      if (!editing) return;
                      setEditing({
                        ...editing,
                        observacao: applyFilaListaToObs(editing.observacao, e.target.value as FilaLista),
                      });
                    }}
                  >
                    <option value="normal">Fila normal</option>
                    <option value="tratamento">Crítico em tratamento</option>
                    <option value="blacklist">Blacklist / problemático</option>
                  </select>
                </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={saveEdit} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" size={14} /> : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={attendingOpen} onOpenChange={setAttendingOpen}>
          <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-widest font-black">
                <UserCheck size={15} className="text-emerald-500" /> Registrar atendimento
              </DialogTitle>
            </DialogHeader>
            {attending ? (
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-border bg-secondary/10 p-3">
                  <p className="text-[11px] font-black uppercase truncate">{attending.cliente}</p>
                  <p className="text-[9px] font-mono text-muted-foreground/60 truncate">{attending.protocolo}</p>
                </div>

                <div>
                  <Label className="text-[9px] font-black uppercase">Resultado do contato</Label>
                  <select
                    value={attendanceForm.situacao}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, situacao: e.target.value })}
                    className="mt-1 w-full h-10 rounded-xl border border-border/60 bg-card px-3 text-[11px] font-bold uppercase"
                  >
                    <option value="EM ANDAMENTO">EM ANDAMENTO</option>
                    <option value="ENCERRADO">ENCERRADO</option>
                  </select>
                  <p className="mt-1 text-[8px] font-bold uppercase text-muted-foreground/60">
                    Encerrado tira o processo da carteira ativa e zera o próximo prazo.
                  </p>
                </div>

                {attendanceForm.situacao !== "ENCERRADO" ? (
                  <div>
                    <Label className="text-[9px] font-black uppercase">Próximo retorno</Label>
                    <Input
                      type="date"
                      value={toDateInput(attendanceForm.proximoRetorno)}
                      onChange={(e) => setAttendanceForm({ ...attendanceForm, proximoRetorno: fromDateInput(e.target.value) })}
                      className="mt-1 h-10"
                    />
                  </div>
                ) : null}

                <div>
                  <Label className="text-[9px] font-black uppercase">Observação do atendimento</Label>
                  <Textarea
                    value={attendanceForm.observacao}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, observacao: e.target.value })}
                    rows={3}
                    className="mt-1"
                    placeholder="O que foi tratado com o cliente…"
                  />
                </div>
              </div>
            ) : null}
            
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase">Lista da fila</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-[11px] font-bold uppercase"
                    value={attendanceForm.filaLista || "normal"}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, filaLista: e.target.value as FilaLista })}
                  >
                    <option value="normal">Fila normal (padrão)</option>
                    <option value="tratamento">Crítico em tratamento (sai do topo)</option>
                    <option value="blacklist">Blacklist / problemático</option>
                  </select>
                  <p className="text-[9px] text-muted-foreground">
                    Mesmas listas da aba Tarefas. Em tratamento e blacklist aparecem nas sub-abas da fila.
                  </p>
                </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAttendingOpen(false)} disabled={attendanceSaving}>Cancelar</Button>
              <Button onClick={saveAttendance} disabled={attendanceSaving} className="bg-emerald-600 hover:bg-emerald-700">
                {attendanceSaving ? <Loader2 className="animate-spin" size={14} /> : "Salvar atendimento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
