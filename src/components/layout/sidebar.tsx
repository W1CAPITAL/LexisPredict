"use client";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Sidebar — menu enxuto, nomes claros, sem Notificações / Omni Export / Dossiê.
 * Scroll estável (conteúdo fora do pai).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { DollarSign,
  LayoutDashboard,
  Briefcase,
  Upload,
  BarChart3,
  ShieldAlert,
  Settings,
  StickyNote,
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
  HelpCircle,
  PlayCircle,
  Scale,
  ScanLine,
  ClipboardList,
  Bot,
  Gavel,
  ShieldCheck,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MetalButton } from "@/components/ui/metal-button";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
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

  const onNavScroll = useCallback(() => {
    if (navScrollRef.current) scrollTopRef.current = navScrollRef.current.scrollTop;
  }, []);

  useEffect(() => {
    const el = navScrollRef.current;
    if (el && Math.abs(el.scrollTop - scrollTopRef.current) > 2) {
      el.scrollTop = scrollTopRef.current;
    }
  });

  const navGroups: { title: string; items: NavItem[] }[] = [
    {
      title: "Operação",
      items: [
        { label: "Painel", href: "/", icon: LayoutDashboard },
        { label: "Fila de contato", href: "/tarefas", icon: ListTodo },
        { label: "Finanças", href: "/financas", icon: DollarSign },
        { label: "Processos", href: "/cases", icon: Briefcase },
        { label: "Processos da Empresa", href: "/processos", icon: FolderOpen },
        { label: "Busca e Apreensão", href: "/busca-apreensao", icon: Gavel },
        ...(isAdmin ? [{ label: "Supervisão", href: "/supervisao", icon: ShieldCheck }] : []),
        ...(isAdmin ? [{ label: "Equipe", href: "/team", icon: Users }] : []),
      ],
    },
    {
      title: "Ferramentas",
      items: [
        { label: "Cadastro", href: "/tools/automacao", icon: ClipboardList },
        { label: "Consulta processo", href: "/veredito", icon: Scale },
        { label: "Assistente", href: "/chat", icon: Bot },
        { label: "Procuração", href: "/documents", icon: FileText },
        { label: "Habilitação", href: "/habilitacao-peca", icon: FileSignature },
        { label: "Substabelecimento", href: "/substabelecimento", icon: Files },
        { label: "Revogação poderes", href: "/revogacao-poderes", icon: Scale },
        { label: "Subst. simples", href: "/substabelecimento-simples", icon: ClipboardList },
        { label: "Peça de subst.", href: "/substabelecimento-peca", icon: Files },
        { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
        { label: "Importar", href: "/import", icon: Upload },
        { label: "Notas", href: "/notes", icon: StickyNote },
        { label: "OCR", href: "/tools/ocr", icon: ScanLine },
        { label: "Treinamento", href: "/onboarding", icon: PlayCircle },
      ],
    },
    {
      title: "Sistema",
      items: [
        { label: "Indicadores", href: "/analytics", icon: BarChart3 },
        { label: "Urgências", href: "/urgency", icon: ShieldAlert },
        { label: "Configurações", href: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="h-[4.5rem] shrink-0 flex items-center px-5 border-b border-sidebar-border/80">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
            <Layers size={18} strokeWidth={2.25} />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[13px] tracking-tight text-sidebar-foreground leading-none truncate">
                LexisPredict
              </span>
              <span className="text-[10px] text-primary font-semibold tracking-wide mt-1">
                Operações
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
          <LiquidMetalButton
            onClick={onToggleMinimize}
            preset="chromatic"
            mode="liquid"
            strength={1}
            className="w-full h-11 rounded-xl font-semibold text-[11px] tracking-wide gap-2.5"
          >
            <Zap className={cn("w-4 h-4", status === "running" && "animate-pulse text-amber-400")} />
            {!collapsed && "Scanner tribunal"}
          </LiquidMetalButton>
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
                    "metal-nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                    active
                      ? "bg-primary/10 text-primary font-semibold shadow-[inset_3px_0_0_0_hsl(var(--primary))] metal-nav-item--active"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0",
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/60 hover:bg-primary/10 hover:text-primary transition-all group"
          >
            <HelpCircle size={16} className="shrink-0 opacity-60 group-hover:opacity-100" />
            {!collapsed && (
              <span className="text-[11px] font-black tracking-tight uppercase truncate">
                Guia rápido
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-sidebar-border space-y-4 shrink-0 overflow-hidden">
        {!collapsed && <InstallAppButton />}
        {!collapsed && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/50 border border-sidebar-border min-w-0">
            <Avatar className="w-9 h-9 border border-primary/20 shrink-0">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs">
                {profile?.nome?.substring(0, 2).toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-black uppercase truncate text-sidebar-foreground">
                {profile?.nome || "User"}
              </span>
              <span className="text-[9px] text-sidebar-foreground/50 uppercase font-bold truncate">
                {profile?.cargo || "Operador"}
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
              className="h-9 w-9 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg flex items-center justify-center"
            >
              <LogOut size={16} />
            </button>
            <ThemeToggle />
          </div>
          {showCollapseBtn && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="hidden md:flex h-9 w-9 text-sidebar-foreground/60 hover:text-primary rounded-lg items-center justify-center"
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

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

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
    onLogout: async () => {
      await signOut();
      router.push("/login");
    },
    onToggleTheme: () => setDarkMode(!isDarkMode),
    onToggleCollapsed: () => setCollapsed((c) => !c),
  };

  return (
    <>
      {/* Único menu: abre só pelo botão (sem sidebar fixa) */}
      <div className="fixed top-4 left-4 z-[100]">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-xl border border-border/60 bg-background/95 shadow-md backdrop-blur-md"
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="p-0 border-r border-sidebar-border w-[min(18rem,88vw)] sm:w-[20rem] overflow-hidden bg-sidebar"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>Navegação do gabinete</SheetDescription>
            </SheetHeader>
            <SidebarNavBody {...bodyProps} collapsed={false} showCollapseBtn={false} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
