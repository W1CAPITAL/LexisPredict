"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListTodo, Briefcase, FolderOpen, PauseCircle, ShieldAlert, Gavel, Hash, MessageCircle, CalendarDays, FileText, FileSpreadsheet, BarChart3, Users, ShieldCheck, Kanban, Wallet, Calculator, Bot, MessagesSquare, Upload, Settings, Search, Menu, PanelLeftClose, PanelLeftOpen, LogOut, Zap, StickyNote, PlayCircle, BrainCircuit, Crown, Monitor, Scale } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { useAdmin } from '@/hooks/use-admin';
import { usePlano } from '@/hooks/use-plano';
import { filterNavByPlan, planTemScanner } from '@/lib/planos-pacotes';
import { useDataJudScanStore } from '@/store/use-datajud-scan-store';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const sections = [
  { title: 'Dia a dia', items: [
    ['Painel', '/', LayoutDashboard], ['Fila de atendimento', '/tarefas', ListTodo],
    ['Meus processos', '/cases', Briefcase], ['Processos da empresa', '/processos', FolderOpen],
    ['Processos parados', '/processos-parados', PauseCircle], ['Encerrados a revisar', '/encerrados-revisao', ShieldAlert],
    ['Busca e apreensão', '/busca-apreensao', Gavel], ['Gerador de processos', '/gerador-processos', Hash],
    ['WhatsApp', '/whatsapp', MessageCircle], ['Agenda', '/agenda', CalendarDays],
  ]},
  { title: 'Documentos e análise', items: [
    ['Peças e documentos', '/documents', FileText], ['Dossiê operacional', '/report', BarChart3],
    ['Procedentes', '/cumprimentos-procedentes', Scale], ['OCR', '/tools/ocr', FileText],
    ['Importar carteira', '/import', Upload], ['Visualizador CSV', '/visualizador-csv', FileSpreadsheet], ['Assistente', '/chat', Bot],
    ['Veredito', '/veredito', Scale], ['Indicadores', '/analytics', BarChart3],
    ['Insights', '/insights', BrainCircuit], ['Urgências', '/urgency', ShieldAlert],
    ['Investigação predatória', '/investigacao-predatoria', Search],
  ]},
  { title: 'Gestão', items: [
    ['CRM', '/crm', Kanban], ['Retornos comerciais', '/crm/followups', ListTodo],
    ['Finanças', '/financas', Wallet], ['Cálculos', '/calculos', Calculator],
    ['Chat da equipe', '/mensagens', MessagesSquare], ['Notas', '/notes', StickyNote],
    ['Treinamento', '/onboarding', PlayCircle], ['Offline', '/offline', Monitor], ['Prêmios', '/premios', Crown],
  ]},
] as const;
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function SidebarVertical() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { isAdmin, isSuperAdmin, canScan } = useAdmin();
  const { plan } = usePlano();
  const { status, toggleMinimize } = useDataJudScanStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const desktopNav = useRef<HTMLElement>(null);
  const uid = profile?.auth_user_id || 'session';
  const scrollKey = `lexis-nav-scroll-v2:${uid}`;
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('lexis-sidebar-compact-v2') === '1');
      if (desktopNav.current) desktopNav.current.scrollTop = Number(sessionStorage.getItem(scrollKey) || 0);
    } catch { /* Optional display preferences. */ }
  }, [scrollKey]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const update = (event: Event) => setCollapsed(Boolean((event as CustomEvent).detail?.compact));
    window.addEventListener('lexis-nav-display', update);
    return () => window.removeEventListener('lexis-nav-display', update);
  }, []);
  const groups = useMemo(() => {
    const all = sections.map(section => ({ title: String(section.title), items: section.items.map(([label, href, icon]) => ({ label, href, icon })) }));
    const team = [];
    if (isAdmin) team.push({ label: 'Supervisão', href: '/supervisao', icon: ShieldCheck }, { label: 'Equipe', href: '/team', icon: Users }, { label: 'Auditoria', href: '/auditoria', icon: ShieldCheck });
    if (isSuperAdmin) team.push({ label: 'Segurança', href: '/security', icon: ShieldAlert }, { label: 'Administração', href: '/superadmin', icon: Crown });
    if (team.length) all.splice(1, 0, { title: 'Equipe e supervisão', items: team as any });
    return all.map(group => ({ ...group, items: filterNavByPlan(group.items, isSuperAdmin ? 'maximo' : plan).filter(item => !query || normalize(`${item.label} ${item.href}`).includes(normalize(query))) })).filter(group => group.items.length);
  }, [query, plan, isAdmin, isSuperAdmin]);
  const openAgents = () => { setMobileOpen(false); window.dispatchEvent(new Event('lexis-open-agents')); };
  const body = (compact: boolean, mobile: boolean) => <div className="flex h-full min-h-0 flex-col bg-card text-card-foreground">
    <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
      <Link href="/" className="flex min-w-0 flex-1 items-center gap-2" aria-label="LexisPredict — Painel"><img src="/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" />{!compact && <span className="truncate text-sm font-semibold">LexisPredict</span>}</Link>
      {!mobile && <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" aria-label={compact ? 'Expandir menu' : 'Recolher menu'} onClick={() => setCollapsed(v => { try { localStorage.setItem('lexis-sidebar-compact-v2', v ? '0' : '1'); } catch {} return !v; })}>{compact ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button>}
    </div>
    <div className="shrink-0 space-y-2 border-b p-2">
      <button onClick={openAgents} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-secondary px-3 text-sm font-medium hover:bg-muted" title="Agentes"><Bot size={18}/>{!compact && 'Agentes'}</button>
      {!compact && <label className="flex h-11 items-center gap-2 rounded-lg border bg-background px-3"><Search size={16} className="shrink-0 text-muted-foreground"/><input aria-label="Buscar no menu" placeholder="Buscar no menu" value={query} onChange={e => setQuery(e.target.value)} className="w-full min-w-0 bg-transparent text-sm outline-none"/></label>}
    </div>
    <nav ref={mobile ? undefined : desktopNav} aria-label="Menu principal" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin]" onScroll={e => { if (!mobile) try { sessionStorage.setItem(scrollKey, String(e.currentTarget.scrollTop)); } catch {} }}>
      {groups.map(group => <section key={group.title} className="mb-3">
        {!compact && <p className="px-3 py-2 text-xs font-medium text-muted-foreground">{group.title}</p>}
        {group.items.map(item => { const Icon = item.icon; const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/')); return <Link key={item.href} href={item.href} prefetch={false} title={item.label} aria-current={active ? 'page' : undefined} onClick={() => setMobileOpen(false)} className={cn('mb-0.5 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring', compact && 'justify-center px-1', active ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-card-foreground')}><Icon className="h-[18px] w-[18px] shrink-0"/>{!compact && <span className="min-w-0 leading-snug">{item.label}</span>}</Link>; })}
      </section>)}
      {!groups.length && <p className="p-3 text-sm text-muted-foreground">Nenhuma opção encontrada.</p>}
    </nav>
    <div className="shrink-0 space-y-1 border-t p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {canScan && planTemScanner(plan) && <button onClick={() => { window.dispatchEvent(new Event('lexis-need-scanner')); toggleMinimize(); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-muted" title="Scanner DataJud e DJEN"><Zap size={18} className={status === 'running' ? 'animate-pulse' : ''}/>{!compact && (status === 'running' ? 'Consulta em andamento' : 'Scanner DataJud / DJEN')}</button>}
      <Link href="/settings" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-muted" title="Configurações"><Settings size={18}/>{!compact && 'Configurações'}</Link>
      <div className="flex min-h-11 items-center gap-2 px-2">{!compact && <span className="min-w-0 flex-1 truncate text-xs" title={profile?.nome}>{profile?.nome || 'Minha conta'}</span>}<ThemeToggle/><button aria-label="Sair desta sessão" title="Sair desta sessão" onClick={() => void signOut()} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted"><LogOut size={17}/></button></div>
    </div>
  </div>;
  return <>
    <aside data-lexis-sidebar className={cn('sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-r md:block', collapsed ? 'w-24' : 'w-64')}>{body(collapsed, false)}</aside>
    <div data-lexis-mobile-nav className="fixed inset-x-0 top-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-end gap-2 border-b bg-card px-2 pb-1 text-card-foreground md:hidden">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><button aria-label="Abrir menu" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted"><Menu size={22}/></button></SheetTrigger><SheetContent side="left" className="z-[100] h-dvh w-[min(340px,92vw)] p-0"><SheetTitle className="sr-only">Navegação</SheetTitle><SheetDescription className="sr-only">Todas as áreas do LexisPredict, organizadas por atividade.</SheetDescription>{body(false, true)}</SheetContent></Sheet>
      <button onClick={openAgents} className="flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-muted"><Bot size={18}/>Agentes</button><span className="ml-auto flex h-11 items-center px-2 text-xs font-semibold">LexisPredict</span>
    </div>
  </>;
}
