"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Bot,
  Briefcase,
  CalendarDays,
  Calculator,
  ChevronRight,
  ArrowUp,
  PanelLeftClose,
  Crown,
  FileText,
  FolderOpen,
  CalendarCheck,
  ClipboardCheck,
  ClockAlert,
  IdCard,
  BrainCircuit,
  Network,
  FolderKanban,
  ScanSearch,
  SearchCheck,
  Scale,
  Workflow,
  Handshake,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Upload,
  Users,
  Zap,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useAdmin } from "@/hooks/use-admin";
import { usePlano } from "@/hooks/use-plano";
import { filterNavByPlan } from "@/lib/planos-pacotes";
import { operatorRouteAllowed, canViewCompanyCaseList } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CommercialTopbar } from "@/components/layout/commercial-topbar";
import { useDataJudScanStore } from "@/store/use-datajud-scan-store";
import {loadExperiencePrefs,type ExperiencePreferences} from '@/lib/experience-prefs';
import {matchesAppRouteSearch} from '@/lib/app-route-search';
import { selectPrimaryNavigationItems } from "@/lib/primary-navigation";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  supervisor?: boolean;
  admin?: boolean;
  company?: boolean;
  superadmin?: boolean;
};

const core: NavItem[] = [
  { label: "Início", href: "/", icon: LayoutDashboard },
  { label: "Meus Processos", href: "/cases", icon: Briefcase },
  { label: "Processos da Empresa", href: "/processos", icon: FolderOpen, company: true },
  { label: "Réplica e Provas", href: "/fases-provas", icon: FileText },
  { label: "Hoje", href: "/tarefas", icon: ListTodo },
  { label: "Vencidos", href: "/vencidos", icon: ShieldAlert },
  { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
  { label: "Dossiês", href: "/dossies", icon: BookOpen },
  { label: "Consulta OAB", href: "/consulta-oab", icon: IdCard },
  { label: "Superagente", href: "/chat", icon: BrainCircuit },
  { label: "Hermes · Escritório 3D", href: "/hermes-3d", icon: Network, admin: true },
  { label: "Projetos", href: "/projetos", icon: FolderKanban, admin: true },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "Audiências", href: "/audiencias", icon: CalendarCheck },
  { label: "Relatórios", href: "/report", icon: BarChart3 },
  { label: "Análises internas", href: "/analises-internas", icon: ScanSearch },
  { label: "Minhas atividades", href: "/minhas-atividades", icon: ListTodo },
  { label: "CRM", href: "/crm", icon: Handshake },
  { label: "Integrações", href: "/integracoes", icon: Zap },
  { label: "Configurações", href: "/settings", icon: Settings },
];

const extras: NavItem[] = [
  { label: "Processos parados", href: "/processos-parados", icon: ClockAlert },
  { label: "Cumprimentos procedentes", href: "/cumprimentos-procedentes", icon: ClipboardCheck },
  { label: "Busca e apreensão", href: "/busca-apreensao", icon: SearchCheck },
  { label: "Gerador de processos", href: "/gerador-processos", icon: Search },
  { label: "Peças e documentos", href: "/documents", icon: FileText },
  { label: "Veredito", href: "/veredito", icon: Scale },
  { label: "Finanças", href: "/financas", icon: Wallet },
  { label: "Cálculos", href: "/calculos", icon: Calculator },
  { label: "Importar carteira", href: "/import", icon: Upload },
  { label: "Equipe", href: "/team", icon: Users, supervisor: true },
  { label: "Supervisão", href: "/supervisao", icon: ShieldCheck, supervisor: true },
  { label: "Auditoria", href: "/auditoria", icon: ShieldCheck, supervisor: true },
  { label: "Estúdio de Agentes", href: "/estudio-agentes", icon: Workflow, supervisor: true },
  { label: "Administração", href: "/superadmin", icon: Crown, superadmin: true },
];

export function SidebarVertical() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { role, isSupervisor, isAdmin, isSuperAdmin, canSeeCompany } = useAdmin();
  const { plan } = usePlano();
  const openScanner = useDataJudScanStore((state) => state.openScanner);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [navBehavior,setNavBehavior]=useState<ExperiencePreferences['sidebarBehavior']>('fixed');
  const [navOpened,setNavOpened]=useState(true);
  // Starts compact on every visit. Expanded state is temporary by design:
  // hover, click or keyboard focus reveals the full desktop navigation.
  const [railCollapsed, setRailCollapsed] = useState(true);
  const sidebarRef = useRef<HTMLElement>(null);

  const expandRail = () => {
    if (navBehavior === "fixed") setRailCollapsed(false);
  };

  useEffect(() => {
    // Capture outside pointer events even when other components stop propagation.
    // Do not intercept clicks or prevent real navigation, editing or dialogs.
    const collapseOnOutsidePointer = (event: PointerEvent) => {
      if (sidebarRef.current?.contains(event.target as Node)) return;
      setRailCollapsed(true);
    };
    const collapseOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRailCollapsed(true);
    };
    document.addEventListener("pointerdown", collapseOnOutsidePointer, true);
    document.addEventListener("keydown", collapseOnEscape);
    return () => {
      document.removeEventListener("pointerdown", collapseOnOutsidePointer, true);
      document.removeEventListener("keydown", collapseOnEscape);
    };
  }, []);
  const [query, setQuery] = useState("");
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const routePrefetchAt = useRef(new Map<string, number>());

  // Prefetch só com intenção real (hover/foco/toque), evitando N consultas de
  // sessão/tenant para todas as rotas apenas porque o menu está visível.
  const prefetchRoute = (href: string) => {
    const now = Date.now();
    const last = routePrefetchAt.current.get(href) || 0;
    if (now - last < 15_000) return;
    routePrefetchAt.current.set(href, now);
    try { router.prefetch(href); } catch { routePrefetchAt.current.delete(href); }
  };

  const allowed = (item: NavItem) => {
    if (item.superadmin && !isSuperAdmin) return false;
    if (item.supervisor && !isSupervisor) return false;
    if (item.admin && !isAdmin) return false;
    if (item.company && !canViewCompanyCaseList(profile as any)) return false;
    if (role === "Operador" && !operatorRouteAllowed(item.href)) return false;
    return true;
  };

  const mainItems = useMemo(
    () =>
      filterNavByPlan(
        core.filter(allowed).map((item) => ({
          label: item.label,
          href: item.href,
          icon: item.icon,
        })),
        isSuperAdmin ? "maximo" : plan,
      ),
    [role, isSupervisor, isSuperAdmin, canSeeCompany, profile, plan],
  );

  const extraItems = useMemo(
    () =>
      filterNavByPlan(
        extras.filter(allowed).map((item) => ({
          label: item.label,
          href: item.href,
          icon: item.icon,
        })),
        isSuperAdmin ? "maximo" : plan,
      ),
    [role, isSupervisor, isSuperAdmin, canSeeCompany, profile, plan],
  );

  const primaryItems = useMemo(
    () => selectPrimaryNavigationItems([...mainItems, ...extraItems]),
    [mainItems, extraItems],
  );

  useEffect(()=>{
    const refresh=()=>{
      const behavior=loadExperiencePrefs().sidebarBehavior;
      setNavBehavior(behavior);
      setNavOpened(behavior==='fixed');
    };
    refresh();
    window.addEventListener('lexis-experience-updated',refresh);
    return()=>window.removeEventListener('lexis-experience-updated',refresh);
  },[]);

  // Tudo continua disponível, mas fora do primeiro nível.
  const mobileExtraItems = extraItems;

  const mobileMenuItems = useMemo(() => {
    const descriptions: Record<string, string> = {
      "/tarefas": "Veja quem precisa de atendimento agora.",
      "/cases": "Encontre cliente, CNJ e histórico.",
      "/whatsapp": "Converse e acompanhe mensagens.",
      "/dossies": "Peça um dossiê por chat com PDF, planilha, processo, mensagens ou contexto.",
      "/agenda": "Veja prazos e compromissos.",
      "/audiencias": "Audiências e sessões em fontes oficiais.",
      "/report": "KPIs atualizados e PDF executivo da equipe.",
      "/hermes-3d": "Escritório 3D com agentes, reuniões e dados operacionais reais.",
      "/projetos": "Projetos conectados à operação e às automações Hermes.",
      "/minhas-atividades": "Registre atividades feitas por você e veja sua produtividade.",
      "/analises-internas": "Auditorias, dossiês e investigações por CNJ.",
      "/fases-provas": "Localize réplicas, provas e documentos.",
      "/settings": "Conta, equipe e preferências.",
      "/integracoes": "WhatsApp, Agenda Google, Asaas e pesquisa por advogado.",
      "/consulta-oab": "Acesse os portais de tribunais e organize as peças com certificado OAB.",
      "/processos": "Visão completa da carteira da empresa.",
      "/crm": "Clientes, negócios e acompanhamento comercial.",
      "/gerador-processos": "Cadastre e organize novos processos.",
      "/chat": "Superagente: investigações, dossiês, atendimento, relatórios e pesquisa por CNJ ou nome.",
      "/financas": "Valores e lançamentos financeiros.",
      "/calculos": "Ferramentas de cálculo jurídico/financeiro.",
      "/import": "Importe uma carteira em lote.",
      "/processos-parados": "Casos sem andamento recente.",
      "/encerrados-revisao": "Casos encerrados para conferir.",
      "/cumprimentos-procedentes": "Cumprimentos que exigem ação.",
      "/busca-apreensao": "Triagem de busca e apreensão.",
      "/documents": "Peças, procurações e documentos.",
      "/veredito": "Consulta pontual de processo.",
      "/team": "Usuários e permissões.",
      "/supervisao": "Visão da operação da equipe.",
      "/auditoria": "Auditoria administrativa.",
      "/superadmin": "Administração do sistema.",
    };

    const preferred = [
      "/tarefas",
      "/hermes-3d",
      "/projetos",
      "/cases",
      "/processos",
      "/minhas-atividades",
      "/analises-internas",
      "/fases-provas",
      "/supervisao",
      "/whatsapp",
      "/dossies",
      "/chat",
      "/agenda",
      "/audiencias",
      "/report",
      "/hermes-3d",
      "/projetos",
      "/settings",
    ];

    const combined = [...mainItems, ...mobileExtraItems];
    const ordered = [
      ...preferred.map((href) => combined.find((item) => item.href === href)),
      ...combined.filter((item) => !preferred.includes(item.href)),
    ].filter(Boolean) as Array<(typeof combined)[number]>;

    const seen = new Set<string>();
    const q = query.trim().toLowerCase();

    return ordered
      .filter((item) => {
        if (seen.has(item.href)) return false;
        seen.add(item.href);
        return true;
      })
      .map((item) => ({ ...item, description: descriptions[item.href] || "Abrir ferramenta." }))
      .filter(
        (item) =>
          !q ||
          matchesAppRouteSearch(q,item.label,item.href,item.description),
      );
  }, [mainItems, mobileExtraItems, query]);

  const menuGroups = useMemo(() => {
    const definitions = [
      {
        id: "dia",
        label: "Trabalho do dia",
        description: "Fila, prazos e casos que pedem ação agora.",
        icon: ListTodo,
        hrefs: [
          "/tarefas",
          "/minhas-atividades",
          "/agenda",
          "/audiencias",
          "/processos-parados",
          "/encerrados-revisao",
          "/cumprimentos-procedentes",
          "/busca-apreensao",
        ],
      },
      {
        id: "casos",
        label: "Casos e documentos",
        description: "Carteira, peças, consultas e análise.",
        icon: Briefcase,
        hrefs: [
          "/cases",
          "/processos",
          "/vencidos",
          "/fases-provas",
          "/analises-internas",
          "/gerador-processos",
          "/documents",
          "/dossies",
          "/veredito",
          "/chat",
          "/calculos",
        ],
      },
      {
        id: "clientes",
        label: "Clientes e negócio",
        description: "WhatsApp, CRM, financeiro e relatórios.",
        icon: MessageCircle,
        hrefs: ["/whatsapp", "/crm", "/integracoes", "/financas", "/report", "/import"],
      },
      {
        id: "hermes",
        label: "Hermes · escritório de IA",
        description: "Robôs, setores, atividades e reuniões verificáveis.",
        icon: Bot,
        hrefs: ["/hermes-3d", "/projetos"],
      },
      {
        id: "gestao",
        label: "Gestão do sistema",
        description: "Equipe, supervisão, auditoria e configurações.",
        icon: ShieldCheck,
        hrefs: ["/team", "/supervisao", "/auditoria", "/settings", "/superadmin"],
      },
    ];

    const assigned = new Set(definitions.flatMap((group) => group.hrefs));
    const groups = definitions
      .map((group) => ({
        ...group,
        items: mobileMenuItems.filter((item) => group.hrefs.includes(item.href)),
      }))
      .filter((group) => group.items.length > 0);

    const others = mobileMenuItems.filter(
      (item) => !assigned.has(item.href) && item.href !== "/",
    );

    if (others.length) {
      groups.push({
        id: "outros",
        label: "Outras ferramentas",
        description: "Recursos menos usados e funções especializadas.",
        icon: MoreHorizontal,
        hrefs: others.map((item) => item.href),
        items: others,
      });
    }

    return groups;
  }, [mobileMenuItems]);

  const navigateMobile = (href: string) => {
    setToolsOpen(false);
    if (pathname === href) {
      setNavigatingTo(null);
      return;
    }
    setNavigatingTo(href);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("lexis-navigation-start", { detail: { href } }));
    }
    // router.push já agenda a navegação; não atrasar um frame artificialmente.
    router.push(href);
  };

  const openToolsMenu = () => {
    setToolsOpen(true);
  };

  useEffect(() => {
    setToolsOpen(false);
    setNavigatingTo(null);
    setQuery("");
  }, [pathname]);

  // Avoid eagerness: route prefetches pass through middleware and Supabase auth.
  // Navigation uses the selected destination on demand.

  useEffect(() => {
    if (!navigatingTo) return;
    const id = window.setTimeout(() => setNavigatingTo(null), 8000);
    return () => window.clearTimeout(id);
  }, [navigatingTo]);

  const active = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
  // A single indicator moves between real destinations, not on every hover.
  const desktopActiveIndex = primaryItems.findIndex((item) => active(item.href));

  const displayName = String(
    (profile as any)?.nome ||
      (profile as any)?.name ||
      (profile as any)?.full_name ||
      (profile as any)?.email ||
      "Operação"
  );
  const firstName = displayName.trim().split(/\s+/)[0] || "Operação";
  // One shared floating indicator moves between the five existing destinations.
  // Scanner (middle) remains a real action, never an active page.
  const mobileActiveIndex = toolsOpen ? 4 : pathname === "/" ? 0
    : pathname === "/cases" || pathname?.startsWith("/cases/") || pathname === "/processos" || pathname?.startsWith("/processos/") ? 1
    : pathname === "/whatsapp" || pathname?.startsWith("/whatsapp/") ? 3 : 4;

  const mobileSection =
    [...mainItems, ...extraItems].find((item) => active(item.href))?.label ||
    "Operação jurídica";

  const handleOpenScanner = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("lexis-need-scanner"));
    }
    openScanner();
    setToolsOpen(false);
  };

  // Keep DOM identity (and navigation scroll) stable while the rail resizes.
  const renderSidebarBody = () => (
    <div data-lexis-sidebar-body className="flex h-full flex-col bg-[linear-gradient(180deg,#250D18_0%,#3B0B1E_55%,#4D1A30_100%)] text-white">
      <div data-lexis-sidebar-brand className="flex h-[74px] shrink-0 items-center border-b border-white/10 px-3">
        <button
          type="button"
          data-lexis-rail-toggle
          onClick={expandRail}
          aria-label={railCollapsed ? "Expandir menu lateral" : "Menu lateral expandido"}
          aria-controls="lexis-desktop-navigation"
          aria-expanded={!railCollapsed}
          title={railCollapsed ? "Expandir menu" : "Clique fora do menu para recolher"}
          className="group flex w-full min-w-0 items-center gap-2 rounded-xl p-1 text-left text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.08]">
            <span className="lexis-brand-symbol block h-8 w-8 rounded-lg" role="img" aria-label="Emblema LexisPredict" />
          </span>
          <span data-lexis-nav-label className="min-w-0 flex-1 overflow-hidden">
            <span className="block truncate text-[15px] font-black tracking-tight">LexisPredict</span>
            <span className="block truncate text-[11px] font-semibold uppercase tracking-[.1em] text-white/55">W1 Capital</span>
          </span>
          <ChevronRight data-lexis-rail-chevron className="h-4 w-4 shrink-0 text-white/55" />
        </button>
      </div>

      <nav id="lexis-desktop-navigation" data-lexis-nav-scroll className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div data-lexis-nav-primary data-lexis-active-visible={desktopActiveIndex >= 0 ? "true" : "false"} style={{ "--lx-active-index": Math.max(0, desktopActiveIndex) } as CSSProperties} className="relative space-y-1.5">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = active(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onMouseEnter={() => prefetchRoute(item.href)}
                onFocus={() => prefetchRoute(item.href)}
                onTouchStart={() => prefetchRoute(item.href)}
                onClick={() => { if (!isActive) setNavigatingTo(item.href); }}
                data-nav-pending={navigatingTo === item.href ? "true" : undefined}
                aria-current={isActive?'page':undefined}
                aria-label={item.label}
                title={railCollapsed ? item.label : undefined}
                data-lexis-nav-item
                className={cn(
                  "group flex h-11 items-center gap-3 rounded-lg px-3.5 text-[14px] font-semibold transition",
                  isActive
                    ? "bg-[#62213A] text-white shadow-[inset_0_0_0_1px_rgba(201,189,197,.38),0_6px_18px_rgba(0,0,0,.12)]"
                    : "text-[#EDE9ED] hover:bg-white/[.07] hover:text-white",
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-[#F5F2F4]" : "text-[#C9BDC5] group-hover:text-white")} />
                <span data-lexis-nav-label className="min-w-0 flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleOpenScanner}
            data-lexis-nav-cta
            title={railCollapsed ? "Atualizar tribunal" : undefined}
            className="group mt-2 flex h-12 w-full items-center gap-3 rounded-xl border border-[#C9BDC5]/35 bg-[linear-gradient(135deg,rgba(138,46,80,.28),rgba(201,189,197,.11))] px-3.5 text-left text-[13px] font-bold text-white shadow-[inset_0_0_0_1px_rgba(201,189,197,.13),0_8px_20px_rgba(0,0,0,.10)] transition hover:border-[#EDE9ED]/60 hover:bg-[linear-gradient(135deg,rgba(138,46,80,.38),rgba(201,189,197,.18))]"
            aria-label="Abrir Scanner DataJud e DJEN"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#997183]/40 bg-[#250D18] text-[#E7DDE3] shadow-[0_0_18px_rgba(138,46,80,.24)]">
              <Zap className="h-4 w-4" />
            </span>
            <span data-lexis-nav-label className="min-w-0 flex-1">
              <span className="block truncate">Atualizar tribunal</span>
              <span className="mt-0.5 block truncate text-[11px] font-semibold uppercase tracking-[.12em] text-[#D2C3CA]">
                DataJud + DJEN
              </span>
            </span>
            <ChevronRight data-lexis-nav-label className="h-4 w-4 text-[#C9BDC5] transition group-hover:translate-x-0.5 group-hover:text-white" />
          </button>
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={openToolsMenu}
            data-lexis-nav-central
            title={railCollapsed ? "Central de ferramentas" : undefined}
            aria-label="Central de ferramentas"
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3.5 text-[13px] font-semibold text-[#C9BDC5] hover:bg-white/[.06] hover:text-white"
          >
            <Menu className="h-4 w-4 shrink-0" />
            <span data-lexis-nav-label>Central de ferramentas</span>
            <span data-lexis-nav-label className="ml-auto text-[11px] font-bold uppercase tracking-[.08em] text-[#C9BDC5]">todos os módulos</span>
          </button>
        </div>
      </nav>

      <div className="shrink-0 px-4 pb-4">
        <div data-lexis-nav-footer-message className="rounded-xl border border-white/10 bg-white/[.06] p-4">
          <p className="text-[12px] font-semibold leading-relaxed text-white">
            Inteligência jurídica
            <br />
            para resultados reais.
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between px-1 text-[11px] text-[#AFA1A9]">
          <span data-lexis-nav-label>v1.2.0</span>
          <button
            onClick={() => void signOut()}
            aria-label="Sair"
            title="Sair"
            data-lexis-nav-signout
            className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span data-lexis-nav-label>Sair</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {navBehavior!=='fixed'?(
        <button type="button" onClick={()=>setNavOpened(o=>!o)}
          aria-label={navOpened?'Ocultar menu lateral':'Mostrar menu lateral'}
          aria-expanded={navOpened}
          data-lexis-nav-handle
          className="fixed left-2 top-1/2 z-[195] hidden -translate-y-1/2 items-center gap-1 rounded-xl border border-border bg-card px-3 py-3 text-foreground shadow-xl md:flex"
          title={navOpened?'Ocultar menu':'Abrir menu'}>
          {navOpened?<PanelLeftClose className="h-5 w-5"/>:<ArrowUp className="h-5 w-5"/>}
        </button>
      ):null}
      <aside
        ref={sidebarRef}
        onMouseEnter={expandRail}
        onClickCapture={expandRail}
        onFocusCapture={expandRail}
        data-lexis-sidebar
        data-nav-open={navOpened?'true':'false'}
        data-lexis-commercial-sidebar
        data-lexis-magnetic-sidebar
        data-lexis-rail={navBehavior === "fixed" && railCollapsed ? "true" : "false"}
        className="sticky top-0 hidden h-dvh w-[228px] shrink-0 overflow-hidden border-r border-border md:block"
      >
        {renderSidebarBody()}
      </aside>

      <CommercialTopbar />

      <div
        data-lexis-mobile-topbar
        className="fixed inset-x-0 top-0 z-40 flex items-end pb-2 border-b border-white/10 bg-[linear-gradient(135deg,#250D18_0%,#3B0B1E_55%,#4D1A30_100%)] px-3 text-white shadow-[0_10px_28px_rgba(38,7,17,.24)] md:hidden"
      >
        <button
          type="button"
          onPointerDown={() => prefetchRoute("/")}
          onClick={() => navigateMobile("/")}
          aria-label="Ir para o início"
          data-lexis-mobile-brand
          className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-[#C9BDC5]/70 bg-[#250D18] shadow-[0_0_18px_rgba(138,46,80,.28)]"
        >
          <span className="lexis-brand-symbol block h-7 w-7 rounded-md" role="img" aria-label="LexisPredict" />
        </button>
        <div data-lexis-mobile-heading className="ml-2 min-w-0 flex-1">
          <p className="truncate text-[14px] font-black tracking-tight">Olá, {firstName}</p>
          <p className="truncate text-[11px] font-semibold uppercase tracking-[.14em] text-[#D2C3CA]">{mobileSection}</p>
        </div>
        <button
          type="button"
          onPointerDown={() => prefetchRoute("/settings")}
          onClick={() => navigateMobile("/settings")}
          aria-label="Abrir configurações"
          className="relative mr-1 flex h-10 w-10 touch-manipulation items-center justify-center rounded-full border border-white/10 bg-white/[.06] text-[#EDE9ED]"
        >
          <Settings className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={openToolsMenu}
          aria-label="Abrir menu"
          aria-expanded={toolsOpen}
          aria-controls="lexis-mobile-menu"
          data-lexis-mobile-menu-trigger
          className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-[#6D1734] text-white shadow-[0_8px_22px_rgba(138,46,80,.32)]"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
      </div>


      {/* No mobile, bottom-nav and topbar already expose Menu; avoid a
          duplicate floating handle covering the central scanner action. */}
      <nav
        data-lexis-mobile-bottom-nav
        data-lexis-mobile-active-index={mobileActiveIndex}
        style={{ "--lx-mobile-active-index": mobileActiveIndex } as CSSProperties}
        className="fixed inset-x-0 bottom-0 z-[70] grid h-[76px] grid-cols-5 border-t border-[#8F858B] bg-white px-1.5 pt-1.5 shadow-[0_-10px_30px_rgba(59,11,30,.12)] md:hidden"
        aria-label="Navegação principal móvel"
      >
        {[
          { label: "Início", href: "/", icon: LayoutDashboard },
          { label: "Processos", href: "/cases", icon: Briefcase },
        ].map((item) => {
          const Icon = item.icon;
          const isCurrentMobile = active(item.href) ||
            (item.href === "/cases" && (pathname === "/processos" || pathname?.startsWith("/processos/")));
          return (
            <button
              key={item.href}
              type="button"
              data-mobile-nav-action
              data-mobile-nav-active={isCurrentMobile ? "true" : "false"}
              data-mobile-nav-pending={navigatingTo === item.href ? "true" : undefined}
              aria-current={isCurrentMobile ? "page" : undefined}
              onPointerDown={() => prefetchRoute(item.href)}
              onClick={() => navigateMobile(item.href)}
              className={cn(
                "pointer-events-auto flex min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold active:bg-[#EDE9ED]",
                isCurrentMobile ? "text-[#6D1734]" : "text-[#60555C]"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          data-mobile-nav-action
          data-mobile-nav-scanner
          onClick={handleOpenScanner}
          aria-label="Atualizar processos no tribunal"
          className="pointer-events-auto relative -mt-5 flex min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-1 text-[11px] font-black text-[#6D1734]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-4 border-white bg-[linear-gradient(135deg,#6D1734,#A95B75)] text-white shadow-[0_10px_26px_rgba(138,46,80,.32)] active:scale-95">
            <Zap className="h-5 w-5" />
          </span>
          <span>Atualizar</span>
        </button>

        <button
          type="button"
          data-mobile-nav-action
          data-mobile-nav-active={active("/whatsapp") ? "true" : "false"}
          data-mobile-nav-pending={navigatingTo === "/whatsapp" ? "true" : undefined}
          aria-current={active("/whatsapp") ? "page" : undefined}
          onPointerDown={() => prefetchRoute("/whatsapp")}
          onClick={() => navigateMobile("/whatsapp")}
          className={cn(
            "pointer-events-auto flex min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold active:bg-[#EDE9ED]",
            active("/whatsapp") ? "text-[#6D1734]" : "text-[#60555C]"
          )}
        >
          <MessageCircle className="h-5 w-5" />
          <span>WhatsApp</span>
        </button>

        <button
          type="button"
          data-mobile-nav-action
          data-mobile-nav-menu
          aria-expanded={toolsOpen}
          aria-controls="lexis-mobile-menu"
          onClick={openToolsMenu}
          className="pointer-events-auto flex min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold text-[#60555C] active:bg-[#EDE9ED]"
        >
          <Menu className="h-5 w-5" />
          <span>Menu</span>
        </button>
      </nav>

      <Sheet open={toolsOpen} onOpenChange={setToolsOpen}>
        <SheetContent id="lexis-mobile-menu" side="left" data-lexis-mobile-drawer className="z-[110] flex w-[min(88vw,340px)] flex-col border-r border-[#8F858B] bg-white p-0">
          <SheetTitle className="sr-only">Central do LexisPredict</SheetTitle>
          <SheetDescription className="sr-only">Recursos agrupados por objetivo</SheetDescription>
          <div data-lexis-mobile-drawer-header className="border-b border-[#C5BAC1] px-4 pb-4 pt-3">
            <p data-lexis-mobile-menu-title className="text-lg font-black text-[#21151A]">Central</p>
            <p data-lexis-mobile-menu-description className="mt-1 text-xs leading-relaxed text-[#60555C]">Encontre pelo que você quer fazer, não pelo nome do módulo.</p>
            <button
              type="button"
              onPointerDown={() => prefetchRoute("/onboarding")}
              onClick={() => navigateMobile("/onboarding")}
              data-lexis-mobile-menu-feature
              className="mt-3 flex h-11 w-full touch-manipulation items-center gap-3 rounded-xl border border-[#C9BDC5] bg-[#EDE9ED] px-3 text-left text-sm font-bold text-[#6D1734]"
            >
              <BookOpen className="h-4 w-4" />
              Aprender o app em 3 minutos
            </button>
            <button
              type="button"
              onPointerDown={() => prefetchRoute("/dossies")}
              onClick={() => navigateMobile("/dossies")}
              data-lexis-mobile-menu-feature
              className="mt-2 flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-xl border border-[#C9BDC5] bg-[linear-gradient(135deg,#EDE9ED,#f8fbff)] px-3 py-2 text-left text-[#6D1734] shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#6D1734] text-white">
                <BookOpen className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black">Dossiês por IA</span>
                <span className="mt-0.5 block text-[12px] font-semibold leading-snug text-[#60555C]">
                  PDF, Excel, processo, mensagens ou contexto em um único chat.
                </span>
              </span>
            </button>
            <label data-lexis-mobile-menu-search className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-[#C5BAC1] bg-[#F4F3F5] px-3">
              <Search className="h-4 w-4 text-[#60555C]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="O que você quer fazer?"
                aria-label="Buscar ferramenta na central"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          </div>
          <div data-lexis-mobile-drawer-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {query.trim() ? (
              <div className="space-y-1">
                <p data-lexis-mobile-menu-label className="px-2 pb-2 text-[11px] font-black uppercase tracking-[.12em] text-[#60555C]">
                  Resultados
                </p>
                {mobileMenuItems.length ? (
                  mobileMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        type="button"
                        key={item.href}
                        onPointerDown={() => prefetchRoute(item.href)}
                        onClick={() => navigateMobile(item.href)}
                        data-lexis-mobile-menu-entry
                        aria-current={active(item.href) ? "page" : undefined}
                        className="flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#453039] active:bg-[#EDE9ED]"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EDE9ED] text-[#6D1734]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-bold">{item.label}</span>
                          <span data-lexis-mobile-entry-description className="mt-0.5 block text-[12px] font-medium leading-snug text-[#60555C]">{item.description}</span>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p data-lexis-mobile-menu-empty className="rounded-xl bg-[#F4F3F5] p-4 text-center text-xs text-[#60555C]">
                    Não encontrei essa ação. Tente descrever com outras palavras.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {menuGroups.map((group, index) => {
                  const GroupIcon = group.icon;
                  return (
                    <details
                      key={group.id}
                      open={index === 0}
                      data-lexis-mobile-menu-group
                      className="group overflow-hidden rounded-2xl border border-[#C5BAC1] bg-white"
                    >
                      <summary data-lexis-mobile-menu-summary className="flex min-h-16 cursor-pointer list-none touch-manipulation items-center gap-3 px-3 py-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDE9ED] text-[#6D1734]">
                          <GroupIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span data-lexis-mobile-menu-group-title className="block text-sm font-black text-[#21151A]">{group.label}</span>
                          <span data-lexis-mobile-menu-group-description className="mt-0.5 block text-[12px] font-medium leading-snug text-[#60555C]">{group.description}</span>
                        </span>
                        <span data-lexis-mobile-menu-group-count className="rounded-full bg-[#EDE9ED] px-2 py-1 text-[11px] font-black text-[#60555C]">
                          {group.items.length}
                        </span>
                        <ChevronRight className="h-4 w-4 text-[#60555C] transition-transform group-open:rotate-90" />
                      </summary>
                      <div data-lexis-mobile-menu-group-body className="border-t border-[#C5BAC1] bg-[#F4F3F5] p-2">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              type="button"
                              key={item.href}
                              onPointerDown={() => prefetchRoute(item.href)}
                              onClick={() => navigateMobile(item.href)}
                              data-lexis-mobile-menu-entry
                              aria-current={active(item.href) ? "page" : undefined}
                              className="flex min-h-13 w-full touch-manipulation items-center gap-3 rounded-xl px-3 py-2 text-left active:bg-[#EDE9ED]"
                            >
                              <Icon className="h-4 w-4 shrink-0 text-[#6D1734]" />
                              <span className="min-w-0">
                                <span className="block text-[14px] font-bold text-[#453039]">{item.label}</span>
                                <span data-lexis-mobile-entry-description className="block text-[12px] leading-snug text-[#60555C]">{item.description}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {navigatingTo ? (
        <div
          aria-live="polite"
          data-lexis-mobile-pending
          className="pointer-events-none fixed bottom-[calc(var(--lexis-mobile-bottomnav,4.75rem)+0.5rem)] left-1/2 z-[120] -translate-x-1/2 rounded-full border border-[#C5BAC1] bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[#453039] shadow-lg backdrop-blur md:hidden"
        >
          Abrindo…
        </div>
      ) : null}
    </>
  );
}
