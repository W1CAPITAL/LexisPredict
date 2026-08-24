"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  title: string;
  detail?: string;
  at?: string;
  tone?: "default" | "alert" | "ok" | "muted";
};

const toneDot: Record<NonNullable<TimelineItem["tone"]>, string> = {
  default: "bg-primary",
  alert: "bg-red-500",
  ok: "bg-emerald-500",
  muted: "bg-muted-foreground/40",
};

/** Timeline vertical estilo Salesforce Activity — só apresentação. */
export function ActivityTimeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">Sem eventos nesta timeline.</p>
    );
  }
  return (
    <ol className={cn("relative space-y-0 border-l border-border ml-2", className)}>
      {items.map((it) => (
        <li key={it.id} className="relative pl-5 pb-5 last:pb-0">
          <span
            className={cn(
              "absolute -left-1.5 top-1.5 size-3 rounded-full ring-2 ring-background",
              toneDot[it.tone || "default"]
            )}
          />
          <div className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium leading-snug">{it.title}</p>
              {it.at ? (
                <time className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">{it.at}</time>
              ) : null}
            </div>
            {it.detail ? (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{it.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
