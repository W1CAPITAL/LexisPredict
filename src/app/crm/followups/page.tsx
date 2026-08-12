"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listObservedFollowUpsAction,
  type FollowUpItem,
} from "@/app/actions/followup-queue-actions";
import { Loader2, RefreshCcw, ArrowLeft } from "lucide-react";

export default function CrmFollowupsPage() {
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listObservedFollowUpsAction(7);
    setItems(res.items || []);
    setError(res.error || "");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/crm">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-black">Follow-ups observados</h1>
                <p className="text-xs text-muted-foreground">
                  Só sinais do banco — leads parados e títulos atrasados
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={load}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={`${it.kind}-${it.id}`} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">{it.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{it.detail}</p>
                  </div>
                  <Badge variant="secondary" className="text-[9px] shrink-0">
                    {it.kind === 'receber_atrasado' ? 'Atrasado' : 'Parado'}
                  </Badge>
                </div>
                <Button asChild variant="link" className="h-auto p-0 mt-2 text-xs">
                  <Link href={it.href}>Abrir</Link>
                </Button>
              </li>
            ))}
            {!loading && !items.length ? (
              <p className="text-sm text-muted-foreground">Nenhum sinal observado no momento.</p>
            ) : null}
          </ul>
        </div>
      </main>
    </div>
  );
}
