"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/sidebar";

/**
 * App shell Lexis (equivalente funcional ao AppShell Efferd).
 * Mantém a sidebar operacional do gabinete.
 */
export function AppShell({
  children,
  className,
  showSidebar = true,
}: {
  children: React.ReactNode;
  className?: string;
  showSidebar?: boolean;
}) {
  return (
    <div className={cn("flex h-screen bg-background text-foreground overflow-hidden", className)}>
      {showSidebar ? <Sidebar /> : null}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">{children}</div>
    </div>
  );
}
