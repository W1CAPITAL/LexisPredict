/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Bell, 
  Search, 
  ShieldAlert, 
  Zap, 
  Clock, 
  Gavel, 
  Globe, 
  ChevronRight, 
  CheckCircle2, 
  ArrowRight,
  Filter,
  History,
  AlertCircle,
  Copyright,
  Scale,
  Briefcase,
  FileSearch,
  History as HistoryIcon
} from 'lucide-react';
import { useAppStore } from '@/store/use-app-store';
import { LegalCase } from '@/lib/case-logic';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/responsive-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { getSinalCapa } from '@/lib/sinal-capa';
import { format, parseISO } from 'date-fns';

export default function NotificationsPage() {
  const { cases } = useAppStore();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'merito' | 'ba' | 'audiencia' | 'execucao' | 'partes_custas'>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const notifications = useMemo(() => {
    const alerts: any[] = [];

    cases.forEach(c => {
      if (isCasoEncerrado(c)) return;
      
      const sinal = getSinalCapa(c);
      
      // Filtragem: SOMENTE EVENTOS DE MÉRITO/RITO RELEVANTES (Ignore priority < 40 e prazos crus)
      if (sinal.prioridade < 40) return;
      if (!c.tem_novo_andamento) return;

      let icon = <Zap className="text-blue-600" size={18} />;
      let category: 'merito' | 'ba' | 'audiencia' | 'execucao' | 'partes_custas' = 'merito';

      if (sinal.prioridade === 100) {
        icon = <ShieldAlert className="text-red-600 animate-pulse" size={18} />;
        category = 'ba';
      } else if (sinal.prioridade === 90) {
        icon = <Gavel className="text-emerald-600" size={18} />;
        category = 'merito';
      } else if (sinal.prioridade === 80) {
        icon = <Scale className="text-primary" size={18} />;
        category = 'merito';
      } else if (sinal.prioridade === 70) {
        icon = <Clock className="text-orange-500" size={18} />;
        category = 'audiencia';
      } else if (sinal.prioridade === 60) {
        icon = <Briefcase className="text-blue-500" size={18} />;
        category = 'execucao';
      } else if (sinal.prioridade === 50) {
        icon = <HistoryIcon size={18} className="text-slate-500" />;
        category = 'partes_custas';
      }

      alerts.push({
        id: `alert-${c.protocolo}`,
        type: category,
        priority: sinal.prioridade,
        title: sinal.titulo,
        description: sinal.detalhe,
        case: c,
        icon,
        data: sinal.data
      });
    });

    return alerts
      .filter(a => {
        const matchesSearch = a.case.cliente.toLowerCase().includes(search.toLowerCase()) || a.case.protocolo.includes(search);
        const matchesType = filterType === 'all' || a.type === filterType;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        const dateA = a.data ? new Date(a.data).getTime() : 0;
        const dateB = b.data ? new Date(b.data).getTime() : 0;
        return dateB - dateA;
      });
  }, [cases, search, filterType]);

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-[#f8f9fb] font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className={cn("flex-1 flex flex-col h-screen overflow-hidden", ui.main)}>
        <header className="h-auto border-b border-border/30 bg-white/60 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:px-10 gap-4 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-black text-white rounded-lg shadow-lg">
              <Bell size={20} className="text-primary" />
            </div>
            <h1 className="font-black text-base sm:text-xl text-foreground uppercase tracking-tight">Centro de Alertas de Mérito</h1>
          </div>
          <div className="flex items-center gap-3">
             <Badge className="bg-primary/10 text-primary border-none font-black text-[10px] px-4 py-2 uppercase rounded-xl">
               {notifications.length} Eventos Ativos
             </Badge>
          </div>
        </header>

        <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-hidden max-w-6xl mx-auto w-full">
           <div className="mb-6 flex flex-col gap-4 bg-white border border-border/50 p-4 sm:p-6 rounded-2xl shadow-sm">
             <div className="relative w-full">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
               <Input placeholder="Pesquisar por cliente ou CNJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11 h-12 bg-[#f8f9fb] border-none text-base sm:text-xs font-bold uppercase rounded-xl" />
             </div>
             
             <ScrollArea className="w-full">
                <div className="flex bg-[#f8f9fb] p-1 rounded-xl w-max sm:w-auto">
                   <FilterButton active={filterType === 'all'} onClick={() => setFilterType('all')} label="Tudo" />
                   <FilterButton active={filterType === 'ba'} onClick={() => setFilterType('ba')} label="B.A." />
                   <FilterButton active={filterType === 'merito'} onClick={() => setFilterType('merito')} label="Mérito" />
                   <FilterButton active={filterType === 'audiencia'} onClick={() => setFilterType('audiencia')} label="Audiência" />
                   <FilterButton active={filterType === 'execucao'} onClick={() => setFilterType('execucao')} label="Execução" />
                   <FilterButton active={filterType === 'partes_custas'} onClick={() => setFilterType('partes_custas')} label="Gestão" />
                </div>
                <ScrollBar orientation="horizontal" />
             </ScrollArea>
           </div>

           <ScrollArea className="flex-1">
              <div className="space-y-4 pb-20">
                {notifications.map((alert) => (
                  <div key={alert.id} className={cn(
                    "p-4 sm:p-6 bg-white border border-border/50 rounded-2xl hover:border-black transition-all group flex flex-col sm:flex-row items-start justify-between gap-6",
                    alert.priority >= 90 && "border-red-600/30 bg-red-50/10"
                  )}>
                    <div className="flex items-start gap-4 sm:gap-5">
                       <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-secondary/50 flex items-center justify-center shrink-0">
                          {alert.icon}
                       </div>
                       <div className="space-y-2">
                          <h3 className="font-black text-[13px] uppercase tracking-tight text-foreground">{alert.title}</h3>
                          <p className={cn("text-muted-foreground uppercase leading-relaxed max-w-2xl font-bold text-[11px]", ui.readable)}>
                            {alert.description}
                          </p>
                          <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-4">
                             <div className="flex items-center gap-1.5 text-[9px] font-black text-black/40 uppercase">
                                <History size={12} /> {alert.case.cliente}
                             </div>
                             <div className={cn("text-black/20 uppercase text-[9px] font-mono", ui.cnj)}>{alert.case.protocolo}</div>
                             {alert.data && (
                               <div className="text-[9px] font-black text-primary/60 uppercase ml-auto">
                                 {format(parseISO(alert.data), 'dd/MM/yyyy HH:mm')}
                               </div>
                             )}
                          </div>
                       </div>
                    </div>

                    <Button asChild className={cn("flex-1 sm:w-auto bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-[10px] rounded-xl shadow-lg transition-all", ui.touch)}>
                        <Link href={`/cases?search=${alert.case.protocolo}`}>Gerir Caso</Link>
                    </Button>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="py-20"><EmptyState icon={CheckCircle2} title="Tudo sob controle" description="Nenhuma novidade de mérito pendente de triagem." /></div>
                )}
              </div>
           </ScrollArea>
        </div>
      </main>
    </div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button onClick={onClick} className={cn("px-4 h-10 sm:h-9 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", active ? "bg-black text-white shadow-md" : "text-muted-foreground hover:bg-black/5")}>{label}</button>
  );
}
