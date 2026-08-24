"use client";

/**
 * Notas + próximas + log de atualização (poll em /api/version).
 */
import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APP_CHANGELOG,
  APP_VERSION,
  formatChangelogDate,
  getLatestChangelog,
} from "@/lib/app-changelog";
import {
  RELEASE_CHANGELOG,
  RELEASE_NOTES,
  RELEASE_PROXIMAS,
  RELEASE_VERSION,
} from "@/lib/release-feed";

type Note = { id: string; titulo: string; corpo: string };

type Props = { collapsed?: boolean };

export function SystemNotesPanel({ collapsed = false }: Props) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(RELEASE_VERSION);
  const [notes, setNotes] = useState<Note[]>(RELEASE_NOTES);
  const [proximas, setProximas] = useState<Note[]>(RELEASE_PROXIMAS);
  const [log, setLog] = useState<string[]>(RELEASE_CHANGELOG);
  const latest = getLatestChangelog();

  useEffect(() => {
    let live = true;
    const pull = async () => {
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!live) return;
        if (data.version) setVersion(String(data.version));
        if (Array.isArray(data.notes) && data.notes.length) setNotes(data.notes);
        if (Array.isArray(data.proximas) && data.proximas.length) setProximas(data.proximas);
        if (Array.isArray(data.changelog) && data.changelog.length) setLog(data.changelog.map(String));
      } catch {
        /* offline */
      }
    };
    pull();
    const id = setInterval(pull, 15_000);
    const onVis = () => {
      if (document.visibilityState === "visible") pull();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("lexis-release-check", pull);
    return () => {
      live = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("lexis-release-check", pull);
    };
  }, []);

  if (collapsed) {
    return (
      <div className="px-3 pb-2 shrink-0" title={`v${version}`}>
        <div className="h-px w-full bg-sidebar-border/50" />
        <p className="mt-2 text-center text-[8px] font-medium tabular-nums text-sidebar-foreground/35">
          v{version}
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 pb-2 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors",
          "hover:border-sidebar-border/60 hover:bg-sidebar-accent/30",
          open && "border-sidebar-border/50 bg-sidebar-accent/25"
        )}
        aria-expanded={open}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {open ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-sidebar-foreground/40" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-sidebar-foreground/40" />
          )}
          <span className="truncate text-[9px] font-semibold tracking-wide text-sidebar-foreground/45 uppercase">
            Notas
          </span>
          <span className="ml-auto shrink-0 font-mono text-[9px] tabular-nums text-sidebar-foreground/35">
            v{version}
          </span>
        </div>
        {!open && (
          <p className="mt-0.5 pl-4 truncate text-[9px] text-sidebar-foreground/40">
            {notes[0]?.titulo || latest.title}
          </p>
        )}
      </button>

      {open && (
        <div className="mt-1 max-h-[min(28vh,220px)] overflow-y-auto overscroll-contain rounded-lg border border-sidebar-border/40 bg-sidebar-accent/20 px-2 py-2 space-y-3">
          <p className="px-1 text-[8px] font-medium uppercase tracking-wider text-sidebar-foreground/35">
            Em vigor
          </p>
          {notes.map((n) => (
            <article key={n.id} className="px-1">
              <h4 className="text-[10px] font-semibold text-sidebar-foreground/80">{n.titulo}</h4>
              <p className="text-[9px] leading-snug text-sidebar-foreground/55">{n.corpo}</p>
            </article>
          ))}

          <p className="px-1 text-[8px] font-medium uppercase tracking-wider text-sidebar-foreground/35 pt-1">
            Próximas
          </p>
          {proximas.map((n) => (
            <article key={n.id} className="px-1">
              <h4 className="text-[10px] font-semibold text-sidebar-foreground/80">{n.titulo}</h4>
              <p className="text-[9px] leading-snug text-sidebar-foreground/55">{n.corpo}</p>
            </article>
          ))}

          <p className="px-1 text-[8px] font-medium uppercase tracking-wider text-sidebar-foreground/35 pt-1">
            Log de atualização
          </p>
          <ul className="space-y-1 px-1">
            {log.slice(0, 3).map((line, i) => (
              <li
                key={i}
                className="text-[9px] leading-snug text-sidebar-foreground/55 pl-2 border-l border-sidebar-border/40"
              >
                {line}
              </li>
            ))}
          </ul>

          <p className="px-1 text-[8px] text-sidebar-foreground/35">
            Histórico interno {formatChangelogDate(latest.date)} · app {APP_VERSION}
          </p>
          {APP_CHANGELOG.slice(0, 2).map((item) => (
            <p key={item.version} className="px-1 text-[8px] text-sidebar-foreground/40">
              v{item.version} · {item.title}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
