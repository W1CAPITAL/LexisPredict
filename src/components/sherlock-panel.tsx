"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  sherlockStatusAction,
  sherlockBuscarPorNomeAction,
  sherlockBuscarUsernameAction,
  sherlockPreviewUsernamesAction,
} from "@/app/actions/sherlock-action";
import { Loader2, Search } from "lucide-react";

type Hit = { site: string; url: string; username?: string };

export function SherlockPanel({
  defaultNome = "",
  compact = false,
}: {
  defaultNome?: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<{
    ready: boolean;
    enabled: boolean;
    localhost: boolean;
    production: boolean;
    hint: string;
    urlPreview: string;
  } | null>(null);
  const [nome, setNome] = useState(defaultNome);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [tried, setTried] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    sherlockStatusAction()
      .then((s) =>
        setStatus({
          ready: s.ready,
          enabled: s.enabled,
          localhost: s.localhost,
          production: s.production,
          hint: s.hint,
          urlPreview: s.urlPreview,
        })
      )
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (defaultNome) setNome(defaultNome);
  }, [defaultNome]);

  useEffect(() => {
    if (!nome || nome.length < 5) {
      setPreviews([]);
      return;
    }
    sherlockPreviewUsernamesAction(nome).then(setPreviews).catch(() => setPreviews([]));
  }, [nome]);

  const buscaDisponivel = Boolean(status?.ready);

  const buscarNome = async () => {
    if (!buscaDisponivel) {
      setErr(status?.hint || "Sherlock não está disponível.");
      return;
    }
    setBusy(true);
    setErr("");
    setHits([]);
    try {
      const r = await sherlockBuscarPorNomeAction(nome);
      setTried(r.tried || []);
      setHits(r.hits || []);
      if (!r.ok) setErr(r.error || "Nenhum perfil");
    } finally {
      setBusy(false);
    }
  };

  const buscarUser = async () => {
    if (!buscaDisponivel) {
      setErr(status?.hint || "Sherlock não está disponível.");
      return;
    }
    setBusy(true);
    setErr("");
    setHits([]);
    try {
      const r = await sherlockBuscarUsernameAction(username);
      setTried([username]);
      setHits(r.hits || []);
      if (!r.ok) setErr(r.error || "Nenhum perfil");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-border/50 bg-card/30 p-3 space-y-2"
          : "rounded-2xl border border-border/60 bg-card/40 p-4 space-y-3"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-black tracking-tight">Sherlock</h2>
          <p className="text-[11px] text-muted-foreground">
            Perfis públicos por username · <strong>opcional</strong> · não acha CPF/telefone
          </p>
        </div>
        <span
          className={
            "text-[10px] font-black uppercase px-2 py-0.5 rounded " +
            (status?.ready
              ? "bg-emerald-500/15 text-emerald-600"
              : "bg-muted text-muted-foreground")
          }
        >
          {status?.ready ? "API ok" : "off / opcional"}
        </span>
      </div>

      {status && (
        <p
          className={
            "text-[11px] " + (status.localhost ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")
          }
        >
          {status.hint}
          {status.urlPreview ? ` · ${status.urlPreview}` : ""}
        </p>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <label className="space-y-0.5 flex-1 min-w-[180px]">
          <span className="text-[9px] font-black uppercase text-muted-foreground">Nome completo</span>
          <Input className="h-9" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da parte" />
        </label>
        <Button type="button" className="h-9 gap-1 text-xs font-black uppercase" disabled={busy || !buscaDisponivel || !nome.trim()} onClick={buscarNome}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Por nome
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="space-y-0.5 flex-1 min-w-[140px]">
          <span className="text-[9px] font-black uppercase text-muted-foreground">Username direto</span>
          <Input className="h-9 font-mono" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex.: joaosilva" />
        </label>
        <Button type="button" variant="secondary" className="h-9 gap-1 text-xs font-black uppercase" disabled={busy || !buscaDisponivel || !username.trim()} onClick={buscarUser}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Username
        </Button>
      </div>

      {previews.length > 0 && (
        <p className="text-[10px] font-mono text-muted-foreground">Handles: {previews.slice(0, 6).join(" · ")}</p>
      )}

      {err && <p className="text-[11px] text-amber-600 dark:text-amber-400">{err}</p>}
      {tried.length > 0 && !err && hits.length === 0 && (
        <p className="text-[11px] text-muted-foreground">Testados: {tried.join(", ")}</p>
      )}

      {hits.length > 0 && (
        <ul className="text-[11px] space-y-1 max-h-40 overflow-auto border-t border-border/40 pt-2">
          {hits.map((h) => (
            <li key={h.url + (h.username || "")}>
              <a href={h.url} target="_blank" rel="noreferrer" className="text-primary underline">
                {h.site}
                {h.username ? ` · @${h.username}` : ""}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
