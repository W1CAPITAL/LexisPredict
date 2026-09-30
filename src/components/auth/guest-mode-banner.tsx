"use client";

import { useEffect, useState } from "react";
import { DatabaseZap, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearGuestCache, disableGuestMode, isGuestMode } from "@/lib/guest-mode";

export function GuestModeBanner() {
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    setGuest(isGuestMode());
  }, []);

  if (!guest) return null;

  return (
    <div className="sticky top-0 z-[300] border-b border-sky-200 bg-sky-50/95 px-3 py-2 text-sky-950 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <DatabaseZap className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
          <div>
            <p className="text-xs font-black">Modo convidado · demonstração local</p>
            <p className="text-[10px] leading-relaxed text-sky-800/80">
              Alterações permanecem apenas no cache deste navegador. Nenhum dado do convidado é gravado no Supabase.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-sky-200 bg-white text-[10px] font-bold text-sky-900 hover:bg-sky-100"
            onClick={() => {
              clearGuestCache();
              window.location.reload();
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Limpar cache demo
          </Button>
          <Button
            size="sm"
            className="h-8 bg-sky-800 text-[10px] font-bold text-white hover:bg-sky-900"
            onClick={() => {
              disableGuestMode();
              window.location.replace("/login");
            }}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sair do convidado
          </Button>
        </div>
      </div>
    </div>
  );
}
