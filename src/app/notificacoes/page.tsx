"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCheck,
  FileText,
  Gavel,
  ListTodo,
  RefreshCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import {
  deleteReadNotificationsAction,
  getNotificationBootstrapAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notification-actions";
import type { LexisNotification } from "@/lib/notifications";

type Filter = "todas" | "nao_lidas" | "prazo" | "tribunal" | "tarefa" | "sistema";

function iconFor(tipo: string, prioridade: string) {
  if (prioridade === "critica") return <AlertTriangle className="h-5 w-5" />;
  if (tipo === "prazo") return <CalendarClock className="h-5 w-5" />;
  if (tipo === "djen") return <FileText className="h-5 w-5" />;
  if (tipo === "datajud") return <Gavel className="h-5 w-5" />;
  if (tipo === "tarefa") return <ListTodo className="h-5 w-5" />;
  return <ShieldAlert className="h-5 w-5" />;
}

function prettyDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const authId = String((profile as any)?.auth_user_id || "").trim();
  const [items, setItems] = useState<LexisNotification[]>([]);
  const [filter, setFilter] = useState<Filter>("todas");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!authId) return;
    setLoading(true);
    try {
      const res = await getNotificationBootstrapAction(100);
      if (res.ok) setItems((res.notifications || []) as LexisNotification[]);
    } finally {
      setLoading(false);
    }
  }, [authId]);

  useEffect(() => {
    if (authId) void load();
  }, [authId, load]);

  useEffect(() => {
    if (!authId) return;
    let sb: ReturnType<typeof createClient> | null = null;
    let ch: any = null;
    try {
      sb = createClient();
      ch = sb
        .channel("lexis-notification-inbox:" + authId)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notificacoes", filter: "recipient_user_id=eq." + authId },
          (payload: any) => {
            const row = payload?.new || payload?.old;
            if (!row?.id) return;
            if (payload.eventType === "DELETE") {
              setItems((old) => old.filter((item) => item.id !== row.id));
              return;
            }
            setItems((old) => [row, ...old.filter((item) => item.id !== row.id)]
              .sort((a,b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
          }
        )
        .subscribe();
    } catch {
      /* bootstrap continues to work */
    }
    return () => {
      try { if (sb && ch) void sb.removeChannel(ch); } catch { /* */ }
    };
  }, [authId]);

  const filtered = useMemo(() => items.filter((item) => {
    if (filter === "todas") return true;
    if (filter === "nao_lidas") return !item.lida;
    if (filter === "tribunal") return item.tipo === "djen" || item.tipo === "datajud";
    return item.tipo === filter;
  }), [items, filter]);

  const unread = items.filter((item) => !item.lida).length;

  const openItem = async (item: LexisNotification) => {
    if (!item.lida) {
      setItems((old) => old.map((row) => row.id === item.id ? { ...row, lida: true } : row));
      void markNotificationReadAction(item.id);
    }
    router.push(item.link || "/");
  };

  const markAll = async () => {
    setItems((old) => old.map((item) => ({ ...item, lida: true })));
    await markAllNotificationsReadAction();
  };

  const clearRead = async () => {
    await deleteReadNotificationsAction();
    setItems((old) => old.filter((item) => !item.lida));
  };

  const filters: Array<[Filter, string]> = [
    ["todas", "Todas"],
    ["nao_lidas", "Não lidas"],
    ["prazo", "Prazos"],
    ["tribunal", "Tribunal"],
    ["tarefa", "Tarefas"],
    ["sistema", "Sistema"],
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7fb]">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1320px] px-5 pb-10 pt-7 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-[.14em] text-[#1f6fff]">
                <BellRing className="h-4 w-4" /> Central
              </p>
              <h1 className="text-[30px] font-black tracking-[-.04em] text-[#102447]">Notificações</h1>
              <p className="mt-2 text-sm text-[#617693]">Eventos reais da sua carteira, tarefas, tribunal e ambiente.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void load()} disabled={loading} className="rounded-xl border-[#dce5f1] bg-white">
                <RefreshCcw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Atualizar
              </Button>
              {unread > 0 ? (
                <Button variant="outline" onClick={() => void markAll()} className="rounded-xl border-[#dce5f1] bg-white">
                  <CheckCheck className="mr-2 h-4 w-4" /> Marcar lidas
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => void clearRead()} className="rounded-xl border-[#dce5f1] bg-white text-[#6b7d96]">
                <Trash2 className="mr-2 h-4 w-4" /> Limpar lidas
              </Button>
            </div>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
            {filters.map(([id,label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  "shrink-0 rounded-xl border px-4 py-2 text-xs font-bold transition",
                  filter === id
                    ? "border-[#1f6fff] bg-[#1f6fff] text-white"
                    : "border-[#dfe7f2] bg-white text-[#526986] hover:bg-[#f7faff]"
                )}
              >
                {label}
                {id === "nao_lidas" && unread ? <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5">{unread}</span> : null}
              </button>
            ))}
          </div>

          <section className="mt-3 overflow-hidden rounded-2xl border border-[#dfe7f2] bg-white">
            {filtered.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCheck className="h-7 w-7" />
                </div>
                <p className="mt-4 font-black text-[#102447]">Nenhum alerta neste filtro</p>
                <p className="mt-1 max-w-md text-sm text-[#6d7f9b]">
                  Quando houver prazo, publicação, movimentação, tarefa ou evento comercial aplicável a você, ele aparecerá aqui.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#edf1f6]">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void openItem(item)}
                    className={cn(
                      "flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-[#f8fbff]",
                      !item.lida && "bg-[#f7faff]"
                    )}
                  >
                    <div className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                      item.prioridade === "critica"
                        ? "bg-red-50 text-red-600"
                        : item.tipo === "prazo"
                          ? "bg-amber-50 text-amber-600"
                          : item.tipo === "tarefa"
                            ? "bg-emerald-50 text-emerald-600"
                            : item.tipo === "djen" || item.tipo === "datajud"
                              ? "bg-blue-50 text-blue-600"
                              : "bg-slate-50 text-slate-600"
                    )}>
                      {iconFor(item.tipo, item.prioridade)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn("text-sm text-[#18365f]", !item.lida ? "font-black" : "font-bold")}>
                          {item.titulo || "Atualização"}
                        </p>
                        <Badge variant="outline" className="rounded-full border-[#dfe7f2] bg-white text-[9px] uppercase text-[#647a96]">
                          {item.tipo}
                        </Badge>
                        {item.prioridade === "critica" ? (
                          <Badge className="rounded-full border-0 bg-red-50 text-[9px] uppercase text-red-600">crítico</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 max-w-4xl text-xs leading-relaxed text-[#6d7f9b]">{item.corpo}</p>
                      <p className="mt-2 text-[10px] text-[#91a0b4]">{prettyDate(item.created_at)}</p>
                    </div>
                    {!item.lida ? <span className="mt-4 h-2.5 w-2.5 shrink-0 rounded-full bg-[#1f6fff]" /> : null}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
