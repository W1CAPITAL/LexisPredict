"use client";

/**
 * Sidebar vertical: animações hover (fundo + sobe), redimensionar largura,
 * arrastar itens (ex.: Agentes), busca, pin, mais ferramentas.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, ListTodo, CalendarDays, Briefcase, FolderOpen, Gavel, Upload,
  Kanban, Wallet, FileText, Scale, ClipboardList, Bot, Monitor, MessageCircle,
  MessagesSquare, BarChart3, BrainCircuit, ShieldAlert, PauseCircle, ShieldCheck,
  Users, Settings, StickyNote, PlayCircle, LogOut, Menu, X, Zap, Crown,
  Calculator, Search, Pin, PinOff, GripVertical, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  flattenNavItems, loadNavPreferences, saveNavPreferences, type NavPreferences,
} from "@/lib/nav-preferences";
import { filterNavByPlan, planTemScanner } from "@/lib/planos-pacotes";
import { useAuth } from "@/components/auth/auth-provider";
import { useAdmin } from "@/hooks/use-admin";
import { usePlano } from "@/hooks/use-plano";
import { useDataJudScanStore } from "@/store/use-datajud-scan-store";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type NavItem = { label: string; href: string; icon: LucideIcon };

const LS_PINNED = "lexis_sidebar_vertical_pinned";
const LS_WIDTH = "lexis_sidebar_vertical_width";
const MIN_W = 72;
const MAX_W = 360;
const DEFAULT_W = 260;

function buildNavItems(opts: {
  isAdmin: boolean; isSuperAdmin: boolean; plan: string;
  showMore: boolean; query: string; navPrefs: NavPreferences;
}): NavItem[] {
  const { isAdmin, isSuperAdmin, plan, showMore, query, navPrefs } = opts;
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
    { label: "Agentes", href: "/crm/agentes", icon: Bot },
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
    { label: "Config", href: "/settings", icon: Settings },
  );
  let items = flattenNavItems(primary, secondary, rest, navPrefs, showMore);
  items = filterNavByPlan(items as any, isSuperAdmin ? "maximo" : (plan as any));
  const q = query.trim().toLowerCase();
  if (q) {
    items = items.filter(
      (it) => it.label.toLowerCase().includes(q) || it.href.toLowerCase().includes(q)
    );
  }
  return items as NavItem[];
}

export function SidebarVertical() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { canScan, isAdmin, isSuperAdmin } = useAdmin();
  const { plan } = usePlano();
  const { status, toggleMinimize } = useDataJudScanStore();

  const [open, setOpen] = useState(true);
  const [pinned, setPinned] = useState(true);
  const [width, setWidth] = useState(DEFAULT_W);
  const [mobile, setMobile] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [navPrefs, setNavPrefs] = useState<NavPreferences>(() => loadNavPreferences());
  const [dragHref, setDragHref] = useState<string | null>(null);
  const resizing = useRef(false);
  const uid = (profile as any)?.auth_user_id || (profile as any)?.id || null;

  useEffect(() => {
    try {
      if (localStorage.getItem(LS_PINNED) === "0") {
        setPinned(false);
        setOpen(false);
      }
      const w = Number(localStorage.getItem(LS_WIDTH) || DEFAULT_W);
      if (w >= MIN_W && w <= MAX_W) setWidth(w);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    setNavPrefs(loadNavPreferences(uid));
    const on = () => setNavPrefs(loadNavPreferences(uid));
    window.addEventListener("lexis-nav-prefs", on);
    return () => window.removeEventListener("lexis-nav-prefs", on);
  }, [uid]);

  useEffect(() => { setMobile(false); }, [pathname]);

  const canScanEffective = canScan && planTemScanner(plan as any);

  const navItems = useMemo(
    () =>
      buildNavItems({
        isAdmin, isSuperAdmin,
        plan: isSuperAdmin ? "maximo" : String(plan || "essencial"),
        showMore, query, navPrefs,
      }),
    [isAdmin, isSuperAdmin, plan, showMore, query, navPrefs]
  );

  const togglePin = () => {
    setPinned((p) => {
      const next = !p;
      try { localStorage.setItem(LS_PINNED, next ? "1" : "0"); } catch { /* */ }
      setOpen(next);
      return next;
    });
  };

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const next = Math.min(MAX_W, Math.max(MIN_W, startW + (ev.clientX - startX)));
      setWidth(next);
      setOpen(next > 100);
    };
    const onUp = () => {
      resizing.current = false;
      try { localStorage.setItem(LS_WIDTH, String(width)); } catch { /* */ }
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    // persist latest on up via ref trick
    const onUp2 = () => {
      resizing.current = false;
      setWidth((w) => {
        try { localStorage.setItem(LS_WIDTH, String(w)); } catch { /* */ }
        return w;
      });
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp2);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp2);
  }, [width]);

  const onDragStart = (href: string) => (e: React.DragEvent) => {
    setDragHref(href);
    e.dataTransfer.setData("text/plain", href);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (targetHref: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = e.dataTransfer.getData("text/plain") || dragHref;
    setDragHref(null);
    if (!from || from === targetHref) return;
    const prefs = loadNavPreferences(uid);
    const order = [...(prefs.order || [])];
    // build current visual order of hrefs
    const hrefs = navItems.map((i) => i.href);
    const all = order.length ? order : hrefs;
    const list = all.filter((h) => hrefs.includes(h));
    for (const h of hrefs) if (!list.includes(h)) list.push(h);
    const fi = list.indexOf(from);
    const ti = list.indexOf(targetHref);
    if (fi < 0 || ti < 0) return;
    list.splice(fi, 1);
    list.splice(ti, 0, from);
    saveNavPreferences({ order: list }, uid);
    window.dispatchEvent(new Event("lexis-nav-prefs"));
  };

  const nome = String(profile?.nome || "Operador").trim();
  const expanded = open || width > 120;

  const body = (
    <div className="flex flex-col h-full min-h-0 bg-card/70 backdrop-blur-xl border-r border-border/50 relative">
      <div className="flex items-center gap-2 p-3 border-b border-border/40 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Lexis" className="h-9 w-9 rounded-xl object-contain bg-white/90 p-0.5 shrink-0" />
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="min-w-0 flex-1"
            >
              <p className="text-[13px] font-black truncate">LexisPredict</p>
              <p className="text-[10px] text-muted-foreground truncate">Gabinete</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={cn("flex items-center gap-1 px-2 pt-2 shrink-0", !expanded && "flex-col")}>
        <motion.button
          type="button"
          whileHover={{ y: -2, scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Buscar no menu"
          onClick={() => { setSearchOpen((v) => !v); if (!open) setOpen(true); }}
          className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-primary/15 border border-transparent hover:border-primary/20 transition-colors"
        >
          <Search size={16} />
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          title={pinned ? "Fixo — clique para auto-recolher" : "Recolhido — clique para fixar"}
          onClick={togglePin}
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center border transition-colors",
            pinned ? "bg-primary/15 text-primary border-primary/30" : "hover:bg-muted/70 border-transparent"
          )}
        >
          {pinned ? <Pin size={15} /> : <PinOff size={15} />}
        </motion.button>
        {expanded && (
          <button
            type="button"
            title="Restaurar abas ocultas"
            className="h-9 px-2 rounded-xl text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60"
            onClick={() => {
              saveNavPreferences({ hidden: [] }, uid);
              window.dispatchEvent(new Event("lexis-nav-prefs"));
            }}
          >
            ↺
          </button>
        )}
      </div>

      {searchOpen && expanded && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-2 pt-2 shrink-0 overflow-hidden">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no menu…"
            className="w-full h-9 rounded-xl border border-border/60 bg-background/80 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            onKeyDown={(e) => {
              if (e.key === "Escape") { setSearchOpen(false); setQuery(""); }
            }}
          />
        </motion.div>
      )}

      <motion.button
        type="button"
        whileHover={{ y: -2, scale: 1.01 }}
        onClick={() => {
          try { window.dispatchEvent(new Event("lexis-need-scanner")); } catch { /* */ }
          if (canScanEffective) toggleMinimize();
        }}
        className={cn(
          "mx-2 mt-2 flex items-center gap-2 rounded-xl px-2.5 py-2 text-left shrink-0",
          "bg-gradient-to-r from-rose-500/25 via-amber-400/20 to-violet-500/25 border border-white/10",
          "hover:shadow-md transition-shadow"
        )}
        title="DataJud + DJEN"
      >
        <Zap className={cn("h-4 w-4 text-amber-500 shrink-0", status === "running" && "animate-pulse")} />
        {expanded && <span className="text-[11px] font-black truncate">DataJud + DJEN</span>}
      </motion.button>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 mt-1 min-h-0">
        {navItems.map((it) => {
          const active =
            pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
          const Icon = it.icon;
          const isAgentes = /agente/i.test(it.label) || it.href.includes("/crm/agentes");
          return (
            <motion.div
              key={it.href + it.label}
              layout
              draggable
              onDragStart={onDragStart(it.href)}
              onDragOver={onDragOver}
              onDrop={onDrop(it.href)}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className={cn(dragHref === it.href && "opacity-50")}
            >
              <Link
                href={it.href}
                title={it.label + (isAgentes ? " — arraste para reordenar" : " — arraste · botão direito oculta")}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const prefs = loadNavPreferences(uid);
                  if (!prefs.hidden.includes(it.href)) {
                    saveNavPreferences({ hidden: [...prefs.hidden, it.href] }, uid);
                    window.dispatchEvent(new Event("lexis-nav-prefs"));
                  }
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-all duration-200 group",
                  "hover:bg-primary/12 hover:shadow-sm border border-transparent hover:border-primary/20",
                  active
                    ? "bg-primary/15 text-primary font-semibold border-primary/25"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                  <GripVertical size={12} />
                </span>
                <motion.span
                  className="shrink-0 flex items-center justify-center"
                  whileHover={{ y: -3, scale: 1.12 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </motion.span>
                {expanded && <span className="truncate flex-1">{it.label}</span>}
              </Link>
            </motion.div>
          );
        })}

        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          onClick={() => { setShowMore((v) => !v); if (!open) setOpen(true); }}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-bold transition-colors border border-transparent",
            "hover:bg-primary/12 hover:border-primary/20",
            showMore ? "bg-primary/10 text-primary" : "text-muted-foreground"
          )}
        >
          <span className="h-4 w-4 flex items-center justify-center text-sm">{showMore ? "−" : "+"}</span>
          {expanded && <span>{showMore ? "Recolher ferramentas" : "Mais ferramentas"}</span>}
        </motion.button>
      </nav>

      <div className="p-3 border-t border-border/40 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 shrink-0">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
            <AvatarFallback className="text-[10px] font-bold">
              {nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {expanded && (
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold truncate" title={nome}>{nome}</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile?.cargo || "Operador"}</p>
            </div>
          )}
          <ThemeToggle />
        </div>
        <button
          type="button"
          className="flex items-center gap-2 w-full rounded-xl px-2 py-2 text-[12px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={async () => { await signOut(); router.push("/login"); }}
        >
          <LogOut className="h-4 w-4" />
          {expanded && "Sair"}
        </button>
      </div>

      {/* alça de redimensionar */}
      <div
        onMouseDown={onResizeStart}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 hover:bg-primary/40 active:bg-primary/60 transition-colors"
        title="Arraste para ajustar a largura"
      />
    </div>
  );

  return (
    <>
      <motion.aside
        className="hidden md:flex flex-col shrink-0 h-screen sticky top-0 z-40 overflow-visible"
        animate={{ width: open || pinned ? width : MIN_W }}
        transition={{ duration: 0.22, ease: "easeInOut" }}
        onMouseEnter={() => { if (!pinned) setOpen(true); }}
        onMouseLeave={() => { if (!pinned) setOpen(false); }}
      >
        <div className="h-full relative" style={{ width: open || pinned ? width : MIN_W }}>
          {body}
        </div>
      </motion.aside>

      <div className="md:hidden fixed top-3 left-3 z-[100]">
        <button
          type="button"
          className="h-11 w-11 rounded-xl border bg-background/90 backdrop-blur shadow flex items-center justify-center"
          onClick={() => setMobile(true)}
        >
          <Menu size={20} />
        </button>
      </div>
      {mobile && (
        <div className="md:hidden fixed inset-0 z-[110] bg-background/80 backdrop-blur-sm">
          <div className="absolute left-0 top-0 bottom-0 w-[min(320px,92vw)] bg-card shadow-2xl flex flex-col">
            <button type="button" className="absolute right-3 top-3 z-20" onClick={() => setMobile(false)}>
              <X />
            </button>
            <div className="h-full pt-1 overflow-hidden">{body}</div>
          </div>
        </div>
      )}
    </>
  );
}
