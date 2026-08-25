"use client";

/**
 * Aviso global: serviços de banco desativados a partir de 17/09/2026 21:00 (horário de Brasília).
 * Não menciona Plano B / planilha.
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const DEADLINE = new Date("2026-09-17T21:00:00-03:00");
const LS_DISMISS = "lexis_db_sunset_banner_dismissed_v1";

function formatRestante(ms: number): string {
  if (ms <= 0) return "prazo encerrado";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}min`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

export function DbSunsetBanner() {
  const [now, setNow] = useState(() => Date.now());
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      // permite reaparecer se ainda não passou o prazo e usuário não dispensou nesta sessão
      const d = sessionStorage.getItem(LS_DISMISS);
      setHidden(d === "1");
    } catch {
      setHidden(false);
    }
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const expired = now >= DEADLINE.getTime();
  const restante = useMemo(() => formatRestante(DEADLINE.getTime() - now), [now]);

  if (hidden && !expired) return null;

  return (
    <div
      role="alert"
      className={
        expired
          ? "sticky top-0 z-[100] w-full border-b border-red-800 bg-red-700 text-white"
          : "sticky top-0 z-[100] w-full border-b border-amber-600/40 bg-amber-500 text-amber-950"
      }
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2.5 sm:items-center">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 sm:mt-0" aria-hidden />
        <div className="min-w-0 flex-1 text-[12px] leading-snug sm:text-[13px]">
          {expired ? (
            <>
              <strong className="font-black uppercase tracking-wide">Serviços de banco de dados desativados.</strong>{" "}
              A partir de <strong>17/09/2026 às 21:00</strong> (horário de Brasília) não é mais possível utilizar o
              aplicativo com a base de dados. Entre em contato com a administração do gabinete.
            </>
          ) : (
            <>
              <strong className="font-black uppercase tracking-wide">Aviso importante.</strong> Os serviços do banco de
              dados serão <strong>desativados a partir de 17/09/2026 – 21:00:00</strong> (horário de Brasília). Após esse
              horário <strong>não será mais possível utilizar o aplicativo</strong> com a base atual. Tempo restante
              estimado: <strong>{restante}</strong>.
            </>
          )}
        </div>
        {!expired ? (
          <button
            type="button"
            aria-label="Fechar aviso"
            className="shrink-0 rounded-md p-1 hover:bg-black/10"
            onClick={() => {
              try {
                sessionStorage.setItem(LS_DISMISS, "1");
              } catch {
                /* */
              }
              setHidden(true);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
