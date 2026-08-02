/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Briefcase, 
  Upload, 
  BarChart3, 
  ShieldAlert, 
  Settings, 
  StickyNote,
  FileSearch,
  LogOut,
  MessageCircle,
  Menu,
  FileText,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Repeat,
  Bot,
  Zap,
  Layers,
  FileSignature,
  FileStack,
  Sun,
  Moon,
  CheckCircle,
  Printer,
  HelpCircle,
  PlayCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getTranslation, Locale } from '@/lib/i18n';
import { checkIfSuperAdmin, checkIfSupervisor } from '@/lib/supabase';
import { useAppStore } from '@/store/use-app-store';
import { useDataJudScanStore } from '@/store/use-datajud-scan-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { InstallAppButton } from '@/components/mobile/InstallAppButton';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>('pt');
  const { profile, signOut } = useAuth();
  const { isDarkMode, setDarkMode, setTutorialActive, cases } = useAppStore();
  const { status, toggleMinimize } = useDataJudScanStore();
  
  const t = getTranslation(locale);
  
  const isSuperAdmin = checkIfSuperAdmin(profile);
  const isSupervisor = checkIfSupervisor(profile);
  const isAdmin = profile?.cargo === 'Administrador' || isSuperAdmin || isSupervisor;

  useEffect(() => {
    const savedLocale = localStorage.getItem('lexisPredict_locale') as Locale;
    if (savedLocale) setLocale(savedLocale);
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const toggleTheme = () => {
    setDarkMode(!isDarkMode);
  };

  const startTour = () => {
    setTutorialActive(true);
    setIsMobileOpen(false);
  };

  // Notificações removidas do produto (v12)

  const navGroups = [
    {
      title: t.management,
      items: [
        { label: t.dashboard, href: '/', icon: LayoutDashboard },
                { label: t.tasks, href: '/tarefas', icon: CheckCircle },
        { label: t.cases, href: '/cases', icon: Briefcase },
        ...(isAdmin ? [{ label: t.team, href: '/team', icon: UserPlus }] : []),
      ]
    },
    {
      title: t.operations,
      items: [
        { label: t.audit, href: '/veredito', icon: FileSearch },
        { label: "Procuração", href: '/documents', icon: FileText },
        { label: "Habilitação", href: '/habilitacao-peca', icon: FileSignature },
        { label: "Substabelecimento", href: '/substabelecimento', icon: Repeat },
        { label: "Subst. Simples", href: '/substabelecimento-simples', icon: Repeat },
        { label: "Peça de Subst.", href: '/substabelecimento-peca', icon: FileStack },
        { label: t.whatsapp, href: '/whatsapp', icon: MessageCircle },
        { label: t.import, href: '/import', icon: Upload },
        { label: t.notes, href: '/notes', icon: StickyNote },
        { label: "Motor de OCR", href: '/tools/ocr', icon: Zap },
        { label: "Treinamento Vídeo", href: '/onboarding', icon: PlayCircle },
      ]
    },
    {
      title: t.system,
      items: [
        { label: t.analytics, href: '/analytics', icon: BarChart3 },
        { label: t.urgency, href: '/urgency', icon: ShieldAlert },
        { label: "Dossiê / Relatório", href: '/report', icon: FileText },
        { label: t.settings, href: '/settings', icon: Settings },
        { label: "Omni Export", href: '/master-export', icon: Printer },
      ]
    }
  ];

  const SidebarContent = () => (
    <div className="h-full flex flex-col bg-sidebar/95 backdrop-blur-md border-r border-sidebar-border">
      <div className="h-[4.5rem] flex items-center px-5 border-b border-sidebar-border/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md ring-1 ring-primary/20">
            <Layers size={18} strokeWidth={2.25} />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[13px] tracking-tight text-sidebar-foreground leading-none">LexisPredict</span>
              <span className="text-[10px] text-primary font-semibold tracking-wide mt-1">Enterprise</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
        <div className="px-1">
          <Button 
            onClick={() => toggleMinimize()} 
            className="w-full h-11 bg-foreground text-background hover:bg-primary hover:text-primary-foreground rounded-xl font-semibold text-[11px] tracking-wide shadow-sm transition-all gap-2.5"
          >
            <Zap className={cn("w-4 h-4", status === 'running' && "animate-pulse text-amber-400")} />
            {!collapsed && "DataJud Scanner"}
          </Button>
        </div>

        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">
                {group.title}
              </p>
            )}
            {group.items.map((item) => (
              <Link 
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative",
                  pathname === item.href 
                    ? "bg-primary/10 text-primary font-semibold shadow-[inset_3px_0_0_0_hsl(var(--primary))]" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium"
                )}
              >
                <item.icon className={cn("w-4 h-4 shrink-0", pathname === item.href ? "opacity-100" : "opacity-55 group-hover:opacity-90")} strokeWidth={pathname === item.href ? 2.25 : 2} />
                {!collapsed && (
                  <>
                    <span className="text-[11px] font-bold tracking-tight uppercase flex-1">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="bg-red-600 text-white text-[8px] font-black h-4 px-1.5 rounded-full flex items-center justify-center animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            ))}
          </div>
        ))}

        <div className="px-3 pt-4 border-t border-sidebar-border/10">
          <button 
            onClick={startTour}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/60 hover:bg-primary/10 hover:text-primary transition-all group"
          >
            <HelpCircle size={16} className="shrink-0 opacity-60 group-hover:opacity-100" />
            {!collapsed && <span className="text-[11px] font-black tracking-tight uppercase">Guia do Sistema</span>}
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-sidebar-border space-y-4">
        {!collapsed && <InstallAppButton />}
        
        {!collapsed && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/50 border border-sidebar-border shadow-sm">
            <Avatar className="w-9 h-9 border border-primary/20">
               <AvatarImage src={profile?.avatar_url || ''} />
               <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs">
                 {profile?.nome?.substring(0, 2).toUpperCase() || '??'}
               </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-black uppercase truncate text-sidebar-foreground leading-tight">{profile?.nome || 'User'}</span>
              <span className="text-[9px] text-sidebar-foreground/50 uppercase font-bold mt-0.5">{profile?.cargo || 'Operator'}</span>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button 
              onClick={handleLogout}
              title={t.logout}
              className="h-9 w-9 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg flex items-center justify-center transition-colors"
            >
              <LogOut size={16} />
            </button>
            <button 
              onClick={toggleTheme}
              title="Alternar Tema"
              className="h-9 w-9 text-sidebar-foreground/60 hover:text-primary rounded-lg flex items-center justify-center transition-colors"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex h-9 w-9 text-sidebar-foreground/60 hover:text-primary rounded-lg items-center justify-center transition-colors"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="md:hidden fixed top-5 left-5 z-[100]">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="premium-card h-12 w-12 border-none">
              <Menu size={24} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 border-r-0 w-80">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Access LexisPredict Operations</SheetDescription>
            </SheetHeader>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      <aside className={cn(
        "hidden md:flex h-screen flex-col transition-all duration-500 z-50 shrink-0",
        collapsed ? "w-20" : "w-72"
      )}>
        <SidebarContent />
      </aside>
    </>
  );
}
