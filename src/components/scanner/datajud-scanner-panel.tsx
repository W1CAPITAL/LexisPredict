/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useDataJudScanStore, ScanScope } from '@/store/use-datajud-scan-store';
import { useAppStore } from '@/store/use-app-store';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { isCNJ } from '@/lib/utils';
import { 
  Zap, 
  X, 
  Play, 
  Pause, 
  Square, 
  ChevronDown, 
  Loader2, 
  CheckCircle2, 
  History,
  Gavel,
  AlertTriangle,
  PlayCircle,
  ArrowRightCircle,
  Trash2,
  RotateCcw,
  Activity,
  ShieldCheck,
  Clock,
  CloudLightning
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { fetchRepoCases, clearDataJudAuditAction, runCloudWorkerAction } from '@/app/actions/case-actions';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function DataJudScannerPanel() {
  const { 
    status, total, done, alerts, closed, errors, logs, queue, currentIndex, courtHealthMap,
    isMinimized, toggleMinimize, startScan, pauseScan, resumeScan, resumeInterruptedScan, cancelScan, resetScan, loadProgress 
  } = useDataJudScanStore();
  
  const { cases } = useAppStore();
  const [loadingCases, setLoadingCases] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  // Cloud Worker Heartbeat
  const [isCloudActive, setIsCloudActive] = useState(false);
  const [cloudStats, setCloudStats] = useState({ success: 0, batches: 0, estimate: 0 });
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Heartbeat do Motor de Nuvem (Efeito de Loop)
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isCloudActive) {
      const executeCloudBatch = async () => {
        if (!isCloudActive) return;
        setIsCloudLoading(true);
        
        try {
          setCloudStats(prev => ({ ...prev, batches: prev.batches + 1 }));
          
          const res = await runCloudWorkerAction();
          if (res && res.success) {
             setCloudStats(prev => ({ 
               ...prev,
               success: prev.success + (res.successCount || 0), 
               estimate: res.remainingEstimate || 0
             }));
          }
        } catch (e) {
          console.warn("[Cloud Heartbeat] Falha de comunicação.");
        } finally {
          setIsCloudLoading(false);
          if (isCloudActive) {
            timer = setTimeout(executeCloudBatch, 45000); 
          }
        }
      };
      
      executeCloudBatch();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isCloudActive]);

  const handleStart = async (scope: ScanScope) => {
    setLoadingCases(true);
    try {
      const currentCases = cases.length > 0 ? cases : await fetchRepoCases();
      if (!currentCases || currentCases.length === 0) {
        toast({ title: "Carteira Vazia", description: "Não localizamos processos para auditar.", variant: "destructive" });
        return;
      }

      const validCases = currentCases.filter(c => isCNJ(c.protocolo) && !isCasoEncerrado(c));
      const uniqueMap = new Map();
      validCases.forEach(c => uniqueMap.set(c.protocolo, c));
      const pool = Array.from(uniqueMap.values()) as any[];

      let finalQueue: string[] = [];
      if (scope === 'resume') {
        finalQueue = pool
          .filter(c => !c.datajud_ultimo_nome && !c.tem_atualizacao_pos_retorno)
          .map(c => c.protocolo);
      } else {
        finalQueue = pool.map(c => c.protocolo);
      }

      if (finalQueue.length === 0) {
        toast({ title: "Fila Limpa", description: "Todos os registros já possuem dados recentes." });
        return;
      }

      await startScan(finalQueue, scope);
      toast({ title: "Varredura Manual Iniciada" });

    } catch (e) {
      toast({ title: "Falha técnica", variant: "destructive" });
    } finally {
      setLoadingCases(false);
    }
  };

  const healthStats = useMemo(() => {
    const list = Object.values(courtHealthMap);
    return {
      online: list.filter(h => h.status === 'online').length,
      slow: list.filter(h => h.status === 'slow').length,
      offline: list.filter(h => h.status === 'offline').length
    };
  }, [courtHealthMap]);

  if (isMinimized && status === 'idle') return null;

  if (isMinimized && status !== 'idle') {
    return (
      <div className="fixed bottom-6 right-6 z-[200] animate-in slide-in-from-bottom-4">
        <Button onClick={toggleMinimize} className="h-14 w-14 rounded-full bg-black text-white shadow-2xl border-2 border-primary hover:scale-105 transition-transform">
          <div className="relative">
            <Zap className={cn("text-primary", status === 'running' && "animate-pulse")} />
            <span className="absolute -top-4 -right-4 bg-primary text-black text-[9px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-black">
              {Math.round((done / (total || 1)) * 100)}%
            </span>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("fixed bottom-6 right-6 z-[200] w-[420px] bg-white border-2 border-black shadow-[12px_12px_0px_rgba(0,0,0,0.1)] transition-all animate-in slide-in-from-bottom-4 flex flex-col max-h-[90vh]")}>
      <div className="bg-black text-white p-4 flex items-center justify-between border-b-2 border-black shrink-0">
        <div className="flex items-center gap-3">
          <Zap size={18} className={cn("text-primary", (status === 'running' || isCloudLoading) && "animate-pulse")} />
          <h3 className="text-[10px] font-black uppercase tracking-widest">Scanner Omnipresente v6.5</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleMinimize} className="h-7 w-7 text-white hover:bg-white/10"><ChevronDown size={14} /></Button>
          <Button variant="ghost" size="icon" onClick={resetScan} className="h-7 w-7 text-white hover:bg-red-600"><X size={14} /></Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">
          <section className="p-5 bg-slate-50 border-2 border-black/5 space-y-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <CloudLightning className={cn("text-primary", isCloudActive && "animate-pulse")} size={16} />
                   <Label className="text-[10px] font-black uppercase">Motor de Nuvem (Servidor)</Label>
                </div>
                <Switch checked={isCloudActive} onCheckedChange={(val) => {
                  setIsCloudActive(val);
                  if (val) setCloudStats({ success: 0, batches: 0, estimate: 0 });
                }} />
             </div>
             
             {isCloudActive ? (
               <div className="space-y-4 animate-in fade-in">
                  <div className="flex justify-between items-center text-[9px] font-black uppercase opacity-60">
                     {isCloudLoading ? (
                       <span className="flex items-center gap-2"><Loader2 className="animate-spin text-primary" size={10} /> Processando Lote no Servidor...</span>
                     ) : (
                       <span className="flex items-center gap-2"><Clock size={10} className="text-emerald-500 animate-pulse" /> Aguardando Próximo Pulso...</span>
                     )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                     <div className="p-2 bg-white border border-black/5 text-center shadow-sm">
                        <p className="text-[7px] font-black uppercase opacity-40">Sucessos</p>
                        <p className="text-xs font-black text-emerald-600 tabular-nums">{cloudStats.success}</p>
                     </div>
                     <div className="p-2 bg-white border border-black/5 text-center shadow-sm">
                        <p className="text-[7px] font-black uppercase opacity-40">Ciclos</p>
                        <p className="text-xs font-black text-blue-600 tabular-nums">{cloudStats.batches}</p>
                     </div>
                     <div className="p-2 bg-white border border-black/5 text-center shadow-sm">
                        <p className="text-[7px] font-black uppercase opacity-40">Restante</p>
                        <p className="text-xs font-black text-slate-600 tabular-nums">~{cloudStats.estimate}</p>
                     </div>
                  </div>
               </div>
             ) : (
               <p className="text-[9px] font-bold uppercase text-black/30">Auditoria 24h em background desativada.</p>
             )}
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-2">
               <Activity size={16} className="text-black/40" />
               <Label className="text-[10px] font-black uppercase">Scanner Manual (Navegador)</Label>
            </div>

            {status === 'idle' ? (
              <div className="grid grid-cols-1 gap-3">
                {queue.length > 0 && currentIndex < queue.length && (
                  <Button onClick={resumeInterruptedScan} className="h-14 bg-emerald-600 text-white font-black uppercase text-[10px] justify-start px-6 rounded-none border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-none animate-pulse">
                    <ArrowRightCircle size={18} className="mr-3" /> Retomar Auditoria (Smart Skip)
                  </Button>
                )}

                <Button onClick={() => handleStart('resume')} disabled={loadingCases} className="h-12 bg-black text-white font-black uppercase text-[10px] justify-start px-6 rounded-none border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-none">
                  <PlayCircle size={16} className="mr-3 text-primary" /> Iniciar Varredura Inteligente
                </Button>
                
                <Button onClick={() => handleStart('full')} disabled={loadingCases} variant="outline" className="h-12 border-2 border-black font-black uppercase text-[10px] justify-start px-6 rounded-none shadow-[4px_4px_0px_#22c55e] hover:shadow-none">
                  <RotateCcw size={16} className="mr-3 text-emerald-600" /> Varredura Completa do Lote
                </Button>

                <div className="pt-4 border-t border-black/10">
                  <Button onClick={async () => { if(confirm('Resetar todas as assinaturas?')) { setIsClearing(true); await clearDataJudAuditAction(); setIsClearing(false); resetScan(); } }} disabled={isClearing} variant="outline" className="w-full h-10 border-2 border-red-600/20 text-red-600 font-black uppercase text-[9px] rounded-none">
                    <Trash2 size={14} className="mr-2" /> Limpar Histórico de Sincronia
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-top-2">
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] font-black uppercase text-black/40">Progresso Manual</p>
                      <p className="text-xl font-black tabular-nums">{done} / {total}</p>
                    </div>
                    <Badge className={cn("font-black uppercase text-[8px] rounded-none px-2", status === 'running' ? "bg-emerald-50" : "bg-primary")}>
                      {status === 'running' ? 'Auditando...' : 'Concluído'}
                    </Badge>
                  </div>
                  <Progress value={(done / (total || 1)) * 100} className="h-2 border-2 border-black bg-gray-100 [&>div]:bg-black" />
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
                  <div className="p-2 border-2 border-black bg-red-50 text-center">
                    <p className="text-[7px] font-black uppercase text-red-800/40">Falhas</p>
                    <p className="text-sm font-black text-red-600 tabular-nums">{errors}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {status === 'running' ? (
                    <Button variant="outline" onClick={pauseScan} className="flex-1 border-2 border-black rounded-none font-black text-[9px] uppercase"><Pause size={12} className="mr-2" /> Pausar</Button>
                  ) : status === 'paused' ? (
                    <Button onClick={resumeScan} className="flex-1 bg-black text-white border-2 border-black rounded-none font-black text-[9px] uppercase"><Play size={12} className="mr-2" /> Retomar</Button>
                  ) : null}
                  
                  {(status === 'running' || status === 'paused') && (
                    <Button variant="ghost" onClick={cancelScan} title="Cancelar" className="h-10 w-10 border-2 border-black rounded-none text-red-600"><Square size={12} fill="currentColor" /></Button>
                  )}

                  {status === 'done' && (
                    <Button onClick={resetScan} className="w-full bg-black text-white border-2 border-black rounded-none font-black text-[9px] uppercase shadow-[4px_4px_0px_#22c55e]">Finalizar Sessão</Button>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase text-black/40 flex items-center gap-2"><Activity size={10} /> Status de Conexão Tribunais</p>
              <div className="flex gap-2">
                 <Badge className="bg-emerald-500 text-white border-none text-[7px] font-black">{healthStats.online} OK</Badge>
                 <Badge className="bg-orange-500 text-white border-none text-[7px] font-black">{healthStats.slow} LENTOS</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-2">
              {Object.values(courtHealthMap).sort((a,b) => b.successRate - a.successRate).map(h => (
                <div key={h.id} className="flex flex-col p-2 bg-[#f8f9fb] border border-black/5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[8px] font-black uppercase">{h.id}</span>
                    <span className={cn("w-1.5 h-1.5 rounded-full", h.status === 'online' ? "bg-emerald-50" : h.status === 'slow' ? "bg-orange-500" : "bg-red-500")} />
                  </div>
                  <div className="flex justify-between items-center text-[7px] font-bold text-black/40">
                    <span>{Math.round(h.avgLatency)}ms</span>
                    <span>{Math.round(h.successRate * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {logs.length > 0 && (
            <section className="space-y-2">
              <Label className="text-[9px] font-black uppercase text-black/40 tracking-widest">Logs de Atividade Recente</Label>
              <ScrollArea className="h-32 border-2 border-black bg-[#fafafa]">
                <div className="p-2 space-y-1">
                  {logs.map((log, i) => (
                    <div key={i} className={cn("flex items-start gap-2 text-[9px] font-bold uppercase leading-tight p-2 border-b border-black/5", log.encerrado ? "bg-red-50" : log.alerta ? "bg-blue-50" : "")}>
                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        {log.encerrado ? <Gavel size={10} className="text-red-600" /> : 
                         log.alerta ? <AlertTriangle size={10} className="text-blue-600" /> : 
                         <CheckCircle2 size={10} className="text-emerald-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[8px] truncate">{log.protocolo}</p>
                        <p className="text-[7px] opacity-60 truncate">{log.message}</p>
                      </div>
                      {log.latency && <span className="text-[7px] font-black text-black/20 shrink-0 mt-0.5">{log.latency}ms</span>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </section>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-3 bg-black text-white text-[8px] font-black uppercase text-center border-t-2 border-black shrink-0">
        <ShieldCheck size={10} className="inline mr-1 text-primary" /> Authority System • Dual Engine Mode
      </div>
    </div>
  );
}
