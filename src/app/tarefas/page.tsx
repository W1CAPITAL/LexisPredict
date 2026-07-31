/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  EyeOff
} from 'lucide-react';
import { LegalCase, processarCaso, formatDateToISO } from '@/lib/case-logic';
import { cn, formatWhatsAppLink } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { fetchRepoCases, syncRepoCases, scanSingleCaseAction } from '@/app/actions/case-actions';
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
import { Checkbox } from '@/components/ui/checkbox';
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
  
  // Metadados de Prioridade v260.0
  hasBA: boolean;
  hasClosedCourt: boolean;
  hasUpdate: boolean;
  statusScore: number;
  oldestReturnGap: number;

  // Telemetria v52.0
  lastMovementName?: string | null;
  lastMovementDate?: string | null;
}

export default function TarefasPage() {
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

  // DataJud State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyResult, setHistoryResult] = useState<{ case: LegalCase, movimentos: any[] } | null>(null);
  const [suggestedScripts, setSuggestedScripts] = useState<ScriptSuggestion[]>([]);
  const [showScripts, setShowScripts] = useState(false);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [isGeneratingAIDraft, setIsGeneratingAIDraft] = useState(false);
  const [selectedMotor, setSelectedMotor] = useState<string>('xai');

  const { toast } = useToast();

  const getTodayKey = () => {
    const today = new Date().toISOString().split('T')[0];
    return `lexis_tarefas_contatados_${today}`;
  };

  useEffect(() => {
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
    loadData();
  }, [loadData]);

  const handleSingleScan = async (protocolo: string) => {
    try {
      const res = await scanSingleCaseAction(protocolo);
      if (res.success && res.case) {
        setHistoryResult({ case: res.case, movimentos: res.movimentos || [] });
        setIsHistoryModalOpen(true);
        setShowScripts(false);
        setSuggestedScripts([]);
        setAiDraft(null);
        setCases(prev => prev.map(c => c.protocolo === protocolo ? res.case! : c));
      } else {
        toast({ title: "Andamento não localizado", description: res.message || "Tribunal offline", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro na consulta", variant: "destructive" });
    }
  };

  const handleSuggestClick = async (protocolo: string, cliente: string, ultimoRetorno: string | null) => {
    try {
      const res = await scanSingleCaseAction(protocolo);
      if (res.success && res.case) {
        const moves = res.movimentos || [];
        setHistoryResult({ case: res.case, movimentos: moves });
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
        
        setCases(prev => prev.map(c => c.protocolo === protocolo ? res.case! : c));
      } else {
        toast({ title: "Sugestão Indisponível", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro na consulta", variant: "destructive" });
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
        preferredModel: selectedMotor
      });
      
      if (res.rascunho) {
        setAiDraft(res.rascunho);
        toast({ title: "Rascunho Motor Lexis Gerado" });
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

  const offices = useMemo(() => {
    const list = Array.from(new Set(cases.map(c => c.escritorio))).filter(Boolean).sort();
    return list;
  }, [cases]);

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
          statusScore: 0,
          oldestReturnGap: 0,
          lastMovementName: c.datajud_ultimo_nome,
          lastMovementDate: c.datajud_ultimo_movimento
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

      let currentScore = 0;
      if (c.status === 'Caso Crítico') currentScore = 50;
      else if (c.status === 'Vencido') currentScore = 40;
      else if (c.status === 'É Hoje') currentScore = 30;
      else if (c.status === 'Atenção') currentScore = 20;
      else if (c.status === 'Sem Prazo') currentScore = 10;
      
      if (currentScore > g.statusScore) g.statusScore = currentScore;

      if (c.status === 'Vencido' || c.status === 'Caso Crítico') {
        g.vencidos++;
        const atraso = c.diasFaltando ? Math.abs(c.diasFaltando) : 0;
        if (atraso > g.diasAtrasoMax) g.diasAtrasoMax = atraso;
      }
      if (c.status === 'É Hoje') g.hoje++;

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
        if (a.hasUpdate !== b.hasUpdate) return a.hasUpdate ? -1 : 1;
        if (b.statusScore !== a.statusScore) return b.statusScore - a.statusScore;
        if (b.oldestReturnGap !== a.oldestReturnGap) return b.oldestReturnGap - a.oldestReturnGap;
        return b.diasAtrasoMax - a.diasAtrasoMax;
      });

    const pending = sortedAll.filter(g => !contactedSet.has(g.cliente));
    const done = sortedAll.filter(g => contactedSet.has(g.cliente));

    return {
      focus: pending.slice(0, dailyMeta),
      backlog: pending.slice(dailyMeta),
      completed: done,
      totalPendingCount: pending.length
    };
  }, [cases, search, officeFilter, contatadosHoje, dailyMeta]);

  const openAttendance = (group: TaskGroup) => {
    setActiveGroup(group);
    setAttendanceForm({
      observacao: '',
      proximoRetorno: '',
      situacao: 'EM ANDAMENTO',
      applyToAll: true
    });
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
        const isMatch = attendanceForm.applyToAll 
          ? c.cliente === activeGroup.cliente 
          : activeGroup.cases.some(ac => ac.protocolo === c.protocolo);

        if (isMatch) {
          let newFlagStatus = c.tem_atualizacao_pos_retorno;
          if (c.datajud_ultimo_movimento) {
            const lastMovDate = startOfDay(parseISO(c.datajud_ultimo_movimento));
            const returnDate = startOfDay(todayDate);
            if (!isAfter(lastMovDate, returnDate)) {
              newFlagStatus = false;
            }
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
            tem_atualizacao_pos_retorno: newFlagStatus
          };
          return processarCaso(newCaseData, thresholds);
        }
        return c;
      });

      const result = await syncRepoCases(updatedCases);
      if (result.success) {
        setCases(updatedCases);
        const updatedContatados = [...contatadosHoje, activeGroup.cliente];
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

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-border/50 bg-card/60 backdrop-blur-xl flex items-center justify-between px-10 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-black text-white rounded-lg shadow-lg">
              <CheckCircle size={20} className="text-primary" />
            </div>
            <div>
               <h1 className="font-black text-xl text-foreground uppercase tracking-tight">Fila Crítica de Contato</h1>
               <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">Priorização DataJud & Carência</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="h-9 px-4 border-none bg-primary/5 text-primary font-black uppercase text-[10px]">
              Sincronia Global Ativa
            </Badge>
            <Button variant="ghost" size="icon" onClick={loadData} className="h-10 w-10 rounded-xl hover:bg-secondary">
              <RefreshCcw className={cn("w-5 h-5", loading && "animate-spin text-primary")} />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10 max-w-[1400px] mx-auto w-full space-y-10 pb-32">
          {!loading && (
            <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="premium-card p-6 border-l-4 border-l-slate-400">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Fila em Aberto</p>
                <h3 className="text-3xl font-black text-foreground tabular-nums">{taskData.totalPendingCount}</h3>
              </div>
              <div className="premium-card p-6 border-l-4 border-l-primary relative group">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Meta do Período</p>
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
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Foco do Dia</p>
                <h3 className="text-3xl font-black text-orange-600 tabular-nums">{Math.min(dailyMeta, taskData.focus.length)}</h3>
              </div>
            </section>
          )}

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white border border-border/50 p-6 rounded-2xl shadow-sm">
             <div className="relative flex-1 w-full max-xl">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
               <Input 
                 placeholder="Pesquisar por cliente na fila..." 
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="pl-11 h-12 bg-[#f8f9fb] border-none text-xs font-bold uppercase rounded-xl focus-visible:ring-primary/20"
               />
             </div>
             
             <div className="w-full md:w-64">
               <Select value={officeFilter} onValueChange={setOfficeFilter}>
                 <SelectTrigger className="h-12 bg-[#f8f9fb] border-none rounded-xl text-[10px] font-black uppercase">
                   <div className="flex items-center gap-2">
                     <Building2 size={16} className="text-primary" />
                     <SelectValue placeholder="ESCRITÓRIO" />
                   </div>
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all" className="text-[10px] font-black uppercase">TODOS ESCRITÓRIOS</SelectItem>
                   {offices.map(o => (
                     <SelectItem key={o} value={o} className="text-[10px] font-black uppercase">{o}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Target size={18} className="text-primary" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Sequência Prioritária (Auditoria DataJud Ativa)</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {taskData.focus.map((group) => (
                <TaskCard 
                  key={group.cliente} 
                  group={group} 
                  isFocus 
                  onMarkContacted={() => openAttendance(group)} 
                  onScan={handleSingleScan}
                  onSuggest={() => handleSuggestClick(group.protocoloReferencia, group.cliente, group.cases[0]?.ultimoRetorno || null)}
                />
              ))}
              {taskData.focus.length === 0 && !loading && (
                <div className="col-span-full py-20 flex items-center justify-center">
                  <EmptyState icon={CheckCircle2} title="Meta Concluída" description="Fila prioritária limpa para o dia de hoje." />
                </div>
              )}
            </div>

            {taskData.backlog.length > 0 && (
              <div className="pt-10">
                <Button variant="ghost" onClick={() => setShowBacklog(!showBacklog)} className="w-full flex items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-xl group">
                  <div className="flex items-center gap-3">
                    <Clock size={18} className="text-slate-400 group-hover:text-primary" />
                    <div className="text-left">
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">Demais Ativos em Fila ({taskData.backlog.length})</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Clientes aguardando atendimento após a meta imediata</p>
                    </div>
                  </div>
                  {showBacklog ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </Button>
                {showBacklog && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6 animate-in slide-in-from-top-2">
                    {taskData.backlog.map((group) => (
                      <TaskCard 
                        key={group.cliente} 
                        group={group} 
                        onMarkContacted={() => openAttendance(group)} 
                        onScan={handleSingleScan}
                        onSuggest={() => handleSuggestClick(group.protocoloReferencia, group.cliente, group.cases[0]?.ultimoRetorno || null)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal de Cronologia DataJud + Sugestões */}
        <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
          <DialogContent className="sm:max-w-[750px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-black text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                      <History size={28} />
                  </div>
                  <div>
                      <DialogTitle className="font-black uppercase tracking-tight text-xl">Andamentos Oficiais</DialogTitle>
                      <p className="text-[10px] font-bold uppercase text-white/60 mt-1">Ref: {historyResult?.case.protocolo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => {
                      if (historyResult) {
                        const suggestions = suggestScripts({
                          clienteNome: historyResult.case.cliente,
                          protocolo: historyResult.case.protocolo,
                          ultimoRetorno: historyResult.case.ultimoRetorno,
                          movimentos: historyResult.movimentos
                        });
                        setSuggestedScripts(suggestions);
                        setShowScripts(true);
                      }
                    }} 
                    variant="outline" 
                    className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-black uppercase text-[10px] rounded-xl h-10 px-4"
                  >
                    <MessageSquare size={14} className="mr-2" /> Sugerir Resposta
                  </Button>
                </div>
              </div>
              <DialogDescription className="text-[10px] uppercase font-bold text-white/40">Visualização detalhada da cronologia processual e ferramentas de despacho.</DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col h-[550px]">
              <div className="p-6 bg-secondary/20 border-b flex items-center justify-between shrink-0">
                <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-muted-foreground">Titular do Processo</p>
                    <p className="text-sm font-black uppercase">{historyResult?.case?.cliente}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {historyResult?.case?.indicio_busca_apreensao && (
                    <Badge className="bg-red-600 text-white font-black uppercase text-[10px] px-4 py-2 animate-bounce">Indício Busca e Apreensão</Badge>
                  )}
                  {historyResult?.case?.datajud_encerrado_tribunal && (
                    <Badge className="bg-black text-red-500 border-2 border-red-500 font-black uppercase text-[10px] px-4 py-2 animate-pulse">Encerrado no Tribunal</Badge>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex">
                {/* Lado Esquerdo: Cronologia */}
                <ScrollArea className={cn("bg-white transition-all duration-300", showScripts ? "w-1/2 border-r" : "w-full")}>
                  <div className="p-6 space-y-6">
                    {historyResult?.movimentos && historyResult.movimentos.length > 0 ? (
                      [...historyResult.movimentos].sort((a,b) => {
                        const dateA = a.dataHora ? new Date(a.dataHora).getTime() : 0;
                        const dateB = b.dataHora ? new Date(b.dataHora).getTime() : 0;
                        return dateB - dateA;
                      }).map((m, i) => (
                        <div key={i} className="flex gap-6 relative group">
                           {i !== historyResult.movimentos.length - 1 && <div className="absolute left-[23px] top-8 bottom-[-24px] w-0.5 bg-border group-hover:bg-primary/30 transition-colors" />}
                           <div className="w-12 h-12 rounded-full border-2 border-border bg-background flex items-center justify-center shrink-0 relative z-10 group-hover:border-primary transition-all">
                              <Clock size={16} className="text-muted-foreground group-hover:text-primary" />
                           </div>
                           <div className="flex-1 pt-1 space-y-1 pb-6">
                              <p className="text-[10px] font-black text-primary uppercase tracking-widest">{m.dataHora ? new Date(m.dataHora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Data não informada'}</p>
                              <p className="text-[13px] font-bold text-foreground leading-tight uppercase">{m.nome}</p>
                           </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center space-y-4 opacity-40">
                         <FileSearch size={48} className="mx-auto" />
                         <p className="text-xs font-black uppercase">Nenhuma movimentação detalhada.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Lado Direito: Sugestões de Script */}
                {showScripts && (
                  <ScrollArea className="w-1/2 bg-slate-50 animate-in slide-in-from-right-2 duration-300">
                    <div className="p-6 space-y-6">
                      <div className="flex items-center justify-between mb-4">
                         <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                           <Zap size={14} /> Sugestões de Resposta
                         </h3>
                         <Button variant="ghost" size="icon" onClick={() => setShowScripts(false)} className="h-6 w-6"><EyeOff size={14} /></Button>
                      </div>

                      {/* IA DRAFT AREA (Opcional via Motor Lexis) */}
                      <div className="bg-black text-white p-5 space-y-4 mb-8">
                         <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <p className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Sparkles size={12}/> Draft Estratégico (Motor Lexis)</p>
                              <Badge variant="outline" className="border-primary/20 text-primary text-[8px] font-black uppercase">Neural Unit</Badge>
                            </div>

                            <div className="flex gap-2">
                              <Select value={selectedMotor} onValueChange={setSelectedMotor}>
                                <SelectTrigger className="h-8 bg-white/10 border-white/20 text-white font-black uppercase text-[8px] rounded-none">
                                  <div className="flex items-center gap-1.5">
                                    <Settings2 size={10} />
                                    <SelectValue />
                                  </div>
                                </SelectTrigger>
                                <SelectContent className="bg-white border-2 border-black rounded-none">
                                  <SelectItem value="xai" className="text-[9px] font-black uppercase">xAI Grok 4.5</SelectItem>
                                  <SelectItem value="groq-llama" className="text-[9px] font-black uppercase">Groq Llama 3.3</SelectItem>
                                  <SelectItem value="airforce" className="text-[9px] font-black uppercase">Airforce Ultra</SelectItem>
                                </SelectContent>
                              </Select>

                              <Button 
                                onClick={handleGenerateAIDraft} 
                                disabled={isGeneratingAIDraft}
                                className="h-8 flex-1 bg-white text-black font-black uppercase text-[8px] rounded-none hover:bg-primary transition-all shadow-[3px_3px_0px_#00D1FF] hover:shadow-none"
                              >
                                {isGeneratingAIDraft ? <Loader2 size={10} className="animate-spin" /> : "Gerar Rascunho"}
                              </Button>
                            </div>
                         </div>

                         {aiDraft ? (
                           <div className="space-y-3 animate-in fade-in duration-500 mt-2">
                              <div className="p-3 bg-white/5 border border-white/10 rounded-sm">
                                 <p className="text-[10px] font-bold italic leading-relaxed text-white/80">"{aiDraft}"</p>
                              </div>
                              <Button onClick={() => copyScript(aiDraft)} variant="ghost" className="h-7 w-full text-[8px] font-black uppercase border border-white/20 hover:bg-white/10 text-white">Copiar Rascunho IA</Button>
                           </div>
                         ) : !isGeneratingAIDraft && (
                           <p className="text-[8px] font-bold text-white/30 uppercase mt-1">Selecione o motor e clique para gerar uma resposta personalizada.</p>
                         )}

                         {isGeneratingAIDraft && (
                            <div className="flex items-center gap-2 text-[8px] font-black uppercase text-primary animate-pulse py-2">
                              <Loader2 size={10} className="animate-spin" />
                              Processando rascunho via {selectedMotor.toUpperCase()}...
                            </div>
                         )}
                      </div>
                      
                      {suggestedScripts.map((script, idx) => (
                        <div key={idx} className="bg-white border-2 border-black p-5 rounded-none shadow-[6px_6px_0px_rgba(0,0,0,0.05)] space-y-4">
                           <div className="space-y-1">
                              <Badge className="bg-black text-white text-[8px] font-black uppercase rounded-none px-2 mb-1">{script.titulo}</Badge>
                              <p className="text-[11px] font-black uppercase leading-tight">{script.quandoUsar}</p>
                           </div>
                           <div className="p-4 bg-slate-50 border border-black/5 relative">
                              <p className="text-[11px] font-bold text-black/70 leading-relaxed italic">"{script.texto}"</p>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => copyScript(script.texto)}
                                className="absolute top-2 right-2 h-8 w-8 hover:bg-black hover:text-white transition-all"
                              >
                                <Copy size={14} />
                              </Button>
                           </div>
                        </div>
                      ))}
                      
                      <div className="p-4 bg-amber-50 border border-amber-200 flex items-start gap-3">
                         <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                         <p className="text-[9px] font-bold text-amber-800 uppercase leading-relaxed">Atenção: Revise o texto e placeholders antes de realizar o envio oficial.</p>
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>

            <DialogFooter className="p-4 bg-secondary/10 border-t">
               <Button onClick={() => setIsHistoryModalOpen(false)} className="bg-black text-white font-black uppercase text-[10px] px-8 rounded-xl h-12 w-full">Fechar Auditoria</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen}>
          <DialogContent className="sm:max-w-[480px] rounded-2xl border-none shadow-2xl overflow-hidden p-0">
            <DialogHeader className="p-6 bg-secondary/20 border-b">
              <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
                <UserCheck className="text-primary" /> Registrar Atendimento
              </DialogTitle>
              <DialogDescription className="font-bold uppercase text-[10px] text-muted-foreground">
                Cliente: {activeGroup?.cliente}
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 space-y-6">
              <div className="space-y-6">
                <div className="grid gap-2">
                  <Label className="uppercase text-[9px] font-black text-muted-foreground flex items-center gap-2">
                    <Zap size={12} /> Resultado do Contato
                  </Label>
                  <Select value={attendanceForm.situacao} onValueChange={(val) => setAttendanceForm({...attendanceForm, situacao: val})}>
                    <SelectTrigger className="rounded-xl h-12 bg-secondary/30 border-none font-bold text-[11px] uppercase">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EM ANDAMENTO" className="text-[10px] font-bold uppercase">Manter em Andamento</SelectItem>
                      <SelectItem value="ENCERRADO" className="text-[10px] font-bold uppercase text-red-600">Encerrar Processo (Baixa Interna)</SelectItem>
                      <SelectItem value="ARQUIVADO" className="text-[10px] font-bold uppercase">Arquivar Processo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn("grid gap-2", attendanceForm.situacao === 'ENCERRADO' && "opacity-40 pointer-events-none")}>
                  <Label className="uppercase text-[9px] font-black text-muted-foreground flex items-center gap-2">
                    <Calendar size={12} /> Data do Próximo Retorno
                  </Label>
                  <Input placeholder="DD/MM/AAAA" value={attendanceForm.proximoRetorno} onChange={(e) => setAttendanceForm({...attendanceForm, proximoRetorno: e.target.value})} className="rounded-xl h-12 bg-secondary/30 border-none font-bold text-sm" />
                </div>
                <div className="grid gap-2">
                  <Label className="uppercase text-[9px] font-black text-muted-foreground flex items-center gap-2">
                    <FileText size={12} /> Observações de Gabinete
                  </Label>
                  <Textarea placeholder="REGISTRE DETALHES DO ACORDO OU ATENDIMENTO..." value={attendanceForm.observacao} onChange={(e) => setAttendanceForm({...attendanceForm, observacao: e.target.value.toUpperCase()})} className="rounded-xl min-h-[100px] bg-secondary/30 border-none font-bold text-[11px] uppercase resize-none" />
                </div>
              </div>
            </div>
            <DialogFooter className="p-6 pt-0">
              <Button onClick={handleSaveAttendance} disabled={isSavingAttendance} className="w-full h-14 bg-black text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl">
                {isSavingAttendance ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2 text-white" />}
                Salvar Registro & Sincronizar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function TaskCard({ 
  group, 
  isFocus = false, 
  onMarkContacted,
  onScan,
  onSuggest
}: { 
  group: TaskGroup, 
  isFocus?: boolean, 
  onMarkContacted: () => void,
  onScan: (protocolo: string) => void,
  onSuggest: () => void
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  
  const prob = calcularProbabilidadeEncerramento({
    status: group.vencidos > 0 ? "Vencido" : "No Prazo",
    situacao: "EM ANDAMENTO",
    diasVencidos: group.diasAtrasoMax
  });

  const isCritical = group.statusScore >= 50;

  return (
    <div className={cn(
      "premium-card p-6 bg-white flex flex-col transition-all group border-l-4", 
      isFocus ? "border-l-primary" : "border-l-slate-200", 
      group.hasBA && "border-l-red-600 bg-red-50/10",
      group.hasClosedCourt && !group.hasBA && "border-l-black bg-slate-50/50"
    )}>
      <div className="flex justify-between items-start mb-6">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center transition-all", 
          group.hasBA ? "bg-red-600 text-white animate-pulse shadow-lg" : 
          group.hasClosedCourt ? "bg-black text-white" :
          "bg-slate-50 text-slate-400 group-hover:bg-primary group-hover:text-white"
        )}>
          {group.hasBA ? <ShieldAlert size={24} /> : group.hasClosedCourt ? <Gavel size={24} /> : <Phone size={24} />}
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          {group.hasBA ? (
             <Badge className="bg-red-600 text-white border-none text-[8px] font-black uppercase px-2 py-0.5 animate-bounce">CRÍTICO: BUSCA E APREENSÃO</Badge>
          ) : group.hasClosedCourt ? (
            <Badge className="bg-black text-red-500 border-2 border-red-500 text-[8px] font-black uppercase px-2 py-0.5 animate-pulse">BAIXA NO TRIBUNAL</Badge>
          ) : group.hasUpdate ? (
            <Badge variant="destructive" className="text-[7px] font-black uppercase px-2 py-0 h-4 animate-pulse">NOVO ANDAMENTO</Badge>
          ) : isCritical ? (
            <Badge className="bg-red-600 text-white border-none text-[8px] font-black uppercase px-2 py-0.5 animate-bounce">URGÊNCIA MÁXIMA</Badge>
          ) : group.oldestReturnGap >= 30 ? (
            <Badge className="bg-orange-50 text-orange-700 border-none text-[8px] font-black uppercase px-2 py-0.5">Sem Retorno há {group.oldestReturnGap} dias</Badge>
          ) : (
            <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0.5 border-slate-200">Em Monitoramento</Badge>
          )}
          
          <div className="text-[8px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-1">
            <Sparkles size={8}/> Prob. {prob}%
          </div>
        </div>
      </div>
      
      <div className="space-y-1 flex-1">
        <h3 className="font-black text-sm text-foreground uppercase tracking-tight truncate group-hover:text-primary transition-colors">{group.cliente}</h3>
        <p className="text-[9px] font-bold text-muted-foreground uppercase">Ref: {group.protocoloReferencia}</p>

        {group.lastMovementName && (
          <div className="mt-4 p-3 bg-secondary/30 rounded-xl border border-border/20 group-hover:border-primary/20 transition-all">
             <div className="flex items-center gap-2 mb-1.5">
                <History size={12} className="text-primary/60" />
                <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest">Último Andamento Tribunal</span>
             </div>
             <p className="text-[10px] font-black text-foreground uppercase leading-tight line-clamp-2" title={group.lastMovementName}>
                {group.lastMovementName}
             </p>
             <p className="text-[8px] font-mono text-muted-foreground/60 mt-1 uppercase">
                {group.lastMovementDate ? format(new Date(group.lastMovementDate), 'dd/MM/yyyy') : 'S/ Data'}
             </p>
          </div>
        )}
        
        <div className="flex flex-col gap-2 mt-4">
           <div className="flex items-center gap-1.5 text-primary font-black uppercase text-[8px] tracking-widest bg-primary/5 px-2 py-1 rounded-md w-fit">
             <Gavel size={10} />
             {group.advogado}
           </div>
           {group.escritorio && (
             <div className="flex items-center gap-1.5 text-muted-foreground font-black uppercase text-[7px] tracking-widest bg-secondary/50 px-2 py-1 rounded-md w-fit">
               <Building2 size={10} />
               {group.escritorio}
             </div>
           )}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Button 
              title="Sugerir Resposta" 
              variant="ghost" 
              size="icon" 
              disabled={isSuggesting}
              onClick={async () => {
                setIsSuggesting(true);
                await onSuggest();
                setIsSuggesting(false);
              }}
              className="h-9 w-9 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
           >
             {isSuggesting ? <Loader2 className="animate-spin" /> : <MessageSquareQuote size={18} />}
           </Button>
           <Button 
              title="Andamentos DataJud" 
              variant="ghost" 
              size="icon" 
              disabled={isScanning}
              onClick={async () => {
                setIsScanning(true);
                await onScan(group.protocoloReferencia);
                setIsScanning(false);
              }}
              className="h-9 w-9 rounded-lg text-primary hover:bg-primary/10 transition-colors"
           >
             {isScanning ? <Loader2 className="animate-spin" /> : <FileSearch size={18} />}
           </Button>
           <Button variant="ghost" size="icon" asChild className="h-9 w-9 rounded-lg text-emerald-600 hover:bg-emerald-50"><a href={formatWhatsAppLink(group.telefone)} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /></a></Button>
           <Button title="Registrar Atendimento" variant="ghost" size="icon" onClick={onMarkContacted} className="h-9 w-9 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"><UserCheck size={18} /></Button>
        </div>
        <Button variant="ghost" asChild className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-primary"><Link href={`/cases?search=${encodeURIComponent(group.cliente)}`}>Gerir Contas <ChevronRight size={14} className="ml-1" /></Link></Button>
      </div>
    </div>
  );
}
