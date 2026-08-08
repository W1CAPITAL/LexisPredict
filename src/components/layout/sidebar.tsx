"use client";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Sidebar — menu enxuto, nomes claros, sem Notificações / Omni Export / Dossiê.
 * Scroll estável (conteúdo fora do pai).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { DollarSign, TrendingUp,
  Kanban,
  Package,
  Building2,
  LayoutDashboard,
  Briefcase,
  Upload,
  BarChart3,
  BrainCircuit,
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
  CalendarDays,
  HelpCircle,
  PlayCircle,
  Scale,
  ScanLine,
  ClipboardList,
  Bot,
  Gavel,
  ShieldCheck,
  FolderOpen,
  Percent,
  ScrollText,
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

function SafeIcon({
  icon: Icon,
  className,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number; size?: number }>;
  className?: string;
}) {
  if (!Icon) return null;
  return <Icon className={className} strokeWidth={1.75} size={18} />;
}

type NavItem = {
  label: string;
  href: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; size?: number }>;
};

function SidebarNavBody({
  collapsed,
  pathname,
  locale,
  isAdmin,
  isSuperAdmin,
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
  isSuperAdmin?: boolean;
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

  // Só restaura scroll ao mudar de rota — NÃO a cada render (isso “puxava” o menu para cima)
  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTop = scrollTopRef.current;
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  const [navQuery, setNavQuery] = useState("");

  const navGroups: { title: string; items: NavItem[] }[] = useMemo(() => {
    const groups: { title: string; items: NavItem[] }[] = [
      {
        title: "Hoje (rotina)",
        items: [
          { label: "Painel", href: "/", icon: LayoutDashboard, hint: "Vencidos, andamentos e o que exige ação" },
          { label: "Fila de contato", href: "/tarefas", icon: ListTodo, hint: "Quem ligar / responder agora" },
          { label: "Agenda da semana", href: "/agenda", icon: CalendarDays, hint: "Prazos e atendimentos por dia" },
        ],
      },
      {
        title: "Carteira",
        items: [
          { label: "Meus processos", href: "/cases", icon: Briefcase, hint: "Carteira operacional e scanner" },
          { label: "Visão da empresa", href: "/processos", icon: FolderOpen, hint: "Todos os processos do escritório" },
          { label: "Busca e apreensão", href: "/busca-apreensao", icon: Gavel, hint: "Só casos com indício reforçado de B.A." },
          { label: "Importar planilha", href: "/import", icon: Upload, hint: "Entrada em lote da carteira" },
        ],
      },
      {
        title: "Dinheiro (CRM)",
        items: [
          { label: "CRM Assessoria", href: "/crm", icon: Kanban, hint: "Funil, serviços, receber e pagar" },
          { label: "Finanças avulsas", href: "/financas", icon: DollarSign, hint: "Lançamentos pontuais (legado)" },
        ],
      },
      {
        title: "Peças e modelos",
        items: [
          { label: "Modelos & Peças", href: "/modelos", icon: ScrollText, hint: "Biblioteca completa (recomendado)" },
          { label: "Procuração", href: "/documents", icon: FileText, hint: "Gerador dedicado de procuração" },
          { label: "Habilitação", href: "/habilitacao-peca", icon: FileSignature, hint: "Petição de habilitação" },
          { label: "Substabelecimento", href: "/substabelecimento", icon: Files, hint: "Com ou sem reserva" },
        ],
      },
      {
        title: "Consulta e IA",
        items: [
          { label: "Consulta CNJ", href: "/veredito", icon: Scale, hint: "DataJud / DJEN por processo ou CPF" },
          { label: "Cadastro assistido", href: "/ia-sync", icon: ClipboardList, hint: "Extrair dados de contrato/print" },
          { label: "Assistente", href: "/chat", icon: Bot, hint: "Dúvidas e rascunhos com IA" },
          { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle, hint: "Atalhos de mensagem" },
        ],
      },
      {
        title: "Números",
        items: [
          { label: "Indicadores", href: "/analytics", icon: BarChart3, hint: "Gráficos da carteira" },
          { label: "IA Preditiva", href: "/insights", icon: BrainCircuit, hint: "Padrões por tribunal / risco" },
          { label: "Urgências", href: "/urgency", icon: ShieldAlert, hint: "Fila crítica consolidada" },
        ],
      },
    ];

    if (isAdmin) {
      groups.push({
        title: "Gestão",
        items: [
          { label: "Supervisão", href: "/supervisao", icon: ShieldCheck, hint: "Desempenho da equipe" },
          { label: "Equipe", href: "/team", icon: Users, hint: "Cargos e operadores" },
          { label: "Auditoria", href: "/auditoria", icon: ShieldCheck, hint: "Quem fez o quê" },
          ...(isSuperAdmin
            ? [{ label: "Segurança", href: "/security", icon: ShieldAlert, hint: "Varreduras (só Superadmin)" }]
            : []),
        ],
      });
    }

    groups.push({
      title: "Ajuda e ajustes",
      items: [
        { label: "Treinamento", href: "/onboarding", icon: PlayCircle, hint: "Wizard e guia do sistema" },
        { label: "Notas", href: "/notes", icon: StickyNote, hint: "Anotações por cliente" },
        { label: "Configurações", href: "/settings", icon: Settings, hint: "Tema, IA, banca" },
      ],
    });

    const q = navQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.label.toLowerCase().includes(q) ||
            (it.hint || "").toLowerCase().includes(q) ||
            it.href.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [isAdmin, isSuperAdmin, navQuery]);


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
        {!collapsed && (
          <div className="px-1 mb-1">
            <input
              type="search"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Buscar no menu…"
              className="w-full h-9 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 text-[11px] font-medium text-sidebar-foreground placeholder:text-sidebar-foreground/45 outline-none focus:ring-1 focus:ring-primary"
              aria-label="Buscar no menu"
            />
            <p className="text-[9px] text-sidebar-foreground/50 mt-1.5 px-0.5 leading-snug">
              Dica: comece por <span className="font-bold text-sidebar-foreground/70">Hoje</span>, depois carteira e CRM.
            </p>
          </div>
        )}

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
              <p className="px-3 mb-2 text-[10px] font-bold text-primary tracking-wide">
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon; // lucide
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  title={item.hint ? `${item.label} — ${item.hint}` : item.label}
                  className={cn(
                    "metal-nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                    active
                      ? "bg-primary/10 text-primary font-semibold shadow-[inset_3px_0_0_0_hsl(var(--primary))] metal-nav-item--active"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium"
                  )}
                >
                  <SafeIcon
                    icon={Icon}
                    className={cn(
                      "w-4 h-4 shrink-0 mt-0.5",
                      active ? "opacity-100" : "opacity-55 group-hover:opacity-90"
                    )}
                  />
                  {!collapsed && (
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold tracking-tight text-left leading-tight">
                        {item.label}
                      </span>
                      {item.hint ? (
                        <span className="text-[9px] font-medium text-sidebar-foreground/50 leading-snug line-clamp-2">
                          {item.hint}
                        </span>
                      ) : null}
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
    isSuperAdmin,
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
      {/* Desktop: trilho fixo */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 h-screen sticky top-0 z-40",
          "border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          "transition-[width] duration-200 ease-out",
          collapsed ? "w-[4.25rem]" : "w-[16.5rem]"
        )}
      >
        <SidebarNavBody {...bodyProps} showCollapseBtn />
      </aside>

      {/* Mobile: botão + sheet */}
      <div className="md:hidden fixed top-3 left-3 z-[100]">
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
