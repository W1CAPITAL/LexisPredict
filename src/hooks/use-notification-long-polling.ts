"use client";

import { useEffect, useRef } from "react";
import type { LexisNotification } from "@/lib/notifications";

type NotificationPollResponse = {
  ok: boolean;
  changed: boolean;
  cursor: string;
  notifications?: LexisNotification[];
};

const ENDPOINT = "/api/notifications/long-poll";

function backoff(failures: number): number {
  return Math.min(30_000, Math.pow(2, Math.min(failures, 5)) * 1000);
}

function waitForActivity(signal: AbortSignal): Promise<void> {
  if (signal.aborted || (!document.hidden && navigator.onLine)) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const wake = () => {
      if (signal.aborted || (!document.hidden && navigator.onLine)) finish();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    signal.addEventListener("abort", finish, { once: true });
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

/** Sem setInterval e sem requests sobrepostas.
 * Somente conectado quando habilitado e aba visível; aborta em navegação/ocultação.
 * O usuário/empresa são identificados exclusivamente no servidor.
 */
export function useNotificationLongPolling(
  enabled: boolean,
  onUpdate: (notifications: LexisNotification[]) => void,
  sessionKey = "",
) {
  const callback = useRef(onUpdate);
  callback.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;
    const lifetime = new AbortController();
    let active: AbortController | null = null;
    let cursor = "";
    let failures = 0;

    const onVisibility = () => {
      if ((document.hidden || !navigator.onLine) && active) active.abort();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("offline", onVisibility);

    async function run() {
      while (!lifetime.signal.aborted) {
        await waitForActivity(lifetime.signal);
        if (lifetime.signal.aborted) break;

        const request = new AbortController();
        active = request;
        try {
          const url = cursor ? ENDPOINT + "?cursor=" + encodeURIComponent(cursor) : ENDPOINT;
          const response = await fetch(url, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal: request.signal,
          });
          if (response.status === 401 || response.status === 403) break;
          if (!response.ok) throw new Error("Poll HTTP " + response.status);
          if (response.status === 204) break;
          const data = (await response.json()) as NotificationPollResponse;
          if (!data.ok || !/^[0-9a-f]{64}$/.test(data.cursor)) throw new Error("Cursor inválido");

          cursor = data.cursor;
          failures = 0;
          if (data.changed && Array.isArray(data.notifications) && !lifetime.signal.aborted) {
            callback.current(data.notifications);
          }
        } catch (error) {
          if (lifetime.signal.aborted) break;
          if (!request.signal.aborted) {
            failures += 1;
            await sleep(backoff(failures), lifetime.signal);
          }
        } finally {
          if (active === request) active = null;
        }
      }
    }

    void run();
    return () => {
      lifetime.abort();
      active?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("offline", onVisibility);
    };
  }, [enabled, sessionKey]);
}
