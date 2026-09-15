"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ListTodo, Briefcase, FolderOpen, PauseCircle, ShieldAlert,
  Gavel, Hash, MessageCircle, CalendarDays, FileText, BarChart3, Users,
  ShieldCheck, Kanban, Wallet, Calculator, Bot, MessagesSquare, Upload,
  Settings, Search, Menu, LogOut, Zap, StickyNote, PlayCircle, BrainCircuit,
  Crown, Monitor, Scale, FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useAdmin } from "@/hooks/use-admin";
import { usePlano } from "@/hooks/use-plano";
import { filterNavByPlan, planTemScanner } from "@/lib/planos-pacotes";
import { useDataJudScanStore } from "@/store/use-datajud-scan-store";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const primary = [
  ["Painel", "/", LayoutDashboard],
  ["Fila", "/tarefas", ListTodo],
  ["Meus processos", "/cases", Briefcase],
  ["Empresa", "/processos", FolderOpen],
  ["Parados", "/processos-parados", PauseCircle],
  ["Encerrados", "/encerrados-revisao", ShieldAlert],
  ["B.A.", "/busca-apreensao", Gavel],
  ["Gerador", "/gerador-processos", Hash],
  ["WhatsApp", "/whatsapp", MessageCircle],
  ["Dossiê", "/report", BarChart3],
  ["Config", "/settings", Settings],
] as const;

const more = [
  ["Agenda", "/agenda", CalendarDays],
  ["Peças", "/documents", FileText],
  ["Procedentes", "/cumprimentos-procedentes", Scale],
  ["OCR", "/tools/ocr", FileText],
  ["Importar", "/import", Upload],
  ["CSV local", "/visualizador-csv", FileSpreadsheet],
  ["Assistente", "/chat", Bot],
  ["Veredito", "/veredito", Scale],
  ["Indicadores", "/analytics", BarChart3],
  ["Insights", "/insights", BrainCircuit],
  ["Urgências", "/urgency", ShieldAlert],
  ["CRM", "/crm", Kanban],
  ["Finanças", "/financas", Wallet],
  ["Cálculos", "/calculos", Calculator],
  ["Chat equipe", "/mensagens", MessagesSquare],
  ["Notas", "/notes", StickyNote],
  ["Treinamento", "/onboarding", PlayCircle],
  ["Offline", "/offline", Monitor],
] as const;

export function SidebarDock() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { isAdmin, isSuperAdmin, canScan } = useAdmin();
  const { plan } = usePlano();
  const { status, toggleMinimize } = useDataJudScanStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const extras = useMemo(() => {
    // label: string — admin/superadmin labels are not in the `more` const union
    const items: { label: string; href: string; icon: React.ComponentType<{ className?: string; size?: number | string }> }[] =
      more.map(([label, href, icon]) => ({ label, href, icon }));
    if (isAdmin) {
      items.push(
        { label: "Supervisão", href: "/supervisao", icon: ShieldCheck },
        { label: "Equipe", href: "/team", icon: Users },
        { label: "Auditoria", href: "/auditoria", icon: ShieldCheck },
      );
    }
    if (isSuperAdmin) {
      items.push(
        { label: "Segurança", href: "/security", icon: ShieldAlert },
        { label: "Administração", href: "/superadmin", icon: Crown },
      );
    }
    const q = query.trim().toLowerCase();
    return filterNavByPlan(items, isSuperAdmin ? "maximo" : plan).filter(
      (item) => !q || `${item.label} ${item.href}`.toLowerCase().includes(q),
    );
  }, [isAdmin, isSuperAdmin, plan, query]);

  const main = filterNavByPlan(
    primary.map(([label, href, icon]) => ({ label, href, icon })),
    isSuperAdmin ? "maximo" : plan,
  );

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  return (
    <>
      <div data-lexis-sidebar data-lexis-dock className="hidden md:block h-0 w-0" aria-hidden />
      <header
        className="fixed top-0 inset-x-0 z-30 hidden h-14 items-center gap-2 border-b bg-card px-2 md:flex"
      >
        <Link href="/" className="flex items-center gap-2 px-2" aria-label="Painel">
          <img src="/logo.png" alt="" className="h-7 w-7 rounded-md object-contain" />
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:thin]">
          {main.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium hover:bg-muted">
              <Menu size={15} /> Mais
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(360px,92vw)] p-0">
            <SheetTitle className="sr-only">Mais telas</SheetTitle>
            <SheetDescription className="sr-only">Telas extras do gabinete</SheetDescription>
            <div className="flex h-full flex-col">
              <div className="border-b p-3">
                <label className="flex h-10 items-center gap-2 rounded-lg border px-3">
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar tela"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </label>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {extras.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "mb-0.5 flex h-10 items-center gap-2 rounded-lg px-3 text-sm",
                        isActive(item.href) ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      <Icon size={16} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </SheetContent>
        </Sheet>
        {canScan && planTemScanner(plan) && (
          <button
            onClick={() => {
              window.dispatchEvent(new Event("lexis-need-scanner"));
              toggleMinimize();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted"
            title="Scanner"
          >
            <Zap size={16} className={status === "running" ? "animate-pulse" : ""} />
          </button>
        )}
        <ThemeToggle />
        <button
          aria-label="Sair"
          onClick={() => void signOut()}
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted"
        >
          <LogOut size={16} />
        </button>
      </header>

      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b bg-card px-2 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <button aria-label="Abrir menu" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted">
              <Menu size={20} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(340px,92vw)] p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">Navegação</SheetDescription>
            <div className="overflow-y-auto p-2 pb-8">
              {[...main, ...extras].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "mb-0.5 flex h-11 items-center gap-2 rounded-lg px-3 text-sm",
                      isActive(item.href) ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
              <p className="px-3 pt-3 text-xs text-muted-foreground">{profile?.nome}</p>
            </div>
          </SheetContent>
        </Sheet>
        <span className="text-sm font-semibold">LexisPredict</span>
      </div>
    </>
  );
}
