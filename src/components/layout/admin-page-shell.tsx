"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Crumb = { label: string; href?: string };

/**
 * Shell de página estilo AdminCN: header + breadcrumb + área de conteúdo.
 * Não substitui Sidebar — envolve só o main content.
 */
export function AdminPageShell({
  title,
  subtitle,
  crumbs,
  actions,
  children,
  className,
  contentClassName,
}: {
  title: string;
  subtitle?: string;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col min-h-0 flex-1", className)}>
      <header className="admin-page-header shrink-0 px-4 sm:px-8 py-3.5">
        {crumbs && crumbs.length > 0 && (
          <Breadcrumb className="mb-2">
            <BreadcrumbList>
              {crumbs.map((c, i) => (
                <React.Fragment key={`${c.label}-${i}`}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {c.href ? (
                      <BreadcrumbLink href={c.href}>{c.label}</BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{c.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="admin-page-title truncate">{title}</h1>
            {subtitle ? (
              <p className="admin-page-subtitle mt-0.5">{subtitle}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="admin-toolbar shrink-0">{actions}</div>
          ) : null}
        </div>
      </header>
      <div
        className={cn(
          "flex-1 overflow-y-auto admin-scroll p-4 sm:p-6",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Card admin (data attribute para CSS) */
export function AdminCard({
  children,
  className,
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      data-admin-card
      className={cn("p-4 sm:p-5", !hover && "hover:shadow-none", className)}
    >
      {children}
    </div>
  );
}

/** KPI tile */
export function AdminKpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "bad";
}) {
  const toneCls =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : tone === "bad"
          ? "text-red-700 dark:text-red-400"
          : "text-foreground";
  return (
    <div className="admin-kpi">
      <p className="admin-kpi-label">{label}</p>
      <p className={cn("admin-kpi-value", toneCls)}>{value}</p>
      {hint ? (
        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
