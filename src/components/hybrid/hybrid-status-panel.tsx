"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hybridStatusAction, hybridPullCarteiraAction, hybridAutoSyncAction, hybridSeedSheetsFromSupabaseAction } from "@/app/actions/hybrid-sync-actions";
import { Loader2, RefreshCw, Database, Sheet } from "lucide-react";

export function HybridStatusPanel() {
  const [st, setSt] = useState<any>(null);
  const [pull, setPull] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      setSt(await hybridStatusAction());
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const doPull = async () => {
    setBusy(true);
    try {
      const r = await hybridPullCarteiraAction({ limit: 5000 });
      if (r.success) setPull(`${r.count} linhas da planilha (source=${r.source})`);
      else setPull(r.error || "falha");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black flex items-center gap-2">
            <Sheet size={16} className="text-primary" />
            Modo híbrido
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Supabase = login/empresa · Sheets = carteira M/N + resultado de scan
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {st && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-lg border p-2">
            <p className="text-muted-foreground">Modo</p>
            <p className="font-bold">{st.mode}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-muted-foreground">Webhook</p>
            <Badge variant={st.webhookConfigured ? "default" : "destructive"} className="text-[10px]">
              {st.webhookConfigured ? "OK" : "falta env"}
            </Badge>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-muted-foreground">Ping</p>
            <p className="font-bold">{st.ping?.ok ? "pong" : st.ping?.error || "—"}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-muted-foreground">Espelho PG</p>
            <p className="font-bold">{st.mirrorPostgres ? "sim" : "não (Postgres enxuto)"}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-muted-foreground">Audit scan</p>
            <p className="font-bold">{st.skipScanAudit ? "pulado" : "grava"}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void doPull()} disabled={busy || !st?.enabled}>
          <Database className="h-3.5 w-3.5 mr-1" />
          Puxar carteira Sheets
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy || !st?.enabled}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await hybridAutoSyncAction();
              setPull(r.message || r.error || r.action);
            } finally {
              setBusy(false);
            }
          }}
        >
          Sincronizar agora
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !st?.enabled}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await hybridSeedSheetsFromSupabaseAction({ maxRows: 4000 });
              setPull(r.success ? `Seed: ${r.pushed} linhas` : r.error || "falha seed");
            } finally {
              setBusy(false);
            }
          }}
        >
          Forçar seed Supabase→Sheets
        </Button>
      </div>
      {pull ? <p className="text-[11px] font-mono text-muted-foreground">{pull}</p> : null}

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Env: <code>LEXIS_HYBRID_MODE=sheets_carteira_scan</code> ·{" "}
        <code>LEXIS_SHEETS_WEBHOOK_URL</code> · <code>LEXIS_SHEETS_TOKEN</code> ·{" "}
        <code>LEXIS_HYBRID_MIRROR_PG=false</code> · <code>LEXIS_HYBRID_SKIP_SCAN_AUDIT=true</code>
      </p>
    </div>
  );
}
