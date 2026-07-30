/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
"use client";

import React, { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Zap, Activity, RefreshCcw, CheckCircle2, Play, ShieldCheck, Clock, AlertTriangle, Fingerprint, Bug, Server, Square, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDataJudScanStore } from '@/store/use-datajud-scan-store';
import { fetchRepoCases } from '@/app/actions/case-actions';
import { fetchMniStatsAction } from '@/app/actions/scanner-actions';
import { cn } from '@/lib/utils';
import { isCasoEncerrado } from '@/lib/status-encerrado';

export default function ScannerMonitorPage() {
  const { 
    status, total, done, alerts, closed, errors, logs, queue, currentIndex,
    startScan, pauseScan, resumeScan, cancelScan, resetScan, loadProgress, activeWorkers
  } = useDataJudScanStore();

  const [mniStats, setMniStats] = useState<any>(null);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    loadProgress();
    loadStats();
  }, []);

  const loadStats = async () => {
    const data = await fetchMniStatsAction();
    if (data) setMniStats(data);
  };

  const handleStart = async () => {
    const cases = await fetchRepoCases();
    const validCases = cases.filter(c => c.protocolo && c.protocolo.length >= 8 && !isCasoEncerrado(c));
    
    if (validCases.length === 0) return;
    
    startScan(validCases.map(c => c.protocolo), 'full');
  };

  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex h-screen bg-[#f3f2f2] font-sans text-black overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-[#dddbda] bg-white flex items-center justify-between px-10 shrink-0 z-40">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-black text-white flex items-center justify-center rounded-sm">
                <ShieldCheck size={24} className="text-primary" />
             </div>
             <div>
                <h1 className="font-black text-xl uppercase tracking-tighter">Monitor Omni-Scanner</h1>
                <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">Protocolo Workpool Unificado v540.0</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" onClick={() => setDebugMode(!debugMode)} className={cn("h-9 rounded-none font-black text-[9px] uppercase border-2 border-black", debugMode && "bg-black text-white")}>
                <Bug size={14} className="mr-2"/> Debug
             </Button>
             <Button variant="ghost" onClick={loadStats} className="border-2 border-black h-9 px-4 rounded-none"><RefreshCcw size={16} className="mr-2"/> Atualizar Stats</Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10 max-w-7xl mx-auto w-full space-y-8 pb-20">
           <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MiniStat label="Concluídos" value={done} />
              <MiniStat label="Alertas" value={alerts} color="text-blue-600" />
              <MiniStat label="Falhas" value={errors} color="text-red-600" />
              <MiniStat label="Workers Ativos" value={activeWorkers} color="text-primary" />
           </section>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000]">
                 <CardHeader className="bg-black text-white py-4">
                    <CardTitle className="text-[10px] font-black uppercase flex items-center justify-between">
                      <div className="flex items-center gap-2"><Fingerprint size={16} className="text-primary" /> Execução Paralela FIFO</div>
                      <Badge variant="outline" className="text-primary border-primary">{activeWorkers} WORKERS</Badge>
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-10 space-y-8">
                    <div className="space-y-2">
                       <div className="flex justify-between items-end">
                          <p className="text-[9px] font-black uppercase text-black/40">Status do Lote Unificado</p>
                          <p className="text-xl font-black tabular-nums">{progress}%</p>
                       </div>
                       <Progress value={progress} className="h-4 border-2 border-black bg-gray-100 [&>div]:bg-black" />
                    </div>
                    
                    <div className="flex gap-4">
                      {status === 'idle' || status === 'done' || status === 'cancelled' ? (
                        <Button onClick={handleStart} className="h-16 w-full bg-black text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-none shadow-[6px_6px_0px_#00D1FF] hover:shadow-none transition-all">
                           <Play size={18} className="mr-3" /> Iniciar Varredura de Carteira
                        </Button>
                      ) : status === 'running' ? (
                        <Button onClick={pauseScan} className="h-16 w-full bg-orange-500 text-white font-black uppercase text-[11px] rounded-none border-2 border-black shadow-[6px_6px_0px_#000]">
                           Pausar Execução
                        </Button>
                      ) : (
                        <Button onClick={resumeScan} className="h-16 w-full bg-black text-white font-black uppercase text-[11px] rounded-none shadow-[6px_6px_0px_#22c55e]">
                           Retomar Workers
                        </Button>
                      )}
                    </div>
                 </CardContent>
              </Card>

              <Card className="bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000] flex flex-col h-[500px]">
                 <CardHeader className="bg-[#f8f9fb] border-b-2 border-black py-4">
                    <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2"><Activity size={16} /> Console de Auditoria</CardTitle>
                 </CardHeader>
                 <ScrollArea className="flex-1 bg-black text-primary p-6 font-mono text-[9px]">
                    {logs.map((log, i) => (
                      <div key={i} className={cn("mb-4 border-l-2 pl-3", log.status === 'warning' ? 'border-blue-500 text-blue-400' : log.status === 'success' ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400')}>
                         <div className="flex items-center justify-between mb-1">
                            <span className="opacity-30">[{new Date().toLocaleTimeString()}]</span>
                            {log.encerrado && <Badge className="bg-red-500 text-white text-[7px] px-1 rounded-none">BAIXA</Badge>}
                         </div>
                         <div className="font-black uppercase tracking-tight">{log.protocolo}: {log.message}</div>
                      </div>
                    ))}
                    {logs.length === 0 && <p className="opacity-20 uppercase">Aguardando comando master...</p>}
                 </ScrollArea>
              </Card>
           </div>
        </div>
      </main>
    </div>
  );
}

function MiniStat({ label, value, color = "text-black" }: any) {
  return (
    <div className="bg-white border-2 border-black p-5 text-center shadow-sm">
       <p className="text-[8px] font-black uppercase opacity-40 mb-1">{label}</p>
       <p className={cn("text-2xl font-black tabular-nums", color)}>{value}</p>
    </div>
  );
}
