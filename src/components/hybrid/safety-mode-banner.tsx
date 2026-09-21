"use client";

import { useEffect, useState } from "react";
import { loadSafetySession, clearSafetySession, loadSafetyQueue, clearSafetyQueue } from "@/lib/hybrid/safety-mode";
import { probeSupabaseAction, safetyReplayQueueAction } from "@/app/actions/safety-mode-actions";
import { hybridAutoSyncAction } from "@/app/actions/hybrid-sync-actions";

export function SafetyModeBanner() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [queue, setQueue] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sess = loadSafetySession();
    if (sess?.active) {
      setOpen(true);
      setReason(sess.reason || "Supabase indisponível");
      setQueue(loadSafetyQueue().length);
    }
  }, []);

  if (!open) return null;

  const voltar = async () => {
    setBusy(true);
    try {
      const probe = await probeSupabaseAction();
      if (!probe.ok) {
        setReason(probe.reason || "Banco ainda fora");
        return;
      }
      const pending = loadSafetyQueue();
      if (pending.length) {
        await safetyReplayQueueAction(pending.map((x) => x.row));
      }
      try { await hybridAutoSyncAction(); } catch { /* */ }
      clearSafetyQueue();
      clearSafetySession();
      setOpen(false);
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sticky top-0 z-[60] border-b border-amber-500/40 bg-amber-100 px-3 py-2 text-amber-950 dark:bg-amber-950 dark:text-amber-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-sm">
        <p>
          <strong>Modo segurança.</strong> O banco (Supabase) está sem cota ou fora do ar.
          Login e carteira usam a planilha (aba Usuarios / Processos). Funções de scanner, IA e CRM podem ficar reduzidas.
          {queue ? ` ${queue} alteração(ões) na fila para quando o banco voltar.` : ""}
          {reason ? ` (${reason})` : ""}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void voltar()}
          className="rounded-md border border-amber-700 bg-white px-3 py-1 text-xs font-medium text-amber-950 disabled:opacity-60"
        >
          {busy ? "Sincronizando…" : "Banco voltou? Sincronizar"}
        </button>
      </div>
    </div>
  );
}
