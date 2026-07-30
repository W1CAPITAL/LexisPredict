"use client";
/**
 * @fileOverview Painel de Monitoramento MNI v2.0
 * Ativado para execução inteligente e dashboard de utilidade.
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Zap, 
  Activity, 
  Database, 
  AlertCircle, 
  RefreshCcw, 
  CheckCircle2, 
  Search,
  Play,
  Settings,
  History,
  ShieldCheck,
  Loader2,
  ChevronRight,
  Gavel,
  FileText,
  Clock
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

  useEffect(() => {
    loadStats();
  }, []);

  const handleStartScan = async () => {
    setIsScanning(true);
    setProgress(10);
    setLogs([{ type: 'INFO', msg: 'Iniciando Handshake com MNI Tribunal...' }]);
    
    try {
      const res = await startFullScannerJobAction();
      
      if (res.success) {
        setProgress(100);
        const newLogs = (res.results || []).map((r: any) => ({
          type: r.necessitaRetorno ? 'WARNING' : 'SUCCESS',
          msg: `CNJ ${r.cnj}: [${r.statusUtil}] - ${r.ultimoEventoNome}`
        }));
        
        setLogs(prev => [...newLogs, { type: 'DONE', msg: `Lote finalizado: ${res.processed} processos auditados.` }, ...prev]);
        toast({ title: "Motor MNI: Auditoria Concluída" });
        await loadStats();
      } else {
        setLogs(prev => [{ type: 'ERROR', msg: `Falha: ${res.error}` }, ...prev]);
      }
    } catch (err) {
      setLogs(prev => [{ type: 'ERROR', msg: 'Erro crítico de infraestrutura MNI.' }, ...prev]);
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
                <Activity size={24} className="text-primary" />
             </div>
             <div>
                <h1 className="font-black text-xl uppercase tracking-tighter">Scanner Monitor MNI</h1>
                <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">Auditoria Resolutiva de Gabinete</p>
             </div>
          </div>
          <Button variant="ghost" size="icon" onClick={loadStats} className="border-2 border-black rounded-none"><RefreshCcw size={18} /></Button>
        </header>

        <div className="flex-1 overflow-auto p-10 max-w-7xl mx-auto w-full space-y-10">
           {/* DASHBOARD DE UTILIDADE MNI */}
           <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatItem label="Sem novos andamentos" value={stats?.semAndamento || 0} color="text-emerald-600" icon={<CheckCircle2 size={16}/>} />
              <StatItem label="Novos andamentos" value={stats?.novoAndamento || 0} color="text-blue-600" icon={<Zap size={16}/>} />
              <StatItem label="Processos Encerrados" value={stats?.encerrados || 0} color="text-red-600" icon={<Gavel size={16}/>} />
              <StatItem label="Com Prazos Ativos" value={stats?.comPrazo || 0} color="text-orange-600" icon={<Clock size={16}/>} />
           </section>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-10">
                 <Card className="bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000] overflow-hidden">
                    <CardHeader className="bg-black text-white py-4 flex flex-row items-center justify-between">
                       <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                          <Zap size={16} className="text-primary" /> Motor de Varredura Resolutiva
                       </CardTitle>
                       {isScanning && <Badge className="bg-primary text-black animate-pulse rounded-none">TRIAGEM ATIVA</Badge>}
                    </CardHeader>
                    <CardContent className="p-10 space-y-8">
                       <div className="space-y-4">
                          <div className="flex justify-between items-end">
                             <p className="text-[11px] font-black uppercase">Progresso do Lote MNI</p>
                             <p className="text-xl font-black">{progress}%</p>
                          </div>
                          <Progress value={progress} className="h-3 border-2 border-black bg-gray-100 [&>div]:bg-black" />
                       </div>

                       <div className="grid grid-cols-1 gap-6 pt-6">
                          <Button onClick={handleStartScan} disabled={isScanning} className="h-16 bg-black text-white font-black uppercase text-[11px] tracking-widest rounded-none shadow-[6px_6px_0px_#00D1FF] hover:shadow-none transition-all">
                             {isScanning ? <Loader2 className="animate-spin mr-3" /> : <Play size={18} className="mr-3" />} 
                             Iniciar Lote Inteligente (MNI Soberano)
                          </Button>
                       </div>
                    </CardContent>
                 </Card>

                 {/* TABELA DE CATEGORIAS */}
                 <div className="bg-white border-2 border-black p-8 shadow-[8px_8px_0px_#000] space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest border-b-2 border-black pb-2">Distribuição de Eventos Úteis</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                       <MiniCategory label="Em Recurso" value={stats?.emRecurso || 0} />
                       <MiniCategory label="Novas Publicações" value={stats?.publicacao || 0} />
                       <MiniCategory label="Novas Petições" value={stats?.peticao || 0} />
                       <MiniCategory label="Outros" value={stats?.total - (stats?.semAndamento + stats?.novoAndamento + stats?.encerrados) || 0} />
                    </div>
                 </div>
              </div>

              <Card className="bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000] flex flex-col">
                 <CardHeader className="bg-[#f8f9fb] border-b-2 border-black py-4">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                       <Search size={16} /> Console de Auditoria
                    </CardTitle>
                 </CardHeader>
                 <ScrollArea className="flex-1 bg-black text-primary p-6 font-mono text-[9px]">
                    {logs.map((log, i) => (
                      <div key={i} className="mb-2 flex gap-3">
                         <span className="opacity-40">[{new Date().toLocaleTimeString()}]</span>
                         <span className={cn(
                           log.type === 'ERROR' ? 'text-red-500' : 
                           log.type === 'WARNING' ? 'text-blue-400' : 
                           log.type === 'SUCCESS' ? 'text-green-400' : 'text-primary'
                         )}>
                           {log.msg}
                         </span>
                      </div>
                    ))}
                    {logs.length === 0 && <p className="opacity-20 uppercase italic text-center py-20">Aguardando comando de triagem...</p>}
                 </ScrollArea>
              </Card>
           </div>
        </div>

        <footer className="h-10 border-t border-[#dddbda] bg-white flex items-center justify-center gap-6 text-[10px] text-black/60 font-black uppercase tracking-[0.2em] shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary" /> Auditoria Resolutiva Ativa
          </div>
          <span>Authority Engine v2.0 • Modelo de Inteligência CNJ</span>
        </footer>
      </main>
    </div>
  );
}

function StatItem({ label, value, color, icon }: any) {
  return (
    <div className="bg-white border-2 border-black p-6 shadow-[5px_5px_0px_#000] flex flex-col gap-2">
       <div className="flex items-center justify-between">
          <p className="text-[9px] font-black uppercase text-black/40 tracking-widest">{label}</p>
          <div className={color}>{icon}</div>
       </div>
       <p className={cn("text-2xl font-black", color)}>{value}</p>
    </div>
  );
}

function MiniCategory({ label, value }: any) {
  return (
    <div className="space-y-1">
       <p className="text-[8px] font-black text-black/40 uppercase">{label}</p>
       <p className="text-xl font-black">{value}</p>
    </div>
  );
}
