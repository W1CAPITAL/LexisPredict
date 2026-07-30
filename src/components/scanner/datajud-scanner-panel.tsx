"use client";

import React, { useState, useEffect } from 'react';
import { useDataJudScanStore, ScanScope } from '@/store/use-datajud-scan-store';
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
  Gavel,
  AlertTriangle,
  PlayCircle,
  ArrowRightCircle,
  Copy,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { fetchRepoCases, clearDataJudAuditAction } from '@/app/actions/case-actions';

export function DataJudScannerPanel() {
  const { 
    status, total, done, alerts, closed, errors, logs, queue, currentIndex, isAuthPaused,
    isMinimized, toggleMinimize, startScan, pauseScan, resumeScan, resumeInterruptedScan, cancelScan, resetScan, loadProgress 
  } = useDataJudScanStore();
  
  const { cases, setCases } = useAppStore();
  const [loadingCases, setLoadingCases] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    if (!isMinimized && cases.length === 0 && !loadingCases) {
      setLoadingCases(true);
      fetchRepoCases().then(data => {
        if (data) setCases(data);
        setLoadingCases(false);
      }).catch(() => setLoadingCases(false));
    }
  }, [isMinimized, cases.length, loadingCases, setCases]);

  const handleStart = async (scope: ScanScope) => {
    let currentCases = cases;
    
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
      toast({ title: "Carteira Vazia", description: "Não localizamos processos ativos no seu perfil.", variant: "destructive" });
      return;
    }

    // FILTRAGEM INTELIGENTE v400.0
    // Ignora processos já encerrados/arquivados
    const activeCases = currentCases.filter(c => !isCasoEncerrado(c));
    let finalQueue: string[] = [];

    if (scope === 'resume') {
       // Pula os que já possuem andamento identificado ou baixa no tribunal
       finalQueue = activeCases
         .filter(c => !c.datajud_encerrado_tribunal && !c.tem_atualizacao_pos_retorno)
         .map(c => c.protocolo);
    } else if (scope === 'critical') {
       // Apenas os com status de alerta crítico
       finalQueue = activeCases
         .filter(c => ['Vencido', 'Caso Crítico', 'É Hoje'].includes(c.status))
         .map(c => c.protocolo);
    } else {
       // Lote integral: Ordena por data de consulta (antigos/null primeiro)
       finalQueue = [...activeCases]
         .sort((a, b) => {
           const dateA = a.datajud_consultado_em ? new Date(a.datajud_consultado_em).getTime() : 0;
           const dateB = b.datajud_consultado_em ? new Date(b.datajud_consultado_em).getTime() : 0;
           return dateA - dateB;
         })
         .map(c => c.protocolo);
    }

    if (finalQueue.length === 0) {
      toast({ title: "Escopo Limpo", description: "Nenhum processo ativo pendente de auditoria.", variant: "destructive" });
      return;
    }

    toast({ title: "Iniciando Varredura", description: `${finalQueue.length} registros em triagem neural.` });
    startScan(finalQueue, scope);
  };

  const handleRestartFull = () => {
    if (confirm("Deseja descartar o progresso atual e iniciar uma nova varredura de toda a carteira ativa?")) {
      resetScan();
      handleStart('full');
    }
  };

  const handleCopyLogs = () => {
    if (logs.length === 0) return;
    const text = logs.map(l => `[${l.protocolo}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: "Log Copiado", description: "Histórico na área de transferência." });
  };

  const handleClearAudit = async () => {
    if (!confirm("Isso zerará os alertas de novos andamentos e baixas detectadas. Continuar?")) return;
    
    setIsClearing(true);
    try {
      const res = await clearDataJudAuditAction();
      if (res.success) {
        localStorage.removeItem('lexis_datajud_scan_v1');
        window.location.reload();
      }
    } finally {
      setIsClearing(false);
    }
  };

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
    <div className={cn("fixed bottom-6 right-6 z-[200] w-96 bg-white border-2 border-black shadow-[12px_12px_0px_rgba(0,0,0,0.1)] transition-all animate-in slide-in-from-bottom-4")}>
      <div className="bg-black text-white p-4 flex items-center justify-between border-b-2 border-black">
        <div className="flex items-center gap-3">
          <Zap size={18} className={cn("text-primary", status === 'running' && "animate-pulse")} />
          <h3 className="text-[10px] font-black uppercase tracking-widest">Scanner Omnipresente</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleMinimize} className="h-7 w-7 text-white hover:bg-white/10"><ChevronDown size={14} /></Button>
          <Button variant="ghost" size="icon" onClick={resetScan} className="h-7 w-7 text-white hover:bg-red-600"><X size={14} /></Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {status === 'idle' ? (
          <div className="space-y-4">
            <p className="text-[9px] font-black uppercase text-black/40 tracking-widest">Opções de Varredura Elite</p>
            
            <div className="grid grid-cols-1 gap-2">
              {queue.length > 0 && currentIndex < queue.length && (
                <Button onClick={resumeInterruptedScan} className="h-14 bg-emerald-600 text-white font-black uppercase text-[10px] justify-start px-6 rounded-none border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-none transition-all mb-4 animate-pulse">
                  <ArrowRightCircle size={18} className="mr-3" /> Continuar Fila ({done} / {total})
                </Button>
              )}

              <Button onClick={() => handleStart('resume')} disabled={loadingCases || isClearing} className="h-12 bg-black text-white font-black uppercase text-[10px] justify-start px-6 rounded-none border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-none transition-all">
                <PlayCircle size={16} className="mr-3 text-primary" /> Retomar Auditoria (Inteligente)
              </Button>
              
              <Button onClick={handleRestartFull} disabled={loadingCases || isClearing} variant="outline" className="h-12 border-2 border-black font-black uppercase text-[10px] justify-start px-6 rounded-none shadow-[4px_4px_0px_#22c55e] hover:shadow-none transition-all bg-emerald-50/30">
                <RotateCcw size={16} className="mr-3 text-emerald-600" /> Varredura Lote Integral
              </Button>

              <div className="pt-4 border-t border-black/10 mt-2 space-y-2">
                <Button onClick={handleClearAudit} disabled={isClearing || loadingCases} variant="outline" className="w-full h-10 border-2 border-red-600/20 text-red-600 font-black uppercase text-[9px] rounded-none hover:bg-red-50 hover:border-red-600 transition-all">
                  {isClearing ? <Loader2 className="animate-spin mr-2" /> : <Trash2 size={14} className="mr-2" />} Limpar Auditoria
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[9px] font-black uppercase text-black/40">Progresso do Lote</p>
                  <p className="text-xl font-black tabular-nums">{done} / {total}</p>
                </div>
                <Badge className={cn(
                  "font-black uppercase text-[8px] rounded-none px-2", 
                  status === 'running' ? "bg-emerald-500" : 
                  status === 'done' ? "bg-primary" : 
                  isAuthPaused ? "bg-red-600 animate-pulse" : "bg-orange-500"
                )}>
                  {status === 'running' ? 'Triagem Ativa' : 
                   status === 'done' ? 'Auditado' : 
                   isAuthPaused ? 'Sessão Expirada' : 'Pausado'}
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase text-black/40 flex items-center gap-2"><History size={10}/> Telemetria Forense</p>
                <Button variant="ghost" size="sm" onClick={handleCopyLogs} className="h-6 px-2 text-[8px] font-black uppercase hover:bg-black hover:text-white transition-all">
                  <Copy size={10} className="mr-1" /> Copiar Log
                </Button>
              </div>
              <ScrollArea className="h-32 border-2 border-black bg-[#fafafa]">
                <div className="p-2 space-y-1">
                  {logs.map((log, i) => (
                    <div key={i} className={cn("flex items-start gap-2 text-[9px] font-bold uppercase leading-tight p-2 border-b border-black/5", log.encerrado ? "bg-red-50" : log.alerta ? "bg-blue-50" : "")}>
                      {log.encerrado ? <Gavel size={10} className="text-red-600 shrink-0 mt-0.5" /> : 
                       log.alerta ? <AlertTriangle size={10} className="text-blue-600 shrink-0 mt-0.5" /> : 
                       <CheckCircle2 size={10} className="text-emerald-500 shrink-0 mt-0.5" />}
                      <span className="break-all font-mono">{log.protocolo}: {log.message}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex gap-2">
              {status === 'running' ? (
                <Button variant="outline" onClick={pauseScan} className="flex-1 border-2 border-black rounded-none font-black text-[9px] uppercase"><Pause size={12} className="mr-2" /> Pausar</Button>
              ) : status === 'paused' ? (
                <Button onClick={resumeScan} className="flex-1 bg-black text-white border-2 border-black rounded-none font-black text-[9px] uppercase"><Play size={12} className="mr-2" /> Retomar</Button>
              ) : null}
              
              {(status === 'running' || status === 'paused') && (
                <Button variant="ghost" onClick={cancelScan} title="Cancelar" className="h-10 w-10 border-2 border-black rounded-none text-red-600 hover:bg-red-50"><Square size={12} fill="currentColor" /></Button>
              )}

              {status === 'done' && (
                <Button onClick={resetScan} className="w-full bg-black text-white border-2 border-black rounded-none font-black text-[9px] uppercase shadow-[4px_4px_0px_#22c55e]">Concluir</Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
