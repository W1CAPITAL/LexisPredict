"use client";

/**
 * Contatos observados (Twenty People-like) — só dados já gravados em negócios.
 * Comp AI: não inventa telefone/email.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/crm-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listContatosObservadosAction } from "@/app/actions/crm-pipeline-actions";
import { Loader2, RefreshCcw, Phone, Mail, User } from "lucide-react";

export default function CrmContatosPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listContatosObservadosAction();
    setRows(res.rows || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        r.nome?.toLowerCase().includes(t) ||
        r.doc?.toLowerCase().includes(t) ||
        r.telefone?.includes(t) ||
        r.email?.toLowerCase().includes(t)
    );
  }, [rows, q]);

  return (
    <CrmShell
      title="Contatos"
      subtitle="Agregados dos negócios — sem inventar campos"
      actions={
        <>
          <Input
            className="h-9 w-[180px]"
            placeholder="Buscar"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button variant="outline" size="sm" className="h-9" onClick={load}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          </Button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-black truncate">{c.nome}</p>
            </div>
            {c.doc ? <p className="text-[11px] text-muted-foreground font-mono">{c.doc}</p> : null}
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {c.telefone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {c.telefone}
                </span>
              ) : null}
              {c.email ? (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {c.email}
                </span>
              ) : null}
            </div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">
              {(c.negocio_ids || []).length} negócio(s)
            </p>
          </div>
        ))}
      </div>
      {!loading && !filtered.length ? (
        <p className="text-sm text-muted-foreground">Nenhum contato observado nos negócios.</p>
      ) : null}
    </CrmShell>
  );
}
