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
  ShieldAlert, 
  Search,
  ExternalLink,
  MessageCircle,
  Copyright,
  CalendarDays,
  Target,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Zap,
  CheckCircle2,
  Loader2,
  Sparkles,
  Gavel,
  FileSearch,
  History,
  MessageSquareQuote,
  Copy,
  Globe,
  Bot,
  Download,
  ChevronRight,
  UserCheck,
  Building2
} from 'lucide-react';
import { LegalCase, processarCaso, formatDateToISO, EventoTipo } from '@/lib/case-logic';
import { cn, formatWhatsAppLink } from '@/lib/utils';
import { ui } from '@/lib/responsive-ui';
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
import { format, parseISO, startOfDay, differenceInDays } from 'date-fns';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { suggestScripts, ScriptSuggestion } from '@/lib/script-processual/suggest';
import { gerarRascunhoEstrategico } from '@/ai/motor-despacho';
import { useAuth } from '@/components/auth/auth-provider';
import { plainTextFromDjen, summarizeDjenKeywords } from '@/lib/djen';
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
  eventoUnificadoResumo: string | null;
  eventoTipo: EventoTipo | null;
  statusScore: number;
  oldestReturnGap: number;
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
      try { setContatadosHoje(JSON.parse(savedContatados)); } catch (e) { setContatadosHoje([]); }
    }
  }, []);

  const adjustMeta = (amount: number) => {
    const newVal = Math.max(10, Math.min(100, dailyMeta + amount));
    setDailyMeta(newVal);
    localStorage.setItem('lexis_tarefas_meta', newVal.toString());
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRepoCases();
      if (Array.isArray(data)) setCases(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (mounted) loadData(); }, [loadData, mounted]);

  const handleSingleScan = async (protocolo: string) => {
    setLoading(true);
    try {
      const res = await scanSingleCaseAction(protocolo);
      if (res.success && res.case) {
        setHistoryResult({ 
          case: res.case, 
          movimentos: res.movimentos || [],
          djenComunicacoes: res.comunicacoes || []
        });
        setIsHistoryModalOpen(true);
        setShowScripts(false);
        setSuggestedScripts([]);
        setAiDraft(null);
        setCases(prev => prev.map(c => c.protocolo === protocolo ? res.case! : c));
      }
    } finally { setLoading(false); }
  };

  const handleSuggestClick = async (protocolo: string, cliente: string, ultimoRetorno: string | null) => {
    setLoading(true);
    try {
      const res = await scanSingleCaseAction(protocolo);
      if (res.success && res.case) {
        setHistoryResult({ 
          case: res.case, 
          movimentos: res.movimentos || [], 
          djenComunicacoes: res.comunicacoes || [] 
        });
        setAiDraft(null);
        
        // Contexto DJEN Limpo
        const djenTexts = (res.comunicacoes || []).map(d => plainTextFromDjen(d.texto));

        const suggestions = suggestScripts({
          clienteNome: cliente,
          protocolo: protocolo,
          ultimoRetorno: ultimoRetorno,
          eventoTipo: res.case.evento_tipo,
          eventoResumo: res.case.evento_resumo,
          movimentos: res.movimentos || [],
          djenTexts
        });
        setSuggestedScripts(suggestions);
        setShowScripts(true);
        setIsHistoryModalOpen(true);
        setCases(prev => prev.map(c => c.protocolo === protocolo ? res.case! : c));
      }
    } finally { setLoading(false); }
  };

  const handleGenerateAIDraft = async () => {
    if (!historyResult || isGeneratingAIDraft) return;
    setIsGeneratingAIDraft(true);
    setAiDraft(null);
    try {
      const djenTexts = (historyResult.djenComunicacoes || []).map(d => plainTextFromDjen(d.texto));
      
      const res = await gerarRascunhoEstrategico({
        clienteNome: historyResult.case.cliente,
        protocolo: historyResult.case.protocolo,
        ultimoRetorno: historyResult.case.ultimoRetorno,
        movimentos: historyResult.movimentos,
        djenTexts,
        eventoTipo: historyResult.case.evento_tipo,
        eventoResumo: historyResult.case.evento_resumo,
        preferredModel: selectedMotor,
        empresaId: profile?.empresa_id
      });
      if (res.rascunho) {
        setAiDraft(res.rascunho);
        toast({ title: "Rascunho Gerado" });
      }
    } catch (e) { toast({ title: "Erro na IA", variant: "destructive" }); }
    finally { setIsGeneratingAIDraft(false); }
  };

  const handleExportDjenPDF = async (item: any) => {
    if (!historyResult) return;
    const res = await generateDjenPublicationPDFAction({
      titulo: item.tipoComunicacao || "PUBLICAÇÃO OFICIAL",
      protocolo: historyResult.case.protocolo,
      data: item.data_disponibilizacao ? new Date(item.data_disponibilizacao).toLocaleDateString() : 'S/D',
      orgao: item.nomeOrgao,
      texto: plainTextFromDjen(item.texto)
    });
    if (res.success && res.base64) {
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${res.base64}`;
      link.download = `Publicacao_${historyResult.case.protocolo}.pdf`;
      link.click();
    }
  };

  const handleSaveAttendance = async () => {
    if (!activeGroup || isSavingAttendance) return;
    setIsSavingAttendance(true);
    try {
      const todayStr = format(new Date(), 'dd/MM/yyyy');
      const updatedCases = cases.map(c => {
        if (attendanceForm.applyToAll ? c.cliente === activeGroup.cliente : activeGroup.cases.some(ac => ac.protocolo === c.protocolo)) {
          return processarCaso({
            ...c, 
            situacao: attendanceForm.situacao, 
            ultimoRetorno: todayStr, 
            observacao: attendanceForm.observacao || c.observacao,
            proximoPrazo: attendanceForm.situacao === 'ENCERRADO' ? '' : attendanceForm.proximoRetorno,
            tem_novo_andamento: false,
            djen_nova_comunicacao: false
          });
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
        toast({ title: "Sincronizado" });
      }
    } finally { setIsSavingAttendance(false); }
  };

  const copyScript = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado" });
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
          cliente: nome, vencidos: 0, hoje: 0, totalAtivos: 0, diasAtrasoMax: 0,
          protocoloReferencia: c.protocolo, telefone: c.telefone || '', advogado: c.advogado || '', escritorio: (c.escritorio || '').trim().toUpperCase(),
          cases: [], hasBA: false, hasClosedCourt: false, hasUpdate: false, eventoUnificadoResumo: null, eventoTipo: null, statusScore: 0, oldestReturnGap: 0
        };
      }
      const g = groups[nome];
      g.totalAtivos++;
      g.cases.push(c);
      if (c.indicio_busca_apreensao) g.hasBA = true;
      if (c.datajud_encerrado_tribunal) g.hasClosedCourt = true;
      if (c.tem_novo_andamento) g.hasUpdate = true;
      if (c.evento_resumo) { g.eventoUnificadoResumo = c.evento_resumo; g.eventoTipo = c.evento_tipo || null; }

      let currentScore = 0;
      const statusUpper = (c.status || '').toUpperCase();
      if (statusUpper.includes('CRÍTICO')) currentScore = 50;
      else if (statusUpper === 'VENCIDO') currentScore = 40;
      else if (statusUpper === 'É HOJE') currentScore = 30;
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
      } else g.oldestReturnGap = 365;
    });

    const sortedAll = Object.values(groups)
      .filter(g => (g.cliente.toLowerCase().includes(search.toLowerCase()) || g.protocoloReferencia.includes(search)) && (officeFilter === 'all' || g.escritorio === officeFilter))
      .sort((a, b) => {
        // a) hasBA (Sempre Primeiro)
        if (a.hasBA !== b.hasBA) return a.hasBA ? -1 : 1;
        
        // b) hasClosedCourt (Baixa Real)
        if (a.hasClosedCourt !== b.hasClosedCourt) return a.hasClosedCourt ? -1 : 1;
        
        // c) eventoTipo importante (Peso Jurídico)
        const getEventWeight = (type: string | null) => {
           if (!type) return 0;
           if (type === 'ba') return 100;
           if (type.startsWith('sentenca')) return 90;
           if (type.startsWith('audiencia') || type === 'liminar') return 80;
           if (type === 'cumprimento_sentenca' || type === 'cumprimento') return 70;
           if (type === 'novo_andamento_relevante') return 60;
           return 0;
        };
        const weightA = getEventWeight(a.eventoTipo);
        const weightB = getEventWeight(b.eventoTipo);
        if (weightB !== weightA) return weightB - weightA;

        // d) statusScore (Crítico > Vencido > Hoje)
        if (b.statusScore !== a.statusScore) return b.statusScore - a.statusScore;
        
        // e) oldestReturnGap (Mais dias sem retorno)
        if (b.oldestReturnGap !== a.oldestReturnGap) return b.oldestReturnGap - a.oldestReturnGap;
        
        // f) totalAtivos (Desempate Volume)
        return b.totalAtivos - a.totalAtivos;
      });

    const pending = sortedAll.filter(g => !contactedSet.has(g.cliente));
    return { focus: pending.slice(0, dailyMeta), backlog: pending.slice(dailyMeta), completed: sortedAll.filter(g => contactedSet.has(g.cliente)), totalPendingCount: pending.length };
  }, [cases, search, officeFilter, contatadosHoje, dailyMeta]);

  const distinctOffices = useMemo(() => {
    const set = new Set<string>();
    cases.forEach(c => {
      const off = (c.escritorio || '').trim().toUpperCase();
      if (off) set.add(off);
    });
    return Array.from(set).sort();
  }, [cases]);

  const unifiedHistory = useMemo(() => {
    if (!historyResult) return [];
    const movs = (historyResult.movimentos || []).map(m => ({ type: 'court', date: m.dataHora ? new Date(m.dataHora) : new Date(0), title: m.nome, subtitle: m.complemento || '', raw: m }));
    const djen = (historyResult.djenComunicacoes || []).map(d => ({ 
      type: 'djen', 
      date: d.data_disponibilizacao ? new Date(d.data_disponibilizacao) : new Date(0), 
      title: summarizeDjenKeywords(d.texto), 
      subtitle: d.nomeOrgao || '', 
      raw: d 
    }));
    return [...movs, ...djen].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [historyResult]);

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className={cn("flex-1 flex flex-col h-screen overflow-hidden", ui.main)}>
        <header className="h-auto border-b border-border/50 bg-card/60 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:px-10 gap-4 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-black text-white rounded-lg shadow-lg"><CheckCircle size={20} className="text-primary" /></div>
            <h1 className="font-black text-base sm:text-xl text-foreground uppercase tracking-tight">Fila Crítica de Atendimento</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="h-9 px-4 border-none bg-primary/5 text-primary font-black uppercase text-[10px]">Audit Híbrida Ativa</Badge>
            <Button variant="ghost" size="icon" onClick={loadData} className="h-10 w-10 rounded-xl hover:bg-secondary"><RefreshCcw className={cn("w-5 h-5", loading && "animate-spin text-primary")} /></Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-10 max-w-[1400px] mx-auto w-full space-y-10 pb-32">
          <section className={ui.metrics}>
            <div className="premium-card p-6 border-l-4 border-l-slate-400"><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Pendentes</p><h3 className="text-3xl font-black text-foreground tabular-nums">{taskData.totalPendingCount}</h3></div>
            <div className="premium-card p-6 border-l-4 border-l-primary relative group"><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Meta do Dia</p><div className="flex items-center gap-4"><span className="text-4xl font-black text-foreground tabular-nums">{dailyMeta}</span><div className="flex items-center gap-1.5 ml-auto"><Button variant="outline" size="icon" onClick={() => adjustMeta(-5)} className="h-8 w-8"><Minus size={14} /></Button><Button variant="outline" size="icon" onClick={() => adjustMeta(5)} className="h-8 w-8"><Plus size={14} /></Button></div></div></div>
            <div className="premium-card p-6 border-l-4 border-l-emerald-500"><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Finalizados</p><h3 className="text-3xl font-black text-emerald-600 tabular-nums">{contatadosHoje.length}</h3></div>
          </section>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white border border-border/50 p-4 sm:p-6 rounded-2xl shadow-sm">
             <div className="flex-1 w-full flex flex-col md:flex-row gap-4">
                <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" /><Input placeholder="Pesquisar por cliente ou CNJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11 h-12 bg-[#f8f9fb] border-none text-base sm:text-xs font-bold uppercase rounded-xl" /></div>
                <Select value={officeFilter} onValueChange={setOfficeFilter}>
                   <SelectTrigger className="h-12 w-full md:w-[250px] bg-[#f8f9fb] border-none rounded-xl font-black uppercase text-[10px] tracking-widest px-6 shadow-sm"><SelectValue placeholder="TODOS ESCRITÓRIOS" /></SelectTrigger>
                   <SelectContent className="bg-white border-2 border-black rounded-xl">
                      <SelectItem value="all" className="font-black uppercase text-[10px]">TODOS ESCRITÓRIOS</SelectItem>
                      {distinctOffices.map(off => <SelectItem key={off} value={off} className="font-black uppercase text-[10px]">{off}</SelectItem>)}
                   </SelectContent>
                </Select>
             </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3"><Target size={18} className="text-primary" /><h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Sequência Prioritária</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {taskData.focus.map((group) => (
                <TaskCard key={group.cliente} group={group} isFocus onMarkContacted={() => { setActiveGroup(group); setIsAttendanceOpen(true); }} onScan={handleSingleScan} onSuggest={() => handleSuggestClick(group.protocoloReferencia, group.cliente, group.cases[0]?.ultimoRetorno || null)} />
              ))}
            </div>
          </div>

          {taskData.backlog.length > 0 && (
            <div className="space-y-4 pt-10 border-t border-border/30">
               <Button variant="ghost" onClick={() => setShowBacklog(!showBacklog)} className="h-10 px-4 font-black uppercase text-[10px] tracking-widest text-muted-foreground rounded-xl">{showBacklog ? <ChevronUp size={16} className="mr-2"/> : <ChevronDown size={16} className="mr-2"/>} Ver Backlog ({taskData.backlog.length})</Button>
               {showBacklog && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{taskData.backlog.map((group) => <TaskCard key={group.cliente} group={group} onMarkContacted={() => { setActiveGroup(group); setIsAttendanceOpen(true); }} onScan={handleSingleScan} onSuggest={() => handleSuggestClick(group.protocoloReferencia, group.cliente, group.cases[0]?.ultimoRetorno || null)} />)}</div>}
            </div>
          )}
        </div>

        <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
          <DialogContent className="sm:max-w-[950px] w-[calc(100vw-2rem)] rounded-2xl border-none shadow-2xl p-0 overflow-hidden h-[90vh] flex flex-col">
            <DialogHeader className="p-4 sm:p-6 bg-black text-white shrink-0">
              <DialogTitle className="font-black uppercase tracking-tight text-lg sm:text-xl flex items-center gap-3"><History size={24} className="text-primary"/> Auditoria Unificada (Audit 3D)</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col flex-1 bg-white overflow-hidden min-h-0">
              <ScrollArea className="flex-1 w-full h-full">
                <div className="p-4 sm:p-6 space-y-10">
                  <section className="space-y-6">
                     <h3 className={cn("text-black flex items-center justify-between border-b-2 border-black/5 pb-2", ui.label)}><div className="flex items-center gap-2"><Globe size={14} className="text-primary"/> Cronologia Unificada</div></h3>
                     <div className="space-y-6">
                       {unifiedHistory.map((item, i) => (
                         <div key={i} className={cn("relative p-5 border-2 rounded-xl transition-all", item.type === 'djen' ? "border-blue-600 bg-blue-50/10 shadow-[4px_4px_0px_#2563eb]" : "border-slate-200 bg-slate-50/50")}>
                           <div className="flex items-start justify-between mb-3">
                             <div className="flex items-center gap-3">
                               <Badge className={cn("text-[8px] font-black uppercase rounded-none", item.type === 'djen' ? "bg-blue-600" : "bg-slate-500")}>{item.type === 'djen' ? 'Diário Oficial' : 'Tribunal'}</Badge>
                               <span className="text-[10px] font-black text-muted-foreground uppercase">{format(item.date, 'dd/MM/yyyy')}</span>
                             </div>
                             {item.type === 'djen' && <Button variant="ghost" size="icon" onClick={() => handleExportDjenPDF(item.raw)} className="h-8 w-8 hover:bg-blue-600 hover:text-white border border-blue-600/20 ml-auto"><Download size={14} /></Button>}
                           </div>
                           <h4 className="text-sm font-black uppercase text-foreground leading-tight mb-2">{item.title}</h4>
                           <p className="text-[9px] font-bold text-muted-foreground uppercase">{item.subtitle}</p>
                           {item.type === 'djen' && <div className="mt-4 p-4 bg-white border border-blue-100 rounded-lg"><p className={cn("text-black leading-relaxed italic", ui.readable)}>{plainTextFromDjen(item.raw.texto)}</p></div>}
                         </div>
                       ))}
                     </div>
                  </section>

                  <section className="space-y-6 pt-6 border-t">
                    <h3 className={cn("text-amber-600 flex items-center gap-2", ui.label)}><Sparkles size={14} /> Draft Estratégico & Sugestões</h3>
                    <div className="bg-black text-white p-4 sm:p-6 space-y-4 rounded-xl">
                      <p className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Bot size={12}/> Motor Neural Lexis</p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Select value={selectedMotor} onValueChange={setSelectedMotor}>
                          <SelectTrigger className="h-10 bg-white/10 border-white/20 text-white font-black uppercase text-[10px] rounded-lg flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-white border-2 border-black rounded-lg">
                            <SelectItem value="local_only" className="text-[9px] font-black uppercase">Motor Lexis Soberano</SelectItem>
                            <SelectItem value="xai" className="text-[9px] font-black uppercase">xAI Grok 2 Elite</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button onClick={handleGenerateAIDraft} disabled={isGeneratingAIDraft} className="h-10 px-6 bg-white text-black font-black uppercase text-[10px] rounded-lg">{isGeneratingAIDraft ? <Loader2 size={12} className="animate-spin" /> : "Gerar Rascunho"}</Button>
                      </div>
                      {aiDraft && <div className="space-y-3 animate-in fade-in duration-500 mt-2"><div className="p-4 bg-white/5 border border-white/10 rounded-lg"><p className={cn("text-white/80 italic", ui.readable)}>"{aiDraft}"</p></div><Button onClick={() => copyScript(aiDraft)} variant="ghost" className="h-10 w-full text-[9px] font-black uppercase border border-white/20 hover:bg-white/10 text-white rounded-lg">Copiar Rascunho</Button></div>}
                    </div>

                    {showScripts && suggestedScripts.length > 0 && (
                      <div className="grid gap-4">
                        {suggestedScripts.map((script, idx) => (
                          <div key={idx} className="bg-white border-2 border-black p-5 rounded-xl shadow-sm space-y-4">
                            <Badge className="bg-black text-white text-[8px] font-black uppercase rounded-none">{script.titulo}</Badge>
                            <p className="text-[11px] font-black uppercase leading-tight">{script.quandoUsar}</p>
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

        <Dialog open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen}>
          <DialogContent className="sm:max-w-[480px] rounded-2xl border-none shadow-2xl h-[90vh] overflow-hidden p-0 flex flex-col">
            <form className="flex flex-col h-full">
              <DialogHeader className="p-6 bg-secondary/20 border-b shrink-0"><DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2"><UserCheck className="text-primary" /> Registrar Atendimento</DialogTitle></DialogHeader>
              <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
                  <div className="grid gap-2"><Label className={ui.label}>Resultado do Contato</Label><Select value={attendanceForm.situacao} onValueChange={(val) => setAttendanceForm({...attendanceForm, situacao: val})}><SelectTrigger className="rounded-xl h-12 bg-secondary/30 border-none font-bold text-[11px] uppercase"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EM ANDAMENTO" className="text-[10px] font-bold uppercase">Manter Ativo</SelectItem><SelectItem value="ENCERRADO" className="text-[10px] font-bold uppercase text-red-600">Encerrar Caso</SelectItem></SelectContent></Select></div>
                  <div className="grid gap-2"><Label className={ui.label}>Próximo retorno</Label><Input type="date" value={attendanceForm.proximoRetorno} onChange={(e) => setAttendanceForm({...attendanceForm, proximoRetorno: e.target.value})} disabled={attendanceForm.situacao === 'ENCERRADO'} className="rounded-xl h-12 bg-secondary/30 border-none font-bold uppercase" /></div>
                  <div className="grid gap-2"><Label className={ui.label}>Observações</Label><Textarea placeholder="Histórico de conversa..." value={attendanceForm.observacao} onChange={(e) => setAttendanceForm({...attendanceForm, observacao: e.target.value.toUpperCase()})} className="rounded-xl min-h-[100px] bg-secondary/30 border-none font-bold uppercase resize-none" /></div>
                  <div className="flex items-center space-x-3 pt-2"><Checkbox id="applyToAll" checked={attendanceForm.applyToAll} onCheckedChange={(val) => setAttendanceForm({...attendanceForm, applyToAll: !!val})} /><Label htmlFor="applyToAll" className="text-[10px] font-black uppercase cursor-pointer leading-tight">Aplicar a toda carteira do cliente</Label></div>
              </div>
              <DialogFooter className="p-6 pt-0 shrink-0"><Button type="button" onClick={handleSaveAttendance} disabled={isSavingAttendance} className="w-full h-14 bg-black text-white rounded-xl font-black uppercase text-[11px] shadow-xl">{isSavingAttendance ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />} Sincronizar Registro</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function TaskCard({ group, isFocus = false, onMarkContacted, onScan, onSuggest }: { group: TaskGroup, isFocus?: boolean, onMarkContacted: () => void, onScan: (protocolo: string) => void, onSuggest: () => void }) {
  return (
    <div className={cn("premium-card p-4 sm:p-6 bg-white flex flex-col transition-all group border-l-4", isFocus ? "border-l-primary shadow-md" : "border-l-slate-200 shadow-sm", group.hasBA && "border-l-red-600 bg-red-50/10", group.hasClosedCourt && "border-l-black bg-slate-50/50")}>
      <div className="flex justify-between items-start mb-6">
        <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all", group.hasBA ? "bg-red-600 text-white" : group.hasClosedCourt ? "bg-black text-white" : "bg-slate-50 text-slate-400 group-hover:bg-primary group-hover:text-white")}>
          {group.hasBA ? <ShieldAlert size={24} /> : group.hasClosedCourt ? <Gavel size={24} /> : <UserCheck size={24} />}
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          {group.hasBA ? <Badge className="bg-red-600 text-white text-[8px] font-black uppercase">CRÍTICO: B.A.</Badge> : group.hasClosedCourt ? <Badge className="bg-black text-red-500 border-2 border-red-500 text-[8px] font-black uppercase">BAIXA TRIBUNAL</Badge> : group.hasUpdate ? <Badge variant="destructive" className="text-[7px] font-black uppercase animate-pulse">NOVO EVENTO</Badge> : <Badge variant="outline" className="text-[8px] font-black uppercase">Monitoramento</Badge>}
        </div>
      </div>
      <div className="space-y-1 flex-1">
        <h3 className="font-black text-sm text-foreground uppercase tracking-tight truncate group-hover:text-primary transition-colors">{group.cliente}</h3>
        <p className={cn("text-muted-foreground uppercase", ui.cnj)}>{group.protocoloReferencia}</p>
        <div className="mt-4 flex items-center gap-2">
           <Building2 size={12} className="text-black/30" />
           <span className="text-[9px] font-black uppercase text-black/40">{group.escritorio || 'GERAL'}</span>
        </div>
        {group.eventoUnificadoResumo && <div className={cn("mt-4 p-3 rounded-xl border", group.eventoTipo === 'ba' ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100")}><p className={cn("text-[10px] font-black uppercase mb-1", group.eventoTipo === 'ba' ? "text-red-700" : "text-blue-700")}>Novidade Identificada</p><p className={cn("text-foreground/80 leading-relaxed italic line-clamp-3 uppercase font-bold text-[11px]", ui.readable)}>{group.eventoUnificadoResumo}</p></div>}
      </div>
      <div className="mt-6 pt-6 border-t border-border/30 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
           <Button variant="ghost" size="icon" onClick={onSuggest} className={cn("text-amber-600 hover:bg-amber-50", ui.touch)} title="Sugestão de Resposta"><MessageSquareQuote size={18} /></Button>
           <Button variant="ghost" size="icon" onClick={() => onScan(group.protocoloReferencia)} className={cn("text-primary hover:bg-primary/10", ui.touch)} title="Auditoria 3D"><FileSearch size={18} /></Button>
           <Button variant="ghost" size="icon" asChild className={cn("text-emerald-600 hover:bg-emerald-50", ui.touch)} title="WhatsApp"><a href={formatWhatsAppLink(group.telefone)} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /></a></Button>
           <Button variant="ghost" size="icon" onClick={onMarkContacted} className={cn("text-slate-400 hover:text-emerald-600", ui.touch)} title="Marcar Contatado"><UserCheck size={18} /></Button>
        </div>
        <Button variant="ghost" asChild className="h-10 px-3 sm:px-4 rounded-xl text-[10px] font-black uppercase hover:text-primary transition-all"><Link href={`/cases?search=${encodeURIComponent(group.cliente)}`}>Gerir <ChevronRight size={14} className="ml-1 hidden sm:inline" /></Link></Button>
      </div>
    </div>
  );
}