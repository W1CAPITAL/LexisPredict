"use client";
/**
 * @fileOverview Painel de Auditoria Inteligente MNI v6.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Zap, Activity, RefreshCcw, CheckCircle2, Search, Play, History, ShieldCheck, Loader2, Clock, AlertTriangle, Fingerprint
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { startFullScannerJobAction, fetchMniStatsAction } from '@/app/actions/scanner-actions';
import { cn } from '@/lib/utils';

export default function ScannerMonitorPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const { toast } = useToast();

  const loadStats = async () => {
    const data = await fetchMniStatsAction();
    if (data) setStats(data);
  };

  useEffect(() => { loadStats(); }, []);

  const handleStartScan = async () => {
    setIsScanning(true);
    setProgress(5);
    setLogs([{ type: 'INFO', msg: 'Handshake: Iniciando Auditoria Inteligente...' }]);
    
    try {
      const res = await startFullScannerJobAction();
      if (res.success) {
        setProgress(100);
        const newLogs = (res.results || []).map((r: any) => ({
          type: r.mudancaDetectada ? 'WARNING' : 'SUCCESS',
          msg: `[${r.tribunal}] CNJ ${r.cnj} | ${r.analysis.categoria} | Confiança: ${r.analysis.confianca}% | Mudança: ${r.mudancaDetectada ? 'SIM' : 'NÃO'}`
        }));
        setLogs(prev => [...newLogs, { type: 'DONE', msg: `Auditoria Concluída: ${res.processed} processos auditados.` }, ...prev]);
        toast({ title: "Auditoria Finalizada" });
        await loadStats();
      }
    } catch (err) {
      setLogs(prev => [{ type: 'ERROR', msg: 'Falha crítica no motor de auditoria.' }, ...prev]);
    } finally {
      setIsScanning(false);
    }
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
                <h1 className="font-black text-xl uppercase tracking-tighter">Motor de Auditoria Inteligente</h1>
                <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">Protocolo de Integridade MNI v6.0</p>
             </div>
          </div>
          <Button variant="ghost" onClick={loadStats} className="border-2 border-black h-9 px-4 rounded-none"><RefreshCcw size={16} className="mr-2"/> Atualizar Stats</Button>
        </header>

        <div className="flex-1 overflow-auto p-10 max-w-7xl mx-auto w-full space-y-8 pb-20">
           <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MiniStat label="Localizados" value={stats?.localizados || 0} />
              <MiniStat label="Mudanças" value={stats?.mudancasDetectadas || 0} color="text-blue-600" />
              <MiniStat label="Sem Alteração" value={stats?.semAlteracao || 0} color="text-black/40" />
              <MiniStat label="Possível Encerr." value={stats?.possivelEncerramento || 0} color="text-emerald-600" />
              <MiniStat label="Não Localizados" value={stats?.naoLocalizados || 0} color="text-red-600" />
           </section>

           <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <CardInertia label="Parados +30 dias" value={stats?.parados30 || 0} color="bg-orange-100 text-orange-700" />
              <CardInertia label="Parados +90 dias" value={stats?.parados90 || 0} color="bg-orange-500 text-white" />
              <CardInertia label="Inércia +180 dias" value={stats?.parados180 || 0} color="bg-red-600 text-white" />
           </section>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000]">
                 <CardHeader className="bg-black text-white py-4"><CardTitle className="text-[10px] font-black uppercase flex items-center gap-2"><Fingerprint size={16} className="text-primary" /> Execução de Auditoria Cronológica</CardTitle></CardHeader>
                 <CardContent className="p-10 space-y-8">
                    <Progress value={progress} className="h-4 border-2 border-black bg-gray-100 [&>div]:bg-black" />
                    <Button onClick={handleStartScan} disabled={isScanning} className="h-16 w-full bg-black text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-none shadow-[6px_6px_0px_#00D1FF] hover:shadow-none transition-all">
                       {isScanning ? <Loader2 className="animate-spin mr-3" /> : <Play size={18} className="mr-3" />} Iniciar Auditoria de Integridade (Full Hash)
                    </Button>
                 </CardContent>
              </Card>

              <Card className="bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000] flex flex-col h-[500px]">
                 <CardHeader className="bg-[#f8f9fb] border-b-2 border-black py-4"><CardTitle className="text-[10px] font-black uppercase flex items-center gap-2"><Activity size={16} /> Console de Auditoria</CardTitle></CardHeader>
                 <ScrollArea className="flex-1 bg-black text-primary p-6 font-mono text-[9px]">
                    {logs.map((log, i) => (
                      <div key={i} className={cn("mb-2 border-l-2 pl-2", log.type === 'WARNING' ? 'border-blue-500 text-blue-400' : log.type === 'SUCCESS' ? 'border-emerald-500 text-emerald-400' : 'border-primary')}>
                         <span className="opacity-30">[{new Date().toLocaleTimeString()}]</span> {log.msg}
                      </div>
                    ))}
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
    <div className="bg-white border-2 border-black p-4 text-center">
       <p className="text-[8px] font-black uppercase opacity-40 mb-1">{label}</p>
       <p className={cn("text-xl font-black tabular-nums", color)}>{value}</p>
    </div>
  );
}

function CardInertia({ label, value, color }: any) {
  return (
    <div className={cn("p-6 border-2 border-black flex items-center justify-between", color)}>
       <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
       <p className="text-3xl font-black">{value}</p>
    </div>
  );
}
