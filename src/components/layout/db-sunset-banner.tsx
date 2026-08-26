"use client";

/**
 * Aviso periódico (não bloqueia): banco de dados desativado a partir de 07/09/2026 21:00 BRT.
 * Fecha e reaparece depois de algumas horas — não trava o operador.
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const DEADLINE = new Date("2026-09-07T21:00:00-03:00");
const LS_DISMISS_UNTIL = "lexis_db_sunset_dismiss_until_v2";
/** Quanto tempo o aviso fica oculto após fechar (ms) — 4 horas */
const DISMISS_MS = 4 * 60 * 60 * 1000;

function formatRestante(ms: number): string {
  if (ms <= 0) return "prazo encerrado";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

export function DbSunsetBanner() {
  const [now, setNow] = useState(() => Date.now());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      try {
        const until = Number(localStorage.getItem(LS_DISMISS_UNTIL) || "0");
        const expired = Date.now() >= DEADLINE.getTime();
        // depois do prazo: sempre visível; antes: só se não estiver no período de dismiss
        setVisible(expired || Date.now() >= until);
      } catch {
        setVisible(true);
      }
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  const expired = now >= DEADLINE.getTime();
  const restante = useMemo(() => formatRestante(DEADLINE.getTime() - now), [now]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className={
        expired
          ? "sticky top-0 z-[90] w-full border-b border-red-800/80 bg-red-700/95 text-white backdrop-blur-sm"
          : "sticky top-0 z-[90] w-full border-b border-amber-600/30 bg-amber-400/90 text-amber-950 backdrop-blur-sm"
      }
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
        <AlertTriangle className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        <p className="min-w-0 flex-1 text-[11px] leading-snug sm:text-[12px]">
          {expired ? (
            <>
              <strong className="font-black uppercase tracking-wide">Banco de dados desativado.</strong>{" "}
              Desde <strong>07/09/2026 às 21:00</strong> (Brasília) os serviços de base não estão disponíveis.
              O aplicativo não opera mais com a base atual.
            </>
          ) : (
            <>
              <strong className="font-black uppercase tracking-wide">Aviso.</strong> Os serviços do{" "}
              <strong>banco de dados</strong> serão desativados em{" "}
              <strong>07/09/2026 – 21:00:00</strong> (Brasília). Após esse horário não será possível utilizar o
              aplicativo com a base atual. Restam cerca de <strong>{restante}</strong>.
            </>
          )}
        </p>
        {!expired ? (
          <button
            type="button"
            aria-label="Ocultar aviso por algumas horas"
            title="Ocultar por 4 horas"
            className="shrink-0 rounded-md p-1 hover:bg-black/10"
            onClick={() => {
              try {
                localStorage.setItem(LS_DISMISS_UNTIL, String(Date.now() + DISMISS_MS));
              } catch {
                /* */
              }
              setVisible(false);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
