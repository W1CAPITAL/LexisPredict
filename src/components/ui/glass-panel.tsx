"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function GlassPanel({
  className,
  strong = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return (
    <div
      className={cn(strong ? "glass-strong glass-panel" : "glass-panel", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass-card p-4", className)} {...props}>
      {children}
    </div>
  );
}
