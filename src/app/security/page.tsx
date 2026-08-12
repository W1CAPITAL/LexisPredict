"use client";

/**
 * Aba Segurança DEFENSIVA — Superadmin.
 * Sem pentest, sem exploit, sem scan ofensivo.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  runDefensiveSecurityAuditAction,
  type SecurityCheck,
} from "@/app/actions/security-audit-actions";
import { ocrHealthAction } from "@/app/actions/ocr-adapter-actions";
import {
  ShieldAlert,
  Loader2,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { checkIfSuperAdmin } from "@/lib/supabase";

function StatusIcon({ status }: { status: SecurityCheck["status"] }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (status === "fail") return <XCircle className="h-4 w-4 text-red-600" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
}

export default function SecurityPage() {
  const { profile, loading: authLoading } = useAuth();
  const [checks, setChecks] = useState<SecurityCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [ocrHealth, setOcrHealth] = useState<{ externalConfigured: boolean; endpointHost: string | null } | null>(null);

  const isSA = profile ? checkIfSuperAdmin(profile) : false;

  const run = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [res, ocr] = await Promise.all([
        runDefensiveSecurityAuditAction(),
        ocrHealthAction(),
      ]);
      setOcrHealth(ocr);
      if (!res.success) {
        setError(res.error || "Falha");
        setChecks([]);
      } else {
        setChecks(res.checks);
        setGeneratedAt(res.generatedAt);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isSA) run();
  }, [authLoading, isSA, run]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isSA) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-2">
            <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
            <h1 className="text-lg font-black">Acesso restrito</h1>
            <p className="text-sm text-muted-foreground">A aba Segurança é exclusiva de Superadmin.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-black flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" /> Segurança (defensiva)
              </h1>
              <p className="text-xs text-muted-foreground">
                Checklist de configuração e isolamento. Sem pentest ou exploit no app.
              </p>
            </div>
            <Button size="sm" onClick={run} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              <span className="ml-1">Reauditar</span>
            </Button>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</div>
          ) : null}

          {ocrHealth ? (
            <div className="rounded-xl border border-border bg-card p-3 text-xs">
              <p className="font-black uppercase text-[10px] text-muted-foreground mb-1">OCR externo</p>
              <p>
                {ocrHealth.externalConfigured
                  ? `Configurado → host ${ocrHealth.endpointHost}`
                  : "Não configurado (app usa Tesseract local na aba OCR)"}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            {checks.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "rounded-lg border border-border bg-card p-3 flex gap-3",
                  c.status === "fail" && "border-red-500/50",
                  c.status === "warn" && "border-amber-500/40"
                )}
              >
                <StatusIcon status={c.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold">{c.label}</p>
                    <Badge variant="secondary" className="text-[9px] uppercase">
                      {c.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {generatedAt ? (
            <p className="text-[10px] text-muted-foreground">
              Gerado em {new Date(generatedAt).toLocaleString("pt-BR")}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
