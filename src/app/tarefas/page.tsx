/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  CheckCircle, 
  RefreshCcw, 
  Phone, 
  ShieldAlert, 
  Clock, 
  ChevronRight, 
  Search,
  ExternalLink,
  MessageCircle,
  Copyright,
  CalendarDays,
  Target,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Settings2,
  Plus,
  Minus,
  Zap,
  UserCheck,
  CheckCircle2,
  Loader2,
  FileText,
  Calendar,
  Archive,
  PlayCircle,
  Sparkles,
  Gavel,
  User,
  Building2,
  Filter,
  FileSearch,
  History,
  MessageSquareQuote,
  MessageSquare,
  Copy,
  EyeOff,
  BookOpen,
  Globe,
  Info,
  AlertTriangle,
  Bell,
  Bot,
  Download
} from 'lucide-react';
import { LegalCase, processarCaso, formatDateToISO } from '@/lib/case-logic';
import { cn, formatWhatsAppLink } from '@/lib/utils';
import { ui } from '@/lib/responsive-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { fetchRepoCases, syncRepoCases, scanSingleCaseAction, scanOneDjenAction } from '@/app/actions/case-actions';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, startOfDay, differenceInDays, isAfter, isValid, parse } from 'date-fns';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { calcularProbabilidadeEncerramento } from '@/lib/probabilidade-encerramento';
import { suggestScripts, ScriptSuggestion } from '@/lib/script-processual/suggest';
import { gerarRascunhoEstrategico } from '@/ai/motor-despacho';
import { useAuth } from '@/components/auth/auth-provider';
import { summarizeDjenForAlert } from '@/lib/djen';
import { Checkbox } from '@/components/ui/checkbox';
import { generateDjenPublicationPDFAction } from '@/app/actions/document-actions';

interface TaskGroup {
  cliente: string;
  vencidos: number;
  hoje: number;
  totalAtivos: number;
  diasAtrasoMax: number;
  protocoloReferencia: string;
  telefone: string;
  advogado: string;
  escritorio: string;
  cases: LegalCase[];
  hasBA: boolean;
  hasClosedCourt: boolean;
  hasUpdate: boolean;
  hasDjen: boolean;
  statusScore: number;
  oldestReturnGap: number;
  lastMovementName?: string | null;
  lastMovementDate?: string | null;
  djenResumo?: string | null;
  lastDjenDate?: string | null;
}

export default function TarefasPage() {
  const [mounted, setMounted] = useState(false);
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [dailyMeta, setDailyMeta] = useState(25);
  const [contatadosHoje, setContatadosHoje] = useState<string[]>([]);
  const [showBacklog, setShowBacklog] = useState(false);
  
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [activeGroup, setActiveGroup] = useState<TaskGroup | null>(null);
  const [attendanceForm, setAttendanceForm] = useState({
    observacao: '',
    proximoRetorno: '',
    situacao: 'EM ANDAMENTO',
    applyToAll: true
  });

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyResult, setHistoryResult] = useState<{ case: LegalCase, movimentos: any[], djenComunicacoes?: any[] } | null>(null);
  const [suggestedScripts, setSuggestedScripts] = useState<ScriptSuggestion[]>([]);
  const [showScripts, setShowScripts] = useState(false);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [isGeneratingAIDraft, setIsGeneratingAIDraft] = useState(false);
  const [selectedMotor, setSelectedMotor] = useState<string>('local_only');

  const { profile } = useAuth();
  const { toast } = useToast();

  const getTodayKey = () => {
    const today = new Date().toISOString().split('T')[0];
    return `lexis_tarefas_contatados_${today}`;
  };

  useEffect(() => {
    setMounted(true);
    const savedMeta = localStorage.getItem('lexis_tarefas_meta');
    if (savedMeta) {
      const parsed = parseInt(savedMeta);
      if (!isNaN(parsed)) setDailyMeta(parsed);
    }

    const savedContatados = localStorage.getItem(getTodayKey());
    if (savedContatados) {
      try {
        setContatadosHoje(JSON.parse(savedContatados));
      } catch (e) {
        setContatadosHoje([]);
      }
    }
  }, []);

  const adjustMeta = (amount: number) => {
    const newVal = Math.max(10, Math.min(100, dailyMeta + amount));
    setDailyMeta(newVal);
    localStorage.setItem('lexis_tarefas_meta', newVal.toString());
    toast({ title: `Meta atualizada: ${newVal} contatos`, duration: 1500 });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRepoCases();
      if (Array.isArray(data)) setCases(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) loadData();
  }, [loadData, mounted]);

  const handleSingleScan = async (protocolo: string) => {
    setLoading(true);
    try {
      // Auditoria Unificada: DataJud + DJEN Automática
      const [resDj, resDjen] = await Promise.all([
        scanSingleCaseAction(protocolo),
        scanOneDjenAction(protocolo)
      ]);

      if (resDj.success || resDjen.success) {
        setHistoryResult({ 
          case: resDj.case || cases.find(c => c.protocolo === protocolo)!, 
          movimentos: resDj.movimentos || [],
          djenComunicacoes: resDjen.comunicacoes || []
        });
        setIsHistoryModalOpen(true);
        setShowScripts(false);
        setSuggestedScripts([]);
        setAiDraft(null);
        
        if (resDj.case) setCases(prev => prev.map(c => c.protocolo === protocolo ? resDj.case! : c));
      } else {
        toast({ title: "Andamento não localizado", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestClick = async (protocolo: string, cliente: string, ultimoRetorno: string | null) => {
    setLoading(true);
    try {
      const [resDj, resDjen] = await Promise.all([
        scanSingleCaseAction(protocolo),
        scanOneDjenAction(protocolo)
      ]);

      if (resDj.success && resDj.case) {
        const moves = resDj.movimentos || [];
        const djenComs = resDjen.comunicacoes || [];
        setHistoryResult({ case: resDj.case, movimentos: moves, djenComunicacoes: djenComs });
        setAiDraft(null);
        
        const suggestions = suggestScripts({
          clienteNome: cliente,
          protocolo: protocolo,
          ultimoRetorno: ultimoRetorno,
          movimentos: moves
        });
        
        setSuggestedScripts(suggestions);
        setShowScripts(true);
        setIsHistoryModalOpen(true);
        
        setCases(prev => prev.map(c => c.protocolo === protocolo ? resDj.case! : c));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportDjenPDF = async (item: any) => {
    if (!historyResult) return;
    toast({ title: "Gerando PDF", description: "Selando publicação oficial..." });
    const res = await generateDjenPublicationPDFAction({
      titulo: summarizeDjenForAlert(item.texto, item.tipoComunicacao),
      protocolo: historyResult.case.protocolo,
      data: item.data_disponibilizacao ? new Date(item.data_disponibilizacao).toLocaleDateString() : 'S/D',
      orgao: item.nomeOrgao,
      tipo: item.tipoComunicacao,
      texto: item.texto
    });
    if (res.success && res.base64) {
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${res.base64}`;
      link.download = `Djen_${historyResult.case.protocolo}_${Date.now()}.pdf`;
      link.click();
    }
  };

  const handleGenerateAIDraft = async () => {
    if (!historyResult || isGeneratingAIDraft) return;
    
    setIsGeneratingAIDraft(true);
    setAiDraft(null);
    try {
      const res = await gerarRascunhoEstrategico({
        clienteNome: historyResult.case.cliente,
        protocolo: historyResult.case.protocolo,
        ultimoRetorno: historyResult.case.ultimoRetorno,
        movimentos: historyResult.movimentos,
        preferredModel: selectedMotor,
        empresaId: profile?.empresa_id
      });
      
      if (res.rascunho) {
        setAiDraft(res.rascunho);
        toast({ title: selectedMotor === 'local_only' ? "Rascunho Local Gerado" : "Rascunho Motor Lexis Gerado" });
      }
    } catch (e) {
      toast({ title: "Falha no Motor Lexis", variant: "destructive" });
    } finally {
      setIsGeneratingAIDraft(false);
    }
  };

  const copyScript = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado para o Clipboard", description: "Revise antes de enviar." });
  };

  const taskData = useMemo(() => {
    const groups: Record<string, TaskGroup> = {};
    const contactedSet = new Set(contatadosHoje);
    const today = startOfDay(new Date());

    const activeCases = cases.filter(c => !isCasoEncerrado(c));

    activeCases.forEach(c => {
      const nome = c.cliente || 'NÃO IDENTIFICADO';
      if (!groups[nome]) {
        groups[nome] = {
          cliente: nome,
          vencidos: 0,
          hoje: 0,
          totalAtivos: 0,
          diasAtrasoMax: 0,
          protocoloReferencia: c.protocolo,
          telefone: c.telefone || '',
          advogado: c.advogado || 'NÃO ATRIBUÍDO',
          escritorio: c.escritorio || '',
          cases: [],
          hasBA: false,
          hasClosedCourt: false,
          hasUpdate: false,
          hasDjen: false,
          statusScore: 0,
          oldestReturnGap: 0,
          lastMovementName: c.datajud_ultimo_nome,
          lastMovementDate: c.datajud_ultimo_movimento,
          djenResumo: null,
          lastDjenDate: null
        };
      }

      const g = groups[nome];
      g.totalAtivos++;
      g.cases.push(c);

      if (c.datajud_ultimo_movimento) {
        const currentLatest = g.lastMovementDate ? new Date(g.lastMovementDate).getTime() : 0;
        const caseLatest = new Date(c.datajud_ultimo_movimento).getTime();
        if (caseLatest > currentLatest) {
          g.lastMovementDate = c.datajud_ultimo_movimento;
          g.lastMovementName = c.datajud_ultimo_nome;
          g.protocoloReferencia = c.protocolo;
        }
      }

      if (c.indicio_busca_apreensao) g.hasBA = true;
      if (c.datajud_encerrado_tribunal) g.hasClosedCourt = true;
      if (c.tem_atualizacao_pos_retorno) g.hasUpdate = true;
      if (c.djen_nova_comunicacao) g.hasDjen = true;

      if (c.djen_ultimo_resumo) {
        const isBetter = !g.djenResumo || 
          (c.djen_ultima_data && g.lastDjenDate && isAfter(parseISO(c.djen_ultima_data), parseISO(g.lastDjenDate))) ||
          (c.djen_nova_comunicacao && !g.lastDjenDate);
          
        if (isBetter) {
          g.djenResumo = c.djen_ultimo_resumo;
          g.lastDjenDate = c.djen_ultima_data;
        }
      }

      let currentScore = 0;
      const statusUpper = (c.status || '').toUpperCase();
      if (statusUpper.includes('CRÍTICO')) currentScore = 50;
      else if (statusUpper === 'VENCIDO') currentScore = 40;
      else if (statusUpper === 'É HOJE') currentScore = 30;
      else if (statusUpper === 'ATENÇÃO') currentScore = 20;
      else if (statusUpper === 'SEM PRAZO') currentScore = 10;
      
      if (currentScore > g.statusScore) g.statusScore = currentScore;

      if (statusUpper === 'VENCIDO' || statusUpper.includes('CRÍTICO')) {
        g.vencidos++;
        const atraso = c.diasFaltando ? Math.abs(c.diasFaltando) : 0;
        if (atraso > g.diasAtrasoMax) g.diasAtrasoMax = atraso;
      }
      if (statusUpper === 'É HOJE') g.hoje++;

      const isoRetorno = formatDateToISO(c.ultimoRetorno);
      if (isoRetorno) {
        const gap = differenceInDays(today, startOfDay(parseISO(isoRetorno)));
        if (gap > g.oldestReturnGap) g.oldestReturnGap = gap;
      } else {
        if (365 > g.oldestReturnGap) g.oldestReturnGap = 365;
      }
    });

    const sortedAll = Object.values(groups)
      .filter(g => {
        const matchesSearch = g.cliente.toLowerCase().includes(search.toLowerCase()) || g.protocoloReferencia.includes(search);
        const matchesOffice = officeFilter === 'all' || g.escritorio === officeFilter;
        return matchesSearch && matchesOffice;
      })
      .sort((a, b) => {
        if (a.hasBA !== b.hasBA) return a.hasBA ? -1 : 1;
        if (a.hasClosedCourt !== b.hasClosedCourt) return a.hasClosedCourt ? -1 : 1;
        if (a.hasDjen !== b.hasDjen) return a.hasDjen ? -1 : 1;
        if (a.hasUpdate !== b.hasUpdate) return a.hasUpdate ? -1 : 1;
        if (b.statusScore !== a.statusScore) return b.statusScore - a.statusScore;
        if (b.oldestReturnGap !== a.oldestReturnGap) return b.oldestReturnGap - a.oldestReturnGap;
        return b.totalAtivos - a.totalAtivos;
      });

    const pending = sortedAll.filter(g => !contactedSet.has(g.cliente));
    const done = sortedAll.filter(g => contactedSet.has(g.cliente));

    return { focus: pending.slice(0, dailyMeta), backlog: pending.slice(dailyMeta), completed: done, totalPendingCount: pending.length };
  }, [cases, search, officeFilter, contatadosHoje, dailyMeta]);

  const openAttendance = (group: TaskGroup) => {
    setActiveGroup(group);
    setAttendanceForm({ observacao: '', proximoRetorno: '', situacao: 'EM ANDAMENTO', applyToAll: true });
    setIsAttendanceOpen(true);
  };

  const handleSaveAttendance = async () => {
    if (!activeGroup || isSavingAttendance) return;
    setIsSavingAttendance(true);

    try {
      const todayDate = new Date();
      const todayStr = format(todayDate, 'dd/MM/yyyy');
      const savedThreshold = localStorage.getItem('lexisPredict_urgency_alert');
      const thresholds = { alertLimit: savedThreshold ? parseInt(savedThreshold) : 3 };

      const updatedCases = cases.map(c => {
        const isMatch = attendanceForm.applyToAll ? c.cliente === activeGroup.cliente : activeGroup.cases.some(ac => ac.protocolo === c.protocolo);

        if (isMatch) {
          let newFlagStatus = c.tem_atualizacao_pos_retorno;
          if (c.datajud_ultimo_movimento) {
            const lastMovDate = startOfDay(parseISO(c.datajud_ultimo_movimento));
            const returnDate = startOfDay(todayDate);
            if (!isAfter(lastMovDate, returnDate)) newFlagStatus = false;
          } else {
            newFlagStatus = false;
          }

          const newCaseData = {
            ...c,
            situacao: attendanceForm.situacao,
            ultimoRetorno: todayStr,
            observacao: attendanceForm.observacao || c.observacao,
            proximoPrazo: attendanceForm.situacao === 'ENCERRADO' ? '' : (attendanceForm.proximoRetorno || c.proximoPrazo),
            statusManual: 'Automatico',
            tem_atualizacao_pos_retorno: newFlagStatus,
            djen_nova_comunicacao: false
          };
          return processarCaso(newCaseData, thresholds);
        }
        return c;
      });

      const result = await syncRepoCases(updatedCases);
      if (result.success) {
        setCases(updatedCases);
        const updatedContatados = Array.from(new Set([...contatadosHoje, activeGroup.cliente]));
        setContatadosHoje(updatedContatados);
        localStorage.setItem(getTodayKey(), JSON.stringify(updatedContatados));
        setIsAttendanceOpen(false);
        setActiveGroup(null);
        toast({ title: "Atendimento Sincronizado" });
      }
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const unifiedHistory = useMemo(() => {
    if (!historyResult) return [];
    
    const movs = (historyResult.movimentos || []).map(m => ({
      type: 'court',
      date: m.dataHora ? new Date(m.dataHora) : new Date(0),
      title: m.nome,
      subtitle: m.complemento || '',
      raw: m
    }));

    const djen = (historyResult.djenComunicacoes || []).map(d => ({
      type: 'djen',
      date: d.data_disponibilizacao ? new Date(d.data_disponibilizacao) : new Date(0),
      title: summarizeDjenForAlert(d.texto || "", d.tipoComunicacao || ""),
      subtitle: d.nomeOrgao || '',
      raw: d
    }));

    return [...movs, ...djen].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [historyResult]);

  if (!mounted) return null;

  const offices = Array.from(new Set(cases.map(c => c.escritorio))).filter(Boolean).sort();

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className={cn("flex-1 flex flex-col h-screen overflow-hidden", ui.main)}>
        <header className="h-auto border-b border-border/50 bg-card/60 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:px-10 gap-4 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-black text-white rounded-lg shadow-lg">
              <CheckCircle size={20} className="text-primary" />
            </div>
            <div>
               <h1 className="font-black text-base sm:text-xl text-foreground uppercase tracking-tight">Fila Crítica de Contato</h1>
               <p className="hidden sm:block text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">Priorização DataJud · DJEN · Carência</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="h-9 px-4 border-none bg-primary/5 text-primary font-black uppercase text-[10px]">Vigilância 3D Ativa</Badge>
            <Button variant="ghost" size="icon" onClick={loadData} className="h-10 w-10 rounded-xl hover:bg-secondary">
              <RefreshCcw className={cn("w-5 h-5", loading && "animate-spin text-primary")} />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-10 max-w-[1400px] mx-auto w-full space-y-10 pb-32">
          <section className={ui.metrics}>
            <div className="premium-card p-6 border-l-4 border-l-slate-400">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Fila em Aberto</p>
              <h3 className="text-3xl font-black text-foreground tabular-nums">{taskData.totalPendingCount}</h3>
            </div>
            <div className="premium-card p-6 border-l-4 border-l-primary relative group">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Meta do Dia</p>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-black text-foreground tabular-nums">{dailyMeta}</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <Button variant="outline" size="icon" onClick={() => adjustMeta(-5)} className="h-8 w-8"><Minus size={14} /></Button>
                  <Button variant="outline" size="icon" onClick={() => adjustMeta(5)} className="h-8 w-8"><Plus size={14} /></Button>
                </div>
              </div>
            </div>
            <div className="premium-card p-6 border-l-4 border-l-emerald-500">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Contatados Hoje</p>
              <h3 className="text-3xl font-black text-emerald-600 tabular-nums">{contatadosHoje.length}</h3>
            </div>
            <div className="premium-card p-6 border-l-4 border-l-orange-400">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Foco Imediato</p>
              <h3 className="text-3xl font-black text-orange-600 tabular-nums">{Math.min(dailyMeta, taskData.focus.length)}</h3>
            </div>
          </section>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white border border-border/50 p-4 sm:p-6 rounded-2xl shadow-sm">
             <div className="relative flex-1 w-full flex flex-col md:flex-row gap-4">
               <div className="relative flex-1">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                 <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11 h-12 bg-[#f8f9fb] border-none text-base sm:text-xs font-bold uppercase rounded-xl" />
               </div>
               {offices.length > 0 && (
                 <div className="w-full md:w-64">
                    <Select value={officeFilter} onValueChange={setOfficeFilter}>
                      <SelectTrigger className="h-12 bg-[#f8f9fb] border-none rounded-xl text-[10px] font-black uppercase">
                        <div className="flex items-center gap-2"><Building2 size={14} className="text-primary" /><SelectValue placeholder="ESCRITÓRIO" /></div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-[10px] font-black uppercase">TODOS ESCRITÓRIOS</SelectItem>
                        {offices.map(o => <SelectItem key={o} value={o} className="text-[10px] font-black uppercase">{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                 </div>
               )}
             </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3"><Target size={18} className="text-primary" /><h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Sequência Prioritária</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {taskData.focus.map((group) => (
                <TaskCard key={group.cliente} group={group} isFocus onMarkContacted={() => openAttendance(group)} onScan={handleSingleScan} onSuggest={() => handleSuggestClick(group.protocoloReferencia, group.cliente, group.cases[0]?.ultimoRetorno || null)} />
              ))}
              {taskData.focus.length === 0 && !loading && (
                <div className="col-span-full py-20 flex items-center justify-center">
                  <EmptyState icon={CheckCircle2} title="Meta Concluída" description="Fila prioritária limpa para o dia de hoje." />
                </div>
              )}
            </div>
          </div>

          {taskData.backlog.length > 0 && (
            <div className="space-y-4 pt-10 border-t border-border/30">
               <Button variant="ghost" onClick={() => setShowBacklog(!showBacklog)} className="h-12 sm:h-10 px-4 font-black uppercase text-[10px] tracking-widest text-muted-foreground hover:bg-black/5 rounded-xl w-full sm:w-auto">
                 {showBacklog ? <ChevronUp size={16} className="mr-2"/> : <ChevronDown size={16} className="mr-2"/>} Outros pendentes ({taskData.backlog.length})
               </Button>
               {showBacklog && (
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in slide-in-from-top-2">
                   {taskData.backlog.map((group) => (
                     <TaskCard key={group.cliente} group={group} onMarkContacted={() => openAttendance(group)} onScan={handleSingleScan} onSuggest={() => handleSuggestClick(group.protocoloReferencia, group.cliente, group.cases[0]?.ultimoRetorno || null)} />
                   ))}
                 </div>
               )}
            </div>
          )}

          {taskData.completed.length > 0 && (
            <div className="space-y-6 pt-10 border-t border-border/30">
               <div className="flex items-center gap-3"><CheckCircle2 size={18} className="text-emerald-500" /><h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Contatados Hoje ({taskData.completed.length})</h2></div>
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 opacity-60">
                 {taskData.completed.map((group) => (
                   <TaskCard key={group.cliente} group={group} onMarkContacted={() => {}} onScan={handleSingleScan} onSuggest={() => {}} />
                 ))}
               </div>
            </div>
          )}
        </div>

        <Suspense fallback={null}>
          <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
            <DialogContent className="sm:max-w-[950px] w-[calc(100vw-2rem)] rounded-2xl border-none shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
              <DialogHeader className="p-4 sm:p-6 bg-black text-white shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary"><History size={24} /></div>
                    <div>
                        <DialogTitle className="font-black uppercase tracking-tight text-lg sm:text-xl">Auditoria Unificada (Audit 3D)</DialogTitle>
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase text-white/60 mt-1">Ref: {historyResult?.case.protocolo}</p>
                    </div>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="flex flex-col flex-1 bg-white overflow-hidden min-h-0">
                <ScrollArea className="flex-1 w-full">
                  <div className="p-4 sm:p-6 space-y-10">
                    <section className="space-y-6">
                       <h3 className={cn("text-black flex items-center justify-between border-b-2 border-black/5 pb-2", ui.label)}>
                          <div className="flex items-center gap-2"><Globe size={14} className="text-primary"/> Linha do Tempo Cronológica Unificada</div>
                          <Badge variant="outline" className="text-[8px] border-black/10">Soberania DJEN + DataJud</Badge>
                       </h3>
                       
                       <div className="space-y-6">
                         {unifiedHistory.map((item, i) => (
                           <div key={i} className={cn(
                             "relative p-5 border-2 rounded-xl transition-all hover:translate-x-1",
                             item.type === 'djen' ? "border-blue-600 bg-blue-50/10 shadow-[4px_4px_0px_#2563eb]" : "border-slate-200 bg-slate-50/50"
                           )}>
                             <div className="flex items-start justify-between mb-3">
                               <div className="flex items-center gap-3">
                                 <Badge className={cn("text-[8px] font-black uppercase rounded-none", item.type === 'djen' ? "bg-blue-600" : "bg-slate-500")}>
                                   {item.type === 'djen' ? 'Diário Oficial' : 'Tribunal'}
                                 </Badge>
                                 <span className="text-[10px] font-black text-muted-foreground uppercase">{format(item.date, 'dd/MM/yyyy')}</span>
                               </div>
                               {item.type === 'djen' && (
                                 <div className="flex gap-2">
                                   <Button variant="ghost" size="icon" onClick={() => handleExportDjenPDF(item.raw)} className="h-8 w-8 hover:bg-blue-600 hover:text-white border border-blue-600/20"><Download size={14} /></Button>
                                   <a href={item.raw.link} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-md bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors"><ExternalLink size={14} /></a>
                                 </div>
                               )}
                             </div>
                             
                             <h4 className="text-sm font-black uppercase text-foreground leading-tight mb-2">{item.title}</h4>
                             {item.subtitle && <p className="text-[9px] font-bold text-muted-foreground uppercase mb-3">{item.subtitle}</p>}
                             
                             {item.type === 'djen' && (
                               <div className="mt-4 p-4 bg-white border border-blue-100 rounded-lg">
                                  <p className={cn("text-black leading-relaxed whitespace-pre-wrap italic", ui.readable)}>{item.raw.texto}</p>
                               </div>
                             )}
                           </div>
                         ))}
                       </div>
                    </section>

                    <section className="space-y-6 pt-6 border-t">
                      <h3 className={cn("text-amber-600 flex items-center gap-2", ui.label)}><Sparkles size={14} /> Sugestões & Rascunho IA</h3>
                      <div className="bg-black text-white p-4 sm:p-6 space-y-4 rounded-xl">
                        <div className="flex flex-col gap-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Bot size={12}/> Motor Neural Lexis</p>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Select value={selectedMotor} onValueChange={setSelectedMotor}>
                              <SelectTrigger className="h-10 bg-white/10 border-white/20 text-white font-black uppercase text-[10px] rounded-lg flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-white border-2 border-black rounded-lg">
                                <SelectItem value="local_only" className="text-[9px] font-black uppercase">Motor Lexis Soberano</SelectItem>
                                <SelectItem value="xai" className="text-[9px] font-black uppercase">xAI Grok 2 Elite</SelectItem>
                                <SelectItem value="groq-llama" className="text-[9px] font-black uppercase">Groq Llama 3.3</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button onClick={handleGenerateAIDraft} disabled={isGeneratingAIDraft} className="h-10 px-6 bg-white text-black font-black uppercase text-[10px] rounded-lg hover:bg-primary transition-all">{isGeneratingAIDraft ? <Loader2 size={12} className="animate-spin" /> : "Gerar Rascunho"}</Button>
                          </div>
                        </div>
                        {aiDraft && (
                          <div className="space-y-3 animate-in fade-in duration-500 mt-2">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-lg"><p className={cn("text-white/80 italic", ui.readable)}>"{aiDraft}"</p></div>
                            <Button onClick={() => copyScript(aiDraft)} variant="ghost" className="h-10 w-full text-[9px] font-black uppercase border border-white/20 hover:bg-white/10 text-white rounded-lg">Copiar Rascunho</Button>
                          </div>
                        )}
                      </div>
                      {showScripts && suggestedScripts.length > 0 && (
                        <div className="grid gap-4">
                          {suggestedScripts.map((script, idx) => (
                            <div key={idx} className="bg-white border-2 border-black p-5 rounded-xl shadow-sm space-y-4">
                              <div className="space-y-1"><Badge className="bg-black text-white text-[8px] font-black uppercase rounded-none px-2 mb-1">{script.titulo}</Badge><p className="text-[11px] font-black uppercase leading-tight">{script.quandoUsar}</p></div>
                              <div className="p-4 bg-slate-50 border border-black/5 relative rounded-lg">
                                <p className={cn("text-black/70 italic", ui.readable)}>"{script.texto}"</p>
                                <Button variant="ghost" size="icon" onClick={() => copyScript(script.texto)} className="absolute top-2 right-2 h-8 w-8 hover:bg-black hover:text-white transition-all rounded-lg"><Copy size={14} /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </ScrollArea>
                <DialogFooter className="p-4 bg-secondary/10 border-t shrink-0"><Button onClick={() => setIsHistoryModalOpen(false)} className="bg-black text-white font-black uppercase text-[10px] px-8 rounded-xl h-12 w-full">Fechar Auditoria</Button></DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </Suspense>

        <Dialog open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen}>
          <DialogContent className="sm:max-w-[480px] rounded-2xl border-none shadow-2xl overflow-hidden p-0 max-h-[90vh]">
            <form className="flex flex-col h-full">
              <DialogHeader className="p-6 bg-secondary/20 border-b shrink-0">
                <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2"><UserCheck className="text-primary" /> Registrar Atendimento</DialogTitle>
                <DialogDescription className="sr-only">Formulário para registrar contato com o cliente.</DialogDescription>
              </DialogHeader>
              <div className="p-6 space-y-6 overflow-y-auto">
                  <div className="grid gap-2">
                    <Label className={ui.label}>Resultado do Contato</Label>
                    <Select value={attendanceForm.situacao} onValueChange={(val) => setAttendanceForm({...attendanceForm, situacao: val})}>
                      <SelectTrigger className="rounded-xl h-12 bg-secondary/30 border-none font-bold text-[11px] uppercase"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="EM ANDAMENTO" className="text-[10px] font-bold uppercase">Manter em Andamento</SelectItem><SelectItem value="ENCERRADO" className="text-[10px] font-bold uppercase text-red-600">Encerrar Processo</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className={ui.label}>Próximo retorno</Label>
                    <Input type="date" value={attendanceForm.proximoRetorno} onChange={(e) => setAttendanceForm({...attendanceForm, proximoRetorno: e.target.value})} disabled={attendanceForm.situacao === 'ENCERRADO'} className="rounded-xl h-12 bg-secondary/30 border-none font-bold text-base sm:text-xs uppercase" />
                  </div>
                  <div className="grid gap-2">
                    <Label className={ui.label}>Observações</Label>
                    <Textarea placeholder="REGISTRE DETALHES..." value={attendanceForm.observacao} onChange={(e) => setAttendanceForm({...attendanceForm, observacao: e.target.value.toUpperCase()})} className="rounded-xl min-h-[100px] bg-secondary/30 border-none font-bold text-base sm:text-xs uppercase resize-none" />
                  </div>
                  <div className="flex items-center space-x-3 pt-2">
                    <Checkbox id="applyToAll" checked={attendanceForm.applyToAll} onCheckedChange={(val) => setAttendanceForm({...attendanceForm, applyToAll: !!val})} className="h-5 w-5" />
                    <Label htmlFor="applyToAll" className="text-[10px] font-black uppercase cursor-pointer leading-tight">Aplicar a toda carteira do cliente</Label>
                  </div>
              </div>
              <DialogFooter className="p-6 pt-0 shrink-0"><Button type="button" onClick={handleSaveAttendance} disabled={isSavingAttendance} className="w-full h-14 bg-black text-white rounded-xl font-black uppercase text-[11px] shadow-xl">{isSavingAttendance ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />} Salvar Registro</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function TaskCard({ group, isFocus = false, onMarkContacted, onScan, onSuggest }: { group: TaskGroup, isFocus?: boolean, onMarkContacted: () => void, onScan: (protocolo: string) => void, onSuggest: () => void }) {
  const [isScanning, setIsScanning] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const prob = calcularProbabilidadeEncerramento({ status: group.vencidos > 0 ? "Vencido" : "No Prazo", situacao: "EM ANDAMENTO", diasVencidos: group.diasAtrasoMax });

  return (
    <div className={cn("premium-card p-4 sm:p-6 bg-white flex flex-col transition-all group border-l-4", isFocus ? "border-l-primary shadow-md" : "border-l-slate-200 shadow-sm", group.hasBA && "border-l-red-600 bg-red-50/10", group.hasClosedCourt && "border-l-black bg-slate-50/50", group.hasDjen && !group.hasBA && "border-l-blue-600")}>
      <div className="flex justify-between items-start mb-6">
        <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all", group.hasBA ? "bg-red-600 text-white animate-pulse" : group.hasClosedCourt ? "bg-black text-white" : "bg-slate-50 text-slate-400 group-hover:bg-primary group-hover:text-white")}>{group.hasBA ? <ShieldAlert size={24} /> : group.hasClosedCourt ? <Gavel size={24} /> : <Phone size={24} />}</div>
        <div className="flex flex-col items-end gap-2 text-right">
          {group.hasBA ? <Badge className="bg-red-600 text-white text-[8px] font-black uppercase px-2 py-0.5">CRÍTICO: B.A.</Badge> : group.hasClosedCourt ? <Badge className="bg-black text-red-500 border-2 border-red-500 text-[8px] font-black uppercase px-2 py-0.5 animate-pulse">BAIXA TRIBUNAL</Badge> : group.hasDjen ? <Badge className="bg-blue-600 text-white text-[8px] font-black uppercase px-2 py-0.5 animate-pulse">DJEN</Badge> : group.hasUpdate ? <Badge variant="destructive" className="text-[7px] font-black uppercase px-2 py-0 h-4 animate-pulse">NOVO ANDAMENTO</Badge> : <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0.5">Vigilância</Badge>}
          <div className="text-[8px] font-black text-primary/60 uppercase">Prob. {prob}%</div>
        </div>
      </div>
      <div className="space-y-1 flex-1">
        <h3 className="font-black text-sm text-foreground uppercase tracking-tight truncate group-hover:text-primary transition-colors">{group.cliente}</h3>
        <p className={cn("text-muted-foreground uppercase", ui.cnj)}>Ref: {group.protocoloReferencia}</p>
        {group.djenResumo && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
             <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><Globe size={10}/> Publicação Oficial</p>
             <p className={cn("text-blue-900 leading-relaxed italic line-clamp-3", ui.readable)}>"{group.djenResumo}"</p>
          </div>
        )}
        {group.lastMovementName && !group.djenResumo && (
          <div className="mt-4 p-3 bg-secondary/30 rounded-xl border border-border/20">
             <p className="text-[10px] font-black text-foreground uppercase leading-tight line-clamp-2">{group.lastMovementName}</p>
             <p className="text-[8px] font-mono text-muted-foreground/60 mt-1 uppercase">{group.lastMovementDate ? format(new Date(group.lastMovementDate), 'dd/MM/yyyy') : 'S/ Data'}</p>
          </div>
        )}
      </div>
      <div className="mt-6 pt-6 border-t border-border/30 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
           <Button variant="ghost" size="icon" disabled={isSuggesting} onClick={async () => { setIsSuggesting(true); await onSuggest(); setIsSuggesting(false); }} className={cn("text-amber-600 hover:bg-amber-50", ui.touch)} title="IA"><MessageSquareQuote size={18} /></Button>
           <Button variant="ghost" size="icon" disabled={isScanning} onClick={async () => { setIsScanning(true); await onScan(group.protocoloReferencia); setIsScanning(false); }} className={cn("text-primary hover:bg-primary/10", ui.touch)} title="Audit"><FileSearch size={18} /></Button>
           <Button asChild variant="ghost" size="icon" className={cn("text-blue-600 hover:bg-blue-50", ui.touch)} title="Alerts"><Link href={`/notificacoes?search=${group.protocoloReferencia}`}><Bell size={18} /></Link></Button>
           <Button variant="ghost" size="icon" asChild className={cn("text-emerald-600 hover:bg-emerald-50", ui.touch)} title="WA"><a href={formatWhatsAppLink(group.telefone)} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /></a></Button>
           <Button variant="ghost" size="icon" onClick={onMarkContacted} className={cn("text-slate-400 hover:text-emerald-600", ui.touch)} title="Reg"><UserCheck size={18} /></Button>
        </div>
        <Button variant="ghost" asChild className="h-10 px-3 sm:px-4 rounded-xl text-[10px] font-black uppercase hover:text-primary transition-all"><Link href={`/cases?search=${encodeURIComponent(group.cliente)}`}>Gerir <ChevronRight size={14} className="ml-1 hidden sm:inline" /></Link></Button>
      </div>
    </div>
  );
}
