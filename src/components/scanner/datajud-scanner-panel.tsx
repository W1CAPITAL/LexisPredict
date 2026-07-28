
"use client";

import React, { useState, useEffect } from 'react';
import { useDataJudScanStore } from '@/store/use-datajud-scan-store';
import { useAppStore } from '@/store/use-app-store';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { 
  Zap, 
  X, 
  Play, 
  Pause, 
  Square, 
  ChevronDown, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  History,
  ShieldCheck,
  Gavel,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { fetchRepoCases } from '@/app/actions/case-actions';

export function DataJudScannerPanel() {
  const { 
    status, total, done, alerts, closed, errors, logs, 
    isMinimized, toggleMinimize, startScan, pauseScan, resumeScan, cancelScan, resetScan 
  } = useDataJudScanStore();
  
  const { cases, setCases } = useAppStore();
  const [scope, setScope] = useState<'critical' | 'all'>('critical');
  const [loadingCases, setLoadingCases] = useState(false);
  const { toast } = useToast();

  // Sincronia de segurança: Carrega a carteira se o store estiver vazio ao abrir o painel
  useEffect(() => {
    if (!isMinimized && cases.length === 0 && !loadingCases) {
      setLoadingCases(true);
      fetchRepoCases().then(data => {
        if (data) setCases(data);
        setLoadingCases(false);
      }).catch(() => setLoadingCases(false));
    }
  }, [isMinimized, cases.length, loadingCases, setCases]);

  const handleStart = async () => {
    let currentCases = cases;
    
    // Garantir que temos dados antes de montar a fila
    if (currentCases.length === 0) {
      setLoadingCases(true);
      try {
        const data = await fetchRepoCases();
        if (data) {
          setCases(data);
          currentCases = data;
        }
      } finally {
        setLoadingCases(false);
      }
    }

    if (currentCases.length === 0) {
      toast({ title: "Carteira Vazia", description: "Não localizamos processos para auditar.", variant: "destructive" });
      return;
    }

    const targetCases = currentCases.filter(c => !isCasoEncerrado(c));
    let queue: string[] = [];
    
    if (scope === 'critical') {
      queue = targetCases
        .filter(c => ['Vencido', 'Sem Prazo', 'Caso Crítico', 'É Hoje'].includes(c.status))
        .map(c => c.protocolo);
    } else {
      queue = targetCases.map(c => c.protocolo);
    }

    if (queue.length === 0) {
      toast({ 
        title: "Escopo Limpo", 
        description: `Nenhum processo identificado para o filtro selecionado.`,
        variant: "destructive" 
      });
      return;
    }

    toast({ title: "Scanner Iniciado", description: `Processando fila de ${queue.length} registros.` });
    startScan(queue);
  };

  if (isMinimized && status === 'idle') return null;

  if (isMinimized && status !== 'idle') {
    return (
      <div className="fixed bottom-6 right-6 z-[200] animate-in slide-in-from-bottom-4">
        <Button 
          onClick={toggleMinimize} 
          className="h-14 w-14 rounded-full bg-black text-white shadow-2xl border-2 border-primary hover:scale-105 transition-transform"
        >
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
    <div className={cn(
      "fixed bottom-6 right-6 z-[200] w-96 bg-white border-2 border-black shadow-[12px_12px_0px_rgba(0,0,0,0.1)] transition-all animate-in slide-in-from-bottom-4"
    )}>
      <div className="bg-black text-white p-4 flex items-center justify-between border-b-2 border-black">
        <div className="flex items-center gap-3">
          <Zap size={18} className={cn("text-primary", status === 'running' && "animate-pulse")} />
          <h3 className="text-[10px] font-black uppercase tracking-widest">Scanner Omnipresente</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleMinimize} className="h-7 w-7 text-white hover:bg-white/10">
            <ChevronDown size={14} />
          </Button>
          <Button variant="ghost" size="icon" onClick={status === 'done' ? resetScan : cancelScan} className="h-7 w-7 text-white hover:bg-red-600">
            <X size={14} />
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {status === 'idle' ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase text-black/40 tracking-widest">Configuração de Varredura</p>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={scope === 'critical' ? 'default' : 'outline'} 
                  onClick={() => setScope('critical')}
                  className={cn("h-10 text-[9px] font-black uppercase rounded-none border-2 border-black transition-all", scope === 'critical' ? "bg-black text-white" : "bg-white text-black")}
                >
                  Fila Crítica
                </Button>
                <Button 
                  variant={scope === 'all' ? 'default' : 'outline'} 
                  onClick={() => setScope('all')}
                  className={cn("h-10 text-[9px] font-black uppercase rounded-none border-2 border-black transition-all", scope === 'all' ? "bg-black text-white" : "bg-white text-black")}
                >
                  Carteira Total
                </Button>
              </div>
            </div>
            <Button 
              onClick={handleStart} 
              disabled={loadingCases}
              className="w-full h-12 bg-black text-white font-black uppercase text-[10px] shadow-[4px_4px_0px_#00D1FF] hover:shadow-none transition-all"
            >
              {loadingCases ? <Loader2 className="animate-spin mr-2" /> : <Play size={14} className="mr-2" />}
              {loadingCases ? "Sincronizando Dados..." : "Iniciar Auditoria Manual"}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[9px] font-black uppercase text-black/40">Progresso Global</p>
                  <p className="text-xl font-black tabular-nums">{done} / {total}</p>
                </div>
                <Badge className={cn(
                  "font-black uppercase text-[8px] rounded-none px-2",
                  status === 'running' ? "bg-emerald-500" : status === 'done' ? "bg-primary" : "bg-orange-500"
                )}>
                  {status === 'running' ? 'Auditando' : status.toUpperCase()}
                </Badge>
              </div>
              <Progress value={(done / (total || 1)) * 100} className="h-2 border-2 border-black bg-gray-100 [&>div]:bg-black" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 border-2 border-black bg-emerald-50 text-center">
                <p className="text-[7px] font-black uppercase text-emerald-800/40">Encerrados</p>
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

            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase text-black/40 flex items-center gap-2"><History size={10}/> Telemetria Forense</p>
              <ScrollArea className="h-32 border-2 border-black bg-[#fafafa]">
                <div className="p-2 space-y-1">
                  {logs.map((log, i) => (
                    <div key={i} className={cn(
                      "flex items-start gap-2 text-[9px] font-bold uppercase leading-tight p-2 border-b border-black/5",
                      log.encerrado ? "bg-red-50" : log.alerta ? "bg-blue-50" : ""
                    )}>
                      {log.encerrado ? <Gavel size={10} className="text-red-600 shrink-0 mt-0.5" /> : 
                       log.alerta ? <AlertTriangle size={10} className="text-blue-600 shrink-0 mt-0.5" /> : 
                       <CheckCircle2 size={10} className="text-emerald-500 shrink-0 mt-0.5" />}
                      <span className="break-all">{log.message}</span>
                    </div>
                  ))}
                  {logs.length === 0 && <p className="p-4 text-center text-[8px] font-black uppercase opacity-20">Aguardando dados...</p>}
                </div>
              </ScrollArea>
            </div>

            <div className="flex gap-2">
              {status === 'running' ? (
                <Button variant="outline" onClick={pauseScan} className="flex-1 border-2 border-black rounded-none font-black text-[9px] uppercase">
                  <Pause size={12} className="mr-2" /> Pausar
                </Button>
              ) : status === 'paused' ? (
                <Button onClick={resumeScan} className="flex-1 bg-black text-white border-2 border-black rounded-none font-black text-[9px] uppercase">
                  <Play size={12} className="mr-2" /> Retomar
                </Button>
              ) : null}
              
              {(status === 'running' || status === 'paused') && (
                <Button variant="ghost" onClick={cancelScan} className="h-10 w-10 border-2 border-black rounded-none text-red-600 hover:bg-red-50">
                  <Square size={12} fill="currentColor" />
                </Button>
              )}

              {status === 'done' && (
                <Button onClick={resetScan} className="w-full bg-black text-white border-2 border-black rounded-none font-black text-[9px] uppercase shadow-[4px_4px_0px_#22c55e]">
                  Concluir e Fechar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#f8f9fb] border-t-2 border-black p-3 text-center flex items-center justify-center gap-2">
        <ShieldCheck size={12} className="text-primary" />
        <span className="text-[8px] font-black uppercase text-black/30 tracking-widest">Scanner Certificado W1 Capital</span>
      </div>
    </div>
  );
}
