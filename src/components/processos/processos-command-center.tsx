"use client";

import React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  ExternalLink,
  FileClock,
  FileDown,
  FileSearch,
  Filter,
  Gavel,
  History,
  Loader2,
  RefreshCcw,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  UserRoundSearch,
  ShieldCheck,
  Clock3,
  Database,
  Gauge,
  Radar,
  Rows3,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import type { LegalCase } from "@/lib/case-logic";
import { cn } from "@/lib/utils";
import { computeOpsLinha } from "@/lib/ops-linha";
import { openDjenPublicacaoAction } from "@/app/actions/open-djen-action";
import { generateDossieProcessoPDFAction } from "@/app/actions/dossie-processo-actions";
import { consultarOabAction, type OabResult } from "@/app/actions/oab-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { processOperationalCoverage, processSourceGapCount, processSourceMatrix, recommendedProcessActions } from "@/lib/processos-command-intelligence";
import { gerarTarefasJuridicas } from "@/lib/automacao-tarefas";

type Props = {
  items: LegalCase[];
  totalCount: number;
  ativosCount: number;
  vencidosCount: number;
  loading?: boolean;
  searching?: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  baOnly: boolean;
  onBaOnlyChange: (value: boolean) => void;
  silencioOnly: boolean;
  onSilencioOnlyChange: (value: boolean) => void;
  sortOps: boolean;
  onSortOpsChange: (value: boolean) => void;
  onRefresh: () => void | Promise<void>;
  onScan?: () => void;
  canScan?: boolean;
  onEdit: (item: LegalCase) => void;
  onAttend: (item: LegalCase) => void;
  onExportCsv: (items?: LegalCase[]) => void;
  ownerNameByAuth?: Map<string, string>;
  scannerLabel?: string;
};

type DetailTab = "overview" | "movements" | "deadlines" | "parties" | "documents" | "ai";
type FocusPreset = "all" | "urgent" | "returns" | "djen" | "updates" | "silence" | "sources" | "ba";

const COLORS = ["#4f7cff", "#7c5cff", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#94a3b8"];

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function fmtCnj(raw: unknown) {
  const digits = clean(raw).replace(/\D/g, "");
  if (digits.length !== 20) return clean(raw) || "—";
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

function parseDate(value: unknown): Date | null {
  const raw = clean(value);
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const d = new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(value: unknown, withTime = false) {
  const d = parseDate(value);
  if (!d) return clean(value) || "—";
  return d.toLocaleString("pt-BR", withTime
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysSince(value: unknown) {
  const d = parseDate(value);
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function pick(c: LegalCase, ...keys: string[]) {
  const row = c as any;
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && clean(value)) return value;
  }
  return "";
}

function ownerName(c: LegalCase, map?: Map<string, string>) {
  const raw = clean((c as any).created_by).toLowerCase();
  return (raw && map?.get(raw)) || clean((c as any).edited_by_name) || clean(c.atendente) || "—";
}

function statusColor(value: string) {
  const s = value.toLowerCase();
  if (/venc|cr[ií]tic|alto/.test(s)) return "border-red-400/30 bg-red-500/15 text-red-300";
  if (/aten|sem andamento|sil[eê]ncio/.test(s)) return "border-amber-400/30 bg-amber-500/15 text-amber-200";
  if (/encerr|arquiv/.test(s)) return "border-violet-400/30 bg-violet-500/15 text-violet-200";
  if (/prazo|andamento|normal/.test(s)) return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  return "border-slate-400/20 bg-slate-500/10 text-slate-300";
}

function latestMovement(c: LegalCase) {
  return clean(
    pick(c, "datajud_ultimo_nome", "evento_resumo", "djen_ultimo_resumo", "ultimaMovimentacao", "ultimo_movimento")
  ) || "Sem movimentação em cache";
}

function latestMovementDate(c: LegalCase) {
  return pick(c, "datajud_ultimo_movimento", "evento_data", "djen_ultima_data", "datajud_consultado_em");
}

function caseSilenceDays(c: LegalCase) {
  try {
    const ops = computeOpsLinha(c);
    if (typeof ops.diasTribunal === "number") return ops.diasTribunal;
  } catch {}
  return daysSince(latestMovementDate(c));
}

function djenCriticalLabel(c: LegalCase) {
  const text = clean(c.djen_ultimo_resumo || c.evento_resumo).toUpperCase();
  if (!text) return "";
  if (/PENHORA|BLOQUEIO|SISBAJUD|RENAJUD/.test(text)) return "Penhora / bloqueio";
  if (/LIMINAR|TUTELA DE URG[EÊ]NCIA|ANTECIPA[CÇ][AÃ]O/.test(text)) return "Liminar / tutela";
  if (/AUDI[EÊ]NCIA/.test(text)) return "Audiência";
  if (/INTIMA[CÇ][AÃ]O|INTIMADO|PRAZO/.test(text)) return "Intimação / prazo";
  if (/SENTEN[CÇ]A|JULGO|PROCEDENTE|IMPROCEDENTE/.test(text)) return "Sentença / mérito";
  if (/TR[AÂ]NSITO|BAIXA DEFINITIVA|ARQUIVAMENTO|EXTIN[CÇ][AÃ]O/.test(text)) return "Trânsito / baixa";
  return "";
}

function urgencyScore(c: LegalCase) {
  let score = 0;
  if (/vencido|caso crítico/i.test(String(c.status))) score += 80;
  if (c.risco === "Crítico") score += 50;
  if (c.tem_novo_andamento || c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao) score += 35;
  if (djenCriticalLabel(c)) score += 25;
  const silence = caseSilenceDays(c);
  if (silence != null) score += Math.min(60, Math.max(0, silence - 30));
  if (c.diasFaltando != null && c.diasFaltando <= 3) score += 35;
  return score;
}

function riskLabel(c: LegalCase) {
  const score = urgencyScore(c);
  if (score >= 100) return "Alto";
  if (score >= 55) return "Médio";
  return "Baixo";
}

function returnState(c: LegalCase) {
  const days = typeof c.diasFaltando === "number" ? c.diasFaltando : null;
  if (c.status === "Vencido" || (days != null && days < 0)) return { label: "Vencido", tone: "red" as const };
  if (days === 0 || c.status === "É Hoje") return { label: "Hoje", tone: "blue" as const };
  if ((days != null && days <= 3) || c.status === "Atenção") return { label: "Até 3 dias", tone: "amber" as const };
  if (c.proximoPrazo) return { label: "Programado", tone: "green" as const };
  return { label: "Sem retorno", tone: "slate" as const };
}

function inferOabUf(c: LegalCase) {
  const explicit = clean(pick(c, "oab_uf", "oabUf", "advogado_oab_uf")).toUpperCase();
  if (/^[A-Z]{2}$/.test(explicit)) return explicit;
  const oab = clean(pick(c, "oab", "oab_numero", "advogado_oab")).toUpperCase();
  const embedded = oab.match(/\b([A-Z]{2})\b/);
  if (embedded?.[1]) return embedded[1];
  const tribunal = clean(c.tribunal).toUpperCase();
  const match = tribunal.match(/^TJ([A-Z]{2})$/);
  return match?.[1] || "";
}

function sourceFreshness(c: LegalCase) {
  const dj = daysSince(c.datajud_consultado_em);
  const de = daysSince(c.djen_consultado_em);
  const freshest = [dj, de].filter((x): x is number => typeof x === "number").sort((a,b)=>a-b)[0];
  if (freshest == null) return { label: "Não consultado", tone: "red" as const };
  if (freshest <= 1) return { label: "Atualizado", tone: "green" as const };
  if (freshest <= 7) return { label: freshest+"d", tone: "blue" as const };
  if (freshest <= 30) return { label: freshest+"d", tone: "amber" as const };
  return { label: freshest+"d", tone: "red" as const };
}

function toneBadge(tone:"red"|"blue"|"amber"|"green"|"slate"){
  if(tone==="red")return "border-red-400/25 bg-red-500/12 text-red-200";
  if(tone==="blue")return "border-blue-400/25 bg-blue-500/12 text-blue-200";
  if(tone==="amber")return "border-amber-400/25 bg-amber-500/12 text-amber-200";
  if(tone==="green")return "border-emerald-400/25 bg-emerald-500/12 text-emerald-200";
  return "border-slate-400/15 bg-slate-500/8 text-slate-400";
}

function kpiTone(kind: "blue" | "amber" | "red" | "cyan") {
  if (kind === "amber") return "from-amber-500/18 to-transparent text-amber-200 border-amber-400/20";
  if (kind === "red") return "from-red-500/18 to-transparent text-red-200 border-red-400/20";
  if (kind === "cyan") return "from-cyan-500/18 to-transparent text-cyan-200 border-cyan-400/20";
  return "from-blue-500/18 to-transparent text-blue-100 border-blue-400/20";
}

function KpiCard({ label, value, hint, kind = "blue", icon }: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  kind?: "blue" | "amber" | "red" | "cyan";
  icon: React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-xl border bg-gradient-to-br p-3 shadow-[0_12px_35px_rgba(0,0,0,.16)]",
      kpiTone(kind)
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[8px] font-bold uppercase tracking-[.11em] text-slate-400">{label}</p>
        <span className="opacity-80">{icon}</span>
      </div>
      <p className="mt-2 text-[22px] font-black tracking-tight tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-1 text-[8px] font-semibold text-slate-500">{hint}</p> : null}
    </div>
  );
}

function miniTimeline(c: LegalCase) {
  const rows = [
    { label: clean(c.datajud_ultimo_nome) || "Último movimento DataJud", detail: clean(c.evento_resumo), date: c.datajud_ultimo_movimento, source: "DataJud" },
    { label: clean(c.djen_ultimo_resumo) || "Última publicação DJEN", detail: clean(c.djen_ultimo_resumo), date: c.djen_ultima_data, source: "DJEN" },
    { label: "Último retorno ao cliente", detail: clean(c.observacao).slice(0, 160), date: c.ultimoRetorno, source: "Atendimento" },
    { label: "Ajuizamento / distribuição", detail: clean(c.classe_acao), date: c.dataDistribuicao, source: "Processo" },
  ];
  return rows
    .filter((x) => clean(x.date) || clean(x.detail))
    .sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0))
    .slice(0, 8);
}

function toCsvDownload(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

export function ProcessosCommandCenter(props: Props) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = React.useState("");
  const [tab, setTab] = React.useState<DetailTab>("overview");
  const [tribunal, setTribunal] = React.useState("");
  const [classe, setClasse] = React.useState("");
  const [risco, setRisco] = React.useState("");
  const [assunto, setAssunto] = React.useState("");
  const [municipio, setMunicipio] = React.useState("");
  const [grau, setGrau] = React.useState("");
  const [sistema, setSistema] = React.useState("");
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [responsavel, setResponsavel] = React.useState("");
  const [novidade, setNovidade] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [busy, setBusy] = React.useState<"" | "djen" | "dossie" | "oab">("");
  const [focusPreset,setFocusPreset]=React.useState<FocusPreset>("all");
  const [oabResult,setOabResult]=React.useState<OabResult|null>(null);
  const PAGE = 10;

  const tribunais = React.useMemo(() => [...new Set(props.items.map((c) => clean(c.tribunal)).filter(Boolean))].sort(), [props.items]);
  const classes = React.useMemo(() => [...new Set(props.items.map((c) => clean(pick(c, "classe_acao", "classeProcessual_nome", "classe"))).filter(Boolean))].sort().slice(0, 80), [props.items]);
  const assuntos = React.useMemo(() => [...new Set(props.items.map((c) => clean(pick(c, "assunto_nome", "assunto", "tipo"))).filter(Boolean))].sort().slice(0, 80), [props.items]);
  const municipios = React.useMemo(() => [...new Set(props.items.map((c) => clean(pick(c, "orgaoJulgador_municipio", "municipio", "cidade"))).filter(Boolean))].sort().slice(0, 80), [props.items]);
  const graus = React.useMemo(() => [...new Set(props.items.map((c) => clean(pick(c, "grau", "grau_nome", "instancia"))).filter(Boolean))].sort(), [props.items]);
  const sistemas = React.useMemo(() => [...new Set(props.items.map((c) => clean(pick(c, "sistema_nome", "sistema"))).filter(Boolean))].sort(), [props.items]);
  const responsaveis = React.useMemo(() => [...new Set(props.items.map((c) => ownerName(c, props.ownerNameByAuth)).filter((x) => x && x !== "—"))].sort(), [props.items, props.ownerNameByAuth]);

  const rows = React.useMemo(() => {
    return props.items.filter((c) => {
      if (tribunal && clean(c.tribunal) !== tribunal) return false;
      const cl = clean(pick(c, "classe_acao", "classeProcessual_nome", "classe"));
      if (classe && cl !== classe) return false;
      if (risco && riskLabel(c) !== risco) return false;
      if (assunto && clean(pick(c, "assunto_nome", "assunto", "tipo")) !== assunto) return false;
      if (municipio && clean(pick(c, "orgaoJulgador_municipio", "municipio", "cidade")) !== municipio) return false;
      if (grau && clean(pick(c, "grau", "grau_nome", "instancia")) !== grau) return false;
      if (sistema && clean(pick(c, "sistema_nome", "sistema")) !== sistema) return false;
      if (responsavel && ownerName(c, props.ownerNameByAuth) !== responsavel) return false;
      if (novidade === "qualquer" || !novidade) {
        // sem filtro
      } else if (novidade === "novidade" && !(c.tem_novo_andamento || c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao)) return false;
      else if (novidade === "djen" && !c.djen_nova_comunicacao) return false;
      else if (novidade === "datajud" && !c.tem_atualizacao_pos_retorno) return false;
      else if (novidade === "sem" && (c.tem_novo_andamento || c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao)) return false;
      const ajuizamento = parseDate(pick(c, "dataDistribuicao", "dataAjuizamento", "data_ajuizamento"));
      if (periodStart) {
        const start = parseDate(periodStart);
        if (!ajuizamento || !start || ajuizamento < start) return false;
      }
      if (periodEnd) {
        const end = parseDate(periodEnd);
        if (!ajuizamento || !end || ajuizamento > new Date(end.getTime() + 86399999)) return false;
      }
      if (focusPreset === "urgent" && riskLabel(c) !== "Alto" && c.status !== "Vencido" && c.status !== "Caso Crítico") return false;
      if (focusPreset === "returns" && !(c.status === "Vencido" || c.status === "É Hoje" || c.status === "Atenção" || (typeof c.diasFaltando === "number" && c.diasFaltando <= 3))) return false;
      if (focusPreset === "djen" && !c.djen_nova_comunicacao && !djenCriticalLabel(c)) return false;
      if (focusPreset === "updates" && !(c.tem_novo_andamento || c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao)) return false;
      if (focusPreset === "silence" && (caseSilenceDays(c) == null || (caseSilenceDays(c) as number) < 45)) return false;
      if (focusPreset === "sources" && processSourceGapCount(c) < 2) return false;
      if (focusPreset === "ba" && !c.indicio_busca_apreensao) return false;
      return true;
    });
  }, [props.items, tribunal, classe, risco, assunto, municipio, grau, sistema, responsavel, novidade, periodStart, periodEnd, focusPreset, props.ownerNameByAuth]);

  React.useEffect(() => setPage(1), [tribunal, classe, risco, assunto, municipio, grau, sistema, responsavel, novidade, periodStart, periodEnd, focusPreset, props.query, props.statusFilter]);
  React.useEffect(() => {
    if (!rows.length) {
      setSelectedId("");
      return;
    }
    if (!rows.some((c) => String(c.id || c.protocolo) === selectedId)) {
      setSelectedId(String(rows[0].id || rows[0].protocolo));
    }
  }, [rows, selectedId]);

  const selected = React.useMemo(
    () => rows.find((c) => String(c.id || c.protocolo) === selectedId) || rows[0] || null,
    [rows, selectedId]
  );
  React.useEffect(()=>setOabResult(null),[selectedId]);

  const loaded = props.items.length;
  const silenceCount = React.useMemo(() => props.items.filter((c) => (caseSilenceDays(c) || 0) >= 45).length, [props.items]);
  const updateCount = React.useMemo(() => props.items.filter((c) => c.tem_novo_andamento || c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao).length, [props.items]);
  const highRiskCount = React.useMemo(() => props.items.filter((c) => riskLabel(c) === "Alto").length, [props.items]);
  const noMovementCount = React.useMemo(() => props.items.filter((c) => !clean(latestMovementDate(c))).length, [props.items]);
  const sourceCoverage = React.useMemo(()=>{
    const total=Math.max(1,props.items.length);
    const datajud=props.items.filter(c=>!!clean(c.datajud_consultado_em)).length;
    const djen=props.items.filter(c=>!!clean(c.djen_consultado_em)).length;
    const fresh=props.items.filter(c=>{
      const f=sourceFreshness(c);
      return f.tone==="green"||f.tone==="blue";
    }).length;
    const hashed=props.items.filter(c=>!!clean(c.datajud_hash)).length;
    return {
      datajud, djen, fresh, hashed,
      datajudPct:Math.round(datajud/total*100),
      djenPct:Math.round(djen/total*100),
      freshPct:Math.round(fresh/total*100),
      hashPct:Math.round(hashed/total*100),
    };
  },[props.items]);
  const focusCounts = React.useMemo(()=>({
    urgent:props.items.filter(c=>riskLabel(c)==="Alto"||c.status==="Vencido"||c.status==="Caso Crítico").length,
    returns:props.items.filter(c=>c.status==="Vencido"||c.status==="É Hoje"||c.status==="Atenção"||(typeof c.diasFaltando==="number"&&c.diasFaltando<=3)).length,
    djen:props.items.filter(c=>c.djen_nova_comunicacao||!!djenCriticalLabel(c)).length,
    updates:props.items.filter(c=>c.tem_novo_andamento||c.tem_atualizacao_pos_retorno||c.djen_nova_comunicacao).length,
    silence:props.items.filter(c=>(caseSilenceDays(c)||0)>=45).length,
    sources:props.items.filter(c=>processSourceGapCount(c)>=2).length,
    ba:props.items.filter(c=>!!c.indicio_busca_apreensao).length,
  }),[props.items]);

  const tribunalData = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const c of props.items) {
      const key = clean(c.tribunal) || "Outros";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [props.items]);

  const statusData = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const c of props.items) {
      const key = clean(c.status) || "Sem status";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [props.items]);

  const monthlyData = React.useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), movimentacoes: 0, publicacoes: 0 };
    });
    const byKey = new Map(months.map((m) => [m.key, m]));
    for (const c of props.items) {
      const movement = parseDate(c.datajud_ultimo_movimento || c.evento_data);
      const djen = parseDate(c.djen_ultima_data);
      if (movement) {
        const key = `${movement.getFullYear()}-${String(movement.getMonth() + 1).padStart(2, "0")}`;
        const bucket = byKey.get(key); if (bucket) bucket.movimentacoes += 1;
      }
      if (djen) {
        const key = `${djen.getFullYear()}-${String(djen.getMonth() + 1).padStart(2, "0")}`;
        const bucket = byKey.get(key); if (bucket) bucket.publicacoes += 1;
      }
    }
    return months;
  }, [props.items]);

  const silenceBuckets = React.useMemo(() => {
    const buckets = [
      { label: "0–30 dias", min: 0, max: 30, value: 0, tone: "bg-emerald-400" },
      { label: "31–60 dias", min: 31, max: 60, value: 0, tone: "bg-amber-400" },
      { label: "61–180 dias", min: 61, max: 180, value: 0, tone: "bg-orange-400" },
      { label: "+180 dias", min: 181, max: Infinity, value: 0, tone: "bg-red-500" },
    ];
    for (const c of props.items) {
      const d = caseSilenceDays(c);
      if (d == null) continue;
      const bucket = buckets.find((b) => d >= b.min && d <= b.max);
      if (bucket) bucket.value += 1;
    }
    return buckets;
  }, [props.items]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);
  const maxSilence = Math.max(1, ...silenceBuckets.map((b) => b.value));

  async function openDjen(c: LegalCase) {
    setBusy("djen");
    try {
      const res = await openDjenPublicacaoAction(c.protocolo);
      if (res.success && res.link) window.open(res.link, "_blank", "noopener,noreferrer");
      else toast({ title: "DJEN", description: res.error || "Nenhuma publicação encontrada.", variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  async function downloadDossie(c: LegalCase) {
    setBusy("dossie");
    try {
      const res = await generateDossieProcessoPDFAction(c.protocolo, { useClaude: false });
      if (res.success) toCsvDownload(res.base64, res.filename);
      else toast({ title: "Dossiê", description: res.error || "Falha ao gerar PDF.", variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  async function validateOab(c:LegalCase){
    const raw=clean(pick(c,"oab","oab_numero","advogado_oab"));
    const numero=raw.replace(/\D/g,"");
    const uf=inferOabUf(c);
    if(!numero||!uf){
      toast({title:"OAB",description:"Número/UF da OAB não estão completos neste processo.",variant:"destructive"});
      return;
    }
    setBusy("oab");
    try{
      const res=await consultarOabAction(uf,numero);
      setOabResult(res);
      if(res.success)toast({title:"OAB validada",description:[res.nome,res.situacao].filter(Boolean).join(" · ")});
      else toast({title:"CNA/OAB",description:res.error||"Consulta automática indisponível; use o link oficial.",variant:"destructive"});
    }finally{setBusy("")}
  }

  const timeline = selected ? miniTimeline(selected) : [];
  const selectedSilence = selected ? caseSilenceDays(selected) : null;
  const selectedSources = React.useMemo(() => selected ? processSourceMatrix(selected) : [], [selected]);
  const selectedActions = React.useMemo(() => selected ? recommendedProcessActions(selected) : [], [selected]);
  const selectedCoverage = React.useMemo(() => selected ? processOperationalCoverage(selected) : 0, [selected]);
  const selectedTask = React.useMemo(() => { if (!selected) return null; try { return gerarTarefasJuridicas([selected], { limit: 1 })[0] || null; } catch { return null; } }, [selected]);

  return (
    <section className="min-h-full bg-[#050b18] text-slate-100">
      <div className="border-b border-white/8 bg-[radial-gradient(circle_at_20%_-40%,rgba(29,78,216,.28),transparent_45%),linear-gradient(180deg,#071326,#050b18)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-blue-400" />
              <h1 className="text-xl font-black tracking-[-.03em] sm:text-2xl">Processos</h1>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">Centro de análise processual · DataJud + DJEN + carteira + atendimento</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {props.canScan && props.onScan ? (
              <Button onClick={props.onScan} size="sm" className="h-8 bg-blue-600 text-[9px] font-bold hover:bg-blue-500">
                <RefreshCcw size={13} className="mr-1.5" />{props.scannerLabel || "Atualizar DataJud"}
              </Button>
            ) : null}
            {selected ? (
              <Button onClick={() => void openDjen(selected)} disabled={busy === "djen"} variant="outline" size="sm" className="h-8 border-white/15 bg-white/5 text-[9px] text-slate-200 hover:bg-white/10">
                {busy === "djen" ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : <FileClock size={12} className="mr-1.5" />}DJEN
              </Button>
            ) : null}
            <Button onClick={() => void props.onRefresh()} variant="outline" size="sm" className="h-8 border-white/15 bg-white/5 px-2 text-[9px] text-slate-200 hover:bg-white/10" title="Recarregar carteira">
              <RefreshCcw size={12} />
            </Button>
            <Button onClick={() => props.onExportCsv(rows)} variant="outline" size="sm" className="h-8 border-white/15 bg-white/5 text-[9px] text-slate-200 hover:bg-white/10">
              <Download size={12} className="mr-1.5" />Exportar CSV
            </Button>
            <Button onClick={() => props.onExportCsv(rows)} variant="outline" size="sm" title="CSV pronto para importação no Power BI" className="h-8 border-amber-400/20 bg-amber-500/8 text-[9px] text-amber-200 hover:bg-amber-500/15">
              Power BI
            </Button>
            <Button onClick={() => props.onExportCsv(rows)} variant="outline" size="sm" title="CSV pronto para importação no Tableau" className="h-8 border-orange-400/20 bg-orange-500/8 text-[9px] text-orange-200 hover:bg-orange-500/15">
              Tableau
            </Button>
            <Button asChild size="sm" className="h-8 bg-violet-600 text-[9px] font-bold hover:bg-violet-500">
              <Link href={selected ? `/report?processo=${encodeURIComponent(selected.protocolo)}` : "/report"}>
                <Sparkles size={12} className="mr-1.5" />Gerar relatório IA
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard icon={<FileSearch size={15}/>} label="Processos" value={props.loading ? "…" : props.totalCount || loaded} hint={loaded < props.totalCount ? `${loaded} carregados nesta visão` : "carteira carregada"} />
          <KpiCard icon={<Activity size={15}/>} label="Ativos" value={props.loading ? "…" : props.ativosCount} hint="carteira inteira" />
          <KpiCard icon={<FileClock size={15}/>} label="Sem andamento" value={props.loading ? "…" : noMovementCount} hint="nos processos carregados" kind="amber" />
          <KpiCard icon={<AlertTriangle size={15}/>} label="Vencidos" value={props.loading ? "…" : props.vencidosCount} hint="carteira inteira" kind="red" />
          <KpiCard icon={<CalendarClock size={15}/>} label="Silêncio +45d" value={props.loading ? "…" : silenceCount} hint="nos processos carregados" kind="amber" />
          <KpiCard icon={<ShieldAlert size={15}/>} label="Risco alto" value={props.loading ? "…" : highRiskCount} hint={`${updateCount} com novidade`} kind="red" />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {icon:<Database size={12}/>,label:"Cobertura DataJud",value:sourceCoverage.datajudPct+"%",hint:sourceCoverage.datajud+" / "+loaded},
            {icon:<Gavel size={12}/>,label:"Cobertura DJEN",value:sourceCoverage.djenPct+"%",hint:sourceCoverage.djen+" / "+loaded},
            {icon:<Clock3 size={12}/>,label:"Fontes ≤7 dias",value:sourceCoverage.freshPct+"%",hint:sourceCoverage.fresh+" frescos"},
            {icon:<Radar size={12}/>,label:"Snapshot / hash",value:sourceCoverage.hashPct+"%",hint:sourceCoverage.hashed+" monitoráveis"},
          ].map(card=><div key={card.label} className="flex items-center justify-between rounded-lg border border-white/8 bg-[#081427]/75 px-3 py-2">
            <div className="flex items-center gap-2 text-slate-500">{card.icon}<span className="text-[8px] font-bold uppercase tracking-[.08em]">{card.label}</span></div>
            <div className="text-right"><b className="text-[11px] text-slate-200">{card.value}</b><p className="text-[7px] text-slate-600">{card.hint}</p></div>
          </div>)}
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-172px)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 border-r border-white/8">
          <div className="border-b border-white/8 bg-[#071120] p-3">
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {([
                ["all","Todos",loaded,Rows3],
                ["urgent","Urgentes",focusCounts.urgent,ShieldAlert],
                ["returns","Prazos/retornos",focusCounts.returns,CalendarClock],
                ["djen","Radar DJEN",focusCounts.djen,Gavel],
                ["updates","Novidades",focusCounts.updates,Activity],
                ["silence","Silêncio +45d",focusCounts.silence,FileClock],
                ["sources","Fontes incompletas",focusCounts.sources,Database],
                ["ba","B.A.",focusCounts.ba,Scale],
              ] as const).map(([value,label,count,Icon])=>(
                <button key={value} onClick={()=>setFocusPreset(value)} className={cn("flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[8px] font-bold transition",focusPreset===value?"border-blue-400/35 bg-blue-500/15 text-blue-100":"border-white/8 bg-white/[.025] text-slate-500 hover:bg-white/5 hover:text-slate-200")}>
                  <Icon size={11}/>{label}<span className="rounded bg-black/20 px-1 text-[7px] tabular-nums">{count}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
              <select value={tribunal} onChange={(e) => setTribunal(e.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#0b1930] px-2 text-[9px] text-slate-200">
                <option value="">Tribunal · todos</option>
                {tribunais.map((x) => <option key={x}>{x}</option>)}
              </select>
              <select value={classe} onChange={(e) => setClasse(e.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#0b1930] px-2 text-[9px] text-slate-200">
                <option value="">Classe · todas</option>
                {classes.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <select value={assunto} onChange={(e) => setAssunto(e.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#0b1930] px-2 text-[9px] text-slate-200">
                <option value="">Assunto · todos</option>
                {assuntos.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#0b1930] px-2 text-[9px] text-slate-200">
                <option value="">Município · todos</option>
                {municipios.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <select value={grau} onChange={(e) => setGrau(e.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#0b1930] px-2 text-[9px] text-slate-200">
                <option value="">Grau · todos</option>
                {graus.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <select value={sistema} onChange={(e) => setSistema(e.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#0b1930] px-2 text-[9px] text-slate-200">
                <option value="">Sistema · todos</option>
                {sistemas.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#0b1930] px-2 text-[9px] text-slate-200">
                <option value="">Responsável · todos</option>
                {responsaveis.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <select value={novidade} onChange={(e) => setNovidade(e.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#0b1930] px-2 text-[9px] text-slate-200">
                <option value="">Novidade · qualquer</option>
                <option value="novidade">Com novidade</option>
                <option value="datajud">DataJud após retorno</option>
                <option value="djen">Nova publicação DJEN</option>
                <option value="sem">Sem novidade</option>
              </select>
              <select value={props.statusFilter} onChange={(e) => props.onStatusFilterChange(e.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#0b1930] px-2 text-[9px] text-slate-200">
                <option value="">Situação · todas</option>
                {[...new Set(props.items.map((c) => clean(c.status)).filter(Boolean))].sort().map((x) => <option key={x}>{x}</option>)}
              </select>
              <select value={risco} onChange={(e) => setRisco(e.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#0b1930] px-2 text-[9px] text-slate-200">
                <option value="">Risco · todos</option>
                <option>Alto</option><option>Médio</option><option>Baixo</option>
              </select>
              <label className="flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-[#0b1930] px-2 text-[8px] text-slate-500">
                De <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[8px] text-slate-300 outline-none"/>
              </label>
              <label className="flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-[#0b1930] px-2 text-[8px] text-slate-500">
                Até <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[8px] text-slate-300 outline-none"/>
              </label>
              <button onClick={() => props.onBaOnlyChange(!props.baOnly)} className={cn("h-9 rounded-lg border px-2 text-[9px] font-bold", props.baOnly ? "border-red-400/40 bg-red-500/15 text-red-200" : "border-white/10 bg-[#0b1930] text-slate-300")}>
                B.A. real
              </button>
              <button onClick={() => props.onSilencioOnlyChange(!props.silencioOnly)} className={cn("h-9 rounded-lg border px-2 text-[9px] font-bold", props.silencioOnly ? "border-amber-400/40 bg-amber-500/15 text-amber-200" : "border-white/10 bg-[#0b1930] text-slate-300")}>
                Silêncio ≥45d
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)} placeholder="Buscar CNJ, cliente, advogado, tribunal, assunto…" className="h-9 w-full rounded-lg border border-white/10 bg-[#0b1930] pl-9 pr-3 text-[10px] text-white outline-none placeholder:text-slate-600 focus:border-blue-400/50" />
              </div>
              <button onClick={() => props.onSortOpsChange(!props.sortOps)} className={cn("h-9 rounded-lg border px-3 text-[9px] font-bold", props.sortOps ? "border-blue-400/40 bg-blue-500/15 text-blue-200" : "border-white/10 bg-[#0b1930] text-slate-300")}>
                <Filter size={12} className="mr-1 inline" />Prioridade ops
              </button>
              {(focusPreset!=="all" || props.query || props.statusFilter || tribunal || classe || assunto || municipio || grau || sistema || responsavel || novidade || risco || periodStart || periodEnd || props.baOnly || props.silencioOnly) ? (
                <button onClick={() => { setFocusPreset("all"); props.onQueryChange(""); props.onStatusFilterChange(""); props.onBaOnlyChange(false); props.onSilencioOnlyChange(false); setTribunal(""); setClasse(""); setAssunto(""); setMunicipio(""); setGrau(""); setSistema(""); setResponsavel(""); setNovidade(""); setRisco(""); setPeriodStart(""); setPeriodEnd(""); }} className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-[9px] text-slate-400 hover:text-white">
                  <X size={12} className="mr-1 inline" />Limpar
                </button>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1480px] w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-[#081427] text-[8px] uppercase tracking-[.08em] text-slate-500">
                <tr>
                  {["Número CNJ","Cliente","Tribunal","Classe","Assunto","Órgão julgador","Município","Ajuizamento","Última atualização","Último movimento","Dias","Situação","Risco","Responsável","Próximo retorno"].map((h) => (
                    <th key={h} className="border-b border-white/8 px-2 py-2.5 font-bold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[9px]">
                {props.loading ? (
                  <tr><td colSpan={15} className="py-20 text-center text-slate-500"><Loader2 size={20} className="mx-auto mb-2 animate-spin"/>Carregando carteira…</td></tr>
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={15} className="py-20 text-center text-slate-500">{props.searching ? "Buscando na empresa…" : "Nenhum processo encontrado."}</td></tr>
                ) : pageRows.map((c) => {
                  const id = String(c.id || c.protocolo);
                  const selectedRow = id === selectedId;
                  const silence = caseSilenceDays(c);
                  const classeValue = clean(pick(c, "classe_acao", "classeProcessual_nome", "classe")) || "—";
                  const assunto = clean(pick(c, "assunto_nome", "assunto", "tipo")) || "—";
                  const municipio = clean(pick(c, "orgaoJulgador_municipio", "municipio", "cidade")) || "—";
                  const ajuizamento = pick(c, "dataDistribuicao", "dataAjuizamento", "data_ajuizamento");
                  const update = pick(c, "datajud_consultado_em", "evento_data", "djen_consultado_em");
                  const priority = riskLabel(c);
                  return (
                    <tr key={id} onClick={() => { setSelectedId(id); setTab("overview"); }} className={cn("cursor-pointer border-b border-white/[.055] transition-colors hover:bg-blue-500/[.07]", selectedRow && "bg-blue-600/[.14] ring-1 ring-inset ring-blue-400/20")}>
                      <td className="px-2 py-2 font-mono font-bold text-cyan-300">{fmtCnj(c.protocolo)}</td>
                      <td className="max-w-[150px] truncate px-2 py-2 font-semibold text-slate-200" title={c.cliente}>{c.cliente || "—"}</td>
                      <td className="px-2 py-2 text-slate-300">{c.tribunal || "—"}</td>
                      <td className="max-w-[140px] truncate px-2 py-2 text-slate-400" title={classeValue}>{classeValue}</td>
                      <td className="max-w-[140px] truncate px-2 py-2 text-slate-400" title={assunto}>{assunto}</td>
                      <td className="max-w-[150px] truncate px-2 py-2 text-slate-400" title={c.orgao_julgador}>{c.orgao_julgador || "—"}</td>
                      <td className="px-2 py-2 text-slate-400">{municipio}</td>
                      <td className="px-2 py-2 text-slate-400 whitespace-nowrap">{fmtDate(ajuizamento)}</td>
                      <td className="px-2 py-2 text-slate-400 whitespace-nowrap"><span>{fmtDate(update)}</span><span className={cn("ml-1 rounded border px-1 py-0.5 text-[7px]",toneBadge(sourceFreshness(c).tone))}>{sourceFreshness(c).label}</span></td>
                      <td className="max-w-[170px] truncate px-2 py-2 text-sky-300" title={latestMovement(c)}>{latestMovement(c)}</td>
                      <td className={cn("px-2 py-2 font-black tabular-nums", (silence || 0) >= 45 ? "text-red-300" : "text-slate-300")}>{silence ?? "—"}</td>
                      <td className="px-2 py-2"><span className={cn("rounded-full border px-1.5 py-1 text-[8px] font-bold", statusColor(String(c.status)))}>{c.status || "—"}</span></td>
                      <td className="px-2 py-2"><span className={cn("rounded-full border px-1.5 py-1 text-[8px] font-bold", statusColor(priority))}>{priority}</span></td>
                      <td className="max-w-[120px] truncate px-2 py-2 text-slate-300">{ownerName(c, props.ownerNameByAuth)}</td>
                      <td className={cn("px-2 py-2 font-semibold whitespace-nowrap", c.status === "Vencido" ? "text-red-300" : "text-slate-300")}>{fmtDate(c.proximoPrazo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/8 bg-[#071120] px-3 py-2">
            <p className="text-[8px] text-slate-500">Mostrando {pageRows.length} de {rows.length} processos carregados · {props.totalCount || loaded} na empresa</p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/5 disabled:opacity-30"><ChevronLeft size={12}/></button>
              <span className="px-2 text-[8px] text-slate-400">{page} / {pageCount}</span>
              <button disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/5 disabled:opacity-30"><ChevronRight size={12}/></button>
            </div>
          </div>

          <div className="grid gap-2 bg-[#050b18] p-2 lg:grid-cols-3">
            <div className="rounded-xl border border-white/8 bg-[#071120] p-3">
              <p className="mb-2 text-[9px] font-bold text-slate-300">Distribuição por tribunal</p>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={tribunalData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={66} strokeWidth={0}>{tribunalData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}</Pie><RechartsTooltip contentStyle={{background:"#071120",border:"1px solid rgba(255,255,255,.12)",fontSize:10}}/></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[8px] text-slate-500">{tribunalData.map((x,i)=><span key={x.name}><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{background:COLORS[i%COLORS.length]}}/>{x.name}: {x.value}</span>)}</div>
            </div>

            <div className="rounded-xl border border-white/8 bg-[#071120] p-3">
              <p className="mb-2 text-[9px] font-bold text-slate-300">Situação dos processos</p>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={66} strokeWidth={0}>{statusData.map((_, i) => <Cell key={i} fill={COLORS[(i+2) % COLORS.length]}/>)}</Pie><RechartsTooltip contentStyle={{background:"#071120",border:"1px solid rgba(255,255,255,.12)",fontSize:10}}/></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[8px] text-slate-500">{statusData.map((x,i)=><span key={x.name}><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{background:COLORS[(i+2)%COLORS.length]}}/>{x.name}: {x.value}</span>)}</div>
            </div>

            <div className="rounded-xl border border-white/8 bg-[#071120] p-3">
              <p className="mb-2 text-[9px] font-bold text-slate-300">Movimentos e publicações · 12 meses</p>
              <div className="h-[210px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData}>
                    <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/>
                    <XAxis dataKey="label" tick={{fill:"#64748b",fontSize:8}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:"#64748b",fontSize:8}} axisLine={false} tickLine={false} width={26}/>
                    <RechartsTooltip contentStyle={{background:"#071120",border:"1px solid rgba(255,255,255,.12)",fontSize:10}}/>
                    <Legend wrapperStyle={{fontSize:8}}/>
                    <Line type="monotone" dataKey="movimentacoes" name="DataJud" stroke="#4f7cff" strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="publicacoes" name="DJEN" stroke="#a855f7" strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <aside className="bg-[#071120] p-3">
          {selected ? (
            <div className="sticky top-0 space-y-2">
              <div className="rounded-xl border border-white/8 bg-[#0a1729] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-bold text-cyan-300">{fmtCnj(selected.protocolo)}</p>
                    <p className="mt-1 truncate text-[12px] font-black text-white">{selected.cliente}</p>
                  </div>
                  <Button size="sm" onClick={() => props.onEdit(selected)} className="h-7 bg-blue-600 px-2 text-[8px]">Abrir processo</Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className={cn("rounded-full border px-2 py-1 text-[8px] font-bold", statusColor(String(selected.status)))}>{selected.status}</span>
                  <span className={cn("rounded-full border px-2 py-1 text-[8px] font-bold", statusColor(riskLabel(selected)))}>Risco {riskLabel(selected)}</span>
                  {selectedSilence != null ? <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[8px] text-amber-200">{selectedSilence}d sem movimento</span> : null}
                  <span className={cn("rounded-full border px-2 py-1 text-[8px] font-bold",toneBadge(returnState(selected).tone))}>{returnState(selected).label}</span>
                  <span className={cn("rounded-full border px-2 py-1 text-[8px] font-bold",toneBadge(sourceFreshness(selected).tone))}>Fonte {sourceFreshness(selected).label}</span>
                  <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-[8px] font-bold text-blue-200">Cobertura {selectedCoverage}%</span>
                  {selected.datajud_hash?<span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[8px] font-bold text-cyan-200">Snapshot ativo</span>:null}
                </div>
              </div>

              <div className="grid grid-cols-6 rounded-xl border border-white/8 bg-[#0a1729] p-1">
                {([
                  ["overview","Visão"],["movements","Mov."],["deadlines","Prazos"],["parties","Partes"],["documents","Docs"],["ai","IA"]
                ] as [DetailTab,string][]).map(([value,label])=>(
                  <button key={value} onClick={()=>setTab(value)} className={cn("rounded-lg px-1 py-2 text-[8px] font-bold", tab===value?"bg-blue-600 text-white":"text-slate-500 hover:text-slate-200")}>{label}</button>
                ))}
              </div>

              {tab === "overview" ? (
                <div className="space-y-2">
                  <Panel title="Resumo operacional">
                    <Info label="Tribunal" value={selected.tribunal}/>
                    <Info label="Classe" value={pick(selected,"classe_acao","classeProcessual_nome","classe")}/>
                    <Info label="Assunto" value={pick(selected,"assunto_nome","assunto","tipo")}/>
                    <Info label="Órgão julgador" value={selected.orgao_julgador}/>
                    <Info label="Próximo retorno" value={fmtDate(selected.proximoPrazo)}/>
                    <Info label="Último retorno" value={fmtDate(selected.ultimoRetorno)}/>
                    <Info label="Responsável" value={ownerName(selected, props.ownerNameByAuth)}/>
                  </Panel>
                  <Panel title="Alertas críticos" tone="red">
                    {selected.status === "Vencido" ? <AlertLine icon={<CircleAlert size={12}/>} text="Prazo/retorno vencido"/> : null}
                    {(selectedSilence || 0) >= 45 ? <AlertLine icon={<FileClock size={12}/>} text={`Sem movimentação há ${selectedSilence} dias`}/> : null}
                    {selected.djen_nova_comunicacao ? <AlertLine icon={<Gavel size={12}/>} text="Nova publicação DJEN não tratada"/> : null}
                    {djenCriticalLabel(selected) ? <AlertLine icon={<ShieldAlert size={12}/>} text={`Radar DJEN: ${djenCriticalLabel(selected)}`}/> : null}
                    {selected.tem_atualizacao_pos_retorno ? <AlertLine icon={<History size={12}/>} text="Tribunal atualizou após o último retorno"/> : null}
                    {riskLabel(selected)==="Baixo" && !selected.djen_nova_comunicacao && !(selectedSilence && selectedSilence>=45) ? <p className="text-[9px] text-emerald-300">Nenhum alerta crítico calculado.</p> : null}
                  </Panel>
                  <Panel title="Próximos passos">
                    {selectedTask ? (
                      <div className="mb-2 rounded-lg border border-blue-400/15 bg-blue-500/8 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <b className="text-[9px] text-blue-100">{selectedTask.titulo}</b>
                          <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[7px] font-bold text-blue-200">{selectedTask.faixa}</span>
                        </div>
                        <p className="mt-1 text-[8px] leading-relaxed text-slate-400">{selectedTask.detalhe}</p>
                      </div>
                    ) : null}
                    <div className="space-y-1.5">
                      {selectedActions.slice(0,3).map((action,index)=>(
                        <div key={action.title+index} className={cn("rounded-lg border px-2 py-2", action.tone==="red"?"border-red-400/15 bg-red-500/8":action.tone==="amber"?"border-amber-400/15 bg-amber-500/8":action.tone==="green"?"border-emerald-400/15 bg-emerald-500/8":"border-white/8 bg-white/[.025]")}>
                          <p className="text-[8px] font-bold text-slate-200">{action.title}</p>
                          <p className="mt-0.5 text-[7px] leading-relaxed text-slate-500">{action.detail}</p>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => props.onAttend(selected)} className="mt-2 w-full rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-2 text-left text-[9px] font-bold text-cyan-200 hover:bg-cyan-500/15">Registrar atendimento / próximo retorno</button>
                    <button onClick={() => void openDjen(selected)} className="mt-1 w-full rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-2 text-left text-[9px] font-bold text-violet-200 hover:bg-violet-500/15">Abrir publicação DJEN</button>
                    <Link href={"/tarefas?processo="+encodeURIComponent(selected.protocolo)} className="mt-1 block rounded-lg border border-blue-400/20 bg-blue-500/8 px-2 py-2 text-[9px] font-bold text-blue-200 hover:bg-blue-500/15">Abrir fila de tarefas</Link>
                  </Panel>
                  <Panel title="Monitor de fontes">
                    <div className="mb-2 flex items-center justify-between rounded-lg border border-blue-400/15 bg-blue-500/8 px-2 py-2">
                      <span className="text-[8px] font-bold text-blue-100">Cobertura operacional</span>
                      <b className="text-[12px] text-white">{selectedCoverage}%</b>
                    </div>
                    {selectedSources.map((source)=>(
                      <div key={source.id} className="flex items-start justify-between gap-2 border-b border-white/[.055] py-1.5 last:border-0">
                        <div>
                          <p className="text-[8px] font-semibold text-slate-300">{source.label}</p>
                          <p className="text-[7px] text-slate-600">{source.category}</p>
                        </div>
                        <div className="max-w-[160px] text-right">
                          <span className={cn("rounded border px-1.5 py-0.5 text-[7px] font-bold",source.available?(source.fresh===false?"border-amber-400/20 bg-amber-500/8 text-amber-200":"border-emerald-400/20 bg-emerald-500/8 text-emerald-200"):"border-red-400/20 bg-red-500/8 text-red-200")}>{source.available?(source.fresh===false?"envelhecida":"disponível"):"ausente"}</span>
                          <p className="mt-1 text-[7px] leading-relaxed text-slate-500">{source.detail}</p>
                        </div>
                      </div>
                    ))}
                    <Info label="Mudança pós-retorno" value={selected.tem_atualizacao_pos_retorno?"SIM":"não sinalizada"}/>
                  </Panel>
                </div>
              ) : null}

              {tab === "movements" ? (
                <Panel title="Linha do tempo">
                  {timeline.length ? timeline.map((item, index) => (
                    <div key={index} className="relative border-l border-blue-500/30 pb-3 pl-4 last:pb-0">
                      <span className="absolute -left-[4px] top-1 h-2 w-2 rounded-full bg-blue-400 ring-2 ring-[#0a1729]"/>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[9px] font-bold text-slate-200">{item.label}</p>
                        <span className="text-[7px] text-slate-600">{fmtDate(item.date,true)}</span>
                      </div>
                      {item.detail ? <p className="mt-1 line-clamp-3 text-[8px] leading-relaxed text-slate-500">{item.detail}</p> : null}
                      <p className="mt-1 text-[7px] font-bold uppercase text-blue-400/70">{item.source}</p>
                    </div>
                  )) : <p className="text-[9px] text-slate-500">Sem timeline em cache. Rode DataJud + DJEN.</p>}
                </Panel>
              ) : null}

              {tab === "deadlines" ? (
                <div className="space-y-2">
                  <Panel title="Prazos e retornos">
                    <Info label="Próximo retorno operacional" value={fmtDate(selected.proximoPrazo)}/>
                    <Info label="Status do retorno" value={returnState(selected).label}/>
                    <Info label="Dias faltando" value={selected.diasFaltando==null?"sem data calculável":String(selected.diasFaltando)}/>
                    <Info label="Último retorno ao cliente" value={fmtDate(selected.ultimoRetorno)}/>
                    <Info label="Alerta DJEN" value={djenCriticalLabel(selected)||"sem termo crítico"}/>
                  </Panel>
                  <div className="rounded-xl border border-amber-400/15 bg-amber-500/8 p-3 text-[8px] leading-relaxed text-amber-100/80">
                    <div className="flex items-center gap-1.5 font-bold text-amber-200"><Clock3 size={11}/>Separação de conceitos</div>
                    <p className="mt-1">“Próximo retorno” é compromisso operacional da carteira. Um prazo judicial só deve ser tratado como tal quando vier de fonte/documento que sustente a data. O painel não transforma automaticamente publicação em prazo fatal.</p>
                  </div>
                  <Panel title="Ações">
                    <button onClick={() => props.onAttend(selected)} className="w-full rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-2 text-left text-[9px] font-bold text-cyan-200 hover:bg-cyan-500/15">Registrar atendimento / reagendar retorno</button>
                    <Link href={`/agenda?processo=${encodeURIComponent(selected.protocolo)}`} className="mt-1 block rounded-lg border border-blue-400/20 bg-blue-500/10 px-2 py-2 text-[9px] font-bold text-blue-200 hover:bg-blue-500/15">Abrir na agenda</Link>
                    <button onClick={() => void openDjen(selected)} className="mt-1 w-full rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-2 text-left text-[9px] font-bold text-violet-200 hover:bg-violet-500/15">Revisar última publicação DJEN</button>
                  </Panel>
                </div>
              ) : null}

              {tab === "parties" ? (
                <div className="space-y-2">
                  <Panel title="Partes e representantes">
                    <Info label="Cliente / parte ativa" value={selected.cliente}/>
                    <Info label="Parte passiva" value={selected.parte_passiva}/>
                    <Info label="CPF" value={selected.cpf ? "***"+selected.cpf.slice(-4) : ""}/>
                    <Info label="Advogado" value={selected.advogado}/>
                    <Info label="Escritório" value={selected.escritorio}/>
                    <Info label="OAB" value={pick(selected,"oab","oab_numero","advogado_oab")}/>
                  </Panel>
                  {pick(selected,"oab","oab_numero","advogado_oab") ? (
                    <div className="space-y-2">
                      <button disabled={busy==="oab"} onClick={()=>void validateOab(selected)} className="flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-500/8 px-2 py-2 text-[9px] font-bold text-emerald-200 hover:bg-emerald-500/12">
                        {busy==="oab"?<Loader2 size={12} className="animate-spin"/>:<ShieldCheck size={12}/>}Validar OAB no CNA
                      </button>
                      {oabResult?<div className={cn("rounded-lg border p-2 text-[8px]",oabResult.success?"border-emerald-400/20 bg-emerald-500/8 text-emerald-100":"border-amber-400/20 bg-amber-500/8 text-amber-100")}>
                        <b>{oabResult.success?"OAB localizada":"Validação automática indisponível"}</b>
                        {oabResult.nome?<p className="mt-1">{oabResult.nome}</p>:null}
                        {oabResult.situacao?<p>{oabResult.situacao}</p>:null}
                        {oabResult.error?<p className="mt-1 text-amber-200/80">{oabResult.error}</p>:null}
                        <a href={oabResult.consultaUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 underline"><ExternalLink size={9}/>abrir consulta oficial</a>
                      </div>:null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === "documents" ? (
                <div className="space-y-2">
                  <Panel title="Documentos e fontes">
                    <button disabled={busy==="dossie"} onClick={() => void downloadDossie(selected)} className="w-full rounded-lg border border-blue-400/20 bg-blue-500/10 px-2 py-2 text-left text-[9px] font-bold text-blue-200">
                      {busy==="dossie"?<Loader2 size={11} className="mr-1 inline animate-spin"/>:<FileDown size={11} className="mr-1 inline"/>}Gerar dossiê PDF
                    </button>
                    {selected.djen_ultimo_link ? <a href={selected.djen_ultimo_link} target="_blank" rel="noreferrer" className="mt-1 block rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-2 text-[9px] font-bold text-violet-200"><ExternalLink size={11} className="mr-1 inline"/>Última publicação DJEN</a> : null}
                    {selected.linkConsulta ? <a href={selected.linkConsulta} target="_blank" rel="noreferrer" className="mt-1 block rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[9px] font-bold text-slate-300"><ExternalLink size={11} className="mr-1 inline"/>Consulta externa do processo</a> : null}
                  </Panel>
                  <Panel title="Fonte e atualização">
                    <Info label="DataJud consultado" value={fmtDate(selected.datajud_consultado_em,true)}/>
                    <Info label="DJEN consultado" value={fmtDate(selected.djen_consultado_em,true)}/>
                    <Info label="Publicações DJEN" value={String(selected.djen_count || 0)}/>
                    <Info label="Sistema processual" value={pick(selected,"sistema_nome","sistema")}/>
                    <Info label="Frescor combinado" value={sourceFreshness(selected).label}/>
                    <Info label="Snapshot DataJud" value={selected.datajud_hash?"disponível":"não disponível"}/>
                    <Info label="Cobertura operacional" value={selectedCoverage+"%"}/>
                  </Panel>
                  <Panel title="Matriz de proveniência">
                    {selectedSources.map((source)=>(
                      <div key={source.id} className="mb-1 rounded-lg border border-white/8 bg-white/[.02] px-2 py-2 last:mb-0">
                        <div className="flex items-center justify-between gap-2">
                          <b className="text-[8px] text-slate-200">{source.label}</b>
                          <span className={cn("text-[7px] font-bold",source.available?"text-emerald-300":"text-red-300")}>{source.available?"OK":"LACUNA"}</span>
                        </div>
                        <p className="mt-1 text-[7px] text-slate-500">{source.category} · {source.detail}</p>
                      </div>
                    ))}
                    <p className="mt-2 text-[7px] leading-relaxed text-slate-600">DataJud/DJEN são fontes públicas oficiais; carteira/atendimento são dados operacionais internos; snapshot/hash apenas evidencia mudança entre consultas.</p>
                  </Panel>
                </div>
              ) : null}

              {tab === "ai" ? (
                <div className="space-y-2">
                  <Panel title="Radar operacional">
                    <Info label="Urgência" value={riskLabel(selected)}/>
                    <Info label="Prazo/retorno" value={returnState(selected).label}/>
                    <Info label="Silêncio tribunal" value={selectedSilence==null?"sem dado":selectedSilence+" dias"}/>
                    <Info label="Radar DJEN" value={djenCriticalLabel(selected)||"sem termo crítico"}/>
                    <Info label="Fonte" value={sourceFreshness(selected).label}/>
                  </Panel>
                  <Panel title="Análise inteligente">
                    {selected.parecerIA ? <p className="text-[9px] leading-relaxed text-slate-300">{selected.parecerIA}</p> : (
                      <div className="space-y-2 text-[9px] leading-relaxed text-slate-400">
                        <p><BrainCircuit size={12} className="mr-1 inline text-violet-400"/>Prioridade operacional: <b className="text-white">{riskLabel(selected)}</b>.</p>
                        <p>{selectedSilence != null && selectedSilence >= 45 ? `O processo está há ${selectedSilence} dias sem movimentação registrada no cache e merece revisão.` : "Não há silêncio processual crítico calculado nesta visão."}</p>
                        <p>{selected.tem_novo_andamento || selected.djen_nova_comunicacao ? "Há novidade de tribunal/publicação a tratar antes do próximo contato com o cliente." : "Nenhuma novidade não tratada foi sinalizada."}</p>
                      </div>
                    )}
                  </Panel>
                  <Button asChild className="w-full bg-violet-600 text-[9px] hover:bg-violet-500"><Link href={`/veredito?processo=${encodeURIComponent(selected.protocolo)}`}><Sparkles size={12} className="mr-1"/>Abrir análise IA</Link></Button>
                  <Button asChild variant="outline" className="w-full border-white/10 bg-white/5 text-[9px] text-slate-300"><Link href={`/report?processo=${encodeURIComponent(selected.protocolo)}`}><BarChart3 size={12} className="mr-1"/>Gerar relatório</Link></Button>
                </div>
              ) : null}

              <Panel title="Tempo sem andamento">
                <div className="space-y-2">
                  {silenceBuckets.map((b) => (
                    <div key={b.label}>
                      <div className="flex justify-between text-[8px] text-slate-500"><span>{b.label}</span><span>{b.value}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5"><div className={cn("h-full rounded-full", b.tone)} style={{width:`${Math.max(3,(b.value/maxSilence)*100)}%`}}/></div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          ) : (
            <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-white/10 text-center text-slate-600">
              <div><Scale size={28} className="mx-auto mb-2"/>Selecione um processo.</div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function Panel({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "red" }) {
  return (
    <div className={cn("rounded-xl border bg-[#0a1729] p-3", tone === "red" ? "border-red-400/15" : "border-white/8")}>
      <p className="mb-2 text-[9px] font-black text-slate-300">{title}</p>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  const v = clean(value);
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[.055] py-1.5 last:border-0">
      <span className="text-[8px] text-slate-600">{label}</span>
      <span className="max-w-[190px] text-right text-[8px] font-semibold text-slate-300">{v || "—"}</span>
    </div>
  );
}

function AlertLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="mb-1 flex items-center gap-2 rounded-lg border border-red-400/15 bg-red-500/8 px-2 py-2 text-[8px] font-semibold text-red-200 last:mb-0"><span className="text-red-400">{icon}</span>{text}</div>;
}
