"use client";

import React from "react";
import { cn } from "@/lib/utils";

type Col = { key: string; label: string; className?: string };

type Props<T extends Record<string, React.ReactNode>> = {
  columns: Col[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  onRowClick?: (row: T) => void;
  className?: string;
};

/** Tabela densa (muitos registros) — visual clássico CRM, sem lógica de negócio. */
export function DenseList<T extends Record<string, React.ReactNode>>({
  columns,
  rows,
  rowKey,
  onRowClick,
  className,
}: Props<T>) {
  return (
    <div className={cn("w-full overflow-auto rounded-lg border border-border", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap",
                  c.className
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-border/50 last:border-0",
                onRowClick && "cursor-pointer hover:bg-muted/50"
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-3 py-2 align-middle", c.className)}>
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-muted-foreground text-sm">
                Nenhum registro
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
