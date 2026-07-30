
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
"use client";

import React, { useMemo } from 'react';
import { useDataJudScanStore } from '@/store/use-datajud-scan-store';
import { 
  Zap, 
  X, 
  Play, 
  Pause, 
  ChevronDown, 
  Loader2, 
  Activity, 
  ShieldCheck, 
  Clock, 
  CloudLightning,
  AlertTriangle,
  Gavel,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export function DataJudScannerPanel() {
  const { 
    status, total, done, alerts, closed, pending,
    isMinimized, toggleMinimize, startCloudScan, pauseCloudScan, resetScan 
  } = useDataJudScanStore();
  
  const pct = Math.round((done / (total || 1)) * 100);

  if (isMinimized && status === 'idle') return null;

  if (isMinimized && status !== 'idle') {
    return (
      <div className="fixed bottom-6 right-6 z-[200] animate-in slide-in-from-bottom-4">
        <Button onClick={toggleMinimize} className="h-14 w-14 rounded-full bg-black text-white shadow-2xl border-2 border-primary hover:scale-105 transition-transform">
          <div className="relative">
            <Zap className={cn("text-primary", status === 'running' && "animate-pulse")} />
            <span className="absolute -top-4 -right-4 bg-primary text-black text-[9px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-black">
              {pct}%
            </span>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("fixed bottom-6 right-6 z-[200] w-[420px] bg-white border-2 border-black shadow-[20px_20px_0px_rgba(0,0,0,0.1)] transition-all animate-in slide-in-from-bottom-4 flex flex-col max-h-[90vh]")}>
      <div className="bg-black text-white p-4 flex items-center justify-between border-b-2 border-black shrink-0">
        <div className="flex items-center gap-3">
          <Zap size={18} className={cn("text-primary", status === 'running' && "animate-pulse")} />
          <h3 className="text-[10px] font-black uppercase tracking-widest">Scanner Omnipresente v7.0</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleMinimize} className="h-7 w-7 text-white hover:bg-white/10"><ChevronDown size={14} /></Button>
          <Button variant="ghost" size="icon" onClick={resetScan} className="h-7 w-7 text-white hover:bg-red-600"><X size={14} /></Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">
          <section className="p-5 bg-slate-50 border-2 border-black/5 space-y-6">
             <div className="flex items-center gap-2">
                <CloudLightning className={cn("text-primary", status === 'running' && "animate-pulse")} size={16} />
                <p className="text-[10px] font-black uppercase">Auditoria Assíncrona 24h</p>
             </div>
             
             {status === 'idle' ? (
               <div className="space-y-4">
                  <p className="text-[9px] font-bold uppercase text-black/40 leading-relaxed">
                    O sistema auditará sua carteira em micro-lotes via servidor, evitando timeouts e sobrecarga. 
                    Recomendado para sincronia global.
                  </p>
                  <Button onClick={startCloudScan} className="w-full h-12 bg-black text-white font-black uppercase text-[10px] rounded-none border-2 border-black shadow-[4px_4px_0px_#00D1FF] hover:shadow-none transition-all">
                    Ativar Ciclo de Auditoria
                  </Button>
               </div>
             ) : (
               <div className="space-y-6 animate-in fade-in">
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[9px] font-black uppercase text-black/40">Progresso Geral</p>
                        <p className="text-xl font-black tabular-nums">{done} / {total}</p>
                      </div>
                      <Badge className={cn("font-black uppercase text-[8px] rounded-none px-2", status === 'running' ? "bg-emerald-50 text-emerald-600" : "bg-primary")}>
                        {status === 'running' ? 'Sincronizando...' : 'Concluído'}
                      </Badge>
                    </div>
                    <Progress value={pct} className="h-2 border-2 border-black bg-gray-100 [&>div]:bg-black" />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 border-2 border-black bg-emerald-50 text-center">
                      <p className="text-[7px] font-black uppercase text-emerald-800/40">Baixas</p>
                      <p className="text-sm font-black text-emerald-600 tabular-nums">{closed}</p>
                    </div>
                    <div className="p-2 border-2 border-black bg-blue-50 text-center">
                      <p className="text-[7px] font-black uppercase text-blue-800/40">Alertas</p>
                      <p className="text-sm font-black text-blue-600 tabular-nums">{alerts}</p>
                    </div>
                    <div className="p-2 border-2 border-black bg-slate-50 text-center">
                      <p className="text-[7px] font-black uppercase text-slate-800/40">Fila</p>
                      <p className="text-sm font-black text-slate-600 tabular-nums">{pending}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {status === 'running' ? (
                      <Button variant="outline" onClick={pauseCloudScan} className="flex-1 border-2 border-black rounded-none font-black text-[9px] uppercase"><Pause size={12} className="mr-2" /> Pausar Polling</Button>
                    ) : (
                      <Button onClick={startCloudScan} className="flex-1 bg-black text-white border-2 border-black rounded-none font-black text-[9px] uppercase"><Play size={12} className="mr-2" /> Retomar</Button>
                    )}
                  </div>
               </div>
             )}
          </section>

          <section className="space-y-4">
             <div className="flex items-center gap-2 opacity-40">
                <Activity size={14} />
                <h4 className="text-[9px] font-black uppercase tracking-widest">Protocolo de Integridade</h4>
             </div>
             <div className="grid grid-cols-1 gap-2">
                <IntegridadeRow icon={<CheckCircle2 size={10} className="text-emerald-500" />} label="Merge Incremental" status="Ativo" />
                <IntegridadeRow icon={<Clock size={10} className="text-blue-500" />} label="Janela de Polling" status="5s" />
                <IntegridadeRow icon={<ShieldCheck size={10} className="text-primary" />} label="Isolamento SaaS" status="Empresa" />
             </div>
          </section>
        </div>
      </ScrollArea>
      
      <div className="p-3 bg-black text-white text-[8px] font-black uppercase text-center border-t-2 border-black shrink-0">
        Authority System • Modo Micro-Batch Híbrido
      </div>
    </div>
  );
}

function IntegridadeRow({ icon, label, status }: { icon: React.ReactNode, label: string, status: string }) {
  return (
    <div className="flex items-center justify-between text-[8px] font-black uppercase bg-[#f8f9fb] p-2 border border-black/5">
       <div className="flex items-center gap-2">{icon} {label}</div>
       <span className="opacity-40">{status}</span>
    </div>
  );
}
