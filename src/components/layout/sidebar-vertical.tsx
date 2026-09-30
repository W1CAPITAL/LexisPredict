"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Bot,
  BrainCircuit,
  Globe2,
  Puzzle,
  Briefcase,
  CalendarDays,
  Calculator,
  ChevronRight,
  Crown,
  Database,
  FileText,
  FolderOpen,
  Gavel,
  Kanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  PlayCircle,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  StickyNote,
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
import { operatorRouteAllowed } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  { label: "Painel", href: "/", icon: LayoutDashboard },
  { label: "Meus Processos", href: "/cases", icon: Briefcase },
  { label: "Processos", href: "/processos", icon: FolderOpen, company: true },
  { label: "Tarefas", href: "/tarefas", icon: ListTodo },
  { label: "Supervisão", href: "/supervisao", icon: ShieldCheck, supervisor: true },
  { label: "CRM", href: "/crm", icon: Users },
  { label: "Relatórios", href: "/report", icon: BarChart3 },
  { label: "Planos", href: "/planos", icon: Wallet },
  { label: "Configurações", href: "/settings", icon: Settings },
];

const extras: NavItem[] = [
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
  { label: "Peças e documentos", href: "/documents", icon: FileText },
  { label: "Busca e apreensão", href: "/busca-apreensao", icon: Gavel },
  { label: "Gerador de processos", href: "/gerador-processos", icon: Search },
  { label: "Importar carteira", href: "/import", icon: Upload },
  { label: "Consulta de bases", href: "/consulta-bases", icon: Database },
  { label: "Assistente", href: "/chat", icon: Bot },
  { label: "AI Lab", href: "/ai-lab", icon: BrainCircuit },
  { label: "Plugin Hub", href: "/plugins", icon: Puzzle },
  { label: "World Lab", href: "/world-lab", icon: Globe2 },
  { label: "Finanças", href: "/financas", icon: Wallet },
  { label: "Cálculos", href: "/calculos", icon: Calculator },
  { label: "Notas", href: "/notes", icon: StickyNote },
  { label: "Treinamento", href: "/onboarding", icon: PlayCircle },
  { label: "Equipe", href: "/team", icon: Users, supervisor: true },
  { label: "Auditoria", href: "/auditoria", icon: ShieldCheck, supervisor: true },
  { label: "Segurança", href: "/security", icon: ShieldAlert, superadmin: true },
  { label: "Administração", href: "/superadmin", icon: Crown, superadmin: true },
];

export function SidebarVertical() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { role, isSupervisor, isSuperAdmin, canSeeCompany } = useAdmin();
  const { plan } = usePlano();
  const openScanner = useDataJudScanStore((state) => state.openScanner);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allowed = (item: NavItem) => {
    if (item.superadmin && !isSuperAdmin) return false;
    if (item.supervisor && !isSupervisor) return false;
    if (item.company && !canSeeCompany) return false;
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
    [role, isSupervisor, isSuperAdmin, canSeeCompany, plan],
  );

  const extraItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return filterNavByPlan(
      extras.filter(allowed).map((item) => ({
        label: item.label,
        href: item.href,
        icon: item.icon,
      })),
      isSuperAdmin ? "maximo" : plan,
    ).filter((item) => !q || `${item.label} ${item.href}`.toLowerCase().includes(q));
  }, [query, role, isSupervisor, isSuperAdmin, plan]);

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
    mainItems.find((item) => active(item.href))?.label || "Operação jurídica";

  const handleOpenScanner = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("lexis-need-scanner"));
    }
    openScanner();
    setMobileOpen(false);
    setToolsOpen(false);
  };

  const SidebarBody = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#061d35_0%,#082944_55%,#0a3554_100%)] text-white">
      <div className="flex h-[82px] shrink-0 items-center border-b border-white/10 px-5">
        <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
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
          <button onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-2 text-white/70 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <div className="space-y-1.5">
          {mainItems.map((item) => {
            const Icon = item.icon;
            const isActive = active(item.href);
            const showBadge = item.href === "/tarefas";
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={() => setMobileOpen(false)}
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
              <span className="block truncate">Scanner DataJud + DJEN</span>
              <span className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-[.12em] text-[#9fc2e4]">
                Local · Nuvem · Both
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-[#8fb9e3] transition group-hover:translate-x-0.5 group-hover:text-white" />
          </button>
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setToolsOpen(true)}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3.5 text-[12px] font-semibold text-[#9fb9d2] hover:bg-white/[.06] hover:text-white"
          >
            <MoreHorizontal className="h-4 w-4" />
            Mais ferramentas
            <ChevronRight className="ml-auto h-4 w-4" />
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
        className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-white/10 bg-[linear-gradient(135deg,#061d35_0%,#082944_55%,#0b3b67_100%)] px-3 text-white shadow-[0_10px_28px_rgba(4,22,41,.24)] md:hidden"
      >
        <Link href="/" prefetch={false} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#2d7fff]/70 bg-[#07182d] shadow-[0_0_18px_rgba(31,111,255,.28)]">
          <img src="/logo.png" alt="LexisPredict" className="h-6 w-6 object-contain" />
        </Link>
        <div className="ml-2 min-w-0 flex-1">
          <p className="truncate text-[13px] font-black tracking-tight">Olá, {firstName}</p>
          <p className="truncate text-[9px] font-semibold uppercase tracking-[.14em] text-[#9fc2e4]">{mobileSection}</p>
        </div>
        <Link
          href="/settings"
          prefetch={false}
          aria-label="Configurações e notificações"
          className="relative mr-1 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[.06] text-[#d8eaff]"
        >
          <Bell className="h-[17px] w-[17px]" />
          <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#ff4d4f] ring-2 ring-[#082944]" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1769ff] text-white shadow-[0_8px_22px_rgba(23,105,255,.32)]"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="z-[100] w-[280px] border-0 p-0">
          <SheetTitle className="sr-only">Navegação</SheetTitle>
          <SheetDescription className="sr-only">Menu do LexisPredict</SheetDescription>
          <SidebarBody mobile />
        </SheetContent>
      </Sheet>

      <nav
        data-lexis-mobile-bottom-nav
        className="fixed inset-x-0 bottom-0 z-40 grid h-[74px] grid-cols-5 border-t border-[#dfe7f2] bg-white/95 px-1.5 pt-1.5 shadow-[0_-10px_30px_rgba(14,42,78,.10)] backdrop-blur-xl md:hidden"
        aria-label="Navegação principal móvel"
      >
        <Link href="/" prefetch={false} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold", active("/") ? "text-[#1769ff]" : "text-[#6f8098]")}>
          <LayoutDashboard className={cn("h-5 w-5", active("/") && "fill-[#1769ff]/10")} />
          <span>Início</span>
        </Link>
        <Link href="/cases" prefetch={false} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold", active("/cases") ? "text-[#1769ff]" : "text-[#6f8098]")}>
          <Briefcase className="h-5 w-5" />
          <span>Processos</span>
        </Link>
        <button
          type="button"
          onClick={handleOpenScanner}
          aria-label="Abrir Scanner DataJud e DJEN"
          className="relative -mt-5 flex min-w-0 flex-col items-center justify-center gap-1 text-[9px] font-black text-[#1769ff]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-4 border-white bg-[linear-gradient(135deg,#1769ff,#00a8ff)] text-white shadow-[0_10px_26px_rgba(23,105,255,.34)]">
            <Zap className="h-5 w-5" />
          </span>
          <span>Scanner</span>
        </button>
        <Link href="/tarefas" prefetch={false} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold", active("/tarefas") ? "text-[#1769ff]" : "text-[#6f8098]")}>
          <ListTodo className="h-5 w-5" />
          <span>Tarefas</span>
        </Link>
        <button type="button" onClick={() => setMobileOpen(true)} className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold text-[#6f8098]">
          <MoreHorizontal className="h-5 w-5" />
          <span>Mais</span>
        </button>
      </nav>

      <Sheet open={toolsOpen} onOpenChange={setToolsOpen}>
        <SheetContent side="left" className="z-[110] w-[360px] border-r border-[#dfe7f2] bg-white p-0">
          <SheetTitle className="sr-only">Mais ferramentas</SheetTitle>
          <SheetDescription className="sr-only">Recursos adicionais do LexisPredict</SheetDescription>
          <div className="border-b border-[#e2e8f2] p-5">
            <p className="text-lg font-black text-[#102447]">Mais ferramentas</p>
            <label className="mt-4 flex h-10 items-center gap-2 rounded-xl border border-[#dce5f1] bg-[#f7f9fc] px-3">
              <Search className="h-4 w-4 text-[#6c7f9b]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar recurso"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          </div>
          <div className="max-h-[calc(100dvh-120px)] overflow-y-auto p-3">
            {extraItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setToolsOpen(false)}
                  className="mb-1 flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#25466f] hover:bg-[#eef5ff] hover:text-[#125bd7]"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
