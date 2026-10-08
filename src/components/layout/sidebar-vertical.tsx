"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  CalendarDays,
  Calculator,
  ChevronRight,
  Crown,
  FileText,
  FolderOpen,
  Gavel,
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

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  supervisor?: boolean;
  company?: boolean;
  superadmin?: boolean;
};

const core: NavItem[] = [
  { label: "Início", href: "/", icon: LayoutDashboard },
  { label: "Meus Processos", href: "/cases", icon: Briefcase },
  { label: "Processos da Empresa", href: "/processos", icon: FolderOpen, company: true },
  { label: "Hoje", href: "/tarefas", icon: ListTodo },
  { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
  { label: "Dossiês", href: "/dossies", icon: BookOpen },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "Relatórios", href: "/report", icon: BarChart3 },
  { label: "CRM", href: "/crm", icon: Users },
  { label: "Configurações", href: "/settings", icon: Settings },
];

const extras: NavItem[] = [
  { label: "Processos parados", href: "/processos-parados", icon: ShieldAlert },
  { label: "Encerrados em revisão", href: "/encerrados-revisao", icon: ShieldCheck },
  { label: "Cumprimentos procedentes", href: "/cumprimentos-procedentes", icon: Gavel },
  { label: "Busca e apreensão", href: "/busca-apreensao", icon: Gavel },
  { label: "Gerador de processos", href: "/gerador-processos", icon: Search },
  { label: "Peças e documentos", href: "/documents", icon: FileText },
  { label: "Veredito", href: "/veredito", icon: Gavel },
  { label: "Assistente", href: "/chat", icon: Bot },
  { label: "Finanças", href: "/financas", icon: Wallet },
  { label: "Cálculos", href: "/calculos", icon: Calculator },
  { label: "Importar carteira", href: "/import", icon: Upload },
  { label: "Equipe", href: "/team", icon: Users, supervisor: true },
  { label: "Supervisão", href: "/supervisao", icon: ShieldCheck, supervisor: true },
  { label: "Auditoria", href: "/auditoria", icon: ShieldCheck, supervisor: true },
  { label: "Administração", href: "/superadmin", icon: Crown, superadmin: true },
];

export function SidebarVertical() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { role, isSupervisor, isSuperAdmin, canSeeCompany } = useAdmin();
  const { plan } = usePlano();
  const openScanner = useDataJudScanStore((state) => state.openScanner);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const allowed = (item: NavItem) => {
    if (item.superadmin && !isSuperAdmin) return false;
    if (item.supervisor && !isSupervisor) return false;
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
    () =>
      ["/", "/tarefas", "/cases", "/processos", "/whatsapp", "/dossies"]
        .map((href) => mainItems.find((item) => item.href === href))
        .filter(Boolean) as Array<(typeof mainItems)[number]>,
    [mainItems],
  );

  // Tudo continua disponível, mas fora do primeiro nível.
  const mobileExtraItems = extraItems;

  const mobileMenuItems = useMemo(() => {
    const descriptions: Record<string, string> = {
      "/tarefas": "Veja quem precisa de atendimento agora.",
      "/cases": "Encontre cliente, CNJ e histórico.",
      "/whatsapp": "Converse e acompanhe mensagens.",
      "/dossies": "Peça um dossiê por chat com PDF, planilha, processo, mensagens ou contexto.",
      "/agenda": "Veja prazos e compromissos.",
      "/report": "Gere relatórios quando precisar.",
      "/settings": "Conta, equipe e preferências.",
      "/processos": "Visão completa da carteira da empresa.",
      "/crm": "Clientes, negócios e acompanhamento comercial.",
      "/gerador-processos": "Cadastre e organize novos processos.",
      "/chat": "Assistente para dúvidas e análise.",
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
      "/cases",
      "/whatsapp",
      "/dossies",
      "/agenda",
      "/report",
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
          `${item.label} ${item.description} ${item.href}`.toLowerCase().includes(q),
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
          "/agenda",
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
        hrefs: ["/whatsapp", "/crm", "/financas", "/report", "/import"],
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
      window.requestAnimationFrame(() => router.push(href));
    } else {
      router.push(href);
    }
  };

  const openToolsMenu = () => {
    setToolsOpen(true);
  };

  useEffect(() => {
    setToolsOpen(false);
    setNavigatingTo(null);
    setQuery("");
  }, [pathname]);

  useEffect(() => {
    const routes = ["/", "/cases", "/tarefas", "/whatsapp", "/dossies", "/settings", "/agenda"];
    const id = window.setTimeout(() => {
      for (const href of routes) router.prefetch(href);
    }, 500);
    return () => window.clearTimeout(id);
  }, [router]);

  useEffect(() => {
    if (!navigatingTo) return;
    const id = window.setTimeout(() => setNavigatingTo(null), 8000);
    return () => window.clearTimeout(id);
  }, [navigatingTo]);

  const active = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  const displayName = String(
    (profile as any)?.nome ||
      (profile as any)?.name ||
      (profile as any)?.full_name ||
      (profile as any)?.email ||
      "Operação"
  );
  const firstName = displayName.trim().split(/\s+/)[0] || "Operação";
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

  const SidebarBody = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#061d35_0%,#082944_55%,#0a3554_100%)] text-white">
      <div className="flex h-[82px] shrink-0 items-center border-b border-white/10 px-5">
        <Link href="/"  className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#2d7fff] bg-[#07182d] shadow-[0_0_24px_rgba(31,111,255,.22)]">
            <img src="/logo.png" alt="LexisPredict" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <p className="text-[17px] font-black tracking-tight text-white">LexisPredict</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[.22em] text-[#8fb0d1]">
              Operações Jurídicas
            </p>
          </div>
        </Link>
        {mobile ? (
          <button  className="ml-auto rounded-lg p-2 text-white/70 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <div className="space-y-1.5">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = active(item.href);
            const showBadge = item.href === "/tarefas";
            return (
              <Link
                key={item.href}
                href={item.href}
               
                
                className={cn(
                  "group flex h-11 items-center gap-3 rounded-lg px-3.5 text-[13px] font-semibold transition",
                  isActive
                    ? "bg-[#0f4e83] text-white shadow-[inset_0_0_0_1px_rgba(85,159,255,.18),0_6px_18px_rgba(0,0,0,.12)]"
                    : "text-[#d3e2f1] hover:bg-white/[.07] hover:text-white",
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-[#cfe5ff]" : "text-[#a9c3dc] group-hover:text-white")} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {showBadge ? (
                  <span className="rounded-full bg-[#ff4d4f] px-2 py-0.5 text-[9px] font-black text-white">12</span>
                ) : null}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleOpenScanner}
            className="group mt-2 flex h-12 w-full items-center gap-3 rounded-xl border border-[#2f7dff]/35 bg-[linear-gradient(135deg,rgba(20,103,255,.22),rgba(0,197,255,.10))] px-3.5 text-left text-[13px] font-bold text-white shadow-[inset_0_0_0_1px_rgba(120,190,255,.06),0_8px_20px_rgba(0,0,0,.10)] transition hover:border-[#5ca0ff]/60 hover:bg-[linear-gradient(135deg,rgba(20,103,255,.32),rgba(0,197,255,.14))]"
            aria-label="Abrir Scanner DataJud e DJEN"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#4b91ff]/40 bg-[#07182d] text-[#65b5ff] shadow-[0_0_18px_rgba(41,126,255,.20)]">
              <Zap className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">Atualizar tribunal</span>
              <span className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-[.12em] text-[#9fc2e4]">
                DataJud + DJEN
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-[#8fb9e3] transition group-hover:translate-x-0.5 group-hover:text-white" />
          </button>
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={openToolsMenu}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3.5 text-[12px] font-semibold text-[#9fb9d2] hover:bg-white/[.06] hover:text-white"
          >
            <Menu className="h-4 w-4" />
            Central
            <span className="ml-auto text-[9px] font-bold uppercase tracking-[.08em] text-[#7fa1c1]">tudo aqui</span>
          </button>
        </div>
      </nav>

      <div className="shrink-0 px-4 pb-4">
        <div className="rounded-xl border border-white/10 bg-white/[.06] p-4">
          <p className="text-[12px] font-semibold leading-relaxed text-white">
            Inteligência jurídica
            <br />
            para resultados reais.
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between px-1 text-[10px] text-[#7195b6]">
          <span>v1.2.0</span>
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside
        data-lexis-sidebar
        data-lexis-commercial-sidebar
        className="sticky top-0 hidden h-dvh w-[228px] shrink-0 overflow-hidden border-r border-[#dce5f1] md:block"
      >
        <SidebarBody />
      </aside>

      <CommercialTopbar />

      <div
        data-lexis-mobile-topbar
        className="fixed inset-x-0 top-0 z-40 flex items-end pb-2 border-b border-white/10 bg-[linear-gradient(135deg,#061d35_0%,#082944_55%,#0b3b67_100%)] px-3 text-white shadow-[0_10px_28px_rgba(4,22,41,.24)] md:hidden"
      >
        <button
          type="button"
          onClick={() => navigateMobile("/")}
          aria-label="Ir para o início"
          className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-[#2d7fff]/70 bg-[#07182d] shadow-[0_0_18px_rgba(31,111,255,.28)]"
        >
          <img src="/logo.png" alt="LexisPredict" className="h-6 w-6 object-contain" />
        </button>
        <div className="ml-2 min-w-0 flex-1">
          <p className="truncate text-[13px] font-black tracking-tight">Olá, {firstName}</p>
          <p className="truncate text-[9px] font-semibold uppercase tracking-[.14em] text-[#9fc2e4]">{mobileSection}</p>
        </div>
        <button
          type="button"
          onClick={() => navigateMobile("/settings")}
          aria-label="Configurações e notificações"
          className="relative mr-1 flex h-10 w-10 touch-manipulation items-center justify-center rounded-full border border-white/10 bg-white/[.06] text-[#d8eaff]"
        >
          <Bell className="h-[17px] w-[17px]" />
          <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#ff4d4f] ring-2 ring-[#082944]" />
        </button>
        <button
          type="button"
          onClick={openToolsMenu}
          aria-label="Abrir menu"
          className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-[#1769ff] text-white shadow-[0_8px_22px_rgba(23,105,255,.32)]"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
      </div>


      <nav
        data-lexis-mobile-bottom-nav
        className="fixed inset-x-0 bottom-0 z-[70] grid h-[76px] grid-cols-5 border-t border-[#dfe7f2] bg-white px-1.5 pt-1.5 shadow-[0_-10px_30px_rgba(14,42,78,.12)] md:hidden"
        aria-label="Navegação principal móvel"
      >
        {[
          { label: "Início", href: "/", icon: LayoutDashboard },
          { label: "Processos", href: "/cases", icon: Briefcase },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              type="button"
              data-mobile-nav-action
              onClick={() => navigateMobile(item.href)}
              className={cn(
                "pointer-events-auto flex min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold active:bg-[#eef5ff]",
                active(item.href) ? "text-[#1769ff]" : "text-[#6f8098]"
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
          onClick={handleOpenScanner}
          aria-label="Atualizar processos no tribunal"
          className="pointer-events-auto relative -mt-5 flex min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-1 text-[9px] font-black text-[#1769ff]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-4 border-white bg-[linear-gradient(135deg,#1769ff,#00a8ff)] text-white shadow-[0_10px_26px_rgba(23,105,255,.34)] active:scale-95">
            <Zap className="h-5 w-5" />
          </span>
          <span>Atualizar</span>
        </button>

        <button
          type="button"
          data-mobile-nav-action
          onClick={() => navigateMobile("/whatsapp")}
          className={cn(
            "pointer-events-auto flex min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold active:bg-[#eef5ff]",
            active("/whatsapp") ? "text-[#1769ff]" : "text-[#6f8098]"
          )}
        >
          <MessageCircle className="h-5 w-5" />
          <span>WhatsApp</span>
        </button>

        <button
          type="button"
          data-mobile-nav-action
          onClick={openToolsMenu}
          className="pointer-events-auto flex min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold text-[#6f8098] active:bg-[#eef5ff]"
        >
          <Menu className="h-5 w-5" />
          <span>Menu</span>
        </button>
      </nav>

      <Sheet open={toolsOpen} onOpenChange={setToolsOpen}>
        <SheetContent side="left" data-lexis-mobile-drawer className="z-[110] flex w-[min(88vw,340px)] flex-col border-r border-[#dfe7f2] bg-white p-0">
          <SheetTitle className="sr-only">Central do LexisPredict</SheetTitle>
          <SheetDescription className="sr-only">Recursos agrupados por objetivo</SheetDescription>
          <div className="border-b border-[#e2e8f2] px-4 pb-4 pt-3">
            <p className="text-lg font-black text-[#102447]">Central</p>
            <p className="mt-1 text-xs leading-relaxed text-[#6d7f9b]">Encontre pelo que você quer fazer, não pelo nome do módulo.</p>
            <button
              type="button"
              onClick={() => navigateMobile("/onboarding")}
              className="mt-3 flex h-11 w-full touch-manipulation items-center gap-3 rounded-xl border border-[#cfe0ff] bg-[#eef5ff] px-3 text-left text-sm font-bold text-[#145bd7]"
            >
              <BookOpen className="h-4 w-4" />
              Aprender o app em 3 minutos
            </button>
            <button
              type="button"
              onClick={() => navigateMobile("/dossies")}
              className="mt-2 flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-xl border border-[#b9d2ff] bg-[linear-gradient(135deg,#eef5ff,#f8fbff)] px-3 py-2 text-left text-[#174f9d] shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1769ff] text-white">
                <BookOpen className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black">Dossiês por IA</span>
                <span className="mt-0.5 block text-[10px] font-semibold leading-snug text-[#5f7898]">
                  PDF, Excel, processo, mensagens ou contexto em um único chat.
                </span>
              </span>
            </button>
            <label className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-[#dce5f1] bg-[#f7f9fc] px-3">
              <Search className="h-4 w-4 text-[#6c7f9b]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="O que você quer fazer?"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {query.trim() ? (
              <div className="space-y-1">
                <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[.12em] text-[#8a9bb1]">
                  Resultados
                </p>
                {mobileMenuItems.length ? (
                  mobileMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        type="button"
                        key={item.href}
                        onClick={() => navigateMobile(item.href)}
                        className="flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#25466f] active:bg-[#eef5ff]"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef5ff] text-[#1769ff]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-bold">{item.label}</span>
                          <span className="mt-0.5 block text-[11px] font-medium leading-snug text-[#6d7f9b]">{item.description}</span>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="rounded-xl bg-[#f7f9fc] p-4 text-center text-xs text-[#6d7f9b]">
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
                      className="group overflow-hidden rounded-2xl border border-[#e0e8f3] bg-white"
                    >
                      <summary className="flex min-h-16 cursor-pointer list-none touch-manipulation items-center gap-3 px-3 py-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef5ff] text-[#1769ff]">
                          <GroupIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-[#193b67]">{group.label}</span>
                          <span className="mt-0.5 block text-[11px] font-medium leading-snug text-[#73849c]">{group.description}</span>
                        </span>
                        <span className="rounded-full bg-[#f1f5fa] px-2 py-1 text-[10px] font-black text-[#6d7f9b]">
                          {group.items.length}
                        </span>
                        <ChevronRight className="h-4 w-4 text-[#8194ad] transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="border-t border-[#e7edf5] bg-[#fbfcfe] p-2">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              type="button"
                              key={item.href}
                              onClick={() => navigateMobile(item.href)}
                              className="flex min-h-13 w-full touch-manipulation items-center gap-3 rounded-xl px-3 py-2 text-left active:bg-[#eef5ff]"
                            >
                              <Icon className="h-4 w-4 shrink-0 text-[#3975c6]" />
                              <span className="min-w-0">
                                <span className="block text-[13px] font-bold text-[#25466f]">{item.label}</span>
                                <span className="block text-[10px] leading-snug text-[#7a8ba3]">{item.description}</span>
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
          className="pointer-events-none fixed bottom-[calc(var(--lexis-mobile-bottomnav,4.75rem)+0.5rem)] left-1/2 z-[120] -translate-x-1/2 rounded-full border border-[#d7e4f5] bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[#25466f] shadow-lg backdrop-blur md:hidden"
        >
          Abrindo…
        </div>
      ) : null}
    </>
  );
}
