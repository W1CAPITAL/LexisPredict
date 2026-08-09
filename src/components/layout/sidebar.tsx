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
  ScrollText,
  FileText,
  FileSignature,
  Files,
  Scale,
  ClipboardList,
  Bot,
  MessageCircle,
  BarChart3,
  BrainCircuit,
  ShieldAlert,
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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { ThemeToggle } from "@/components/ui/theme-toggle";

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
  onToggleMinimize: () => void;
  onStartTour: () => void;
  onLogout: () => void;
  onToggleCollapsed: () => void;
  showCollapseBtn: boolean;
}) {
  const t = getTranslation(locale);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const [navQuery, setNavQuery] = useState("");

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

  const navGroups: NavGroup[] = useMemo(() => {
    const groups: NavGroup[] = [
      {
        title: "Hoje",
        items: [
          {
            label: "Painel",
            href: "/",
            icon: LayoutDashboard,
            hint: "Vencidos e o que exige ação",
          },
          {
            label: "Fila de contato",
            href: "/tarefas",
            icon: ListTodo,
            hint: "Quem ligar ou responder",
          },
          {
            label: "Agenda",
            href: "/agenda",
            icon: CalendarDays,
            hint: "Prazos da semana",
          },
        ],
      },
      {
        title: "Carteira",
        items: [
          {
            label: "Meus processos",
            href: "/cases",
            icon: Briefcase,
            hint: "Carteira + scanner",
          },
          {
            label: "Visão da empresa",
            href: "/processos",
            icon: FolderOpen,
            hint: "Todos os processos",
          },
          {
            label: "Busca e apreensão",
            href: "/busca-apreensao",
            icon: Gavel,
            hint: "Indícios reforçados de B.A.",
          },
          {
            label: "Importar",
            href: "/import",
            icon: Upload,
            hint: "Planilha em lote",
          },
        ],
      },
      {
        title: "Dinheiro",
        items: [
          {
            label: "CRM Assessoria",
            href: "/crm",
            icon: Kanban,
            hint: "Funil, serviços e caixa",
          },
          {
            label: "Finanças",
            href: "/financas",
            icon: Wallet,
            hint: "Lançamentos avulsos",
          },
        ],
      },
      {
        title: "Peças",
        items: [
          {
            label: "Modelos & Peças",
            href: "/modelos",
            icon: ScrollText,
            hint: "Biblioteca completa",
          },
          {
            label: "Procuração",
            href: "/documents",
            icon: FileText,
            hint: "Gerador de procuração",
          },
          {
            label: "Habilitação",
            href: "/habilitacao-peca",
            icon: FileSignature,
            hint: "Petição de habilitação",
          },
          {
            label: "Substabelecimento",
            href: "/substabelecimento",
            icon: Files,
            hint: "Com ou sem reserva",
          },
        ],
      },
      {
        title: "Consulta",
        items: [
          {
            label: "Consulta CNJ",
            href: "/veredito",
            icon: Scale,
            hint: "DataJud e DJEN",
          },
          {
            label: "Cadastro assistido",
            href: "/ia-sync",
            icon: ClipboardList,
            hint: "Extrair dados de contrato",
          },
          {
            label: "Assistente IA",
            href: "/chat",
            icon: Bot,
            hint: "Dúvidas e rascunhos",
          },
          {
            label: "WhatsApp",
            href: "/whatsapp",
            icon: MessageCircle,
            hint: "Atalhos de mensagem",
          },
        ],
      },
      {
        title: "Números",
        items: [
          {
            label: "Indicadores",
            href: "/analytics",
            icon: BarChart3,
            hint: "Gráficos da carteira",
          },
          {
            label: "IA Preditiva",
            href: "/insights",
            icon: BrainCircuit,
            hint: "Risco e tribunais",
          },
          {
            label: "Urgências",
            href: "/urgency",
            icon: ShieldAlert,
            hint: "Fila crítica",
          },
        ],
      },
    ];

    if (isAdmin) {
      groups.push({
        title: "Gestão",
        items: [
          {
            label: "Supervisão",
            href: "/supervisao",
            icon: ShieldCheck,
            hint: "Desempenho da equipe",
          },
          {
            label: "Equipe",
            href: "/team",
            icon: Users,
            hint: "Cargos e operadores",
          },
          {
            label: "Auditoria",
            href: "/auditoria",
            icon: ShieldCheck,
            hint: "Quem fez o quê",
          },
          ...(isSuperAdmin
            ? [
                {
                  label: "Segurança",
                  href: "/security",
                  icon: ShieldAlert,
                  hint: "Somente Superadmin",
                } as NavItem,
              ]
            : []),
        ],
      });
    }

    groups.push({
      title: "Ajuda",
      items: [
        {
          label: "Treinamento",
          href: "/onboarding",
          icon: PlayCircle,
          hint: "Wizard e guia",
        },
        {
          label: "Notas",
          href: "/notes",
          icon: StickyNote,
          hint: "Anotações por cliente",
        },
        {
          label: "Configurações",
          href: "/settings",
          icon: Settings,
          hint: "Tema, IA e banca",
        },
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
      {/* Brand */}
      <div className="h-[4.25rem] shrink-0 flex items-center px-3 border-b border-sidebar-border/80">
        <div className="flex items-center gap-2.5 min-w-0 w-full">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <SafeIcon icon={Layers} size={18} />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[13px] tracking-tight text-sidebar-foreground leading-none truncate">
                LexisPredict
              </span>
              <span className="text-[10px] text-primary font-semibold mt-1">
                Gabinete operacional
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
              {status === "running" ? "Scanner ativo" : "Scanner tribunal"}
            </span>
          )}
        </LiquidMetalButton>
      </div>

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
                className="w-full h-9 rounded-lg border border-sidebar-border bg-sidebar-accent/40 pl-8 pr-3 text-[11px] font-medium text-sidebar-foreground placeholder:text-sidebar-foreground/45 outline-none focus:ring-1 focus:ring-primary"
                aria-label="Buscar no menu"
              />
            </div>
            <p className="text-[9px] text-sidebar-foreground/50 mt-1.5 px-0.5 leading-snug">
              Comece por <span className="font-bold text-sidebar-foreground/75">Hoje</span>, depois
              Carteira e Dinheiro.
            </p>
          </div>
        )}

        {navGroups.map((group) => (
          <div key={group.title} className="space-y-0.5">
            {!collapsed && (
              <p className="px-2.5 mb-1.5 text-[10px] font-bold text-primary tracking-wide">
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  title={item.hint ? `${item.label} — ${item.hint}` : item.label}
                  className={cn(
                    "group flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-sidebar-border/80 bg-sidebar-accent/30 text-sidebar-foreground/70 group-hover:text-sidebar-foreground"
                    )}
                  >
                    <SafeIcon icon={item.icon} size={16} />
                  </span>
                  {!collapsed && (
                    <span className="min-w-0 flex-1 flex flex-col gap-0.5 pt-0.5">
                      <span className="text-[12px] font-semibold leading-tight tracking-tight">
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

        {!collapsed && navGroups.length === 0 && (
          <p className="px-3 text-xs text-sidebar-foreground/50">Nenhum item para “{navQuery}”.</p>
        )}

        <div className="px-1 pt-1">
          <button
            type="button"
            onClick={onStartTour}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-sidebar-foreground/65 hover:bg-primary/10 hover:text-primary transition-colors"
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
      <div className="p-3 border-t border-sidebar-border space-y-3 shrink-0 overflow-hidden">
        {!collapsed && <InstallAppButton />}
        {!collapsed && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-sidebar-accent/50 border border-sidebar-border min-w-0">
            <Avatar className="w-9 h-9 border border-primary/20 shrink-0">
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
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onLogout}
              title={t.logout}
              className="h-9 w-9 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg flex items-center justify-center"
            >
              <SafeIcon icon={LogOut} size={16} />
            </button>
            <ThemeToggle />
          </div>
          {showCollapseBtn && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="hidden md:flex h-9 w-9 text-sidebar-foreground/60 hover:text-primary rounded-lg items-center justify-center"
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              <SafeIcon icon={collapsed ? ChevronRight : ChevronLeft} size={18} />
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
  const { setDarkMode, isDarkMode, setTutorialActive } = useAppStore();
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
    onToggleCollapsed: () => setCollapsed((c) => !c),
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
