
"use client";
/**
 * @fileOverview Painel de Auditoria Inteligente MNI v7.5
 * Refatorado v520.0 para processamento SEQUENCIAL ATÔMICO com progressão visual funcional.
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Zap, Activity, RefreshCcw, CheckCircle2, Search, Play, History, ShieldCheck, Loader2, Clock, AlertTriangle, Fingerprint, Bug, Server, Globe, Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { scanSingleProcessForMonitorAction, fetchMniStatsAction } from '@/app/actions/scanner-actions';
import { fetchRepoCases } from '@/app/actions/case-actions';
import { cn } from '@/lib/utils';

export default function ScannerMonitorPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [shouldStop, setShouldStop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [debugMode, setDebugMode] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [counters, setCounters] = useState({ done: 0, total: 0, timeouts: 0, apiErrors: 0 });
  const { toast } = useToast();

  const loadStats = async () => {
    const data = await fetchMniStatsAction();
    if (data) setStats(data);
  };

  useEffect(() => { loadStats(); }, []);

  const handleStartScan = async () => {
    setIsScanning(true);
    setShouldStop(false);
    setProgress(1);
    setLogs([{ type: 'INFO', msg: 'Iniciando Rito de Auditoria Progressiva v520.0...' }]);
    
    try {
      // 1. Obter Fila de Trabalho
      const cases = await fetchRepoCases();
      const validCases = cases.filter(c => c.protocolo && c.protocolo.length >= 8);
      
      if (validCases.length === 0) {
        setLogs(prev => [{ type: 'ERROR', msg: 'Nenhum processo válido na carteira para auditoria.' }, ...prev]);
        setIsScanning(false);
        return;
      }

      setCounters({ done: 0, total: validCases.length, timeouts: 0, apiErrors: 0 });
      setLogs(prev => [{ type: 'INFO', msg: `Fila de ${validCases.length} registros provisionada. Iniciando processamento...` }, ...prev]);

      // 2. Loop Sequencial Atômico (Evita timeout de server action longa)
      for (let i = 0; i < validCases.length; i++) {
        if (shouldStop) {
          setLogs(prev => [{ type: 'WARNING', msg: 'Operação interrompida pelo operador.' }, ...prev]);
          break;
        }

        const c = validCases[i];
        
        try {
          const res = await scanSingleProcessForMonitorAction(c.protocolo);
          
          if (res.success) {
            const audit = res.data;
            if (audit.debug?.httpStatus === 408) setCounters(prev => ({ ...prev, timeouts: prev.timeouts + 1 }));
            if (audit.debug?.httpStatus >= 400 && audit.debug?.httpStatus !== 408) setCounters(prev => ({ ...prev, apiErrors: prev.apiErrors + 1 }));

            const logType = audit.mudancaDetectada ? 'WARNING' : audit.localizado ? 'SUCCESS' : 'ERROR';
            const logMsg = `[${audit.tribunal}] CNJ ${audit.cnj} | ${audit.analysis.categoria} | ${audit.debug?.latency}ms`;
            
            setLogs(prev => [{ 
              type: logType, 
              msg: logMsg,
              debug: audit.debug 
            }, ...prev]);
          } else {
            setCounters(prev => ({ ...prev, apiErrors: prev.apiErrors + 1 }));
            setLogs(prev => [{ type: 'ERROR', msg: `CNJ ${c.protocolo}: ${res.error || 'Falha na resposta'}` }, ...prev]);
          }
        } catch (err) {
          setCounters(prev => ({ ...prev, apiErrors: prev.apiErrors + 1 }));
          setLogs(prev => [{ type: 'ERROR', msg: `CNJ ${c.protocolo}: Erro de rede na auditoria.` }, ...prev]);
        }

        const currentDone = i + 1;
        setCounters(prev => ({ ...prev, done: currentDone }));
        setProgress(Math.round((currentDone / validCases.length) * 100));
      }

      setLogs(prev => [{ type: 'DONE', msg: 'Auditoria Progressiva Concluída.' }, ...prev]);
      toast({ title: "Auditoria Finalizada" });
      await loadStats();

    } catch (err) {
      setLogs(prev => [{ type: 'ERROR', msg: 'Falha catastrófica na inicialização do scanner.' }, ...prev]);
    } finally {
      setIsScanning(false);
    }
  };

  const handleStop = () => {
    setShouldStop(true);
    setIsScanning(false);
  };

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
                <h1 className="font-black text-xl uppercase tracking-tighter">Monitor de Auditoria Progressiva</h1>
                <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">Protocolo de Integridade Atômica v520.0 (Resiliente)</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" onClick={() => setDebugMode(!debugMode)} className={cn("h-9 rounded-none font-black text-[9px] uppercase border-2 border-black", debugMode && "bg-black text-white")}>
                <Bug size={14} className="mr-2"/> {debugMode ? 'Ocultar Debug' : 'Modo Debug'}
             </Button>
             <Button variant="ghost" onClick={loadStats} className="border-2 border-black h-9 px-4 rounded-none"><RefreshCcw size={16} className="mr-2"/> Atualizar Stats</Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10 max-w-7xl mx-auto w-full space-y-8 pb-20">
           <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MiniStat label="Concluídos" value={counters.done} />
              <MiniStat label="Timeouts (20s)" value={counters.timeouts} color="text-orange-600" />
              <MiniStat label="Erros de API" value={counters.apiErrors} color="text-red-600" />
              <MiniStat label="Localizados" value={stats?.localizados || 0} color="text-emerald-600" />
           </section>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000]">
                 <CardHeader className="bg-black text-white py-4"><CardTitle className="text-[10px] font-black uppercase flex items-center gap-2"><Fingerprint size={16} className="text-primary" /> Execução Cronológica Progressiva</CardTitle></CardHeader>
                 <CardContent className="p-10 space-y-8">
                    <div className="space-y-2">
                       <div className="flex justify-between items-end">
                          <p className="text-[9px] font-black uppercase text-black/40">Status do Lote</p>
                          <p className="text-[10px] font-black uppercase">{isScanning ? `${progress}% Processado` : 'Aguardando comando'}</p>
                       </div>
                       <Progress value={progress} className="h-4 border-2 border-black bg-gray-100 [&>div]:bg-black" />
                    </div>
                    
                    {!isScanning ? (
                      <Button onClick={handleStartScan} className="h-16 w-full bg-black text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-none shadow-[6px_6px_0px_#00D1FF] hover:shadow-none transition-all">
                         <Play size={18} className="mr-3" /> Iniciar Auditoria (Circuit Breaker 20s)
                      </Button>
                    ) : (
                      <Button onClick={handleStop} variant="destructive" className="h-16 w-full font-black uppercase text-[11px] tracking-[0.2em] rounded-none border-2 border-black shadow-[6px_6px_0px_#ef4444] hover:shadow-none transition-all">
                         <Square size={18} className="mr-3" fill="white" /> Interromper Varredura
                      </Button>
                    )}
                 </CardContent>
              </Card>

              <Card className="bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000] flex flex-col h-[500px]">
                 <CardHeader className="bg-[#f8f9fb] border-b-2 border-black py-4">
                    <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2"><Activity size={16} /> {debugMode ? 'Debug Console' : 'Console de Auditoria'}</CardTitle>
                 </CardHeader>
                 <ScrollArea className="flex-1 bg-black text-primary p-6 font-mono text-[9px]">
                    {logs.map((log, i) => (
                      <div key={i} className={cn("mb-4 border-l-2 pl-3", log.type === 'WARNING' ? 'border-blue-500 text-blue-400' : log.type === 'SUCCESS' ? 'border-emerald-500 text-emerald-400' : log.type === 'ERROR' ? 'border-red-500 text-red-400' : 'border-primary')}>
                         <div className="flex items-center justify-between mb-1">
                            <span className="opacity-30">[{new Date().toLocaleTimeString()}]</span>
                            {log.debug && debugMode && (
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-[7px] border-primary/30 text-primary">{log.debug.latency}ms</Badge>
                                <Badge variant="outline" className={cn("text-[7px] border-primary/30", log.debug.httpStatus >= 400 ? "text-red-500 border-red-500/30" : "text-emerald-500")}>HTTP {log.debug.httpStatus}</Badge>
                              </div>
                            )}
                         </div>
                         <div className="font-black uppercase tracking-tight">{log.msg}</div>
                         {debugMode && log.debug && (
                           <div className="mt-2 p-2 bg-white/5 space-y-1 text-[8px] text-primary/60 border border-white/10">
                              <p className="flex items-center gap-2"><Server size={8}/> ENDPOINT: {log.debug.endpoint}</p>
                              {log.debug.error && <p className="text-red-400"><AlertTriangle size={8} className="inline mr-1"/> ERROR: {log.debug.error}</p>}
                           </div>
                         )}
                      </div>
                    ))}
                    {logs.length === 0 && <p className="opacity-20 uppercase">Aguardando rito de auditoria...</p>}
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
