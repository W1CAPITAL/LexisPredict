"use client";
/**
 * @fileOverview Painel de Monitoramento Soberano do Scanner
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
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ScannerMonitorPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<any[]>([]);

  const runSampleScan = () => {
    setIsScanning(true);
    setProgress(0);
    setLogs([{ type: 'INFO', msg: 'Iniciando Handshake com MNI Tribunal...' }]);

    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setProgress(p);
      setLogs(prev => [{ type: 'SUCCESS', msg: `Lote ${p/10} processado via consultarProcesso()` }, ...prev]);
      
      if (p >= 100) {
        clearInterval(interval);
        setIsScanning(false);
        setLogs(prev => [{ type: 'DONE', msg: 'Monitoramento concluído com 0 falhas.' }, ...prev]);
      }
    }, 1000);
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
                <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">br.jus.cnj.intercomunicacao.servico</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[10px]">Ativo: 17 Tribunais</Badge>
             <Button variant="ghost" size="icon" className="border-2 border-black rounded-none"><Settings size={18} /></Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10 max-w-7xl mx-auto w-full space-y-10">
           <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <KpiMini label="Processos Monitorados" value="1.149" icon={<Database size={16}/>} />
              <KpiMini label="Consultas Hoje" value="482" icon={<RefreshCcw size={16}/>} />
              <KpiMini label="Eventos Detectados" value="12" icon={<Zap size={16}/>} />
              <KpiMini label="Erros MNI" value="0" icon={<AlertCircle size={16}/>} />
           </section>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <Card className="lg:col-span-2 bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000] overflow-hidden">
                 <CardHeader className="bg-black text-white py-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                       <Zap size={16} className="text-primary" /> Motor de Varredura em Execução
                    </CardTitle>
                    {isScanning && <Badge className="bg-primary text-black animate-pulse rounded-none">RUNNING</Badge>}
                 </CardHeader>
                 <CardContent className="p-10 space-y-8">
                    <div className="space-y-4">
                       <div className="flex justify-between items-end">
                          <p className="text-[11px] font-black uppercase">Progresso do Lote Atual</p>
                          <p className="text-xl font-black">{progress}%</p>
                       </div>
                       <Progress value={progress} className="h-3 border-2 border-black bg-gray-100 [&>div]:bg-black" />
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-6">
                       <Button onClick={runSampleScan} disabled={isScanning} className="h-16 bg-black text-white font-black uppercase text-[11px] tracking-widest rounded-none shadow-[6px_6px_0px_#00D1FF] hover:shadow-none transition-all">
                          <Play size={18} className="mr-3" /> Iniciar Lote Global
                       </Button>
                       <Button variant="outline" className="h-16 border-2 border-black font-black uppercase text-[11px] tracking-widest rounded-none bg-white">
                          <History size={18} className="mr-3" /> Ver Logs Históricos
                       </Button>
                    </div>
                 </CardContent>
              </Card>

              <Card className="bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000] flex flex-col">
                 <CardHeader className="bg-[#f8f9fb] border-b-2 border-black py-4">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                       <Search size={16} /> Console de Telemetria
                    </CardTitle>
                 </CardHeader>
                 <ScrollArea className="flex-1 bg-black text-primary p-6 font-mono text-[9px]">
                    {logs.map((log, i) => (
                      <div key={i} className="mb-2 flex gap-3">
                         <span className="opacity-40">[{new Date().toLocaleTimeString()}]</span>
                         <span className={log.type === 'SUCCESS' ? 'text-green-400' : 'text-primary'}>
                           {log.msg}
                         </span>
                      </div>
                    ))}
                    {logs.length === 0 && <p className="opacity-20 uppercase italic">Aguardando comando do gabinete...</p>}
                 </ScrollArea>
              </Card>
           </div>
        </div>

        <footer className="h-10 border-t border-[#dddbda] bg-white flex items-center justify-center gap-6 text-[10px] text-black/60 font-black uppercase tracking-[0.2em] shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary" /> Módulo CNJ-MNI Ativado
          </div>
          <span>Authority Engine v1.0 • Desenvolvido por W1 Capital</span>
        </footer>
      </main>
    </div>
  );
}

function KpiMini({ label, value, icon }: any) {
  return (
    <div className="bg-white border-2 border-black p-6 shadow-[5px_5px_0px_#000]">
       <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-black uppercase text-black/40 tracking-widest">{label}</p>
          <div className="text-primary">{icon}</div>
       </div>
       <p className="text-2xl font-black">{value}</p>
    </div>
  );
}
