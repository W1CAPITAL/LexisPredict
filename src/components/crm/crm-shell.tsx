"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Kanban,
  Wallet,
  Package,
  Users,
  AlertTriangle,
  Scale,
  ListTodo,
  ArrowLeft,
} from "lucide-react";

const NAV = [
  { href: "/crm", label: "Dashboard", icon: LayoutDashboard },
  { href: "/crm/funil", label: "Pipeline", icon: Kanban },
  { href: "/crm/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/crm/servicos", label: "Serviços", icon: Package },
  { href: "/crm/fornecedores", label: "Bancas", icon: Users },
  { href: "/crm/cobranca", label: "Cobrança", icon: AlertTriangle },
  { href: "/crm/atividades", label: "Tarefas", icon: ListTodo },
  { href: "/crm/contatos", label: "Contatos", icon: Users },
  { href: "/crm/conciliacao", label: "Conciliação", icon: Scale },
];

export function CrmShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="shrink-0 border-b border-border/60 bg-card/40 backdrop-blur-md px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                <Link href="/crm" aria-label="CRM home">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-black tracking-tight truncate">{title}</h1>
                {subtitle ? (
                  <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto pb-1">
            {NAV.map((item) => {
              const active = path === item.href || (item.href !== "/crm" && path?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide whitespace-nowrap transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background/80 border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
