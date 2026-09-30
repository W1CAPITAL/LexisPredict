export type NotificationKind = "prazo" | "djen" | "datajud" | "tarefa" | "chat" | "sistema";
export type NotificationPriority = "normal" | "alta" | "critica";

export type NotificationPreferences = {
  in_app_enabled: boolean;
  browser_enabled: boolean;
  prazos: boolean;
  djen: boolean;
  datajud: boolean;
  tarefas: boolean;
  chat: boolean;
  sistema: boolean;
  sound_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

export type LexisNotification = {
  id: string;
  tipo: string;
  prioridade: string;
  titulo: string | null;
  corpo: string | null;
  link: string | null;
  lida: boolean | null;
  read_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  source?: string | null;
  meta?: Record<string, unknown> | null;
  processo_id?: number | null;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  in_app_enabled: true,
  browser_enabled: false,
  prazos: true,
  djen: true,
  datajud: true,
  tarefas: true,
  chat: true,
  sistema: true,
  sound_enabled: false,
  quiet_hours_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
};
