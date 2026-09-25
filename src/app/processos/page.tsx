"use client";

import { AtendimentoSyncRetry } from '@/components/atendimento-sync-retry';
import { canRodarEmpresaScan, canAssignOwner as canAssignOwnerRule } from "@/lib/auth-supervisao";

import { CaseGlassList } from '@/components/cases/case-glass-list';
import { ProcessosCommandCenter } from '@/components/processos/processos-command-center';

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * Processos da Empresa — visão consolidada exclusiva de Supervisor/Superadmin.
 * Trilha separa atendimento de edição para preservar crédito operacional.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { fetchCompanyProcessosAction,
  fetchCompanyProcessosPageAction, registrarAuditoriaEventAction, registrarAtendimentoAction, registrarAtendimentoCompletoAction } from "@/app/actions/case-actions";
import { fetchRankingAtendentesEmpresaAction } from "@/app/actions/ranking-atendentes-action";
import { searchCompanyProcessosAction } from "@/app/actions/search-processos-action";
import { peekCarteiraCache, writeCarteiraCache } from "@/lib/session-carteira-cache";
import { saveOneCaseAction } from "@/app/actions/case-save-actions";
import { ReassignOwnerControl } from "@/components/cases/reassign-owner-control";
import { countAtendidosNestaSemana, labelSemanaAtual, getTopAtendentes, hojeBrasilYmd, isAtendidoHoje, isAtendidoNestaSemana } from '@/lib/atendimento-semana';
import { linhaDonoPasso, proximoPasso } from '@/lib/fase-resumo';
import { OpsCaseLine } from '@/components/ops/ops-case-line';
import { ProtocoloChip } from '@/components/ops/protocolo-chip';
import { AndamentoLeigoBlock } from '@/components/ops/andamento-leigo';
import { compareOps, computeOpsLinha } from '@/lib/ops-linha';
import { isBuscaApreensaoReal } from '@/lib/ba-real';
import { countAuditadosHoje, countAuditadosNestaSemana, countAuditadosTribunalSemana, countEditadosAppSemana, labelSemanaAuditoria, patchAtendimentoComEdicao, patchAuditoriaEdicao } from '@/lib/processos-auditados';
import { isCasoEncerrado } from "@/lib/status-encerrado";
import { fetchProcessosEmpresaKpisAction } from "@/app/actions/processos-kpis-action";
import { EncerrarScannerPanel } from "@/components/processos/encerrar-scanner-panel";
import { DataJudScannerPanel } from "@/components/scanner/datajud-scanner-panel";
import { useDataJudScanStore } from "@/store/use-datajud-scan-store";
import { isEmpresaW1Principal } from "@/lib/w1-empresa";
import { applyFilaListaToObs, parseFilaListaFromObs, type FilaLista } from "@/lib/fila-listas";
import { LegalCase, formatDateToISO } from "@/lib/case-logic";
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
import { CaseResumoChip } from "@/components/cases/case-resumo-chip";
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
  /** Só o botão "Rodar empresa" (lote empresa) exige Supervisão/Superadmin. Resto da página é livre. */
  const canRodarEmpresa = canRodarEmpresaScan(profile as any);
  const canAssignOwner = canAssignOwnerRule(profile as any);
  const openScanner = useDataJudScanStore((s) => s.openScanner);
  const scannerStatus = useDataJudScanStore((s) => s.status);
  const scannerManualStatus = useDataJudScanStore((s) => s.manualStatus);
  const scannerDone = useDataJudScanStore((s) => s.done);
  const scannerTotal = useDataJudScanStore((s) => s.total);

  const [cases, setCases] = useState<LegalCase[]>([]);
  const [searchHits, setSearchHits] = useState<LegalCase[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [topAtendentesSrv, setTopAtendentesSrv] = useState<{ userId: string; userNome: string; dia: number; semana: number; mes: number }[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [ativosCount, setAtivosCount] = useState(0);
  const [vencidosCount, setVencidosCount] = useState(0);
  const [atendidosSemanaSrv, setAtendidosSemanaSrv] = useState(0);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<{ auth_user_id: string; nome: string; avatar_url?: string | null }[]>([]);
  const [loading, setLoading] = useState(() => !peekCarteiraCache(null, "empresa")?.cases?.length);
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 300);
  const [statusFilter, setStatusFilter] = useState("");
  const [baOnly, setBaOnly] = useState(false);
  const [silencioOnly, setSilencioOnly] = useState(false);
  const [sortOps, setSortOps] = useState(true);
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
  const [visibleCount, setVisibleCount] = useState(24);
  const [listOffset, setListOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [onlyAtivosList, setOnlyAtivosList] = useState(true);
  const [hasServerMore, setHasServerMore] = useState(true);
  const PAGE_SIZE = 24;

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchCompanyProcessosAction();
      const list = res?.cases || [];
      setCases(list);
      writeCarteiraCache(list, null, "empresa");
      setListOffset(list.length);
      setTotalCount(Number(res?.totalCount) || list.length);
      let rankList = Array.isArray(res?.ranking) ? res.ranking : [];
      let atendSem = Number(res?.atendidosSemana) || 0;
      // Ranking e KPIs são independentes: execute em paralelo para não somar latências.
      const [rankResult, kpiResult] = await Promise.allSettled([
        fetchRankingAtendentesEmpresaAction(8),
        fetchProcessosEmpresaKpisAction(),
      ]);
      if (rankResult.status === "fulfilled" && rankResult.value?.ok) {
        if (rankResult.value.ranking?.length) rankList = rankResult.value.ranking;
        if (typeof rankResult.value.atendidosSemana === "number") atendSem = rankResult.value.atendidosSemana;
      }
      setTopAtendentesSrv(rankList.slice(0, 5));
      setAtendidosSemanaSrv(atendSem);
      // KPIs de carteira: mesma regra do Dashboard (empresa inteira), NÃO a amostra da tabela.
      if (kpiResult.status === "fulfilled" && kpiResult.value?.ok) {
        if (kpiResult.value.total > 0) setTotalCount(kpiResult.value.total);
        setAtivosCount(kpiResult.value.ativos);
        setVencidosCount(kpiResult.value.vencidos);
      } else if (Number(res?.ativosCount) > 0) {
        setAtivosCount(Number(res.ativosCount));
      }
      setAudit(res?.audit || []);
      setUsers(res?.users || []);
      if ((res as any)?.error) {
        console.error('[processos] action error', (res as any).error);
      }
    } catch (e) {
      console.error('[processos] load failed', e);
      setCases([]);
      setAudit([]);
      setUsers([]);
      setTopAtendentesSrv([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Busca no banco (empresa inteira) quando há texto — a lista local só tem ~300
  useEffect(() => {
    const q = qDebounced.trim();
    if (!q || q.length < 2) {
      setSearchHits(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    (async () => {
      try {
        const res = await searchCompanyProcessosAction(q);
        if (cancelled) return;
        if (res.ok) setSearchHits(res.cases as any);
        else setSearchHits([]);
      } catch {
        if (!cancelled) setSearchHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [qDebounced]);

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
  }, [qDebounced, statusFilter, baOnly]);

  const baCount = useMemo(() => cases.filter((c) => isBuscaApreensaoReal(c)).length, [cases]);

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
    try {
      const iso = formatDateToISO(editing.ultimoRetorno) || "";
      const prazoIso = formatDateToISO(editing.proximoPrazo) || editing.proximoPrazo || "";
      const updated: LegalCase = {
        ...editing,
        proximoPrazo: prazoIso,
        statusManual: "Automatico" as any,
        ultimoRetorno: iso || editing.ultimoRetorno,
        ...patchAuditoriaEdicao(
          (profile as any)?.auth_user_id || (profile as any)?.id
        ),
      } as LegalCase;
      const payload = { ...updated } as any;
      delete payload.force_transfer_owner;
      delete payload.__transfer_owner;

      const res = await saveOneCaseAction(payload);
      if (res.success) {
        await registrarAuditoriaEventAction("edicao", [editing.protocolo], {
          detalhes: { perfil: profile?.cargo, via: "processos-da-empresa" },
        });
        setEditOpen(false);
        setEditing(null);
        await load();
        toast({
          title: "Processo salvo",
          description: editing.cliente || editing.protocolo,
        });
      } else {
        toast({
          title: "Não foi possível salvar",
          description: res.message || "Falha desconhecida (RLS / service role / trigger).",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
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
        proximoPrazo: situacao === "ENCERRADO" ? "" : attendanceForm.proximoRetorno,
        via: "processos-da-empresa",
        filaLista: attendanceForm.filaLista || "normal",
      });
      if (res.success) {
        setAttendingOpen(false);
        setAttending(null);
        await load();
        toast({
          title: "Atendimento registrado",
          description: res.message,
          action: res.mirror?.attempted && !res.mirror.ok ? <AtendimentoSyncRetry protocolos={[attending.protocolo]}/> : undefined,
        });
      } else {
        toast({ title: "Falha ao registrar", description: (res as any).message || "Sem retorno do servidor", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Falha ao registrar", description: e?.message || "Erro inesperado", variant: "destructive" });
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
        situacao: "ENCERRADO", viaEncerrarHumano: true as any,
        ultimoRetorno: todayBR(),
        proximoPrazo: "",
        tem_novo_andamento: false,
        djen_nova_comunicacao: false,
        tem_atualizacao_pos_retorno: false,
      };
      const payload = { ...updated } as any;

      delete payload.force_transfer_owner;
      delete payload.__transfer_owner;
      // Se não há UI de transferência neste fluxo, não manda created_by novo
      const res = await saveOneCaseAction(payload);
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

  /** Reabre ENCERRADO / falso AGUARD.PROTOCOLO — qualquer cargo, dono preservado. */
  const handleReabrir = async (c: LegalCase) => {
    if (!confirm(`Reabrir "${c.cliente}" na carteira ativa?`)) return;
    setSaving(true);
    try {
      const updated: any = {
        ...c,
        situacao: "EM ANDAMENTO",
        statusManual: "Automatico",
        datajud_encerrado_tribunal: false,
        datajud_encerrado_motivo: null,
        tem_novo_andamento: false,
        djen_nova_comunicacao: false,
        tem_atualizacao_pos_retorno: false,
      };
      delete updated.force_transfer_owner;
      delete updated.__transfer_owner;
      const res = await saveOneCaseAction(updated);
      if (res.success) {
        await registrarAuditoriaEventAction("edicao", [c.protocolo], {
          detalhes: { perfil: profile?.cargo, via: "processos-reabrir", acao: "reabrir" },
        });
        await load();
        toast({ title: "Processo reaberto", description: c.cliente || c.protocolo });
      } else {
        toast({
          title: "Não foi possível reabrir",
          description: res.message || "Falha desconhecida",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = (exportRows?: LegalCase[]) => {
    const rowsToExport = exportRows?.length ? exportRows : filtered;
    const head = ["cliente", "protocolo", "advogado", "escritorio", "tribunal", "status", "ultimoRetorno", "indicio_busca_apreensao", "criado_por"];
    const lines = rowsToExport.map((c) =>
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
    for (const u of users as any[]) {
      const nome = String(u.nome || u.email || "").trim();
      if (!nome) continue;
      if (u.auth_user_id) m.set(String(u.auth_user_id).toLowerCase(), nome);
      if (u.id) m.set(String(u.id).toLowerCase(), nome);
    }
    return m;
  }, [users]);

    const avatarByAuth = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users as any[]) {
      const av = u.avatar_url || null;
      if (!av) continue;
      if (u.auth_user_id) m.set(String(u.auth_user_id).toLowerCase(), av);
      if (u.id) m.set(String(u.id).toLowerCase(), av);
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

  // Ranking da EMPRESA vem do servidor (não do array cases, que pode ser parcial/pessoal)
  const topAtendentes = topAtendentesSrv;

  const lastByProtocolo = useMemo(() => {
    const m = new Map<string, AuditEntry>();
    for (const a of audit) {
      const p = String(a.protocolo_ref || "");
      if (p && !m.has(p)) m.set(p, a);
    }
    return m;
  }, [audit]);

  const filtered = useMemo(() => {
    const query = qDebounced.toLowerCase().trim();
  // Enquanto há uma busca ativa, a resposta do servidor é a fonte da lista,
  // inclusive quando vazia. Cair de volta para `cases` fazia parecer que a
  // busca por nome não funcionava e podia mostrar processos incorretos.
  const base = query.length >= 2 && searchHits !== null ? searchHits : cases;
    let list = base.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (baOnly && !isBuscaApreensaoReal(c)) return false;
      if (silencioOnly) {
        const d = computeOpsLinha(c).diasTribunal;
        if (d == null || d < 45) return false;
      }
      if (!query) return true;
      if (searchHits != null) return true; // já filtrado no servidor
      return [c.cliente, c.protocolo, c.advogado, c.escritorio, c.tribunal, String(c.status)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query));
    });
    if (sortOps) list = [...list].sort(compareOps);
    return list;
  }, [cases, searchHits, qDebounced, statusFilter, baOnly, silencioOnly, sortOps]);

  // Ao mudar filtro/busca, volta a mostrar só a 1ª página (não afeta dashboard)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [qDebounced, statusFilter, baOnly, silencioOnly, sortOps, cases.length]);

  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;
  const remaining = filtered.length - visibleCount;

  
  const loadMoreFromServer = async () => {
    if (loadingMore || !hasServerMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchCompanyProcessosPageAction({
        offset: listOffset,
        limit: 300,
        onlyAtivos: onlyAtivosList,
      });
      const batch = res.ok ? res.cases || [] : [];
      if (batch.length > 0) {
        setCases((prev) => {
          const seen = new Set(prev.map((c: any) => String(c.id || c.protocolo)));
          const add = batch.filter((c: any) => !seen.has(String(c.id || c.protocolo)));
          return [...prev, ...add];
        });
        setListOffset((o) => o + batch.length);
        setVisibleCount((v) => v + Math.min(100, batch.length));
        if (batch.length < 300) {
          // página incompleta: se estava só ativos, passa a todos
          if (onlyAtivosList) {
            setOnlyAtivosList(false);
            setListOffset(0);
            setHasServerMore(true);
          } else {
            setHasServerMore(false);
          }
        }
      } else if (onlyAtivosList) {
        setOnlyAtivosList(false);
        setListOffset(0);
        const res2 = await fetchCompanyProcessosPageAction({
          offset: 0,
          limit: 300,
          onlyAtivos: false,
        });
        const batch2 = res2.ok ? res2.cases || [] : [];
        if (batch2.length > 0) {
          setCases((prev) => {
            const seen = new Set(prev.map((c: any) => String(c.id || c.protocolo)));
            const add = batch2.filter((c: any) => !seen.has(String(c.id || c.protocolo)));
            return [...prev, ...add];
          });
          setListOffset(batch2.length);
          setVisibleCount((v) => v + Math.min(100, batch2.length));
        } else {
          setHasServerMore(false);
        }
      } else {
        setHasServerMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  /** Ver mais: sempre tenta servidor se ainda há carteira além do carregado */
  const showMore = async (extra: number) => {
    const nextVis = Math.min(visibleCount + extra, filtered.length + extra);
    setVisibleCount(nextVis);
    if (cases.length < (totalCount || 99999) && hasServerMore) {
      await loadMoreFromServer();
    }
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
      <main className="lexis-main-pad flex-1 flex flex-col min-h-0 overflow-hidden">
        <DataJudScannerPanel />

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <ProcessosCommandCenter
            items={filtered}
            totalCount={totalCount || cases.length}
            ativosCount={ativosCount || ativos.length}
            vencidosCount={vencidosCount || vencidos.length}
            loading={loading}
            searching={searching}
            query={q}
            onQueryChange={setQ}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            baOnly={baOnly}
            onBaOnlyChange={setBaOnly}
            silencioOnly={silencioOnly}
            onSilencioOnlyChange={setSilencioOnly}
            sortOps={sortOps}
            onSortOpsChange={setSortOps}
            onRefresh={() => void load()}
            canScan={canRodarEmpresa}
            onScan={canRodarEmpresa ? openScanner : undefined}
            scannerLabel={
              scannerStatus === "running"
                ? `Scanner nuvem ${scannerDone}/${scannerTotal || "…"}`
                : scannerManualStatus === "running"
                  ? "Scanner local em execução"
                  : "Atualizar DataJud"
            }
            onEdit={(item) => {
              setEditing(item);
              setEditOpen(true);
            }}
            onAttend={(item) => openAttendance(item)}
            onExportCsv={exportCsv}
            ownerNameByAuth={nomeByAuth}
          />
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto bg-card text-card-foreground border-border shadow-2xl">
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
                    <div className="space-y-1 mt-1">
                      <Label className="text-[9px] font-black uppercase">Número do processo (CNJ)</Label>
                      <Input
                        value={editing.protocolo || ""}
                        onChange={(e) => setEditing({ ...editing, protocolo: e.target.value })}
                        className="h-11 font-mono text-sm font-semibold tracking-tight"
                        placeholder="0000000-00.0000.0.00.0000"
                      />
                      <p className="text-[9px] text-muted-foreground">Altere com cuidado — o CNJ identifica o processo no tribunal.</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-[8px] font-black uppercase px-2 py-0 border", statusTone(editing.status))}>
                    {editing.status}
                  </Badge>
                </div>

                <ReassignOwnerControl
                  protocolo={String(editing.protocolo || '')}
                  currentOwnerAuthId={(editing as any).created_by}
                  canAssign={canAssignOwner}
                  onAssigned={(id) => setEditing({ ...editing, created_by: id } as any)}
                />

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
          <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto bg-card text-card-foreground border-border shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-widest font-black">
                <UserCheck size={15} className="text-emerald-500" /> Registrar atendimento
              </DialogTitle>
            </DialogHeader>
            {attending ? (
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-border bg-secondary/10 p-3">
                  <p className="text-[11px] font-black uppercase truncate">{attending.cliente}</p>
                  <div className="mt-1"><ProtocoloChip protocolo={attending.protocolo} size="lg" /></div>
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
              <Button type="button" onClick={saveAttendance} disabled={attendanceSaving} className="bg-emerald-600 hover:bg-emerald-700">
                {attendanceSaving ? <Loader2 className="animate-spin" size={14} /> : "Salvar atendimento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
