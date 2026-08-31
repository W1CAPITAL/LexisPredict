"use client";

/**
 * Dock horizontal LexisPredict — barra inferior estilo Windows.
 * - Fixo por padrão (pinned)
 * - Botão pin: auto-ocultar (sobe ao passar o mouse na borda inferior)
 * - Fundo semitransparente + blur
 * - Hover: ícone sobe + nome da página
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Monitor,
  MessageCircle,
  MessagesSquare,
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
  Layers,
  Search,
  Zap,
  Calculator,
  Crown,
  Pin,
  PinOff,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { flattenNavItems, loadNavPreferences, type NavPreferences } from "@/lib/nav-preferences";
import { PRODUCT } from "@/lib/product-identity";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { useAdmin } from "@/hooks/use-admin";
import { usePlano } from "@/hooks/use-plano";
import { planTemScanner, filterNavByPlan } from "@/lib/planos-pacotes";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getTranslation, type Locale } from "@/lib/i18n";
import { useAppStore } from "@/store/use-app-store";
import { useDataJudScanStore } from "@/store/use-datajud-scan-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  return <Icon className={className} strokeWidth={1.75} size={size} aria-hidden />;
}

type NavItem = {
  label: string;
  href: string;
  hint?: string;
  icon: LucideIcon;
};

const DOCK_H = 58;
const LS_PIN = "lexis_dock_pinned"; // "1" = fixo (padrão), "0" = auto-ocultar

function useNavItems(opts: {
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  plan: import("@/lib/planos-pacotes").PlanId;
  profile: any;
  showMore: boolean;
  query: string;
}) {
  const { isAdmin, isSuperAdmin, plan, profile, showMore, query } = opts;
  const [navPrefs, setNavPrefs] = useState<NavPreferences>(() => loadNavPreferences());

  useEffect(() => {
    const uid = profile?.auth_user_id || profile?.id || null;
    setNavPrefs(loadNavPreferences(uid));
    const onPrefs = () => setNavPrefs(loadNavPreferences(uid));
    window.addEventListener("lexis-nav-prefs", onPrefs);
    return () => window.removeEventListener("lexis-nav-prefs", onPrefs);
  }, [profile]);

  return useMemo(() => {
    const primary: NavItem[] = [
      { label: "Painel", href: "/", icon: LayoutDashboard },
      { label: "Chat equipe", href: "/mensagens", icon: MessagesSquare },
      { label: "Encerrados", href: "/encerrados-revisao", icon: ShieldAlert },
      { label: "Fila", href: "/tarefas", icon: ListTodo },
      { label: "Parados", href: "/processos-parados", icon: PauseCircle },
      { label: "Meus processos", href: "/cases", icon: Briefcase },
      { label: "Empresa", href: "/processos", icon: FolderOpen },
      { label: "Importar", href: "/import", icon: Upload },
      { label: "Cadastro", href: "/tools/automacao", icon: ClipboardList },
    ];
    const secondary: NavItem[] = [
      { label: "Agenda", href: "/agenda", icon: CalendarDays },
      { label: "Procedentes", href: "/cumprimentos-procedentes", icon: Scale },
      { label: "Busca/apreensão", href: "/busca-apreensao", icon: Gavel },
      { label: "Predatória", href: "/investigacao-predatoria", icon: ShieldAlert },
      { label: "Dossiê", href: "/report", icon: BarChart3 },
      { label: "OCR", href: "/tools/ocr", icon: FileText },
      { label: "CRM", href: "/crm", icon: Kanban },
      { label: "Follow-ups", href: "/crm/followups", icon: ListTodo },
      { label: "Agentes CRM", href: "/crm/agentes", icon: Bot },
      { label: "Offline", href: "/offline", icon: Monitor },
      { label: "Finanças", href: "/financas", icon: Wallet },
      { label: "Cálculos", href: "/calculos", icon: Calculator },
      { label: "Documentos", href: "/documents", icon: FileText },
      { label: "Veredito", href: "/veredito", icon: Scale },
      { label: "Assistente", href: "/chat", icon: Bot },
      { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
      { label: "Indicadores", href: "/analytics", icon: BarChart3 },
      { label: "Insights", href: "/insights", icon: BrainCircuit },
      { label: "Urgências", href: "/urgency", icon: ShieldAlert },
    ];
    const rest: NavItem[] = [];
    if (isAdmin) {
      rest.push(
        { label: "Supervisão", href: "/supervisao", icon: ShieldCheck },
        { label: "Equipe", href: "/team", icon: Users },
        { label: "Auditoria", href: "/auditoria", icon: ShieldCheck }
      );
      if (isSuperAdmin) {
        rest.push({ label: "Segurança", href: "/security", icon: ShieldAlert });
        rest.push({ label: "Superadmin", href: "/superadmin", icon: Crown });
      }
    }
    rest.push(
      { label: "Treinamento", href: "/onboarding", icon: PlayCircle },
      { label: "Notas", href: "/notes", icon: StickyNote },
      { label: "Config", href: "/settings", icon: Settings }
    );

    let items = flattenNavItems(primary, secondary, rest, navPrefs, showMore);
    items = filterNavByPlan(items, isSuperAdmin ? "maximo" : plan);
    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (it) => it.label.toLowerCase().includes(q) || it.href.toLowerCase().includes(q)
      );
    }
    return items;
  }, [isAdmin, isSuperAdmin, plan, navPrefs, showMore, query]);
}

function DockItem({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={item.label}
      className={cn(
        "group relative flex flex-col items-center justify-end",
        "h-12 min-w-[52px] px-1.5 rounded-xl",
        "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-2 focus-visible:-translate-y-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      )}
    >
      {/* tooltip / nome que sobe no hover */}
      <span
        className={cn(
          "pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-10",
          "whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide",
          "bg-foreground/90 text-background shadow-lg",
          "opacity-0 translate-y-2 scale-95",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100",
          "group-focus-visible:opacity-100 group-focus-visible:translate-y-0"
        )}
      >
        {item.label}
      </span>

      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "group-hover:scale-110 group-hover:shadow-md group-hover:shadow-primary/25",
          active
            ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
            : "bg-white/10 text-foreground/90 group-hover:bg-white/20 dark:bg-white/5"
        )}
      >
        <SafeIcon icon={item.icon} size={18} />
      </span>

      {/* indicador ativo estilo Windows */}
      <span
        className={cn(
          "mt-0.5 h-[3px] rounded-full transition-all duration-300",
          active ? "w-4 bg-primary" : "w-0 bg-transparent group-hover:w-2 group-hover:bg-foreground/30"
        )}
      />
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { setTutorialActive } = useAppStore();
  const { status, toggleMinimize } = useDataJudScanStore();
  const { canScan, isAdmin, isSuperAdmin } = useAdmin();
  const { plan } = usePlano();
  const [locale, setLocale] = useState<Locale>("pt");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // pin = fixo (padrão). !pin = auto-ocultar como taskbar Windows
  const [pinned, setPinned] = useState(true);
  const [revealed, setRevealed] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_PIN);
      if (v === "0") {
        setPinned(false);
        setRevealed(false);
      }
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const pad = pinned ? `${DOCK_H + 12}px` : "14px";
    root.style.setProperty("--lexis-dock-pad", pad);
    // padding no body + mains full-screen comuns
    const styleId = "lexis-dock-pad-style";
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = `@media (min-width:768px){body{padding-bottom:var(--lexis-dock-pad)!important;} .lexis-main-pad{padding-bottom:var(--lexis-dock-pad)!important;}}`;
    return () => {
      root.style.removeProperty("--lexis-dock-pad");
    };
  }, [pinned]);


  useEffect(() => {
    try {
      const saved = localStorage.getItem("lexisPredict_locale") as Locale | null;
      if (saved) setLocale(saved);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const canScanEffective = canScan && planTemScanner(plan as any);
  const t = getTranslation(locale);

  const navItems = useNavItems({
    isAdmin,
    isSuperAdmin,
    plan: (isSuperAdmin ? "maximo" : plan) as any,
    profile,
    showMore,
    query,
  });

  const togglePin = useCallback(() => {
    setPinned((p) => {
      const next = !p;
      try {
        localStorage.setItem(LS_PIN, next ? "1" : "0");
      } catch {
        /* */
      }
      if (next) setRevealed(true);
      else setRevealed(false);
      return next;
    });
  }, []);

  const onDockEnter = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setRevealed(true);
  };

  const onDockLeave = () => {
    if (pinned) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setRevealed(false), 480);
  };

  const visible = pinned || revealed;

  const dockInner = (
    <div className="flex items-center gap-0.5 min-w-0 h-full px-1">
      {/* logo */}
      <div className="flex items-center gap-1.5 px-2 shrink-0 border-r border-white/10 mr-1">
        <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/25">
          <SafeIcon icon={Layers} size={16} />
        </div>
        <span className="hidden lg:block text-[11px] font-black tracking-tight max-w-[88px] truncate">
          {PRODUCT.name}
        </span>
      </div>

      {/* scanner */}
      <button
        type="button"
        onClick={() => {
          try {
            window.dispatchEvent(new Event("lexis-need-scanner"));
          } catch {
            /* */
          }
          if (canScanEffective) toggleMinimize();
        }}
        title={!canScanEffective ? "Scanner indisponível" : status === "running" ? "Scanner ativo" : "Scanner tribunal"}
        className={cn(
          "group relative flex flex-col items-center justify-end h-12 min-w-[48px] px-1 rounded-xl",
          "transition-transform duration-300 hover:-translate-y-2"
        )}
      >
        <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-foreground/90 text-background px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          Scanner
        </span>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110",
            status === "running"
              ? "bg-amber-500/90 text-white animate-pulse"
              : "bg-white/10 group-hover:bg-white/20"
          )}
        >
          <SafeIcon icon={Zap} size={17} />
        </span>
        <span className="mt-0.5 h-[3px] w-0 group-hover:w-2 rounded-full bg-foreground/30 transition-all" />
      </button>

      {/* nav scroll */}
      <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden scrollbar-none flex items-end gap-0.5 py-1">
        {navItems.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return <DockItem key={item.href + item.label} item={item} active={active} />;
        })}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="h-12 min-w-[44px] px-1 flex flex-col items-center justify-end text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
          title={showMore ? "Recolher ferramentas" : "Mais ferramentas"}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 transition-all">
            {showMore ? "−" : "+"}
          </span>
          <span className="h-[3px]" />
        </button>
      </div>

      {/* ações direita */}
      <div className="flex items-center gap-0.5 shrink-0 border-l border-white/10 pl-1.5 ml-0.5">
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-white/15 transition-all"
          title="Buscar no menu"
        >
          <SafeIcon icon={Search} size={16} />
        </button>
        <ThemeToggle />
        <button
          type="button"
          onClick={togglePin}
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center transition-all",
            pinned ? "bg-primary/20 text-primary" : "hover:bg-white/15 text-muted-foreground"
          )}
          title={pinned ? "Fixo (como agora). Clique para auto-ocultar" : "Auto-ocultar. Clique para fixar"}
        >
          <SafeIcon icon={pinned ? Pin : PinOff} size={15} />
        </button>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push("/login");
          }}
          className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-destructive/20 hover:text-destructive transition-all"
          title={t.logout}
        >
          <SafeIcon icon={LogOut} size={15} />
        </button>
        <div className="hidden sm:flex items-center gap-1.5 pl-1">
          <Avatar className="h-8 w-8 border border-white/20">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
            <AvatarFallback className="text-[10px] font-bold bg-primary/20">
              {String(profile?.nome || "OP")
                .split(/\s+/)
                .map((p: string) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* não ocupa largura no flex das páginas */}
      <div className="hidden md:block w-0 shrink-0" aria-hidden />

      {/* zona de hover na borda inferior (auto-ocultar) */}
      {!pinned && (
        <div
          className="hidden md:block fixed bottom-0 left-0 right-0 h-3 z-[60]"
          onMouseEnter={onDockEnter}
          aria-hidden
        />
      )}

      {/* DOCK desktop */}
      <nav
        aria-label="Menu principal"
        onMouseEnter={onDockEnter}
        onMouseLeave={onDockLeave}
        className={cn(
          "hidden md:flex fixed left-1/2 -translate-x-1/2 z-[55]",
          "w-[min(1100px,calc(100vw-1.5rem))]",
          "h-[58px] items-center",
          "rounded-2xl border border-white/15",
          "bg-background/55 dark:bg-background/45",
          "backdrop-blur-xl backdrop-saturate-150",
          "shadow-[0_8px_32px_rgba(0,0,0,0.28)]",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          visible
            ? "bottom-3 opacity-100 translate-y-0"
            : "bottom-3 opacity-0 translate-y-[110%] pointer-events-none"
        )}
        style={{ transitionDuration: "400ms" }}
      >
        {dockInner}
      </nav>

      {/* busca flutuante */}
      {searchOpen && (
        <div className="hidden md:block fixed bottom-[4.75rem] left-1/2 -translate-x-1/2 z-[56] w-[min(360px,90vw)]">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no menu…"
            className="w-full h-10 rounded-xl border border-white/20 bg-background/80 backdrop-blur-xl px-3 text-sm shadow-lg outline-none focus:ring-2 focus:ring-primary/40"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchOpen(false);
                setQuery("");
              }
            }}
          />
        </div>
      )}

      {/* seta quando auto-oculto */}
      {!pinned && !visible && (
        <button
          type="button"
          onMouseEnter={onDockEnter}
          onClick={() => setRevealed(true)}
          className="hidden md:flex fixed bottom-1 left-1/2 -translate-x-1/2 z-[54] h-5 w-12 items-center justify-center rounded-full bg-background/40 backdrop-blur-md border border-white/10 text-muted-foreground hover:text-foreground transition-all"
          title="Mostrar menu"
        >
          <ChevronUp size={14} />
        </button>
      )}

      {/* Mobile: botão + sheet */}
      <div className="md:hidden fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              className="h-12 w-12 rounded-2xl shadow-lg border border-white/20 bg-background/70 backdrop-blur-xl"
              aria-label="Abrir menu"
            >
              <SafeIcon icon={Menu} size={22} />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="p-0 rounded-t-2xl max-h-[78vh] overflow-hidden bg-background/90 backdrop-blur-xl"
          >
            <SheetHeader className="px-4 pt-4 pb-2 border-b">
              <SheetTitle>Menu Lexis</SheetTitle>
              <SheetDescription>Navegação do gabinete</SheetDescription>
            </SheetHeader>
            <div className="p-3 overflow-y-auto max-h-[calc(78vh-4rem)] grid grid-cols-3 gap-2">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl p-3 text-center transition-all",
                      active ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <SafeIcon icon={item.icon} size={20} />
                    <span className="text-[10px] font-bold leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>

    </>
  );
}
