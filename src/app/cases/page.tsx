/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense, useDeferredValue } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Search, 
  Trash2, 
  ExternalLink, 
  RefreshCcw, 
  Plus, 
  Briefcase, 
  Edit2, 
  CheckCircle2, 
  Clock, 
  MessageCircle, 
  Zap, 
  Loader2, 
  CalendarDays, 
  Eye, 
  EyeOff, 
  Sparkles, 
  History,
  Building2,
  AlertCircle,
  FileSearch,
  FileDown,
  ShieldAlert,
  Scale,
  MessageSquare,
  Copy,
  MessageSquareQuote,
  Settings2,
  BookOpen,
  Globe,
  Info,
  AlertTriangle,
  Gavel,
  Bell,
  Bot
} from 'lucide-react';
import { LegalCase, processarCaso } from '@/lib/case-logic';
import { cn, formatWhatsAppLink } from '@/lib/utils';
import { ui } from '@/lib/responsive-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { fetchRepoCases, syncRepoCases, recalibrateCasesAction, runDataJudScanAction, scanSingleCaseAction, scanOneDjenAction } from '@/app/actions/case-actions';
import { format, parseISO, startOfDay, isAfter, parse, isValid } from 'date-fns';
import { useAdmin } from '@/hooks/use-admin';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { calcularProbabilidadeEncerramento } from '@/lib/probabilidade-encerramento';
import { useAppStore } from '@/store/use-app-store';
import { suggestScripts, ScriptSuggestion } from '@/lib/script-processual/suggest';
import { gerarRascunhoEstrategico } from '@/ai/motor-despacho';
import { plainTextFromDjen } from '@/lib/djen';

const CaseRow = React.memo(({ 
  c, 
  isOperador, 
  onLogReturn, 
  onEdit, 
  onDelete,
  onScan,
  onSuggest
}: { 
  c: LegalCase, 
  isOperador: boolean, 
  onLogReturn: (p: string) => void, 
  onEdit: (c: LegalCase) => void, 
  onDelete: (id: string) => void,
  onScan: (c: LegalCase) => void,
  onSuggest: (c: LegalCase) => void
}) => {
  const prob = calcularProbabilidadeEncerramento({
    status: c.status,
    situacao: c.situacao,
    observacao: c.observacao,
    diasVencidos: c.diasFaltando && c.diasFaltando < 0 ? Math.abs(c.diasFaltando) : 0
  });

  const [loading, setLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const isExecutionPhase = useMemo(() => {
    if (c.datajud_encerrado_tribunal) return false;
    if (c.em_cumprimento_sentenca) return true;
    const text = `${c.datajud_ultimo_nome || ''} ${c.observacao || ''}`.toUpperCase();
    return /CUMPRIMENTO DE SENTEN[CÇ]A|FASE DE CUMPRIMENTO|IN[IÍ]CIO DO CUMPRIMENTO|EXECU[ÇC][AÃ]O DE SENTEN[CÇ]A|CUMPRIMENTO PROVIS[OÓ]RIO/.test(text);
  }, [c]);

  return (
    <tr className="hover:bg-secondary/30 transition-all border-b border-border/50 group">
      <td className="px-8 py-5">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground font-black text-[13px] uppercase leading-none tracking-tight group-hover:text-primary transition-colors">{c.cliente}</span>
            
            {c.indicio_busca_apreensao && (
              <Badge 
                title={`${c.busca_apreensao_motivo} (Confiança: ${c.busca_apreensao_confianca})`}
                className={cn(
                  "h-5 px-2 rounded-md font-black uppercase text-[8px] animate-bounce border-2",
                  c.busca_apreensao_confianca === 'alta' ? "bg-red-600 text-white border-red-800" : "bg-amber-500 text-black border-amber-700"
                )}
              >
                <ShieldAlert size={10} className="mr-1" /> BUSCA E APREENSÃO
              </Badge>
            )}

            {isExecutionPhase && (
              <Badge 
                title={c.cumprimento_sentenca_motivo || "Fase Executiva Detectada"}
                className="h-5 px-2 rounded-md bg-indigo-900 text-white font-black uppercase text-[8px] border-2 border-indigo-500"
              >
                <Scale size={10} className="mr-1" /> CUMPRIMENTO DE SENTENÇA
              </Badge>
            )}

            {c.datajud_encerrado_tribunal && (
              <Badge 
                title={c.datajud_encerrado_motivo || "Encerrado no Tribunal"}
                className="h-5 px-2 rounded-md bg-black text-red-500 font-black uppercase text-[8px] border-2 border-red-500 animate-pulse"
              >
                Encerrado Tribunal
              </Badge>
            )}

            {c.tem_atualizacao_pos_retorno && !c.datajud_encerrado_tribunal && (
              <Badge 
                title={c.datajud_ultimo_nome || "Novo andamento identificado"}
                variant="destructive" 
                className="h-5 px-2 rounded-md font-black uppercase text-[8px] animate-pulse"
              >
                Novo Andamento
              </Badge>
            )}

            {c.djen_nova_comunicacao && (
              <Badge 
                title={c.djen_ultimo_resumo || "Nova comunicação oficial no DJEN"}
                className="h-5 px-2 rounded-md bg-blue-600 text-white font-black uppercase text-[8px] border-2 border-blue-800 animate-pulse"
              >
                DJEN
              </Badge>
            )}
          </div>
          <span className={cn("text-[10px] font-mono text-muted-foreground uppercase tracking-widest", ui.cnj)}>{c.protocolo}</span>
        </div>
      </td>
      <td className="px-8 py-5">
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className="bg-card border-border/50 font-black text-[9px] text-muted-foreground uppercase rounded-md h-7 px-3 w-fit">
            {c.tribunal}
          </Badge>
          <div className="flex items-center gap-1 text-[8px] font-black text-primary/60 uppercase tracking-tighter" title="Estimativa automática">
            <Sparkles size={10} /> Prob. Encerramento: {prob}%
          </div>
        </div>
      </td>
      <td className="px-8 py-5 text-[11px] text-foreground font-bold uppercase">
        <div className="flex flex-col gap-1">
           <span>{c.advogado}</span>
           {c.escritorio && (
             <span className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">{c.escritorio}</span>
           )}
        </div>
      </td>
      <td className="px-8 py-5">
        <div className="flex flex-col gap-2">
          <StatusBadge status={c.status} />
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tight text-foreground">
            <CalendarDays size={14} className="text-primary" />
            <span>Prazo: {c.proximoPrazo || 'Sem Registro'}</span>
          </div>
        </div>
      </td>
      <td className="px-8 py-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg border border-border/50 flex items-center justify-center bg-secondary/50 group-hover:bg-background transition-all">
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-muted-foreground uppercase leading-none mb-1 tracking-widest">Retorno</span>
              <span className="text-11px text-foreground font-bold uppercase whitespace-nowrap">
                {c.ultimoRetorno || 'S/ Atendimento'}
              </span>
            </div>
          </div>

          {c.datajud_ultimo_nome && (
            <div className="flex items-center gap-3 pl-0.5">
              <div className="w-7 h-7 rounded-lg border border-border/30 flex items-center justify-center bg-primary/5 group-hover:bg-primary/10 transition-all">
                <History size={14} className="text-primary/60" />
              </div>
              <div className="flex flex-col max-w-[180px]">
                <span className="text-[8px] font-black text-primary/60 uppercase leading-none mb-1 tracking-widest">Mov. Tribunal</span>
                <span className="text-[10px] text-foreground font-black uppercase truncate leading-tight" title={c.datajud_ultimo_nome}>
                  {c.datajud_ultimo_nome}
                </span>
                <span className="text-[8px] font-mono text-muted-foreground/60 mt-0.5">
                  {c.datajud_ultimo_movimento ? format(new Date(c.datajud_ultimo_movimento), 'dd/MM/yyyy') : 'S/ Data'}
                </span>
              </div>
            </div>
          )}
        </div>
      </td>
      <td className="px-8 py-5 text-right">
        <div className="flex items-center justify-end gap-2">
          <button 
            title="Sugerir Resposta" 
            disabled={suggestLoading}
            onClick={async () => {
              setSuggestLoading(true);
              await onSuggest(c);
              setSuggestLoading(false);
            }} 
            className={cn("text-amber-600 hover:bg-amber-50 w-9 h-9 rounded-lg flex items-center justify-center transition-colors", ui.touch)}
          >
            {suggestLoading ? <Loader2 size={18} className="animate-spin" /> : <MessageSquareQuote size={18} />}
          </button>
          <button 
            title="Andamentos Oficiais" 
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              await onScan(c);
              setLoading(false);
            }} 
            className={cn("text-primary hover:bg-primary/10 w-9 h-9 rounded-lg flex items-center justify-center transition-colors", ui.touch)}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <FileSearch size={18} />}
          </button>

          <Link 
            href={`/notificacoes?search=${c.protocolo}`} 
            title="Ver Notificações" 
            className={cn("text-blue-600 hover:bg-blue-50 w-9 h-9 rounded-lg flex items-center justify-center transition-colors", ui.touch)}
          >
            <Bell size={18} />
          </Link>

          {isOperador && (
            <button title="Registrar Atendimento" onClick={(e) => { e.stopPropagation(); onLogReturn(c.protocolo); }} className={cn("text-emerald-600 hover:bg-emerald-50 w-9 h-9 rounded-lg flex items-center justify-center transition-colors", ui.touch)}>
              <CheckCircle2 size={18} />
            </button>
          )}
          {c.telefone && (
             <a href={formatWhatsAppLink(c.telefone)} target="_blank" rel="noopener noreferrer" title="WhatsApp" className={cn("text-emerald-600 hover:bg-emerald-50 w-9 h-9 rounded-lg flex items-center justify-center transition-colors", ui.touch)}>
               <MessageCircle size={18} />
             </a>
          )}
          <a href={c.linkConsulta} target="_blank" rel="noopener noreferrer" title="Tribunal" className={cn("text-muted-foreground hover:bg-secondary w-9 h-9 rounded-lg flex items-center justify-center transition-colors", ui.touch)}>
            <ExternalLink size={18} />
          </a>
          {isOperador && (
            <>
              <button title="Editar" onClick={(e) => { e.stopPropagation(); onEdit(c); }} className={cn("text-muted-foreground hover:bg-secondary w-9 h-9 rounded-lg flex items-center justify-center transition-colors", ui.touch)}>
                <Edit2 size={18} />
              </button>
              <button title="Excluir" onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} className={cn("text-muted-foreground hover:text-red-600 hover:bg-red-50 w-9 h-9 rounded-lg flex items-center justify-center transition-colors", ui.touch)}>
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
});

CaseRow.displayName = 'CaseRow';

function CasesContent() {
  const { cases, setCases, updateCaseByProtocolo, updateCase, addCase } = useAppStore();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialFilter = searchParams.get('filter') || 'all';
  
  const [search, setSearch] = useState(initialSearch);
  const deferredSearch = useDeferredValue(search);
  
  const [officeFilter, setOfficeFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState(initialFilter);
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [loadingDjen, setLoadingDjen] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<LegalCase | null>(null);
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyResult, setHistoryResult] = useState<{ case: LegalCase, movimentos: any[], djenComunicacoes?: any[] } | null>(null);
  const [suggestedScripts, setSuggestedScripts] = useState<ScriptSuggestion[]>([]);
  const [showScripts, setShowScripts] = useState(false);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [isGeneratingAIDraft, setIsGeneratingAIDraft] = useState(false);
  const [selectedMotor, setSelectedMotor] = useState<string>('local_only');

  const [mounted, setMounted] = useState(false);
  const { isOperador, profile } = useAdmin();
  const { toast } = useToast();

  const [formState, setFormState] = useState({
    cliente: '',
    protocolo: '',
    advogado: '',
    proximoPrazo: '',
    situacao: 'EM ANDAMENTO',
    ultimoRetorno: '',
    statusManual: 'Automatico',
    observacao: '',
    telefone: '',
    escritorio: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const repoData = await fetchRepoCases();
      if (Array.isArray(repoData)) {
        setCases(repoData);
      }
    } finally {
      setLoading(false);
    }
  }, [setCases]);

  const handleDataJudScan = async () => {
    if (!isOperador || isScanning) return;
    setIsScanning(true);
    toast({ title: "Iniciando Varredura Estratégica", description: "Auditando lote de processos prioritários..." });
    
    try {
      const res = await runDataJudScanAction();
      if (res && res.success) {
        toast({ title: "Lote Auditado", description: res.message });
        await loadData();
      } else {
        toast({ title: "Erro na Varredura", description: res?.error || "Falha técnica.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Falha de Conexão", variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSingleScan = async (caseItem: LegalCase) => {
    try {
      const res = await scanSingleCaseAction(caseItem.protocolo);
      if (res.success && res.case) {
        setHistoryResult({ case: res.case, movimentos: res.movimentos || [] });
        setIsHistoryModalOpen(true);
        setShowScripts(false);
        setSuggestedScripts([]);
        setAiDraft(null);
        if (res.casePatch) {
          updateCaseByProtocolo(caseItem.protocolo, res.casePatch);
        } else if (res.case) {
          updateCase(res.case.id || '', res.case);
        }
      } else {
        toast({ 
          title: "Auditoria Indisponível", 
          description: res.message || "Tribunal não retornou andamentos para este CNJ.", 
          variant: "destructive" 
        });
      }
    } catch (e) {
      toast({ title: "Erro na consulta", variant: "destructive" });
    }
  };

  const handleDjenScan = async () => {
    if (!historyResult || loadingDjen) return;
    setLoadingDjen(true);
    try {
      const res = await scanOneDjenAction(historyResult.case.protocolo);
      if (res.success) {
        setHistoryResult(prev => ({ ...prev!, djenComunicacoes: res.comunicacoes }));
        if (res.casePatch) updateCaseByProtocolo(historyResult.case.protocolo, res.casePatch);
        toast({ title: "DJEN Sincronizado", description: res.message });
      } else {
        toast({ title: "Falha no DJEN", description: res.message || "Erro regional (403/gru1)", variant: "destructive" });
      }
    } finally {
      setLoadingDjen(false);
    }
  };

  const handleSuggestClick = async (caseItem: LegalCase) => {
    try {
      const res = await scanSingleCaseAction(caseItem.protocolo);
      if (res.success && res.case) {
        const moves = res.movimentos || [];
        setHistoryResult({ case: res.case, movimentos: moves });
        setAiDraft(null);
        
        const suggestions = suggestScripts({
          clienteNome: res.case.cliente,
          protocolo: res.case.protocolo,
          ultimoRetorno: res.case.ultimoRetorno,
          movimentos: moves
        });
        
        setSuggestedScripts(suggestions);
        setShowScripts(true);
        setIsHistoryModalOpen(true);
        
        if (res.casePatch) {
          updateCaseByProtocolo(caseItem.protocolo, res.casePatch);
        } else if (res.case) {
          updateCase(res.case.id || '', res.case);
        }
      } else {
        toast({ 
          title: "Sugestão Indisponível", 
          description: res.message || "Tribunal não retornou andamentos.", 
          variant: "destructive" 
        });
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

  const handleBatchUpdateStatus = async () => {
    if (!isOperador || cases.length === 0 || isUpdating) return;
    setIsUpdating(true);
    toast({ title: "Recalibrando Gabinete", description: "Reprocessando urgências e prazos..." });
    try {
      const savedThreshold = localStorage.getItem('lexisPredict_urgency_alert');
      const alertLimit = savedThreshold ? parseInt(savedThreshold) : 3;
      const result = await recalibrateCasesAction(alertLimit);
      if (result && result.success) {
        toast({ title: "Recalibração Concluída", description: result.message });
        await loadData();
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportCSV = useCallback(() => {
    const searchLower = deferredSearch.toLowerCase();
    const filteredCases = cases.filter(c => {
      const matchesSearch = (c.cliente || '').toLowerCase().includes(searchLower) || 
                            (c.protocolo || '').includes(deferredSearch);
      const matchesOffice = officeFilter === 'all' || c.escritorio === officeFilter;
      const matchesQuick = quickFilter === 'all' || (quickFilter === 'updated' && (c.tem_atualizacao_pos_retorno || c.datajud_encerrado_tribunal || c.indicio_busca_apreensao || c.djen_nova_comunicacao));
      const isEncerrado = isCasoEncerrado(c);
      let pass = matchesSearch && matchesOffice && matchesQuick;
      if (!showClosed && isEncerrado) pass = false;
      return pass;
    });

    if (filteredCases.length === 0) {
      toast({ title: "Lista vazia", variant: "destructive" });
      return;
    }

    const headersList = [
      'CLIENTE', 'PROTOCOLO', 'TRIBUNAL', 'ADVOGADO', 'ESCRITORIO', 'STATUS',
      'PROXIMO_PRAZO', 'ULTIMO_RETORNO', 'OBSERVACAO', 'TELEFONE',
      'TEM_NOVO_ANDAMENTO', 'ENCERRADO_TRIBUNAL', 'INDICIO_BA', 'CUMPRIMENTO_SENTENCA', 'DJEN_NOVIDADE'
    ];

    const rows = filteredCases.map(c => {
      return [
        c.cliente,
        c.protocolo,
        c.tribunal,
        c.advogado,
        c.escritorio || '',
        c.status,
        c.proximoPrazo || '',
        c.ultimoRetorno || '',
        (c.observacao || '').replace(/\n/g, ' '),
        c.telefone || '',
        c.tem_atualizacao_pos_retorno ? 'SIM' : 'NÃO',
        c.datajud_encerrado_tribunal ? 'SIM' : 'NÃO',
        c.indicio_busca_apreensao ? 'SIM' : 'NÃO',
        c.em_cumprimento_sentenca ? 'SIM' : 'NÃO',
        c.djen_nova_comunicacao ? 'SIM' : 'NÃO'
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(';');
    });

    const csvContent = "\uFEFF" + [headersList.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `processos_lexis_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Exportação Concluída" });
  }, [cases, deferredSearch, officeFilter, quickFilter, showClosed, toast]);

  useEffect(() => { 
    setMounted(true);
    loadData(); 
  }, [loadData]);

  const handleSaveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOperador || !formState.cliente || !formState.protocolo) return;

    try {
      const savedThreshold = localStorage.getItem('lexisPredict_urgency_alert');
      const thresholds = { alertLimit: savedThreshold ? parseInt(savedThreshold) : 3 };
      
      const rawData = {
        ...editingCase,
        cliente: formState.cliente,
        protocolo: formState.protocolo,
        advogado: formState.advogado,
        proximoPrazo: formState.proximoPrazo,
        situacao: formState.situacao,
        ultimoRetorno: formState.ultimoRetorno,
        statusManual: formState.statusManual,
        observacao: formState.observacao,
        telefone: formState.telefone,
        escritorio: formState.escritorio
      };

      let newFlagStatus = editingCase?.tem_atualizacao_pos_retorno;
      if (formState.ultimoRetorno && editingCase?.datajud_ultimo_movimento) {
        try {
          const cleanStr = formState.ultimoRetorno.trim();
          let dateRet;
          if (cleanStr.includes('/')) {
            dateRet = startOfDay(parse(cleanStr, 'dd/MM/yyyy', new Date()));
          } else {
            dateRet = startOfDay(parseISO(cleanStr));
          }
          const dateMov = startOfDay(parseISO(editingCase.datajud_ultimo_movimento));
          if (isValid(dateRet) && !isAfter(dateMov, dateRet)) {
            newFlagStatus = false;
          }
        } catch (e) {}
      }

      const processed = processarCaso({ ...rawData, tem_atualizacao_pos_retorno: newFlagStatus }, thresholds);
      const result = await syncRepoCases([processed]);
      
      if (result.success) {
        if (editingCase) {
          updateCase(editingCase.id, processed);
        } else {
          addCase(processed);
        }
        
        setIsModalOpen(false);
        setEditingCase(null);
        toast({ title: "Registro Sincronizado" });
      } else {
        toast({ title: "Falha na Gravação", description: result.message || "Erro desconhecido.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro Crítico", variant: "destructive" });
    }
  };

  const handleLogReturn = useCallback(async (protocolo: string) => {
    if (!isOperador) return;
    const target = cases.find(c => c.protocolo === protocolo);
    if (!target) return;

    const todayDate = new Date();
    const todayStr = format(todayDate, 'dd/MM/yyyy');
    
    let shouldClearFlag = false;
    if (target.datajud_ultimo_movimento) {
      const lastMovDate = startOfDay(parseISO(target.datajud_ultimo_movimento));
      const returnDate = startOfDay(todayDate);
      if (!isAfter(lastMovDate, returnDate)) {
        shouldClearFlag = true;
      }
    } else {
      shouldClearFlag = true;
    }

    const updatedCase = { 
      ...target, 
      ultimoRetorno: todayStr,
      tem_atualizacao_pos_retorno: shouldClearFlag ? false : target.tem_atualizacao_pos_retorno,
      djen_nova_comunicacao: false 
    };
    
    const result = await syncRepoCases([updatedCase]);
    if (result.success) {
      updateCaseByProtocolo(protocolo, { ultimoRetorno: todayStr, tem_atualizacao_pos_retorno: updatedCase.tem_atualizacao_pos_retorno, djen_nova_comunicacao: false });
      toast({ title: "Atendimento Registrado" });
    }
  }, [cases, isOperador, toast, updateCaseByProtocolo]);

  const offices = useMemo(() => {
    const list = Array.from(new Set(cases.map(c => c.escritorio))).filter(Boolean).sort();
    return list;
  }, [cases]);

  const filtered = useMemo(() => {
    const searchLower = deferredSearch.toLowerCase();
    return cases.filter(c => {
      const matchesSearch = (c.cliente || '').toLowerCase().includes(searchLower) || 
                            (c.protocolo || '').includes(deferredSearch);
      
      const matchesOffice = officeFilter === 'all' || c.escritorio === officeFilter;
      const matchesQuick = quickFilter === 'all' || (quickFilter === 'updated' && (c.tem_atualizacao_pos_retorno || c.datajud_encerrado_tribunal || c.indicio_busca_apreensao || c.djen_nova_comunicacao));
      
      const isEncerrado = isCasoEncerrado(c);
      let pass = matchesSearch && matchesOffice && matchesQuick;
      if (!showClosed && isEncerrado) pass = false;
      
      return pass;
    });
  }, [cases, deferredSearch, showClosed, officeFilter, quickFilter]);

  const handleDelete = async (id: string) => {
    if (!isOperador) return;
    if (confirm('Excluir definitivamente?')) {
      const updated = cases.filter(item => item.id !== id);
      setCases(updated);
      await syncRepoCases(updated);
      toast({ title: "Removido" });
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className={cn("flex-1 flex flex-col h-screen overflow-hidden", ui.main)}>
        <header className="h-auto border-b border-border/50 bg-card/60 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:px-10 gap-4 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <h1 className="font-black text-base sm:text-xl text-foreground uppercase tracking-tight">Processos do Gabinete</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {isOperador && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDataJudScan}
                disabled={isScanning || loading}
                className={cn("h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest border-primary/20 hover:bg-primary/5", ui.touch)}
              >
                {isScanning ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Zap size={16} className="mr-2 text-primary" />}
                Scan
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={loadData} className="h-10 w-10 rounded-xl hover:bg-secondary">
              <RefreshCcw className={cn("w-5 h-5", loading && "animate-spin")} />
            </Button>
          </div>
        </header>

        <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-hidden">
          <div className="premium-card flex-1 flex flex-col overflow-hidden border-none bg-white">
            <div className="p-4 sm:p-5 border-b border-border/30 flex flex-col lg:flex-row items-center justify-between gap-4 shrink-0">
              <div className="flex flex-1 flex-col sm:flex-row items-center gap-4 w-full">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input 
                    placeholder="Pesquisar titular ou CNJ..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-11 h-11 bg-secondary/30 border-none rounded-xl text-base sm:text-xs font-bold uppercase"
                  />
                </div>
                
                <div className="w-full sm:w-48">
                  <Select value={quickFilter} onValueChange={setQuickFilter}>
                    <SelectTrigger className="h-11 bg-secondary/30 border-none rounded-xl text-[10px] font-black uppercase">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={14} className="text-primary" />
                        <SelectValue placeholder="FILTRO RÁPIDO" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-[10px] font-black uppercase">TODOS PROCESSOS</SelectItem>
                      <SelectItem value="updated" className="text-[10px] font-black uppercase text-red-600">⚠ AUDITORIA TRIBUNAL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full sm:w-48">
                  <Select value={officeFilter} onValueChange={setOfficeFilter}>
                    <SelectTrigger className="h-11 bg-secondary/30 border-none rounded-xl text-[10px] font-black uppercase">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-primary" />
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

              {/* GRUPO DE AÇÕES À DIREITA */}
              <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                {isOperador && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBatchUpdateStatus}
                    disabled={isUpdating || loading}
                    className={cn("h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest border-primary/20 hover:bg-primary/5 shrink-0", ui.touch)}
                  >
                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCcw size={16} className="mr-2 text-primary" />}
                    Recalibrar
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className={cn("h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest border-primary/20 hover:bg-primary/5 shrink-0", ui.touch)}
                >
                  <FileDown size={16} className="mr-2 text-primary" />
                  CSV
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowClosed(!showClosed)}
                  className={cn(
                    "h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all shrink-0",
                    ui.touch,
                    showClosed ? "bg-black text-white" : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {showClosed ? <Eye size={16} className="mr-2" /> : <EyeOff size={16} className="mr-2" />}
                  {showClosed ? "Ocultar" : "Mostrar"}
                </Button>
                {isOperador && (
                  <Button 
                    onClick={() => { setEditingCase(null); setIsModalOpen(true); }} 
                    className={cn("h-10 px-6 rounded-xl bg-black text-white hover:bg-black/90 font-black uppercase text-[10px] tracking-widest shadow-lg shrink-0", ui.touch)}
                  >
                    <Plus className="w-4 h-4 mr-2 text-primary" /> Novo
                  </Button>
                )}
              </div>
            </div>

            <div className={cn("flex-1", ui.tableWrap)}>
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead className="sticky top-0 bg-white z-20 border-b border-border shadow-sm">
                  <tr className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                    <th className="px-8 py-5">Identificação / Auditoria</th>
                    <th className="px-8 py-5">Tribunal</th>
                    <th className="px-8 py-5">Advocacia</th>
                    <th className="px-8 py-5">Prazo Final</th>
                    <th className="px-8 py-5">Registros</th>
                    <th className="px-8 py-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filtered.map((c) => (
                    <CaseRow 
                      key={c.id} 
                      c={c} 
                      isOperador={isOperador} 
                      onLogReturn={handleLogReturn} 
                      onScan={handleSingleScan}
                      onSuggest={handleSuggestClick}
                      onEdit={(caseItem) => {
                        setEditingCase(caseItem);
                        setFormState({
                          cliente: caseItem.cliente,
                          protocolo: caseItem.protocolo,
                          advogado: caseItem.advogado,
                          proximoPrazo: caseItem.proximoPrazo,
                          situacao: caseItem.situacao || 'EM ANDAMENTO',
                          ultimoRetorno: caseItem.ultimoRetorno || '',
                          statusManual: caseItem.statusManual || 'Automatico',
                          observacao: caseItem.observacao || '',
                          telefone: caseItem.telefone || '',
                          escritorio: caseItem.escritorio || ''
                        });
                        setIsModalOpen(true);
                      }} 
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && !loading && (
                <div className="h-full flex items-center justify-center py-20">
                  <EmptyState icon={Briefcase} title="Nenhum resultado" description="Não localizamos registros com este filtro." />
                </div>
              )}
            </div>
          </div>
        </div>

        <Suspense fallback={null}>
          <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
            <DialogContent className="sm:max-w-[850px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden max-h-[90vh]">
              <DialogHeader className="p-4 sm:p-6 bg-black text-white shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                        <History size={24} />
                    </div>
                    <div>
                        <DialogTitle className="font-black uppercase tracking-tight text-lg sm:text-xl">Auditoria Unificada</DialogTitle>
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase text-white/60 mt-1">Ref: {historyResult?.case.protocolo}</p>
                    </div>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="flex flex-col flex-1 bg-white overflow-hidden">
                <ScrollArea className="flex-1">
                  <div className="p-4 sm:p-6 space-y-10">
                    <div className="flex flex-col gap-4">
                      <p className={cn("text-muted-foreground border-b pb-2", ui.label)}>Status Operacional</p>
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        {historyResult?.case?.djen_nova_comunicacao && <Badge className="bg-blue-600 text-white font-black uppercase text-[10px] px-3 py-1.5">Publicação DJEN</Badge>}
                        {historyResult?.case?.indicio_busca_apreensao && <Badge className="bg-red-600 text-white font-black uppercase text-[10px] px-3 py-1.5">Indício B.A.</Badge>}
                        {historyResult?.case?.datajud_encerrado_tribunal && <Badge className="bg-black text-red-500 border-2 border-red-500 font-black uppercase text-[10px] px-3 py-1.5">Baixa Tribunal</Badge>}
                      </div>
                    </div>

                    <section className="space-y-6">
                       <h3 className={cn("text-primary flex items-center gap-2 border-b-2 border-primary/10 pb-2", ui.label)}>
                          <Gavel size={14} /> Movimentações Tribunal (DataJud)
                       </h3>
                       <div className="space-y-4">
                         {historyResult?.movimentos?.map((m, i) => (
                           <div key={i} className="flex gap-4 p-3 hover:bg-secondary/20 rounded-lg transition-colors">
                             <div className="w-8 h-8 rounded-full border border-border bg-background flex items-center justify-center shrink-0">
                                 <Clock size={12} className="text-muted-foreground" />
                             </div>
                             <div className="flex-1">
                                 <p className="text-[8px] font-black text-primary uppercase">{m.dataHora ? new Date(m.dataHora).toLocaleDateString('pt-BR') : 'S/D'}</p>
                                 <p className="text-[11px] font-bold text-foreground uppercase leading-tight">{m.nome}</p>
                                 {m.complemento && <p className="text-[8px] text-muted-foreground uppercase">{m.complemento}</p>}
                             </div>
                           </div>
                         ))}
                       </div>
                    </section>

                    <section className="space-y-6">
                       <div className="flex items-center justify-between border-b-2 border-blue-600/10 pb-2">
                          <h3 className={cn("text-blue-600 flex items-center gap-2", ui.label)}>
                            <Globe size={14} /> Diário Oficial Nacional (DJEN)
                          </h3>
                          <Button size="sm" onClick={handleDjenScan} disabled={loadingDjen} className="h-8 bg-blue-600 text-white font-black uppercase text-[8px] rounded-lg">
                             {loadingDjen ? <Loader2 className="animate-spin" size={10}/> : <RefreshCcw size={10}/>} Consultar
                          </Button>
                       </div>
                       <div className="space-y-4">
                          {historyResult?.djenComunicacoes?.map((item, i) => (
                            <div key={i} className="p-4 sm:p-5 border-2 border-black/5 bg-[#fafafa] rounded-xl space-y-3">
                               <Badge variant="outline" className="text-[7px] font-black uppercase border-blue-200 text-blue-600">{item.tipoComunicacao}</Badge>
                               <p className={cn("text-foreground leading-relaxed italic whitespace-pre-wrap", ui.readable)}>
                                  "{item.texto ? plainTextFromDjen(item.texto) : ""}"
                               </p>
                               <p className="text-[8px] font-black text-muted-foreground uppercase pt-2 border-t">{item.data_disponibilizacao} • {item.nomeOrgao}</p>
                            </div>
                          ))}
                       </div>
                    </section>

                    <section className="space-y-6 pt-6 border-t">
                      <div className="flex items-center justify-between">
                        <h3 className={cn("text-amber-600 flex items-center gap-2", ui.label)}>
                          <Sparkles size={14} /> Sugestões & Rascunho IA
                        </h3>
                      </div>

                      <div className="bg-black text-white p-4 sm:p-6 space-y-4 rounded-xl">
                        <div className="flex flex-col gap-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Bot size={12}/> Draft Estratégico</p>

                          <div className="flex flex-col sm:flex-row gap-3">
                            <Select value={selectedMotor} onValueChange={setSelectedMotor}>
                              <SelectTrigger className="h-10 bg-white/10 border-white/20 text-white font-black uppercase text-[8px] rounded-lg flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-2 border-black rounded-lg">
                                <SelectItem value="local_only" className="text-[9px] font-black uppercase">Motor Lexis Soberano</SelectItem>
                                <SelectItem value="xai" className="text-[9px] font-black uppercase">xAI Grok 2</SelectItem>
                                <SelectItem value="groq-llama" className="text-[9px] font-black uppercase">Groq Llama 3.3</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button 
                              onClick={handleGenerateAIDraft} 
                              disabled={isGeneratingAIDraft}
                              className="h-10 px-6 bg-white text-black font-black uppercase text-[10px] rounded-lg hover:bg-primary transition-all"
                            >
                              {isGeneratingAIDraft ? <Loader2 size={12} className="animate-spin" /> : "Gerar Rascunho"}
                            </Button>
                          </div>
                        </div>

                        {aiDraft && (
                          <div className="space-y-3 animate-in fade-in duration-500 mt-2">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                              <p className={cn("text-white/80 italic", ui.readable)}>"{aiDraft}"</p>
                            </div>
                            <Button onClick={() => copyScript(aiDraft)} variant="ghost" className="h-10 w-full text-[9px] font-black uppercase border border-white/20 hover:bg-white/10 text-white rounded-lg">Copiar Rascunho</Button>
                          </div>
                        )}
                      </div>

                      {showScripts && suggestedScripts.length > 0 && (
                        <div className="grid gap-4">
                          {suggestedScripts.map((script, idx) => (
                            <div key={idx} className="bg-white border-2 border-black p-5 rounded-xl shadow-sm space-y-4">
                              <div className="space-y-1">
                                <Badge className="bg-black text-white text-[8px] font-black uppercase rounded-none px-2 mb-1">{script.titulo}</Badge>
                                <p className="text-[11px] font-black uppercase leading-tight">{script.quandoUsar}</p>
                              </div>
                              <div className="p-4 bg-slate-50 border border-black/5 relative rounded-lg">
                                <p className={cn("text-black/70 italic", ui.readable)}>"{script.texto}"</p>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => copyScript(script.texto)}
                                  className="absolute top-2 right-2 h-8 w-8 hover:bg-black hover:text-white transition-all rounded-lg"
                                >
                                  <Copy size={14} />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </ScrollArea>

                <DialogFooter className="p-4 bg-secondary/10 border-t shrink-0">
                   <Button onClick={() => setIsHistoryModalOpen(false)} className="bg-black text-white font-black uppercase text-[10px] px-8 rounded-xl h-12 w-full">Fechar Auditoria</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </Suspense>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[600px] rounded-2xl border-none shadow-2xl max-h-[90vh] overflow-hidden p-0">
            <form onSubmit={handleSaveCase} className="flex flex-col h-full">
              <DialogHeader className="p-6 bg-secondary/20 border-b shrink-0">
                <DialogTitle className="font-black uppercase tracking-tight">
                  {editingCase ? 'Editar Registro' : 'Novo Registro'}
                </DialogTitle>
                <DialogDescription className="sr-only">Preencha os dados do processo.</DialogDescription>
              </DialogHeader>
              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="grid gap-2">
                  <Label className={ui.label}>Titular do Processo</Label>
                  <Input value={formState.cliente} onChange={e => setFormState({...formState, cliente: e.target.value.toUpperCase()})} className="rounded-xl h-12 bg-secondary/30 border-none font-bold uppercase text-base sm:text-sm" required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className={ui.label}>Protocolo (CNJ)</Label>
                    <Input value={formState.protocolo} onChange={e => setFormState({...formState, protocolo: e.target.value})} className={cn("rounded-xl h-12 bg-secondary/30 border-none font-mono text-base sm:text-sm", ui.cnj)} required />
                  </div>
                  <div className="grid gap-2">
                    <Label className={ui.label}>WhatsApp</Label>
                    <Input value={formState.telefone} onChange={e => setFormState({...formState, telefone: e.target.value})} className="rounded-xl h-12 bg-secondary/30 border-none font-mono text-base sm:text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className={ui.label}>Advogado</Label>
                    <Input value={formState.advogado} onChange={e => setFormState({...formState, advogado: e.target.value.toUpperCase()})} className="rounded-xl h-12 bg-secondary/30 border-none font-bold uppercase text-base sm:text-sm" />
                  </div>
                  <div className="grid gap-2">
                    <Label className={ui.label}>Escritório</Label>
                    <Input value={formState.escritorio} onChange={e => setFormState({...formState, escritorio: e.target.value.toUpperCase()})} className="rounded-xl h-12 bg-secondary/30 border-none font-bold uppercase text-base sm:text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className={ui.label}>Status Manual</Label>
                    <Select value={formState.statusManual} onValueChange={val => setFormState({...formState, statusManual: val})}>
                      <SelectTrigger className="rounded-xl h-12 bg-secondary/30 border-none font-bold text-[10px] uppercase"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Automatico" className="text-[10px] font-bold uppercase">Automático (Prazos)</SelectItem>
                        <SelectItem value="Caso Crítico" className="text-[10px] font-bold uppercase text-red-600 font-black">⚠ CASO CRÍTICO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className={ui.label}>Vencimento</Label>
                    <Input value={formState.proximoPrazo} onChange={e => setFormState({...formState, proximoPrazo: e.target.value})} className="rounded-xl h-12 bg-secondary/30 border-none font-bold text-base sm:text-sm" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className={ui.label}>Observações</Label>
                  <Textarea value={formState.observacao} onChange={e => setFormState({...formState, observacao: e.target.value.toUpperCase()})} className="rounded-xl min-h-[100px] bg-secondary/30 border-none font-bold text-base sm:text-sm uppercase resize-none" />
                </div>
              </div>
              <DialogFooter className="p-6 pt-0 shrink-0">
                <Button type="submit" className="w-full h-14 bg-black text-white rounded-xl font-black uppercase text-[11px] shadow-xl">
                  {editingCase ? "Salvar Alterações" : "Ativar Novo Registro"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: any }) {
  const styles: Record<string, string> = {
    'Vencido': "bg-red-50 text-red-700 border-red-100",
    'É Hoje': "bg-blue-50 text-blue-700 border-blue-100 animate-pulse",
    'Atenção': "bg-orange-50 text-orange-700 border-orange-100",
    'No Prazo': "bg-emerald-50 text-emerald-700 border-emerald-100",
    'Caso Crítico': "bg-red-600 text-white border-none animate-pulse font-black",
  };
  return (
    <Badge variant="outline" className={cn("px-3 py-1 text-[10px] font-black uppercase rounded-lg border-none", styles[status] || "bg-secondary text-muted-foreground")}>
      {status}
    </Badge>
  );
}

export default function CasesPage() {
  return (
    <Suspense fallback={<div className="p-10 font-black uppercase text-xs tracking-widest text-muted-foreground">Sincronizando Gabinete...</div>}>
      <CasesContent />
    </Suspense>
  );
}
