"use client";

/**
 * Sidebar LexisPredict — menu com ícones distintos, grupos claros e busca.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Briefcase,
  FolderOpen,
  Gavel,
  Upload,
  Kanban,
  Wallet,
  FileText,
  Scale,
  ClipboardList,
  Bot,
  MessageCircle,
  BarChart3,
  BrainCircuit,
  ShieldAlert,
  PauseCircle,
  ShieldCheck,
  Users,
  Settings,
  StickyNote,
  PlayCircle,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  Layers,
  HelpCircle,
  Search,
  Zap,
  Calculator,
  Crown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils"
import { flattenNavItems, loadNavPreferences, type NavPreferences } from "@/lib/nav-preferences";
import { PRODUCT } from "@/lib/product-identity";
import { Button } from "@/components/ui/button";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import { useAuth } from "@/components/auth/auth-provider";
import { useAdmin } from "@/hooks/use-admin";
import { usePlano } from "@/hooks/use-plano";
import { planTemScanner } from "@/lib/planos-pacotes";
import { filterNavByPlan } from "@/lib/planos-pacotes";
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
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SystemNotesPanel } from "@/components/layout/system-notes-panel";

function SafeIcon({
  icon: Icon,
  className,
  size = 18,
}: {
  icon?: LucideIcon;
  className?: string;
  size?: number;
}) {
  if (!Icon) return null;
  return <Icon className={className} strokeWidth={1.85} size={size} aria-hidden />;
}

type NavItem = {
  label: string;
  href: string;
  hint?: string;
  icon: LucideIcon;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

function SidebarNavBody({
  collapsed,
  pathname,
  locale,
  isAdmin,
  isSuperAdmin,
  profile,
  status,
  canScan = true,
  plan = "maximo",
  onToggleMinimize,
  onStartTour,
  onLogout,
  onToggleCollapsed,
  showCollapseBtn,
}: {
  collapsed: boolean;
  pathname: string;
  locale: Locale;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  profile: any;
  status: string;
  canScan?: boolean;
  plan?: import("@/lib/planos-pacotes").PlanId;
  onToggleMinimize: () => void;
  onStartTour: () => void;
  onLogout: () => void;
  onToggleCollapsed: () => void;
  showCollapseBtn: boolean;
}) {
  const t = getTranslation(locale);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const [navQuery, setNavQuery] = useState("")
  const [showMoreTools, setShowMoreTools] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("lexis_sidebar_more_tools") === "1";
    } catch {
      return false;
    }
  });

  const toggleMoreTools = useCallback(() => {
    setShowMoreTools((v) => {
      const next = !v;
      try {
        if (next) window.localStorage.setItem("lexis_sidebar_more_tools", "1");
        else window.localStorage.removeItem("lexis_sidebar_more_tools");
      } catch { /* */ }
      return next;
    });
  }, []);
  const [navPrefs, setNavPrefs] = useState<NavPreferences>(() => loadNavPreferences());
  useEffect(() => {
    const uid = (profile as any)?.auth_user_id || (profile as any)?.id || null;
    setNavPrefs(loadNavPreferences(uid));
    const onPrefs = () => setNavPrefs(loadNavPreferences(uid));
    window.addEventListener('lexis-nav-prefs', onPrefs);
    return () => window.removeEventListener('lexis-nav-prefs', onPrefs);
  }, [profile]);

  const onNavScroll = useCallback(() => {
    if (navScrollRef.current) scrollTopRef.current = navScrollRef.current.scrollTop;
  }, []);

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTop = scrollTopRef.current;
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  const navItems: NavItem[] = useMemo(() => {
    const primary: NavItem[] = [
      { label: "Painel da carteira", href: "/", icon: LayoutDashboard },
      { label: "Encerrados a revisar", href: "/encerrados-revisao", icon: ShieldAlert },
      { label: "Fila de atendimento", href: "/tarefas", icon: ListTodo },
      { label: "Processos parados", href: "/processos-parados", icon: PauseCircle },
      { label: "Meus processos", href: "/cases", icon: Briefcase },
      { label: "Processos da empresa", href: "/processos", icon: FolderOpen },
      { label: "Importar", href: "/import", icon: Upload },
      { label: "Cadastro", href: "/tools/automacao", icon: ClipboardList },
    ];

    const secondary: NavItem[] = [
      { label: "Agenda", href: "/agenda", icon: CalendarDays },
      { label: "Ações Procedentes", href: "/cumprimentos-procedentes", icon: Scale },
      { label: "Busca e apreensão", href: "/busca-apreensao", icon: Gavel },
      { label: "Radar predatória", href: "/investigacao-predatoria", icon: ShieldAlert },
      { label: "Dossiê", href: "/report", icon: BarChart3 },
      { label: "OCR", href: "/tools/ocr", icon: FileText },
      { label: "Assessoria (comercial)", href: "/crm", icon: Kanban },
      { label: "Follow-ups comerciais", href: "/crm/followups", icon: ListTodo },
      { label: "Finanças", href: "/financas", icon: Wallet },
      { label: "Cálculos judiciais", href: "/calculos", icon: Calculator },
      // Peças/modelos (procuração, substabelecimento, habilitação, revogação, modelos)
      // ficam só na Central de Documentos — evita menu duplicado.
      { label: "Central de documentos", href: "/documents", icon: FileText },
      { label: "Veredito", href: "/veredito", icon: Scale },
      { label: "Assistente", href: "/chat", icon: Bot },
      { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
      { label: "Indicadores", href: "/analytics", icon: BarChart3 },
      { label: "Insights da carteira", href: "/insights", icon: BrainCircuit },
      { label: "Urgências", href: "/urgency", icon: ShieldAlert },
    ];

    const rest: NavItem[] = [];
    if (isAdmin) {
      rest.push(
        { label: "Supervisão", href: "/supervisao", icon: ShieldCheck },
        { label: "Equipe", href: "/team", icon: Users },
        { label: "Auditoria", href: "/auditoria", icon: ShieldCheck },
      );
      if (isSuperAdmin) {
        rest.push({ label: "Segurança", href: "/security", icon: ShieldAlert });
        rest.push({ label: "Superadmin", href: "/superadmin", icon: Crown });
      }
    }
    rest.push(
      { label: "Treinamento", href: "/onboarding", icon: PlayCircle },
      { label: "Notas", href: "/notes", icon: StickyNote },
      { label: "Configurações", href: "/settings", icon: Settings },
    );

    let items = flattenNavItems(primary, secondary, rest, navPrefs, showMoreTools);
    items = filterNavByPlan(items, isSuperAdmin ? "maximo" : plan);

    const q = navQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (it) =>
          it.label.toLowerCase().includes(q) ||
          it.href.toLowerCase().includes(q)
      );
    }
    return items;
  }, [isAdmin, isSuperAdmin, navQuery, showMoreTools, navPrefs, plan]);


  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {/* Brand */}
      <div className="h-[4.25rem] shrink-0 flex items-center px-3 border-b border-sidebar-border/80">
        <div className="flex items-center gap-2.5 min-w-0 w-full">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20 transition-transform duration-200 hover:scale-110">
            <SafeIcon icon={Layers} size={18} />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[13px] tracking-tight text-sidebar-foreground leading-none truncate">
                LexisPredict
              </span>
              <span className="text-[10px] text-primary font-semibold mt-1">
                {PRODUCT.tagline}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Scan shortcut */}
      <div className="px-3 pt-3 shrink-0">
        <LiquidMetalButton
          onClick={onToggleMinimize}
          preset="chromatic"
          mode="liquid"
          className={cn("w-full justify-center gap-2", collapsed && "px-0")}
        >
          <SafeIcon icon={Zap} size={16} />
          {!collapsed && (
            <span className="text-[11px] font-bold uppercase tracking-wide">
              {!canScan ? "Scanner indisponível (plano/bloqueio)" : status === "running" ? "Scanner ativo" : "Scanner tribunal"}
            </span>
          )}
        </LiquidMetalButton>
      </div>

      <SystemNotesPanel collapsed={collapsed} />

      {/* Nav */}
      <div
        ref={navScrollRef}
        onScroll={onNavScroll}
        className="flex-1 min-h-0 py-3 px-2 space-y-4 overflow-y-auto overscroll-y-contain"
        style={{ overflowAnchor: "none", WebkitOverflowScrolling: "touch" }}
      >
        {!collapsed && (
          <div className="px-1">
            <div className="relative">
              <SafeIcon
                icon={Search}
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sidebar-foreground/40 pointer-events-none"
              />
              <input
                type="search"
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                placeholder="Buscar no menu…"
                className="w-full h-9 rounded-lg border border-sidebar-border bg-sidebar-accent/40 pl-8 pr-3 text-[11px] font-medium text-sidebar-foreground placeholder:text-sidebar-foreground/45 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all duration-200"
                aria-label="Buscar no menu"
              />
            </div>
          </div>
        )}

        
      {/* Modo operador: núcleo sempre; demais rotas sob demanda */}
      {!navQuery.trim() && (
        <button
          type="button"
          onClick={toggleMoreTools}
          className={cn(
            "mx-2 mb-2 rounded-lg border border-border/60 px-2 py-1.5 text-[10px] font-black uppercase tracking-wide",
            "text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 hover:shadow-sm",
            collapsed && "mx-1 px-1"
          )}
        >
          {collapsed ? (showMoreTools ? "−" : "+") : showMoreTools ? "Recolher ferramentas" : "Mais ferramentas"}
        </button>
      )}

{navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-all duration-200 ease-out hover:shadow-sm",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 group-hover:scale-105",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-sidebar-border/80 bg-sidebar-accent/30 text-sidebar-foreground/70 group-hover:text-sidebar-foreground"
                    )}
                  >
                    <SafeIcon icon={item.icon} size={16} />
                  </span>
                  {!collapsed && (
                    <span className="min-w-0 flex-1 text-[12px] font-semibold leading-tight tracking-tight">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}

        {!collapsed && navItems.length === 0 && (
          <p className="px-3 text-xs text-sidebar-foreground/50">Nenhum item para “{navQuery}”.</p>
        )}

        <div className="px-1 pt-1">
          <button
            type="button"
            onClick={onStartTour}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-sidebar-foreground/65 hover:bg-primary/10 hover:text-primary transition-all duration-200 hover:shadow-sm"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-sidebar-border/80">
              <SafeIcon icon={HelpCircle} size={16} />
            </span>
            {!collapsed && (
              <span className="text-[12px] font-semibold">Guia rápido</span>
            )}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-3 shrink-0 overflow-visible">
        {!collapsed && <InstallAppButton />}
        {!collapsed && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-sidebar-accent/50 border border-sidebar-border min-w-0 transition-all duration-200 hover:bg-sidebar-accent/80 hover:border-primary/20">
            <Avatar className="w-9 h-9 border-2 border-primary/20 shrink-0 shadow-sm transition-transform duration-200 hover:scale-110 hover:border-primary/40">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                {profile?.nome?.substring(0, 2).toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold truncate text-sidebar-foreground">
                {profile?.nome || "Usuário"}
              </span>
              <span className="text-[9px] text-sidebar-foreground/50 font-semibold truncate">
                {profile?.cargo || "Operador"}
              </span>
            </div>
          </div>
        )}
        <div className={cn("flex gap-2", collapsed ? "flex-col items-center" : "items-center justify-between")}>
          <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
            <button
              type="button"
              onClick={onLogout}
              title={t.logout}
              className="h-9 w-9 text-sidebar-foreground/80 hover:text-destructive hover:bg-destructive/10 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
            >
              <SafeIcon icon={LogOut} size={16} />
            </button>
            <ThemeToggle />
          </div>
          {showCollapseBtn && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className={cn(
                "hidden md:flex items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/50",
                "text-sidebar-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 hover:shadow-md hover:shadow-primary/20",
                "shrink-0 z-10",
                collapsed ? "h-10 w-10 mx-auto" : "h-9 w-9"
              )}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              <SafeIcon icon={collapsed ? ChevronRight : ChevronLeft} size={collapsed ? 20 : 18} />
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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("lexis_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>("pt");
  const { profile, signOut } = useAuth();
  const { setDarkMode, isDarkMode, setTutorialActive } = useAppStore();
  const { status, toggleMinimize } = useDataJudScanStore();
  const { canScan, isViewer } = useAdmin();
  const { plan, canHref, isLocked } = usePlano();
  const isSuperAdmin = checkIfSuperAdmin(profile);
  const isSupervisor = checkIfSupervisor(profile);
  const isAdmin =
    profile?.cargo === "Administrador" || isSuperAdmin || isSupervisor;
  const canScanEffective = canScan && !isLocked && (isSuperAdmin || planTemScanner(plan));

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
    isSuperAdmin,
    profile,
    status: status || "idle",
    canScan: canScanEffective,
    plan,
    onToggleMinimize: () => {
      try { window.dispatchEvent(new Event("lexis-need-scanner")); } catch { /* */ }
      if (!canScanEffective) return;
      toggleMinimize();
    },
    onStartTour: () => {
      setTutorialActive(true);
      setIsMobileOpen(false);
    },
    onLogout: async () => {
      await signOut();
      router.push("/login");
    },
    onToggleCollapsed: () => {
      setCollapsed((c) => {
        const next = !c;
        try {
          if (next) window.localStorage.setItem("lexis_sidebar_collapsed", "1");
          else window.localStorage.removeItem("lexis_sidebar_collapsed");
        } catch { /* */ }
        return next;
      });
    },
  };

  return (
    <>
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 h-screen sticky top-0 z-40",
          "border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          "transition-[width] duration-200 ease-out",
          collapsed ? "w-[4.5rem]" : "w-[17rem]"
        )}
      >
        <SidebarNavBody {...bodyProps} showCollapseBtn />
      </aside>

      <div className="md:hidden fixed top-3 left-3 z-[100]">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-xl border border-border/60 bg-background/95 shadow-md backdrop-blur-md"
              aria-label="Abrir menu"
            >
              <SafeIcon icon={Menu} size={22} />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="p-0 border-r border-sidebar-border w-[min(18rem,90vw)] overflow-hidden bg-sidebar"
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
