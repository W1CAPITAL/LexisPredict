"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadProviderConfig, type ProviderKind } from "@/lib/data-provider";
import { getSyncStatus } from "@/lib/sync/status";

export function ProviderModeBadge() {
  const [kind, setKind] = useState<ProviderKind>("supabase");
  const [pending, setPending] = useState(0);
  const [mode, setMode] = useState<"online" | "offline" | "unknown">("unknown");

  useEffect(() => {
    setKind(loadProviderConfig().kind);
    void getSyncStatus().then((s) => {
      setPending(s.pending);
      setMode(s.mode);
    });
  }, []);

  return (
    <Link
      href="/setup-planilha"
      className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 h-8 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground"
      title="Setup planilha / provider"
    >
      <span
        className={
          "w-2 h-2 rounded-full " +
          (mode === "offline" ? "bg-amber-500" : "bg-emerald-500")
        }
      />
      {kind}
      {pending > 0 ? ` · ${pending} pend.` : ""}
    </Link>
  );
}
