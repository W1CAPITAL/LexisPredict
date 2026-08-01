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
  Copyright
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
import { plainTextFromDjen } from '@/lib/djen';

export default function NotificationsPage() {
  const { cases } = useAppStore();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'datajud' | 'djen' | 'prazos'>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const notifications = useMemo(() => {
    const alerts: any[] = [];

    cases.forEach(c => {
      const isEncerrado = isCasoEncerrado(c);
      
      // 1. Alertas de Prazos
      if (!isEncerrado && (c.status === 'Vencido' || c.status === 'É Hoje' || c.status === 'Caso Crítico')) {
        alerts.push({
          id: `status-${c.protocolo}`,
          type: 'prazos',
          priority: c.status === 'Caso Crítico' ? 100 : (c.status === 'Vencido' ? 90 : 80),
          title: `Urgência: ${c.status}`,
          description: `O processo está em fase crítica de atendimento. Prazo: ${c.proximoPrazo || 'S/D'}.`,
          case: c,
          icon: <Clock className="text-red-600" size={18} />
        });
      }

      // 2. Alertas DataJud
      if (c.tem_atualizacao_pos_retorno && !c.datajud_encerrado_tribunal) {
        alerts.push({
          id: `datajud-upd-${c.protocolo}`,
          type: 'datajud',
          priority: 70,
          title: "Novo Andamento Tribunal",
          description: `Identificada nova movimentação: "${c.datajud_ultimo_nome || 'Consultar autos'}"`,
          case: c,
          icon: <Zap className="text-blue-600" size={18} />
        });
      }

      if (c.datajud_encerrado_tribunal) {
        alerts.push({
          id: `datajud-closed-${c.protocolo}`,
          type: 'datajud',
          priority: 85,
          title: "Baixa no Tribunal",
          description: `Rito de encerramento detectado via auditoria CNJ: ${c.datajud_encerrado_motivo || 'Baixa Definitiva'}`,
          case: c,
          icon: <Gavel className="text-emerald-600" size={18} />
        });
      }

      if (c.indicio_busca_apreensao) {
        alerts.push({
          id: `datajud-ba-${c.protocolo}`,
          type: 'datajud',
          priority: 110,
          title: "Busca e Apreensão",
          description: `ALERTA CRÍTICO: ${c.busca_apreensao_motivo || 'Indício de mandado de busca detectado.'}`,
          case: c,
          icon: <ShieldAlert className="text-red-600 animate-pulse" size={18} />
        });
      }

      // 3. Alertas DJEN (Texto Sanitizado)
      if (c.djen_nova_comunicacao) {
        // Defesa contra HTML antigo no banco
        const cleanSummary = plainTextFromDjen(c.djen_ultimo_resumo || "Nova intimação oficial no Diário Nacional.");
        
        alerts.push({
          id: `djen-${c.protocolo}`,
          type: 'djen',
          priority: 75,
          title: "Publicação DJEN",
          description: cleanSummary,
          case: c,
          icon: <Globe className="text-blue-600" size={18} />
        });
      }
    });

    return alerts
      .filter(a => {
        const matchesSearch = a.case.cliente.toLowerCase().includes(search.toLowerCase()) || 
                            a.case.protocolo.includes(search);
        const matchesType = filterType === 'all' || a.type === filterType;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => b.priority - a.priority);
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
            <div>
               <h1 className="font-black text-base sm:text-xl text-foreground uppercase tracking-tight">Centro de Alertas</h1>
               <p className="hidden sm:block text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">Vigilância Unificada de Gabinete</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <Badge className="bg-primary/10 text-primary border-none font-black text-[10px] px-4 py-2 uppercase rounded-xl">
               {notifications.length} Alertas Ativos
             </Badge>
          </div>
        </header>

        <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-hidden max-w-6xl mx-auto w-full">
           <div className="mb-6 flex flex-col gap-4 bg-white border border-border/50 p-4 sm:p-6 rounded-2xl shadow-sm">
             <div className="relative w-full">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
               <Input 
                 placeholder="Pesquisar..." 
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="pl-11 h-12 bg-[#f8f9fb] border-none text-base sm:text-xs font-bold uppercase rounded-xl"
               />
             </div>
             
             <ScrollArea className="w-full">
                <div className="flex bg-[#f8f9fb] p-1 rounded-xl w-max sm:w-auto">
                   <FilterButton active={filterType === 'all'} onClick={() => setFilterType('all')} label="Tudo" />
                   <FilterButton active={filterType === 'prazos'} onClick={() => setFilterType('prazos')} label="Prazos" />
                   <FilterButton active={filterType === 'datajud'} onClick={() => setFilterType('datajud')} label="DataJud" />
                   <FilterButton active={filterType === 'djen'} onClick={() => setFilterType('djen')} label="DJEN" />
                </div>
                <ScrollBar orientation="horizontal" />
             </ScrollArea>
           </div>

           <ScrollArea className="flex-1">
              <div className="space-y-4 pb-32 sm:pb-20">
                {notifications.map((alert) => (
                  <div key={alert.id} className={cn(
                    "p-4 sm:p-6 bg-white border border-border/50 rounded-2xl hover:border-black transition-all group flex flex-col sm:flex-row items-start justify-between gap-6",
                    alert.priority >= 100 && "border-red-600/30 bg-red-50/10"
                  )}>
                    <div className="flex items-start gap-4 sm:gap-5">
                       <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-secondary/50 flex items-center justify-center shrink-0">
                          {alert.icon}
                       </div>
                       <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                             <h3 className="font-black text-sm uppercase tracking-tight text-foreground">{alert.title}</h3>
                             <Badge variant="outline" className="text-[8px] sm:text-[7px] font-black uppercase border-border">{alert.type}</Badge>
                          </div>
                          <p className={cn("text-muted-foreground uppercase leading-relaxed max-w-2xl", ui.readable)}>
                            {alert.description}
                          </p>
                          <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-4">
                             <div className="flex items-center gap-1.5 text-[9px] font-black text-black/40 uppercase">
                                <History size={12} /> {alert.case.cliente}
                             </div>
                             <div className={cn("text-black/20 uppercase", ui.cnj)}>{alert.case.protocolo}</div>
                          </div>
                       </div>
                    </div>

                    <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                       <Button asChild className={cn("flex-1 sm:w-auto bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-[10px] rounded-xl shadow-lg transition-all", ui.touch)}>
                          <Link href={`/cases?search=${alert.case.protocolo}`}>
                            Gerir <ArrowRight size={14} className="ml-2 hidden sm:inline" />
                          </Link>
                       </Button>
                       <Button variant="ghost" className={cn("flex-1 sm:w-auto font-black uppercase text-[9px] text-muted-foreground hover:text-red-600 transition-all", ui.touch)}>
                          Ignorar
                       </Button>
                    </div>
                  </div>
                ))}

                {notifications.length === 0 && (
                  <div className="py-20">
                    <EmptyState icon={CheckCircle2} title="Tudo Limpo" description="Não há alertas pendentes para os critérios selecionados." />
                  </div>
                )}
              </div>
           </ScrollArea>
        </div>

        <footer className="hidden sm:flex h-10 border-t border-border/30 bg-white items-center justify-center gap-6 text-[10px] text-muted-foreground/60 font-black uppercase tracking-[0.4em] shrink-0">
          <div className="flex items-center gap-2"><Copyright size={10} /> 2026 W1 Capital.</div>
          <span>Vigilância Ativa • LexisPredict</span>
        </footer>
      </main>
    </div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick} 
      className={cn(
        "px-4 h-10 sm:h-9 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
        active ? "bg-black text-white shadow-md" : "text-muted-foreground hover:bg-black/5"
      )}
    >
      {label}
    </button>
  );
}
