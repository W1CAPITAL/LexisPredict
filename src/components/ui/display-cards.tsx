"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type DisplayCardItem = {
  icon?: React.ReactNode;
  title: string;
  description: string;
  date?: string;
  className?: string;
  titleClassName?: string;
};

export function DisplayCards({
  cards,
  className,
}: {
  cards: DisplayCardItem[];
  className?: string;
}) {
  return (
    <div className={cn("grid [grid-template-areas:'stack'] place-items-center relative min-h-[280px]", className)}>
      {cards.map((c, i) => (
        <div
          key={i}
          className={cn(
            "[grid-area:stack] w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-md transition-all duration-500",
            "hover:-translate-y-3 hover:shadow-xl hover:z-10",
            i === 1 && "translate-x-10 translate-y-8 opacity-95",
            i === 2 && "translate-x-20 translate-y-16 opacity-90",
            c.className
          )}
          style={{ zIndex: cards.length - i }}
        >
          <div className="flex items-start gap-3">
            {c.icon}
            <div className="min-w-0 space-y-1">
              <p className={cn("font-bold text-sm", c.titleClassName)}>{c.title}</p>
              <p className="text-xs text-muted-foreground">{c.description}</p>
              {c.date ? <p className="text-[10px] text-muted-foreground/80">{c.date}</p> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
