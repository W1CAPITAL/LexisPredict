"use client";

import React from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, CheckCircle2, CircleDashed } from "lucide-react";

const EXE_REPO = "https://github.com/W1CAPITAL/OFFLINE-LEXISPREDICT";

const ROWS: { label: string; ok: boolean }[] = [
  { label: "Login e senha", ok: true },
  { label: "Planilha / CSV (colunas M e N)", ok: true },
  { label: "DataJud + DJEN", ok: true },
  { label: "Fila + KPIs locais", ok: true },
  { label: "Ranking = log do web", ok: false },
  { label: "CRM + agentes", ok: false },
  { label: "Encerrados a revisar", ok: false },
  { label: "Sync Supabase sem duplicar CNJ", ok: false },
];

export default function OfflineComingSoonPage() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
          <img
            src="/lexis-promo-offline.svg"
            alt="LexisPredict Offline"
            className="w-full rounded-2xl border border-border"
          />
          <div className="flex items-center gap-2">
            <Badge className="font-black uppercase tracking-widest text-[9px]">Coming soon</Badge>
            <Badge variant="outline" className="font-black uppercase text-[9px]">
              EXE v5.1.8 já roda
            </Badge>
          </div>
          <h1 className="text-3xl font-black tracking-tight">LexisPredict Offline</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            EXE Windows com login, senha e planilha. A paridade total com este web
            (ranking, CRM, encerrados a revisar, sync) é o coming soon.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button asChild className="rounded-xl font-black uppercase text-[10px] h-10">
              <a href={EXE_REPO} target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Repositório do EXE
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-xl font-black uppercase text-[10px] h-10">
              <Link href="/">Painel web</Link>
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {ROWS.map((row) => (
              <div
                key={row.label}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-[12px]"
              >
                {row.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={row.ok ? "font-medium" : "text-muted-foreground"}>{row.label}</span>
                {!row.ok ? (
                  <span className="ml-auto text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                    soon
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
