"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Gavel,
  ListTodo,
  MessageSquare,
  MonitorSmartphone,
  ShieldAlert,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getNotificationBootstrapAction,
  saveNotificationPreferencesAction,
} from "@/app/actions/notification-actions";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

type ToggleKey = "prazos" | "djen" | "datajud" | "tarefas" | "chat" | "sistema";

const EVENT_ROWS: Array<{
  key: ToggleKey;
  title: string;
  description: string;
  icon: any;
}> = [
  { key: "prazos", title: "Prazos e retornos", description: "Retornos vencidos e eventos nas próximas 24 horas.", icon: CalendarClock },
  { key: "djen", title: "DJEN", description: "Publicações novas encontradas nos processos da sua carteira.", icon: FileText },
  { key: "datajud", title: "DataJud", description: "Movimentações novas após o último atendimento.", icon: Gavel },
  { key: "tarefas", title: "Tarefas", description: "Atribuições e tarefas vencidas ou próximas do prazo.", icon: ListTodo },
  { key: "chat", title: "Chat da equipe", description: "Mensagens novas do chat interno.", icon: MessageSquare },
  { key: "sistema", title: "Sistema e assinatura", description: "Cobrança, suspensão e avisos realmente importantes do ambiente.", icon: ShieldAlert },
];

export function NotificationSettingsPanel() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPermission("Notification" in window ? Notification.permission : "unsupported");
    }

    let live = true;
    void getNotificationBootstrapAction(1).then((res) => {
      if (!live) return;
      if (res.ok) setPrefs(res.preferences);
      setLoading(false);
    });
    return () => { live = false; };
  }, []);

  const browserAvailable = permission !== "unsupported";
  const browserActive = browserAvailable && permission === "granted" && prefs.browser_enabled;

  const save = async (next: NotificationPreferences) => {
    setPrefs(next);
    setSaving(true);
    try {
      const res = await saveNotificationPreferencesAction(next);
      if (!res.ok) throw new Error(res.error || "Falha ao salvar.");
      setPrefs(res.preferences);
      try {
        const canChatNotify =
          res.preferences.chat &&
          res.preferences.browser_enabled &&
          "Notification" in window &&
          Notification.permission === "granted";
        localStorage.setItem("lexis_chat_notif", canChatNotify ? "granted" : "dismissed");
      } catch {
        /* legacy chat preference bridge */
      }
    } catch (e: any) {
      toast({ title: "Não foi possível salvar", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const patch = (value: Partial<NotificationPreferences>) => {
    void save({ ...prefs, ...value });
  };

  const enableBrowser = async (on: boolean) => {
    if (!on) {
      patch({ browser_enabled: false });
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      toast({ title: "Este navegador não oferece notificações do sistema.", variant: "destructive" });
      return;
    }

    const p = await Notification.requestPermission();
    setPermission(p);
    if (p !== "granted") {
      patch({ browser_enabled: false });
      toast({
        title: "Permissão não concedida",
        description: "Libere as notificações nas permissões do navegador para receber alertas fora da aba.",
        variant: "destructive",
      });
      return;
    }

    patch({ browser_enabled: true });
    try {
      new Notification("LexisPredict", {
        body: "Notificações do navegador ativadas.",
        icon: "/logo.png",
        tag: "lexis-notification-test",
      });
    } catch {
      /* */
    }
  };

  const enabledCount = useMemo(
    () => EVENT_ROWS.filter((row) => prefs[row.key]).length,
    [prefs]
  );

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Carregando preferências de notificação…</div>;
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-[#dfe7f2] bg-white">
        <div className="border-b border-[#e8edf5] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef5ff] text-[#1f6fff]">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-black text-[#102447]">Central de notificações</h2>
              <p className="text-xs text-[#6d7f9b]">
                Alertas gerados a partir de processos, tarefas, DJEN, DataJud e status comercial reais.
              </p>
            </div>
            <Badge className="ml-auto rounded-full border-0 bg-emerald-50 text-emerald-700">
              {enabledCount}/6 eventos ativos
            </Badge>
          </div>
        </div>

        <div className="divide-y divide-[#edf1f6]">
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#18365f]">Alertas em tempo real no app</p>
              <p className="mt-0.5 text-xs text-[#6d7f9b]">Atualiza badge e central assim que um evento real é gravado no Supabase.</p>
            </div>
            <Switch checked={prefs.in_app_enabled} onCheckedChange={(v) => patch({ in_app_enabled: v })} disabled={saving} />
          </div>

          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <MonitorSmartphone className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-[#18365f]">Notificações do navegador</p>
                <Badge variant="outline" className={cn(
                  "rounded-full text-[9px]",
                  browserActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "text-[#6d7f9b]"
                )}>
                  {permission === "unsupported" ? "não suportado" : permission === "granted" ? "permitido" : permission === "denied" ? "bloqueado" : "não solicitado"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-[#6d7f9b]">Mostra alerta do sistema quando a aba estiver em segundo plano; críticos também podem aparecer em primeiro plano.</p>
            </div>
            <Switch checked={browserActive} onCheckedChange={(v) => void enableBrowser(v)} disabled={saving || !browserAvailable} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#dfe7f2] bg-white">
        <div className="border-b border-[#e8edf5] px-5 py-4">
          <h3 className="font-black text-[#102447]">O que deve gerar aviso</h3>
          <p className="mt-1 text-xs text-[#6d7f9b]">Desative categorias que não são relevantes para o seu trabalho.</p>
        </div>
        <div className="grid gap-0 md:grid-cols-2">
          {EVENT_ROWS.map((row, index) => {
            const Icon = row.icon;
            return (
              <div
                key={row.key}
                className={cn(
                  "flex items-start gap-4 border-[#edf1f6] px-5 py-4",
                  index % 2 === 0 && "md:border-r",
                  index < EVENT_ROWS.length - 2 && "border-b"
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5f8fc] text-[#36577d]">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#18365f]">{row.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#6d7f9b]">{row.description}</p>
                </div>
                <Switch checked={prefs[row.key]} onCheckedChange={(v) => patch({ [row.key]: v } as any)} disabled={saving} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[#dfe7f2] bg-white p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Clock3 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#102447]">Horário silencioso</p>
            <p className="mt-1 text-xs text-[#6d7f9b]">
              Durante esse período, a central continua registrando eventos, mas o navegador não abre alertas.
            </p>

            <div className={cn("mt-4 flex flex-wrap items-center gap-3", !prefs.quiet_hours_enabled && "opacity-50")}>
              <label className="text-xs font-bold text-[#526986]">
                Início
                <input
                  type="time"
                  value={(prefs.quiet_hours_start || "19:00").slice(0, 5)}
                  onChange={(e) => patch({ quiet_hours_start: e.target.value })}
                  disabled={!prefs.quiet_hours_enabled || saving}
                  className="ml-2 h-9 rounded-lg border border-[#dfe7f2] bg-white px-3"
                />
              </label>
              <label className="text-xs font-bold text-[#526986]">
                Fim
                <input
                  type="time"
                  value={(prefs.quiet_hours_end || "08:00").slice(0, 5)}
                  onChange={(e) => patch({ quiet_hours_end: e.target.value })}
                  disabled={!prefs.quiet_hours_enabled || saving}
                  className="ml-2 h-9 rounded-lg border border-[#dfe7f2] bg-white px-3"
                />
              </label>
            </div>
          </div>
          <Switch
            checked={prefs.quiet_hours_enabled}
            onCheckedChange={(v) => patch({
              quiet_hours_enabled: v,
              quiet_hours_start: prefs.quiet_hours_start || "19:00",
              quiet_hours_end: prefs.quiet_hours_end || "08:00",
            })}
            disabled={saving}
          />
        </div>
      </section>

      <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-emerald-900">Sem notificações fictícias</p>
            <p className="text-xs text-emerald-700">O badge só aparece quando existem registros não lidos no Supabase.</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="border-emerald-300 bg-white text-emerald-700"
          onClick={() => void enableBrowser(true)}
          disabled={!browserAvailable}
        >
          Testar navegador
        </Button>
      </div>
    </div>
  );
}
