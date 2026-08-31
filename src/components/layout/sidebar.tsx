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
import { getRouteSnapshot, type RouteSnapshot } from "@/lib/route-snapshot-cache";
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

const DOCK_H = 72;
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
      { label: "Prêmios", href: "/premios", icon: Crown },
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
  userId,
}: {
  item: NavItem;
  active: boolean;
  userId?: string | null;
}) {
  const [preview, setPreview] = useState<RouteSnapshot | null>(null);
  const [showPrev, setShowPrev] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const hideItem = () => {
    const prefs = loadNavPreferences(userId);
    const href = String(item.href);
    if (!prefs.hidden.includes(href)) {
      saveNavPreferences({ hidden: [...prefs.hidden, href] }, userId);
      window.dispatchEvent(new Event("lexis-nav-prefs"));
    }
    setMenu(null);
  };

  const move = (dir: -1 | 1) => {
    const prefs = loadNavPreferences(userId);
    const href = String(item.href);
    let order = prefs.order.length ? [...prefs.order] : [];
    if (!order.includes(href)) order.push(href);
    const i = order.indexOf(href);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) {
      setMenu(null);
      return;
    }
    [order[i], order[j]] = [order[j], order[i]];
    saveNavPreferences({ order }, userId);
    window.dispatchEvent(new Event("lexis-nav-prefs"));
    setMenu(null);
  };

  return (
    <>
      <Link
        href={item.href}
        title={`${item.label} — passe o mouse para preview; botão direito para opções`}
        onMouseEnter={() => {
          setPreview(getRouteSnapshot(item.href));
          setShowPrev(true);
        }}
        onMouseLeave={() => setShowPrev(false)}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        onTouchStart={(e) => {
          movedRef.current = false;
          const t = e.touches[0];
          longPressRef.current = setTimeout(() => {
            if (!movedRef.current && t) setMenu({ x: t.clientX, y: t.clientY });
          }, 480);
        }}
        onTouchMove={() => {
          movedRef.current = true;
          if (longPressRef.current) clearTimeout(longPressRef.current);
        }}
        onTouchEnd={() => {
          if (longPressRef.current) clearTimeout(longPressRef.current);
        }}
        className={cn(
          "group relative flex flex-col items-center justify-center gap-0.5 select-none",
          "h-[64px] min-w-[64px] max-w-[88px] px-1 rounded-xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "hover:-translate-y-2.5 focus-visible:-translate-y-2.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
            "transition-all duration-300",
            "group-hover:scale-110 group-hover:shadow-md group-hover:shadow-primary/30",
            active
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/35"
              : "bg-white/15 text-foreground group-hover:bg-white/25 dark:bg-white/10"
          )}
        >
          <SafeIcon icon={item.icon} size={18} />
        </span>
        <span
          className={cn(
            "text-[9px] leading-tight font-bold text-center line-clamp-2 px-0.5 max-w-[80px]",
            active ? "text-primary" : "text-foreground/85"
          )}
        >
          {item.label}
        </span>
        <span
          className={cn(
            "absolute bottom-0.5 h-[3px] rounded-full transition-all duration-300",
            active ? "w-5 bg-primary" : "w-0 group-hover:w-2.5 group-hover:bg-foreground/35"
          )}
        />
      </Link>

      {showPrev && !menu && (
        <div
          className={cn(
            "pointer-events-none fixed bottom-[5.6rem] left-1/2 -translate-x-1/2 z-[70]",
            "w-[min(300px,92vw)] rounded-2xl border border-white/20",
            "bg-background/92 backdrop-blur-xl shadow-2xl overflow-hidden",
            "animate-in fade-in slide-in-from-bottom-2 duration-200"
          )}
        >
          {preview?.thumbDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.thumbDataUrl} alt="" className="w-full h-[110px] object-cover" />
          ) : (
            <div className="h-16 bg-gradient-to-br from-primary/25 via-violet-500/20 to-amber-400/20 flex items-center justify-center px-3 text-center text-[10px] font-bold text-muted-foreground">
              Abra a aba uma vez — o preview fica em cache
            </div>
          )}
          <div className="p-2.5 space-y-0.5">
            <p className="text-[11px] font-black truncate">{preview?.title || item.label}</p>
            <p className="text-[10px] text-muted-foreground line-clamp-3">
              {preview?.excerpt || "Sem snapshot ainda. Visitando a página o app grava automaticamente."}
            </p>
          </div>
        </div>
      )}

      {menu && (
        <div
          role="menu"
          className="fixed z-[80] min-w-[180px] rounded-xl border border-white/20 bg-background/95 backdrop-blur-xl shadow-2xl py-1.5 text-[12px] font-semibold"
          style={{ left: Math.min(menu.x, window.innerWidth - 200), top: Math.max(8, menu.y - 120) }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
          <button type="button" className="w-full text-left px-3 py-2 hover:bg-muted/80" onClick={() => move(-1)}>
            ← Mover esquerda
          </button>
          <button type="button" className="w-full text-left px-3 py-2 hover:bg-muted/80" onClick={() => move(1)}>
            Mover direita →
          </button>
          <button type="button" className="w-full text-left px-3 py-2 hover:bg-destructive/15 text-destructive" onClick={hideItem}>
            Ocultar esta aba
          </button>
        </div>
      )}
    </>
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
      {/* logo oficial do app */}
      <Link
        href="/"
        className="flex items-center gap-2 px-2.5 shrink-0 border-r border-white/10 mr-1.5 hover:opacity-90 transition-opacity"
        title="LexisPredict"
      >
        <img
          src="/logo.png"
          alt="LexisPredict"
          width={36}
          height={36}
          className="h-9 w-9 rounded-xl object-contain shadow-md shadow-primary/20 bg-white/90 dark:bg-white/10 p-0.5"
        />
        <span className="hidden md:flex flex-col min-w-0">
          <span className="text-[12px] font-black tracking-tight leading-none truncate text-foreground">
            LexisPredict
          </span>
          <span className="text-[8px] font-semibold text-muted-foreground leading-none mt-0.5 truncate max-w-[100px]">
            Gabinete
          </span>
        </span>
      </Link>

      {/* scanner DataJud + DJEN — destaque arco-íris */}
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
        title={!canScanEffective ? "Scanner indisponível" : status === "running" ? "Scanner ativo" : "DataJud + DJEN"}
        className={cn(
          "group relative flex flex-col items-center justify-center gap-0.5",
          "h-[64px] min-w-[78px] max-w-[96px] px-1.5 mx-0.5 rounded-xl",
          "transition-transform duration-300 hover:-translate-y-2.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
        )}
      >
        <span
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
            "transition-all duration-300 group-hover:scale-110",
            "bg-gradient-to-br from-rose-500 via-amber-400 to-violet-600",
            "shadow-lg shadow-fuchsia-500/40",
            "ring-2 ring-white/30",
            status === "running" && "animate-pulse ring-amber-300"
          )}
        >
          <span className="absolute inset-[2px] rounded-[10px] bg-background/25 backdrop-blur-[2px]" />
          <SafeIcon icon={Zap} size={18} className="relative z-[1] text-white drop-shadow" />
        </span>
        <span className="text-[9px] leading-tight font-black text-center bg-gradient-to-r from-rose-500 via-amber-500 to-violet-600 bg-clip-text text-transparent">
          DataJud+DJEN
        </span>
      </button>

      {/* nav scroll */}
      <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden scrollbar-none flex items-end gap-0.5 py-1">
        {navItems.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <DockItem
              key={item.href + item.label}
              item={item}
              active={active}
              userId={(profile as any)?.auth_user_id || (profile as any)?.id || null}
            />
          );
        })}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className={cn(
            "h-[64px] min-w-[72px] max-w-[92px] px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl",
            "transition-all duration-300 hover:-translate-y-2",
            showMore ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-white/10"
          )}
          title={showMore ? "Recolher ferramentas" : "Mais ferramentas"}
        >
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black",
              "bg-gradient-to-br from-sky-500/30 to-violet-500/30 border border-white/20"
            )}
          >
            {showMore ? "−" : "+"}
          </span>
          <span className="text-[9px] font-black leading-tight text-center text-foreground/90 line-clamp-2 max-w-[84px]">
            {showMore ? "Recolher" : "Mais ferramentas"}
          </span>
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
          "h-[72px] items-center",
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
        <div className="hidden md:block fixed bottom-[5.5rem] left-1/2 -translate-x-1/2 z-[56] w-[min(360px,90vw)]">
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
