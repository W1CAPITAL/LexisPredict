"use client";

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */

import React from 'react';
import { useDataJudScanStore, ScanLog } from '@/store/use-datajud-scan-store';
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
  AlertCircle,
  Search,
  Monitor,
  Globe,
  Settings2,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/responsive-ui';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';
import { APP_VERSION } from '@/lib/app-changelog';
import { usePlano } from '@/hooks/use-plano';
import { useAdmin } from '@/hooks/use-admin';
import { planTemScanner } from '@/lib/planos-pacotes';

export function DataJudScannerPanel() {
  const { 
    status, total, done, alerts, cloudDjenAlerts, closed, pending, cycles,
    manualStatus, manualTotal, manualDone, manualAlerts, manualClosed, manualErrors, manualDjenAlerts, lastLogs,
    isMinimized, toggleMinimize, startCloudScan, pauseCloudScan, 
    startManualScan, resumeManualScan, pauseManualScan, resetScan,
    scanMode, setScanMode,
    claudeAiEnabled, setClaudeAiEnabled
  } = useDataJudScanStore();
  const { isSuperAdmin, canScan: canScanRole } = useAdmin();
  const { plan, isLocked, isBlocked, isExpired } = usePlano();
  const allowedByPlan = isSuperAdmin || planTemScanner(plan);
  const allowed = canScanRole && allowedByPlan && !isLocked;

  React.useEffect(() => {
    if (!allowed && (status === 'running' || manualStatus === 'running')) {
      try { pauseCloudScan(); } catch { /* */ }
      try { pauseManualScan(); } catch { /* */ }
    }
  }, [allowed, status, manualStatus, pauseCloudScan, pauseManualScan]);
  
  const isManualRunning = manualStatus === 'running';
  const cloudPct = Math.round((done / (total || 1)) * 100);
  const manualPct = Math.round((manualDone / (manualTotal || 1)) * 100);

  if (!allowed) {
    if (isMinimized || (status === 'idle' && manualStatus === 'idle')) return null;
    return (
      <div className="fixed bottom-6 right-6 z-[200] w-[360px] rounded-2xl border-2 border-red-500/40 bg-card p-4 shadow-2xl space-y-2">
        <div className="flex items-center gap-2 text-red-600">
          <Lock size={16} />
          <p className="text-[10px] font-black uppercase tracking-widest">Scanner indisponível</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {isLocked
            ? (isBlocked ? 'Empresa bloqueada — scanner desligado.' : 'Plano expirado — scanner desligado.')
            : !allowedByPlan
              ? `Plano ${String(plan).toUpperCase()} não inclui tribunal/scanner. Use Operacional ou Máximo.`
              : 'Sem permissão para escanear.'}
        </p>
        <Button size="sm" variant="outline" className="w-full text-[10px] font-black uppercase" onClick={resetScan}>
          Fechar
        </Button>
      </div>
    );
  }

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
    <div className={cn(
      "fixed bottom-6 right-6 z-[200] w-[450px] bg-white border-2 border-black shadow-[20px_20px_0px_rgba(0,0,0,0.1)] transition-all animate-in slide-in-from-bottom-4 flex flex-col h-[85vh]",
      ui.scanner
    )}>
      <div className="bg-black text-white p-4 flex items-center justify-between border-b-2 border-black shrink-0">
        <div className="flex items-center gap-3">
          <Zap size={18} className={cn("text-primary", (status === 'running' || manualStatus === 'running') && "animate-pulse")} />
          <h3 className="text-[10px] font-black uppercase tracking-widest">Scanner Omnipresente v9.6</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleMinimize} className="h-7 w-7 text-white hover:bg-white/10"><ChevronDown size={14} /></Button>
          <Button variant="ghost" size="icon" onClick={resetScan} className="h-7 w-7 text-white hover:bg-red-600"><X size={14} /></Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">
          {/* SELEÇÃO DE MODO */}
          <section className="p-5 bg-[#f8f9fb] border-2 border-black/5 space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <Settings2 size={14} className="text-primary" />
                <p className="text-[10px] font-black uppercase tracking-widest">Modo de Operação</p>
             </div>
             <RadioGroup 
                value={scanMode} 
                onValueChange={(val: any) => setScanMode(val)}
                className="grid grid-cols-1 gap-2"
                disabled={manualStatus === 'running' || status === 'running'}
             >
                <div className="flex items-center space-x-3 p-3 bg-white border border-black/5 hover:border-black transition-all cursor-pointer rounded-sm">
                   <RadioGroupItem value="datajud" id="mode-dj" className="border-black" />
                   <Label htmlFor="mode-dj" className="flex-1 cursor-pointer">
                      <p className="text-[10px] font-black uppercase">Somente Tribunal (DataJud)</p>
                      <p className="text-[8px] font-bold text-black/40 uppercase">Varredura de movimentos e prazos.</p>
                   </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-white border border-black/5 hover:border-black transition-all cursor-pointer rounded-sm">
                   <RadioGroupItem value="djen" id="mode-djen" className="border-black" />
                   <Label htmlFor="mode-djen" className="flex-1 cursor-pointer">
                      <p className="text-[10px] font-black uppercase">Somente Diário (DJEN)</p>
                      <p className="text-[8px] font-bold text-black/40 uppercase">Vigilância de publicações oficiais (24h).</p>
                   </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-white border border-black/5 hover:border-black transition-all cursor-pointer rounded-sm">
                   <RadioGroupItem value="both" id="mode-both" className="border-black" />
                   <Label htmlFor="mode-both" className="flex-1 cursor-pointer">
                      <p className="text-[10px] font-black uppercase">Híbrido (Sequencial)</p>
                      <p className="text-[8px] font-bold text-black/40 uppercase">Auditoria unificada 3D em cada CNJ.</p>
                   </Label>
                </div>
             </RadioGroup>
          </section>

          <section className="p-5 bg-violet-50 border-2 border-violet-600/30 space-y-3">
             <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-900">Claude AI (OmniRoute)</p>
                  <p className="text-[8px] font-bold text-violet-700/80 uppercase mt-1">
                    Análise neural de flags · só após ativar
                  </p>
                </div>
                <Button
                  type="button"
                  variant={claudeAiEnabled ? "default" : "outline"}
                  onClick={() => setClaudeAiEnabled(!claudeAiEnabled)}
                  disabled={manualStatus === 'running' || status === 'running'}
                  className={cn(
                    "h-10 px-4 font-black uppercase text-[9px] tracking-widest",
                    claudeAiEnabled ? "bg-violet-700 text-white hover:bg-violet-800" : "border-violet-400 text-violet-800"
                  )}
                >
                  {claudeAiEnabled ? "Claude ON" : "Ativar Claude AI"}
                </Button>
             </div>
             {claudeAiEnabled ? (
               <p className="text-[9px] font-bold text-violet-900">
                 Nos logs: Claude AI trabalhando + o que encontrou (encerrado, cumprimento, mérito, BA, custas, prioridade).
               </p>
             ) : (
               <p className="text-[9px] font-bold text-muted-foreground">
                 Desligado: só DataJud/DJEN. Ative Claude AI antes da varredura local.
               </p>
             )}
          </section>

          {/* ENGINE 1: CLOUD AUDIT (DATAJUD + DJEN) */}
          <section className="p-5 bg-slate-50 border-2 border-black/5 space-y-6">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <CloudLightning className={cn("text-primary", status === 'running' && "animate-pulse")} size={16} />
                   <p className="text-[10px] font-black uppercase">Ciclo de Nuvem (Hybrid Audit)</p>
                </div>
             </div>
             
             {status === 'idle' ? (
               <div className="space-y-4">
                  <p className="text-[9px] font-bold uppercase text-black/40 leading-relaxed">
                    Auditoria assíncrona 3D via servidor. Agora varre Tribunal + DJEN simultaneamente.
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
                  
                  <div className="grid grid-cols-2 gap-2">
                    <DashboardMiniKpi label="Tribunal Alertas" value={alerts} color="text-red-600" />
                    <DashboardMiniKpi label="DJEN Alertas" value={cloudDjenAlerts} color="text-blue-600" />
                    <DashboardMiniKpi label="Sucessos" value={done} color="text-emerald-600" />
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
                <p className="text-[10px] font-black uppercase">Scanner Local ({scanMode.toUpperCase()})</p>
             </div>

             {manualStatus === 'idle' ? (
               <div className="space-y-4">
                  <p className="text-[9px] font-bold uppercase text-black/40 leading-relaxed">
                    Varredura imediata baseada no modo selecionado. Ideal para triagem de urgência na tela.
                  </p>
                  <Button
                    onClick={() => {
                      void startManualScan();
                    }}
                    disabled={false}
                    className="w-full h-11 bg-white text-black font-black uppercase text-[10px] rounded-none border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-none transition-all"
                  >
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
                    <DashboardMiniKpi label="Dj. Alertas" value={manualAlerts} color="text-red-600" />
                    <DashboardMiniKpi label="DJEN Alertas" value={manualDjenAlerts} color="text-blue-600" />
                    <DashboardMiniKpi label="Concluídos" value={manualDone} color="text-emerald-600" />
                  </div>

                  <div className="flex gap-2">
                    {manualStatus === 'running' ? (
                      <Button variant="outline" onClick={pauseManualScan} className="flex-1 border-2 border-black rounded-none font-black text-[9px] uppercase h-10"><Pause size={12} className="mr-2" /> Pausar</Button>
                    ) : (
                      <Button onClick={() => void resumeManualScan()} className="flex-1 bg-black text-white border-2 border-black rounded-none font-black text-[9px] uppercase h-10"><Play size={12} className="mr-2" /> Retomar de onde parou</Button>
                    )}
                  </div>
               </div>
             )}
          </section>

          {/* SHARED LOG FEED */}
          <section className="space-y-4 pb-10">
             <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 opacity-40">
                   <Monitor size={14} />
                   <h4 className="text-[9px] font-black uppercase tracking-widest">Feed de Auditoria Unificado</h4>
                </div>
                <Badge variant="outline" className="text-[7px] font-black uppercase border-black/10">Sessão</Badge>
             </div>
             
             <div className="bg-black/5 p-4 rounded-none space-y-3 min-h-[250px]">
                {lastLogs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white border-b-2 border-black/5 hover:border-black transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                       <LogTypeIcon type={log.type} />
                       <div className="min-w-0">
                          <p className={cn("text-[10px] font-black uppercase text-black truncate max-w-[180px]", ui.cnj)}>{log.protocolo}</p>
                          <div className="flex items-center gap-2">
                             <Badge className={cn(
                               "text-[7px] font-black uppercase px-1 py-0 border-none",
                               log.source === 'Claude' ? "bg-violet-600 text-white" :
                               log.engine === 'Local' ? "bg-slate-200 text-slate-700" : "bg-blue-600 text-white"
                             )}>{log.source === 'Claude' ? 'Claude AI' : log.engine}</Badge>
                             <span className={cn(
                               "text-[8px] font-bold uppercase truncate max-w-[220px]",
                               log.source === 'Claude' || log.type === 'ai' ? "text-violet-800" : "text-black/40"
                             )}>
                               {log.message}
                             </span>
                          </div>
                       </div>
                    </div>
                    <div className="text-right shrink-0">
                       <p className="text-[8px] font-mono text-black/30 group-hover:text-black transition-colors">{log.latency}ms</p>
                    </div>
                  </div>
                ))}
                {lastLogs.length === 0 && (
                  <div className="py-16 flex flex-col items-center justify-center opacity-40 space-y-3">
                     <Search size={28} />
                     <p className="text-[9px] font-black uppercase tracking-widest text-center px-4">
                       {manualStatus === 'running'
                         ? 'Varredura em curso — os logs aparecem a cada CNJ'
                         : 'Aguardando telemetria — inicie a varredura local ou de nuvem'}
                     </p>
                     {manualStatus === 'paused' && (
                       <p className="text-[8px] font-bold uppercase text-amber-700">Pausado — use Retomar de onde parou</p>
                     )}
                  </div>
                )}
             </div>
          </section>
        </div>
      </ScrollArea>
      
      <div className="p-3 bg-black text-white text-[8px] font-black uppercase text-center border-t-2 border-black shrink-0 flex items-center justify-center gap-4">
        <span>{`Authority System · app v${APP_VERSION}`}</span>
        <div className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Rede Ativa</div>
      </div>
    </div>
  );
}

function LogTypeIcon({ type }: { type: ScanLog['type'] }) {
  switch (type) {
    case 'closed': return <Gavel size={14} className="text-emerald-600 shrink-0" />;
    case 'update': return <Zap size={14} className="text-blue-600 shrink-0" />;
    case 'ai': return <CloudLightning size={14} className="text-violet-600 shrink-0" />;
    case 'error': return <AlertCircle size={14} className="text-red-600 shrink-0" />;
    default: return <CheckCircle2 size={14} className="text-slate-400 shrink-0" />;
  }
}

function DashboardMiniKpi({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="p-2 border-2 border-black bg-white text-center">
      <p className="text-[7px] font-black uppercase text-black/40">{label}</p>
      <p className={cn("text-sm font-black tabular-nums", color)}>{value}</p>
    </div>
  );
}
