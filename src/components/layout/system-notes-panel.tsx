"use client";
/**
 * Notas de versão — abaixo do atalho do Scanner, visual discreto.
 * Não compete com a navegação principal.
 */
import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APP_CHANGELOG,
  APP_VERSION,
  formatChangelogDate,
  getLatestChangelog,
} from "@/lib/app-changelog";

type Props = {
  collapsed?: boolean;
};

export function SystemNotesPanel({ collapsed = false }: Props) {
  const [open, setOpen] = useState(false);
  const latest = useMemo(() => getLatestChangelog(), []);

  if (collapsed) {
    return (
      <div className="px-3 pb-2 shrink-0" title={`v${APP_VERSION}`}>
        <div className="h-px w-full bg-sidebar-border/50" />
        <p className="mt-2 text-center text-[8px] font-medium tabular-nums text-sidebar-foreground/35">
          v{APP_VERSION}
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
            Sistema
          </span>
          <span className="ml-auto shrink-0 font-mono text-[9px] tabular-nums text-sidebar-foreground/35">
            v{APP_VERSION}
          </span>
        </div>
        {!open && (
          <p className="mt-0.5 pl-4 truncate text-[9px] text-sidebar-foreground/40">
            {formatChangelogDate(latest.date)} · {latest.title}
          </p>
        )}
      </button>

      {open && (
        <div className="mt-1 max-h-[min(40vh,280px)] overflow-y-auto overscroll-contain rounded-lg border border-sidebar-border/40 bg-sidebar-accent/20 px-2 py-2 space-y-3">
          <p className="px-1 text-[8px] font-medium uppercase tracking-wider text-sidebar-foreground/35">
            Atualizações por data
          </p>
          {APP_CHANGELOG.map((item) => (
            <article
              key={`${item.version}-${item.date}`}
              className="border-b border-sidebar-border/30 pb-2 last:border-0 last:pb-0"
            >
              <div className="flex items-baseline justify-between gap-2 px-1">
                <h4 className="text-[10px] font-semibold leading-snug text-sidebar-foreground/80">
                  {item.title}
                </h4>
                <span className="shrink-0 font-mono text-[8px] text-sidebar-foreground/40">
                  v{item.version}
                </span>
              </div>
              <p className="px-1 text-[8px] text-sidebar-foreground/40 tabular-nums">
                {formatChangelogDate(item.date)}
              </p>
              <ul className="mt-1 space-y-0.5 px-1">
                {item.details.map((line, i) => (
                  <li
                    key={i}
                    className="text-[9px] leading-snug text-sidebar-foreground/55 pl-2 border-l border-sidebar-border/40"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
