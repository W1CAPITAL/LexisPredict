"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  FileText,
  Gavel,
  ListTodo,
  RefreshCcw,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  getNotificationBootstrapAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notification-actions";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type LexisNotification,
  type NotificationPreferences,
} from "@/lib/notifications";

function iconFor(tipo: string, prioridade: string) {
  if (prioridade === "critica") return <AlertTriangle className="h-4 w-4" />;
  if (tipo === "prazo") return <CalendarClock className="h-4 w-4" />;
  if (tipo === "djen") return <FileText className="h-4 w-4" />;
  if (tipo === "datajud") return <Gavel className="h-4 w-4" />;
  if (tipo === "tarefa") return <ListTodo className="h-4 w-4" />;
  return <ShieldAlert className="h-4 w-4" />;
}

function colorFor(tipo: string, prioridade: string) {
  if (prioridade === "critica") return "bg-red-50 text-red-600 border-red-100";
  if (tipo === "prazo") return "bg-amber-50 text-amber-600 border-amber-100";
  if (tipo === "djen") return "bg-blue-50 text-blue-600 border-blue-100";
  if (tipo === "datajud") return "bg-violet-50 text-violet-600 border-violet-100";
  if (tipo === "tarefa") return "bg-emerald-50 text-emerald-600 border-emerald-100";
  return "bg-slate-50 text-slate-600 border-slate-100";
}

function relativeDate(value?: string | null) {
  if (!value) return "";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return "";
  if (ms < 60_000) return "agora";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} h`;
  return new Date(value).toLocaleDateString("pt-BR");
}

function inQuietHours(pref: NotificationPreferences) {
  if (!pref.quiet_hours_enabled || !pref.quiet_hours_start || !pref.quiet_hours_end) return false;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = pref.quiet_hours_start.split(":").map(Number);
  const [eh, em] = pref.quiet_hours_end.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function browserNotify(row: LexisNotification, pref: NotificationPreferences) {
  if (!pref.browser_enabled || inQuietHours(pref)) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && row.prioridade !== "critica") return;
  try {
    new Notification(row.titulo || "LexisPredict", {
      body: String(row.corpo || "Nova atualização").slice(0, 180),
      icon: "/logo.png",
      tag: `lexis-notification-${row.id}`,
    });
  } catch {
    /* browser best effort */
  }
}

export function NotificationCenter() {
  const router = useRouter();
  const { profile } = useAuth();
  const [items, setItems] = useState<LexisNotification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const prefRef = useRef(prefs);
  prefRef.current = prefs;

  const authId = String((profile as any)?.auth_user_id || "").trim();

  const load = useCallback(async () => {
    if (!authId) return;
    setLoading(true);
    try {
      const res = await getNotificationBootstrapAction(30);
      if (res.ok) {
        setItems((res.notifications || []) as LexisNotification[]);
        setPrefs(res.preferences || DEFAULT_NOTIFICATION_PREFERENCES);
      }
    } finally {
      setLoading(false);
    }
  }, [authId]);

  useEffect(() => {
    if (!authId) return;
    void load();
  }, [authId, load]);

  useEffect(() => {
    if (!authId) return;
    let supabase: ReturnType<typeof createClient> | null = null;
    let channel: any = null;

    try {
      supabase = createClient();
      channel = supabase
        .channel(`lexis-notifications:${authId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notificacoes",
            filter: `recipient_user_id=eq.${authId}`,
          },
          (payload: any) => {
            const row = (payload?.new || payload?.old || null) as LexisNotification | null;
            if (!row?.id) return;

            if (payload.eventType === "DELETE") {
              setItems((old) => old.filter((item) => item.id !== row.id));
              return;
            }

            if (payload.eventType === "INSERT" && !prefRef.current.in_app_enabled) {
              browserNotify(row, prefRef.current);
              return;
            }

            setItems((old) => {
              const next = [row, ...old.filter((item) => item.id !== row.id)];
              return next
                .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                .slice(0, 50);
            });

            if (payload.eventType === "INSERT") browserNotify(row, prefRef.current);
          }
        )
        .subscribe();
    } catch {
      /* Realtime unavailable: bootstrap still works */
    }

    return () => {
      try {
        if (supabase && channel) void supabase.removeChannel(channel);
      } catch {
        /* */
      }
    };
  }, [authId]);

  const unread = useMemo(() => items.filter((item) => !item.lida).length, [items]);

  const markOne = async (row: LexisNotification) => {
    if (!row.lida) {
      setItems((old) => old.map((item) => item.id === row.id ? { ...item, lida: true, read_at: new Date().toISOString() } : item));
      void markNotificationReadAction(row.id);
    }
    setOpen(false);
    router.push(row.link || "/notificacoes");
  };

  const markAll = async () => {
    setItems((old) => old.map((item) => ({ ...item, lida: true, read_at: item.read_at || new Date().toISOString() })));
    await markAllNotificationsReadAction();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#dfe7f2] bg-white text-[#18396c] transition hover:bg-[#f6f9fd]"
          aria-label={unread ? `Notificações, ${unread} não lidas` : "Notificações"}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-black text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={10} className="w-[390px] overflow-hidden rounded-2xl border-[#dfe7f2] bg-white p-0 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e8edf5] px-4 py-3">
          <div>
            <p className="font-black text-[#102447]">Notificações</p>
            <p className="text-[11px] text-[#6d7f9b]">
              {unread ? `${unread} pendente${unread === 1 ? "" : "s"}` : "Tudo em dia"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void load()} disabled={loading} title="Atualizar">
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            {unread > 0 ? (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void markAll()} title="Marcar todas como lidas">
                <CheckCheck className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <ScrollArea className="h-[420px]">
          {items.length === 0 ? (
            <div className="flex h-[300px] flex-col items-center justify-center px-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Check className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-black text-[#102447]">Nenhuma pendência agora</p>
              <p className="mt-1 text-xs leading-relaxed text-[#6d7f9b]">
                Prazos, DJEN, DataJud, tarefas e eventos comerciais reais aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#eef2f7]">
              {items.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => void markOne(row)}
                  className={cn(
                    "flex w-full gap-3 px-4 py-3 text-left transition hover:bg-[#f7faff]",
                    !row.lida && "bg-[#f7faff]"
                  )}
                >
                  <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", colorFor(row.tipo, row.prioridade))}>
                    {iconFor(row.tipo, row.prioridade)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className={cn("min-w-0 flex-1 text-xs text-[#18365f]", !row.lida ? "font-black" : "font-bold")}>
                        {row.titulo || "Atualização"}
                      </p>
                      <span className="shrink-0 text-[9px] text-[#8494aa]">{relativeDate(row.created_at)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#6d7f9b]">
                      {row.corpo || "Abra para ver os detalhes."}
                    </p>
                  </div>
                  {!row.lida ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#1f6fff]" /> : null}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="grid grid-cols-2 gap-2 border-t border-[#e8edf5] p-3">
          <Button
            variant="outline"
            className="h-9 rounded-xl border-[#dfe7f2] text-xs font-bold"
            onClick={() => {
              setOpen(false);
              router.push("/notificacoes");
            }}
          >
            Ver central
          </Button>
          <Button
            variant="outline"
            className="h-9 rounded-xl border-[#dfe7f2] text-xs font-bold"
            onClick={() => {
              setOpen(false);
              router.push("/settings?section=Notificacoes");
            }}
          >
            <Settings className="mr-2 h-3.5 w-3.5" />
            Preferências
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
