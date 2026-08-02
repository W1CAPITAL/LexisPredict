/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 * Sidebar v2 — scroll estável, ícones modernos, overflow contido
 */
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Briefcase,
  Upload,
  BarChart3,
  ShieldAlert,
  Settings,
  StickyNote,
  FileSearch,
  LogOut,
  MessageCircle,
  Menu,
  FileText,
  ChevronLeft,
  ChevronRight,
  Users,
  Zap,
  Layers,
  FileSignature,
  Files,
  Sun,
  Moon,
  ListTodo,
  Printer,
  HelpCircle,
  PlayCircle,
  Scale,
  ScanLine,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getTranslation, Locale } from "@/lib/i18n";
import { checkIfSuperAdmin, checkIfSupervisor } from "@/lib/supabase";
import { useAppStore } from "@/store/use-app-store";
import { useDataJudScanStore } from "@/store/use-datajud-scan-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InstallAppButton } from "@/components/mobile/InstallAppButton";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; size?: number }>;
};

/**
 * Conteúdo fora do componente pai para NÃO remontar a cada render
 * (isso zerava o scroll do menu ao navegar / atualizar estado).
 */
function SidebarNavBody({
  collapsed,
  pathname,
  locale,
  isAdmin,
  profile,
  isDarkMode,
  status,
  onToggleMinimize,
  onStartTour,
  onLogout,
  onToggleTheme,
  onToggleCollapsed,
  showCollapseBtn,
}: {
  collapsed: boolean;
  pathname: string;
  locale: Locale;
  isAdmin: boolean;
  profile: any;
  isDarkMode: boolean;
  status: string;
  onToggleMinimize: () => void;
  onStartTour: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
  onToggleCollapsed: () => void;
  showCollapseBtn: boolean;
}) {
  const t = getTranslation(locale);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);

  // Preserva posição de scroll do menu (não volta pro topo)
  const onNavScroll = useCallback(() => {
    if (navScrollRef.current) {
      scrollTopRef.current = navScrollRef.current.scrollTop;
    }
  }, []);

  useEffect(() => {
    const el = navScrollRef.current;
    if (el && Math.abs(el.scrollTop - scrollTopRef.current) > 2) {
      el.scrollTop = scrollTopRef.current;
    }
  });

  const navGroups: { title: string; items: NavItem[] }[] = [
    {
      title: t.management,
      items: [
        { label: t.dashboard, href: "/", icon: LayoutDashboard },
        { label: t.tasks, href: "/tarefas", icon: ListTodo },
        { label: t.cases, href: "/cases", icon: Briefcase },
        ...(isAdmin ? [{ label: t.team, href: "/team", icon: Users }] : []),
      ],
    },
    {
      title: t.operations,
      items: [
        { label: t.audit, href: "/veredito", icon: Scale },
        { label: "Procuração", href: "/documents", icon: FileText },
        { label: "Habilitação", href: "/habilitacao-peca", icon: FileSignature },
        { label: "Substabelecimento", href: "/substabelecimento", icon: Files },
        { label: "Subst. Simples", href: "/substabelecimento-simples", icon: ClipboardList },
        { label: "Peça de Subst.", href: "/substabelecimento-peca", icon: Files },
        { label: t.whatsapp, href: "/whatsapp", icon: MessageCircle },
        { label: t.import, href: "/import", icon: Upload },
        { label: t.notes, href: "/notes", icon: StickyNote },
        { label: "Motor de OCR", href: "/tools/ocr", icon: ScanLine },
        { label: "Treinamento", href: "/onboarding", icon: PlayCircle },
      ],
    },
    {
      title: t.system,
      items: [
        { label: t.analytics, href: "/analytics", icon: BarChart3 },
        { label: t.urgency, href: "/urgency", icon: ShieldAlert },
        { label: "Dossiê / Relatório", href: "/report", icon: Printer },
        { label: t.settings, href: "/settings", icon: Settings },
        { label: "Omni Export", href: "/master-export", icon: FileSearch },
      ],
    },
  ];

  return (
    <div className="h-full min-h-0 flex flex-col bg-sidebar/95 backdrop-blur-md border-r border-sidebar-border overflow-hidden">
      <div className="h-[4.5rem] shrink-0 flex items-center px-5 border-b border-sidebar-border/80">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md ring-1 ring-primary/20 transition-transform duration-300 hover:scale-105">
            <Layers size={18} strokeWidth={2.25} />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0 animate-in fade-in duration-200">
              <span className="font-bold text-[13px] tracking-tight text-sidebar-foreground leading-none truncate">
                LexisPredict
              </span>
              <span className="text-[10px] text-primary font-semibold tracking-wide mt-1">
                Enterprise
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        ref={navScrollRef}
        onScroll={onNavScroll}
        className="flex-1 min-h-0 py-5 px-3 space-y-6 overflow-y-auto overscroll-y-contain"
        style={{ overflowAnchor: "none", WebkitOverflowScrolling: "touch" }}
      >
        <div className="px-1">
          <Button
            onClick={onToggleMinimize}
            className="w-full h-11 bg-foreground text-background hover:bg-primary hover:text-primary-foreground rounded-xl font-semibold text-[11px] tracking-wide shadow-sm transition-all duration-200 gap-2.5 hover:shadow-md active:scale-[0.98]"
          >
            <Zap
              className={cn(
                "w-4 h-4 transition-colors",
                status === "running" && "animate-pulse text-amber-400"
              )}
            />
            {!collapsed && "Scanner DataJud ∪ DJEN"}
          </Button>
        </div>

        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden",
                    active
                      ? "bg-primary/10 text-primary font-semibold shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-opacity duration-200",
                      active ? "opacity-100" : "opacity-55 group-hover:opacity-90"
                    )}
                    strokeWidth={active ? 2.25 : 2}
                  />
                  {!collapsed && (
                    <span className="text-[11px] font-bold tracking-tight uppercase flex-1 truncate">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        <div className="px-3 pt-4 border-t border-sidebar-border/10">
          <button
            type="button"
            onClick={onStartTour}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/60 hover:bg-primary/10 hover:text-primary transition-all duration-200 group"
          >
            <HelpCircle
              size={16}
              className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
            />
            {!collapsed && (
              <span className="text-[11px] font-black tracking-tight uppercase truncate">
                Guia do Sistema
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-sidebar-border space-y-4 shrink-0 overflow-hidden">
        {!collapsed && <InstallAppButton />}

        {!collapsed && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/50 border border-sidebar-border shadow-sm min-w-0 transition-shadow duration-200 hover:shadow-md">
            <Avatar className="w-9 h-9 border border-primary/20 shrink-0">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs">
                {profile?.nome?.substring(0, 2).toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-black uppercase truncate text-sidebar-foreground leading-tight">
                {profile?.nome || "User"}
              </span>
              <span className="text-[9px] text-sidebar-foreground/50 uppercase font-bold mt-0.5 truncate">
                {profile?.cargo || "Operator"}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onLogout}
              title={t.logout}
              className="h-9 w-9 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg flex items-center justify-center transition-all duration-200"
            >
              <LogOut size={16} />
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              title="Alternar Tema"
              className="h-9 w-9 text-sidebar-foreground/60 hover:text-primary rounded-lg flex items-center justify-center transition-all duration-200"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
          {showCollapseBtn && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="hidden md:flex h-9 w-9 text-sidebar-foreground/60 hover:text-primary rounded-lg items-center justify-center transition-all duration-200"
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>("pt");
  const { profile, signOut } = useAuth();
  const { isDarkMode, setDarkMode, setTutorialActive } = useAppStore();
  const { status, toggleMinimize } = useDataJudScanStore();

  const isSuperAdmin = checkIfSuperAdmin(profile);
  const isSupervisor = checkIfSupervisor(profile);
  const isAdmin =
    profile?.cargo === "Administrador" || isSuperAdmin || isSupervisor;

  useEffect(() => {
    const savedLocale = localStorage.getItem("lexisPredict_locale") as Locale;
    if (savedLocale) setLocale(savedLocale);
  }, []);

  // Fecha sheet mobile ao mudar de rota
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const bodyProps = {
    collapsed,
    pathname,
    locale,
    isAdmin,
    profile,
    isDarkMode,
    status: status || "idle",
    onToggleMinimize: () => toggleMinimize(),
    onStartTour: () => {
      setTutorialActive(true);
      setIsMobileOpen(false);
    },
    onLogout: handleLogout,
    onToggleTheme: () => setDarkMode(!isDarkMode),
    onToggleCollapsed: () => setCollapsed((c) => !c),
  };

  return (
    <>
      <div className="md:hidden fixed top-5 left-5 z-[100]">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="premium-card h-12 w-12 border-none shadow-md transition-transform duration-200 active:scale-95"
            >
              <Menu size={24} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 border-r-0 w-[min(20rem,90vw)] overflow-hidden">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Access LexisPredict Operations</SheetDescription>
            </SheetHeader>
            <SidebarNavBody {...bodyProps} collapsed={false} showCollapseBtn={false} />
          </SheetContent>
        </Sheet>
      </div>

      <aside
        className={cn(
          "hidden md:flex h-screen min-h-0 flex-col transition-[width] duration-300 ease-out z-50 shrink-0 overflow-hidden",
          collapsed ? "w-20" : "w-72"
        )}
      >
        <SidebarNavBody {...bodyProps} showCollapseBtn />
      </aside>
    </>
  );
}
