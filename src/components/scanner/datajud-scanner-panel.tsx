/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
"use client";

import React from 'react';
import { useDataJudScanStore } from '@/store/use-datajud-scan-store';
import { 
  Zap, 
  X, 
  Play, 
  Pause, 
  ChevronDown, 
  Activity, 
  ShieldCheck, 
  Clock, 
  CloudLightning,
  AlertTriangle,
  Gavel,
  CheckCircle2,
  Terminal,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export function DataJudScannerPanel() {
  const { 
    status, total, done, alerts, closed, pending, cycles,
    manualStatus, manualTotal, manualDone, manualAlerts, manualClosed, manualErrors, lastLogs,
    isMinimized, toggleMinimize, startCloudScan, pauseCloudScan, startManualScan, pauseManualScan, resetScan 
  } = useDataJudScanStore();
  
  const cloudPct = Math.round((done / (total || 1)) * 100);
  const manualPct = Math.round((manualDone / (manualTotal || 1)) * 100);

  if (isMinimized && status === 'idle' && manualStatus === 'idle') return null;

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[200] animate-in slide-in-from-bottom-4">
        <Button onClick={toggleMinimize} className="h-14 w-14 rounded-full bg-black text-white shadow-2xl border-2 border-primary hover:scale-105 transition-transform">
          <div className="relative">
            <Zap className={cn("text-primary", (status === 'running' || manualStatus === 'running') && "animate-pulse")} />
            <span className="absolute -top-4 -right-4 bg-primary text-black text-[9px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-black">
              {status === 'running' ? cloudPct : manualPct}%
            </span>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[200] w-[420px] bg-white border-2 border-black shadow-[20px_20px_0px_rgba(0,0,0,0.1)] transition-all animate-in slide-in-from-bottom-4 flex flex-col max-h-[85vh]">
      <div className="bg-black text-white p-4 flex items-center justify-between border-b-2 border-black shrink-0">
        <div className="flex items-center gap-3">
          <Zap size={18} className={cn("text-primary", (status === 'running' || manualStatus === 'running') && "animate-pulse")} />
          <h3 className="text-[10px] font-black uppercase tracking-widest">Scanner Omnipresente v8.0</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleMinimize} className="h-7 w-7 text-white hover:bg-white/10"><ChevronDown size={14} /></Button>
          <Button variant="ghost" size="icon" onClick={resetScan} className="h-7 w-7 text-white hover:bg-red-600"><X size={14} /></Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8 pb-20">
          {/* ENGINE 1: CLOUD AUDIT */}
          <section className="p-5 bg-slate-50 border-2 border-black/5 space-y-6">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <CloudLightning className={cn("text-primary", status === 'running' && "animate-pulse")} size={16} />
                   <p className="text-[10px] font-black uppercase">Motor de Nuvem (Servidor)</p>
                </div>
                {status !== 'idle' && <Badge className="text-[8px] font-black uppercase rounded-none bg-blue-600">Ciclos: {cycles}</Badge>}
             </div>
             
             {status === 'idle' ? (
               <div className="space-y-4">
                  <p className="text-[9px] font-bold uppercase text-black/40 leading-relaxed">
                    Auditoria assíncrona em micro-lotes via servidor. Opera em background sem usar seu navegador.
                  </p>
                  <Button onClick={startCloudScan} className="w-full h-11 bg-black text-white font-black uppercase text-[10px] rounded-none border-2 border-black shadow-[4px_4px_0px_#00D1FF] hover:shadow-none transition-all">
                    Ativar Ciclo de Nuvem
                  </Button>
               </div>
             ) : (
               <div className="space-y-4 animate-in fade-in">
                  <div className="flex justify-between items-end">
                    <p className="text-[9px] font-black uppercase text-black/40">Progresso Servidor: {done} / {total}</p>
                    <span className="text-[10px] font-black tabular-nums">{cloudPct}%</span>
                  </div>
                  <Progress value={cloudPct} className="h-2 border-2 border-black bg-white [&>div]:bg-black" />
                  
                  <div className="grid grid-cols-3 gap-2">
                    <DashboardMiniKpi label="Sucessos" value={done} color="text-emerald-600" />
                    <DashboardMiniKpi label="Alertas" value={alerts} color="text-blue-600" />
                    <DashboardMiniKpi label="Restante" value={pending} color="text-slate-400" />
                  </div>

                  <Button variant="outline" size="sm" onClick={pauseCloudScan} className="w-full border-2 border-black rounded-none font-black text-[9px] uppercase h-10">
                    <Pause size={12} className="mr-2" /> Pausar Servidor
                  </Button>
               </div>
             )}
          </section>

          {/* ENGINE 2: MANUAL SCANNER */}
          <section className="p-5 bg-white border-2 border-black space-y-6 shadow-[6px_6px_0px_rgba(0,0,0,0.05)]">
             <div className="flex items-center gap-2">
                <Terminal className={cn("text-primary", manualStatus === 'running' && "animate-pulse")} size={16} />
                <p className="text-[10px] font-black uppercase">Scanner Manual (Navegador)</p>
             </div>

             {manualStatus === 'idle' ? (
               <div className="space-y-4">
                  <p className="text-[9px] font-bold uppercase text-black/40 leading-relaxed">
                    Varredura imediata utilizando a banda do seu computador. Ideal para triagem de urgência na tela.
                  </p>
                  <Button onClick={startManualScan} className="w-full h-11 bg-white text-black font-black uppercase text-[10px] rounded-none border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-none transition-all">
                    Iniciar Varredura Local
                  </Button>
               </div>
             ) : (
               <div className="space-y-4 animate-in fade-in">
                  <div className="flex justify-between items-end">
                    <p className="text-[9px] font-black uppercase text-black/40">Fila Local: {manualDone} / {manualTotal}</p>
                    <span className="text-[10px] font-black tabular-nums">{manualPct}%</span>
                  </div>
                  <Progress value={manualPct} className="h-2 border-2 border-black bg-gray-100 [&>div]:bg-primary" />

                  <div className="grid grid-cols-3 gap-2">
                    <DashboardMiniKpi label="Baixas" value={manualClosed} color="text-emerald-600" />
                    <DashboardMiniKpi label="Novidades" value={manualAlerts} color="text-blue-600" />
                    <DashboardMiniKpi label="Falhas" value={manualErrors} color="text-red-600" />
                  </div>

                  <div className="flex gap-2">
                    {manualStatus === 'running' ? (
                      <Button variant="outline" onClick={pauseManualScan} className="flex-1 border-2 border-black rounded-none font-black text-[9px] uppercase h-10"><Pause size={12} className="mr-2" /> Pausar</Button>
                    ) : (
                      <Button onClick={startManualScan} className="flex-1 bg-black text-white border-2 border-black rounded-none font-black text-[9px] uppercase h-10"><Play size={12} className="mr-2" /> Retomar</Button>
                    )}
                  </div>
                  
                  {/* Logs de Atividade */}
                  <div className="mt-4 space-y-2">
                    <p className="text-[8px] font-black uppercase text-black/30 tracking-widest">Logs de Atividade Local</p>
                    <div className="bg-black/5 p-3 rounded-none space-y-1.5 max-h-[150px] overflow-auto">
                      {lastLogs.map((log, i) => (
                        <div key={i} className="flex items-center justify-between text-[8px] font-bold uppercase border-b border-black/5 pb-1">
                          <span className="truncate max-w-[150px]">{log.protocolo}</span>
                          <span className={cn(log.success ? "text-emerald-600" : "text-red-600")}>{log.message}</span>
                          <span className="text-black/30 font-mono">{log.latency}ms</span>
                        </div>
                      ))}
                      {lastLogs.length === 0 && <p className="text-center py-4 text-[8px] font-black opacity-20">Aguardando telemetria...</p>}
                    </div>
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
                <IntegridadeRow icon={<CheckCircle2 size={10} className="text-emerald-500" />} label="Merge Híbrido" status="Ativo" />
                <IntegridadeRow icon={<Clock size={10} className="text-blue-500" />} label="Gap de Rede" status="600ms" />
                <IntegridadeRow icon={<ShieldCheck size={10} className="text-primary" />} label="Isolamento" status="SaaS Scoped" />
             </div>
          </section>
        </div>
      </ScrollArea>
      
      <div className="p-3 bg-black text-white text-[8px] font-black uppercase text-center border-t-2 border-black shrink-0">
        Authority System • Dual Engine Mode
      </div>
    </div>
  );
}

function DashboardMiniKpi({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="p-2 border-2 border-black bg-white text-center">
      <p className="text-[7px] font-black uppercase text-black/40">{label}</p>
      <p className={cn("text-sm font-black tabular-nums", color)}>{value}</p>
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
