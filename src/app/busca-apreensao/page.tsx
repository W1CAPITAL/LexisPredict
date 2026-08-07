"use client";

/**
 * Fila BA — tipos claros (veículo/prisão/penhora/imóvel) + geo + histórico visual.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert,
  Play,
  Pause,
  Square,
  ExternalLink,
  User,
  Briefcase,
  History,
  Car,
  Lock,
  Package,
  Home,
  MapPin,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MotorSelector } from "@/components/ai/motor-selector";
import { loadPreferredMotor, type MotorId } from "@/lib/ai/motors";
import {
  listBaQueueAction,
  scanOneClienteBaAction,
  listBaScanLogsAction,
  type BaHit,
  type BaQueueItem,
} from "@/app/actions/busca-apreensao-actions";

type Status = "idle" | "running" | "paused" | "done";

const DELAY_MS = 2800;
const DELAY_ON_429_MS = 45000;

function sleep(ms: number, signal: { cancelled: boolean }) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(() => resolve(), ms);
    const iv = setInterval(() => {
      if (signal.cancelled) {
        clearTimeout(t);
        clearInterval(iv);
        resolve();
      }
    }, 200);
    setTimeout(() => clearInterval(iv), ms + 50);
  });
}

function TipoIcon({ tipo }: { tipo?: string | null }) {
  switch (tipo) {
    case "VEICULO":
      return <Car size={14} />;
    case "PRISAO":
      return <Lock size={14} />;
    case "PENHORA_BENS":
      return <Package size={14} />;
    case "IMOVEL":
      return <Home size={14} />;
    default:
      return <ShieldAlert size={14} />;
  }
}

function tipoClass(tipo?: string | null) {
  switch (tipo) {
    case "VEICULO":
      return "bg-orange-600 text-white";
    case "PRISAO":
      return "bg-red-900 text-white";
    case "PENHORA_BENS":
      return "bg-amber-700 text-white";
    case "IMOVEL":
      return "bg-purple-700 text-white";
    default:
      return "bg-red-600 text-white";
  }
}

function tipoLabel(tipo?: string | null) {
  switch (tipo) {
    case "VEICULO":
      return "Veículo";
    case "PRISAO":
      return "Prisão";
    case "PENHORA_BENS":
      return "Penhora de bens";
    case "IMOVEL":
      return "Imóvel";
    case "GENERICO":
      return "BA genérico";
    default:
      return "BA";
  }
}

function HitCard({ h }: { h: BaHit }) {
  const distante = !!(h as any).geoDistante;
  const alertar = (h as any).alertarOperacional !== false && !distante;
  const tipo = (h as any).tipoBa as string | null;

  return (
    <div
      className={cn(
        "rounded-xl p-4 bg-card/50 space-y-2 border-2",
        alertar
          ? "border-red-600 shadow-[3px_3px_0_#dc2626]"
          : "border-amber-500/50 shadow-sm opacity-95"
      )}
    >
      <div className="flex flex-wrap justify-between gap-2">
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <Badge className={cn("font-black uppercase text-[8px] gap-1", tipoClass(tipo))}>
              <TipoIcon tipo={tipo} />
              {tipoLabel(tipo)}
            </Badge>
            <Badge variant="outline" className="text-[8px] font-black uppercase">
              {h.motivoBa}
            </Badge>
            {distante && (
              <Badge className="bg-slate-600 text-white text-[8px] font-black uppercase gap-1">
                <MapPin size={10} /> OUTRO ESTADO — ALARMAR
              </Badge>
            )}
            {!alertar && !distante && (
              <Badge variant="secondary" className="text-[8px] font-bold uppercase">
                Registro (sem alerta forte)
              </Badge>
            )}
          </div>
          <p className="font-black text-sm uppercase flex flex-wrap items-center gap-2">
            <User size={14} /> {h.clienteNome}
            {h.advogadoNome && (
              <span className="font-bold text-muted-foreground normal-case text-xs">
                · <Briefcase size={12} className="inline" /> {h.advogadoNome}
                {h.advogadoOab ? ` · OAB ${h.advogadoOab}` : ""}
              </span>
            )}
          </p>
          <p className="font-mono text-xs font-bold">
            Carteira: {h.protocoloCarteira || "—"}
            {(h as any).ufCarteira ? ` (${(h as any).ufCarteira})` : ""}
          </p>
          <p className="font-mono text-xs font-bold text-muted-foreground">
            DJEN: {h.processoDjen || "—"}
            {(h as any).ufMandado ? ` (${(h as any).ufMandado})` : ""}
          </p>
          <p className="text-[10px] text-muted-foreground font-bold uppercase">
            {h.data || "—"} · {h.tribunal || ""}
          </p>
          {((h as any).geoDistante || (h as any).geoMotivo) && (
            <p className="text-[10px] flex items-center gap-1 text-muted-foreground">
              <MapPin size={10} /> {(h as any).geoMotivo}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {(h.protocoloCarteira || h.processoDjen) && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl text-[8px] font-black uppercase h-8"
            >
              <Link
                href={`/cases?search=${encodeURIComponent(
                  h.protocoloCarteira || h.processoDjen || ""
                )}`}
              >
                Processo
              </Link>
            </Button>
          )}
          {h.link && (
            <Button asChild variant="outline" size="sm" className="rounded-xl h-8">
              <a href={h.link} target="_blank" rel="noreferrer">
                <ExternalLink size={12} />
              </a>
            </Button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground line-clamp-5 whitespace-pre-wrap">
        {h.trecho}
      </p>
    </div>
  );
}

export default function BuscaApreensaoPage() {
  const { toast } = useToast();
  const [queue, setQueue] = useState<BaQueueItem[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [index, setIndex] = useState(0);
  const [hits, setHits] = useState<BaHit[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [savedLogs, setSavedLogs] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [current, setCurrent] = useState<BaQueueItem | null>(null);
  const [preferredMotor, setPreferredMotor] = useState<MotorId>("claude");
  const [filtroTipo, setFiltroTipo] = useState<string>("ALL");
  const [filtroGeo, setFiltroGeo] = useState<"ALL" | "ALERTAR" | "DISTANTE">("ALL");
  const [filtroOrdem, setFiltroOrdem] = useState<"recentes" | "antigos" | "nome">("recentes");
  const [ordemHistorico, setOrdemHistorico] = useState<"recentes" | "antigos">("recentes");

  useEffect(() => {
    setPreferredMotor(loadPreferredMotor());
  }, []);

  const statusRef = useRef<Status>("idle");
  const indexRef = useRef(0);
  const queueRef = useRef<BaQueueItem[]>([]);
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const load = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const q = await listBaQueueAction();
      if (q.success) setQueue(q.queue || []);
      const logsRes = await listBaScanLogsAction();
      if ((logsRes as any)?.logs) setSavedLogs((logsRes as any).logs);
      else if (Array.isArray(logsRes)) setSavedLogs(logsRes as any);
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runLoop = async (from: number) => {
    cancelRef.current.cancelled = false;
    const q = queueRef.current;
    for (let i = from; i < q.length; i++) {
      if (cancelRef.current.cancelled) return;
      if (statusRef.current === "paused") return;
      const item = q[i];
      setIndex(i);
      setCurrent(item);
      setLogs((prev) => [`→ ${item.nome}`, ...prev].slice(0, 80));
      try {
        const res = await scanOneClienteBaAction(item.nome, {
          advogadoNome: item.advogadoNome,
          advogadoOab: item.advogadoOab,
          protocolos: item.protocolos,
          createdBy: item.createdBy,
          preferredMotor,
        });
        if (!res) {
          setLogs((prev) => [`✗ ${item.nome}: resposta vazia do servidor`, ...prev]);
          continue;
        }
        if (res.isRateLimited) {
          setLogs((prev) => [`429 rate limit — aguardando`, ...prev]);
          await sleep(DELAY_ON_429_MS, cancelRef.current);
          i--;
          continue;
        }
        if (!res.success && res.error) {
          setLogs((prev) => [`✗ ${item.nome}: ${res.error}`, ...prev]);
          continue;
        }
        if (res.hits?.length) {
          setHits((prev) => [...res.hits, ...prev]);
          const nAlert = res.hits.filter((h: any) => h.alertarOperacional !== false && !h.geoDistante).length;
          setLogs((prev) => [
            `✓ ${item.nome}: ${res.hits.length} hit(s), ${nAlert} alerta(s)`,
            ...prev,
          ]);
        } else {
          setLogs((prev) => [`· ${item.nome}: sem BA`, ...prev]);
        }
      } catch (e: any) {
        setLogs((prev) => [`✗ ${item.nome}: ${e?.message || "erro"}`, ...prev]);
      }
      await sleep(DELAY_MS, cancelRef.current);
    }
    setStatus("done");
    statusRef.current = "done";
    setCurrent(null);
    load();
  };

  const start = async () => {
    cancelRef.current.cancelled = false;
    setStatus("running");
    statusRef.current = "running";
    setHits([]);
    setLogs([]);
    setIndex(0);
    await runLoop(0);
  };

  const resume = async () => {
    setStatus("running");
    statusRef.current = "running";
    await runLoop(indexRef.current);
  };

  const pause = () => {
    cancelRef.current.cancelled = true;
    setStatus("paused");
    statusRef.current = "paused";
  };

  const stop = () => {
    cancelRef.current.cancelled = true;
    setStatus("idle");
    statusRef.current = "idle";
    setCurrent(null);
  };

  const total = queue.length;
  const done = Math.min(index, total);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const historicoOrdenado = useMemo(() => {
    const list = [...(savedLogs || [])];
    list.sort((a: any, b: any) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return ordemHistorico === "recentes" ? tb - ta : ta - tb;
    });
    return list;
  }, [savedLogs, ordemHistorico]);

  const hitsFiltrados = useMemo(() => {
    const filtered = hits.filter((h: any) => {
      if (filtroTipo !== "ALL" && h.tipoBa !== filtroTipo) return false;
      if (filtroGeo === "DISTANTE" && !h.geoDistante) return false;
      if (filtroGeo === "ALERTAR" && (h.geoDistante || h.alertarOperacional === false))
        return false;
      return true;
    });
    const ts = (h: any) => {
      const raw = h.dataDisponibilizacao || h.data_disponibilizacao || h.data || h.created_at || 0;
      const n = new Date(raw).getTime();
      return Number.isFinite(n) ? n : 0;
    };
    const list = [...filtered];
    if (filtroOrdem === "recentes") list.sort((a, b) => ts(b) - ts(a));
    else if (filtroOrdem === "antigos") list.sort((a, b) => ts(a) - ts(b));
    else list.sort((a, b) => String((a as any).clienteNome || (a as any).nomeCliente || "").localeCompare(String((b as any).clienteNome || (b as any).nomeCliente || ""), "pt-BR"));
    return list;
  }, [hits, filtroTipo, filtroGeo, filtroOrdem]);

  const contagemTipos = useMemo(() => {
    const c: Record<string, number> = {};
    for (const h of hits as any[]) {
      const k = h.tipoBa || "GENERICO";
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [hits]);

  return (
    <div className="flex h-screen bg-transparent font-sans text-foreground overflow-hidden relative z-10">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden glass-panel">
        <header className="border-b border-border/50 bg-card/60 backdrop-blur-xl p-4 sm:px-8 shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-600/10 border-2 border-red-600 flex items-center justify-center">
              <ShieldAlert className="text-red-600" size={20} />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest">
                Busca e Apreensão
              </h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">
                Tipos claros · filtro geo UF · Claude/OmniRoute no scanner
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <MotorSelector
              value={preferredMotor}
              onChange={(id) => setPreferredMotor(id)}
              compact
            />
            {(status === "idle" || status === "done") && (
              <Button
                onClick={start}
                disabled={loadingQueue}
                className="h-10 rounded-xl font-black uppercase text-[10px] bg-red-600 hover:bg-red-700 text-white"
              >
                <Play className="mr-2 h-4 w-4" /> Iniciar fila
              </Button>
            )}
            {status === "running" && (
              <Button
                onClick={pause}
                variant="outline"
                className="h-10 rounded-xl font-black uppercase text-[10px]"
              >
                <Pause className="mr-2 h-4 w-4" /> Pausar
              </Button>
            )}
            {status === "paused" && (
              <>
                <Button
                  onClick={resume}
                  className="h-10 rounded-xl font-black uppercase text-[10px] bg-red-600 text-white"
                >
                  <Play className="mr-2 h-4 w-4" /> Continuar
                </Button>
                <Button
                  onClick={stop}
                  variant="outline"
                  className="h-10 rounded-xl font-black uppercase text-[10px]"
                >
                  <Square className="mr-2 h-4 w-4" /> Parar
                </Button>
              </>
            )}
          </div>
        </header>

        <div className="px-4 sm:px-8 py-3 border-b border-border/40 space-y-2 shrink-0">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest gap-2 flex-wrap">
            <span className="truncate">
              {current
                ? `${current.nome}${current.advogadoNome ? ` · ${current.advogadoNome}` : ""}`
                : loadingQueue
                  ? "Carregando…"
                  : `${total} clientes`}
            </span>
            <span>
              {done}/{total || 0} ({pct}%)
            </span>
          </div>
          <Progress value={pct} className="h-2" />
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[9px] font-black uppercase text-muted-foreground">
              Tipo:
            </span>
            {["ALL", "VEICULO", "PRISAO", "PENHORA_BENS", "IMOVEL", "GENERICO"].map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFiltroTipo(t)}
                  className={cn(
                    "text-[8px] font-black uppercase px-2 py-1 rounded-lg border",
                    filtroTipo === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/40"
                  )}
                >
                  {t === "ALL" ? "Todos" : tipoLabel(t)}
                  {t !== "ALL" && contagemTipos[t] ? ` (${contagemTipos[t]})` : ""}
                </button>
              )
            )}
            <span className="text-[9px] font-black uppercase text-muted-foreground ml-2">
              Geo:
            </span>
            {(
              [
                ["ALL", "Todos"],
                ["ALERTAR", "Só alertar"],
                ["DISTANTE", "Só distantes"],
              ] as const
            ).map(([k, lab]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFiltroGeo(k)}
                className={cn(
                  "text-[8px] font-black uppercase px-2 py-1 rounded-lg border",
                  filtroGeo === k
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/40"
                )}
              >
                {lab}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground flex items-start gap-1">
            <Info size={12} className="mt-0.5 shrink-0" />
            Se o mandado for de OUTRO ESTADO (UF diferente da carteira), o card mostra OUTRO ESTADO — ALARMAR em destaque{" "}
            <strong>OUTRO ESTADO</strong> e não gera alerta operacional forte.
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Alertas sessão ({hitsFiltrados.length}/{hits.length})
            </h2>
            {hitsFiltrados.length === 0 && (
              <p className="text-sm text-muted-foreground">
                
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mr-1">Ordenar</span>
            {([
              ["recentes", "Mais recentes"],
              ["antigos", "Mais antigos"],
              ["nome", "Nome A–Z"],
            ] as const).map(([k, label]) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={filtroOrdem === k ? "default" : "outline"}
                onClick={() => setFiltroOrdem(k)}
                className="h-8 text-[9px] font-black uppercase tracking-widest"
              >
                {label}
              </Button>
            ))}
          </div>
Nenhum hit neste filtro. Rode a fila ou limpe o filtro.
              </p>
            )}
            {hitsFiltrados.map((h) => (
              <HitCard key={h.id} h={h} />
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Log da sessão
              </h2>
              <div className="border-2 border-border rounded-xl p-3 max-h-[28vh] overflow-auto bg-secondary/20 font-mono text-[10px] space-y-1">
                {logs.map((l, i) => (
                  <div key={i} className="border-b border-border/30 pb-1">
                    {l}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                <History size={12} /> Já escaneados (SQL)
                <Button type="button" size="sm" variant="outline" className="ml-auto h-7 text-[8px] font-black uppercase" onClick={() => setOrdemHistorico((o) => o === "recentes" ? "antigos" : "recentes")}>
                  {ordemHistorico === "recentes" ? "Mais recentes" : "Mais antigos"}
                </Button>
              </h2>
              <div className="border-2 border-border rounded-xl p-3 max-h-[40vh] overflow-auto text-[10px] space-y-2">
                {savedLogs.length === 0 && (
                  <p className="text-muted-foreground font-bold uppercase">
                    Nenhum log salvo
                  </p>
                )}
                {savedLogs
                  .filter(
                    (row) =>
                      row.motivo_ba &&
                      row.motivo_ba !== "CONSULTA_SEM_BA" &&
                      row.motivo_ba !== "scan_tick"
                  )
                  .map((row) => {
                    const tipo =
                      row.payload?.tipo_ba ||
                      (String(row.motivo_ba || "").includes("VEÍCULO")
                        ? "VEICULO"
                        : String(row.motivo_ba || "").includes("PRIS")
                          ? "PRISAO"
                          : null);
                    const distante = !!row.payload?.geo_distante;
                    return (
                      <div
                        key={row.id}
                        className={cn(
                          "border rounded-lg p-2 space-y-1",
                          distante ? "border-amber-500/40" : "border-border/40"
                        )}
                      >
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            className={cn(
                              "text-[7px] font-black uppercase gap-1",
                              tipoClass(tipo)
                            )}
                          >
                            <TipoIcon tipo={tipo} />
                            {tipoLabel(tipo)}
                          </Badge>
                          {distante && (
                            <Badge className="bg-slate-600 text-white text-[7px]">
                              OUTRO ESTADO
                            </Badge>
                          )}
                        </div>
                        <p className="font-black uppercase">
                          {row.cliente_nome}
                          {row.advogado_nome ? ` · ${row.advogado_nome}` : ""}
                        </p>
                        <p className="text-muted-foreground font-bold">
                          {row.motivo_ba} ·{" "}
                          {row.data_publicacao ||
                            row.created_at?.slice?.(0, 10) ||
                            ""}
                        </p>
                        <p className="font-mono">
                          Carteira: {row.protocolo_ref || "—"} · DJEN:{" "}
                          {row.processo_djen || "—"}
                        </p>
                        {row.protocolo_ref && (
                          <Link
                            href={`/cases?search=${encodeURIComponent(row.protocolo_ref)}`}
                            className="text-primary font-bold uppercase text-[9px]"
                          >
                            Abrir processo →
                          </Link>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
