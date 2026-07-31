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
  Copy
} from 'lucide-react';
import { LegalCase, processarCaso } from '@/lib/case-logic';
import { cn, formatWhatsAppLink } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { fetchRepoCases, syncRepoCases, recalibrateCasesAction, runDataJudScanAction, scanSingleCaseAction } from '@/app/actions/case-actions';
import { format } from 'date-fns';
import { useAdmin } from '@/hooks/use-admin';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { calcularProbabilidadeEncerramento } from '@/lib/probabilidade-encerramento';
import { useAppStore } from '@/store/use-app-store';
import { suggestScripts, ScriptSuggestion } from '@/lib/script-processual/suggest';

const CaseRow = React.memo(({ 
  c, 
  isOperador, 
  onLogReturn, 
  onEdit, 
  onDelete,
  onScan
}: { 
  c: LegalCase, 
  isOperador: boolean, 
  onLogReturn: (p: string) => void, 
  onEdit: (c: LegalCase) => void, 
  onDelete: (id: string) => void,
  onScan: (c: LegalCase) => void
}) => {
  const prob = calcularProbabilidadeEncerramento({
    status: c.status,
    situacao: c.situacao,
    observacao: c.observacao,
    diasVencidos: c.diasFaltando && c.diasFaltando < 0 ? Math.abs(c.diasFaltando) : 0
  });

  const [loading, setLoading] = useState(false);

  // HEURÍSTICA DE CUMPRIMENTO (v60.0)
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
          </div>
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{c.protocolo}</span>
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
          {/* Retorno Manual */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg border border-border/50 flex items-center justify-center bg-secondary/50 group-hover:bg-background transition-all">
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-muted-foreground uppercase leading-none mb-1 tracking-widest">Retorno</span>
              <span className="text-[11px] text-foreground font-bold uppercase whitespace-nowrap">
                {c.ultimoRetorno || 'S/ Atendimento'}
              </span>
            </div>
          </div>

          {/* Última Movimentação DataJud (Visível) */}
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
            title="Andamentos DataJud" 
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              await onScan(c);
              setLoading(false);
            }} 
            className="text-primary hover:bg-primary/10 h-9 w-9 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <FileSearch size={18} />}
          </button>
          {isOperador && (
            <button title="Registrar Atendimento Hoje" onClick={(e) => { e.stopPropagation(); onLogReturn(c.protocolo); }} className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 h-9 w-9 flex items-center justify-center rounded-lg transition-colors">
              <CheckCircle2 size={18} />
            </button>
          )}
          {c.telefone && (
             <a href={formatWhatsAppLink(c.telefone)} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 transition-all h-9 w-9 flex items-center justify-center rounded-lg">
               <MessageCircle size={18} />
             </a>
          )}
          <a href={c.linkConsulta} target="_blank" rel="noopener noreferrer" title="Tribunal" className="text-muted-foreground hover:bg-secondary h-9 w-9 flex items-center justify-center rounded-lg transition-colors">
            <ExternalLink size={18} />
          </a>
          {isOperador && (
            <>
              <button title="Editar" onClick={(e) => { e.stopPropagation(); onEdit(c); }} className="text-muted-foreground hover:bg-secondary h-9 w-9 flex items-center justify-center rounded-lg transition-colors">
                <Edit2 size={18} />
              </button>
              <button title="Excluir" onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-9 w-9 flex items-center justify-center rounded-lg transition-colors">
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
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<LegalCase | null>(null);
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyResult, setHistoryResult] = useState<{ case: LegalCase, movimentos: any[] } | null>(null);
  const [suggestedScripts, setSuggestedScripts] = useState<ScriptSuggestion[]>([]);
  const [showScripts, setShowScripts] = useState(false);

  const [mounted, setMounted] = useState(false);
  const { isOperador } = useAdmin();
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
    telefone: ''
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

  const handleGenerateScript = () => {
    if (!historyResult) return;
    
    const suggestions = suggestScripts({
      clienteNome: historyResult.case.cliente,
      protocolo: historyResult.case.protocolo,
      ultimoRetorno: historyResult.case.ultimoRetorno,
      movimentos: historyResult.movimentos
    });
    
    setSuggestedScripts(suggestions);
    setShowScripts(true);
    toast({ title: "Sugestões Geradas" });
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
        telefone: formState.telefone
      };

      const processed = processarCaso(rawData, thresholds);
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
        toast({ 
          title: "Falha na Gravação", 
          description: result.message || "Erro desconhecido no servidor.", 
          variant: "destructive" 
        });
      }
    } catch (err: any) {
      toast({ 
        title: "Erro Crítico", 
        description: "Falha ao processar dados do formulário.", 
        variant: "destructive" 
      });
    }
  };

  const handleLogReturn = useCallback(async (protocolo: string) => {
    if (!isOperador) return;
    const target = cases.find(c => c.protocolo === protocolo);
    if (!target) return;

    const today = format(new Date(), 'dd/MM/yyyy');
    const updatedCase = { 
      ...target, 
      ultimoRetorno: today,
      tem_atualizacao_pos_retorno: false 
    };
    
    const result = await syncRepoCases([updatedCase]);
    if (result.success) {
      updateCaseByProtocolo(protocolo, { ultimoRetorno: today, tem_atualizacao_pos_retorno: false });
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
      const matchesQuick = quickFilter === 'all' || (quickFilter === 'updated' && (c.tem_atualizacao_pos_retorno || c.datajud_encerrado_tribunal || c.indicio_busca_apreensao));
      
      const isEncerrado = isCasoEncerrado(c);
      let pass = matchesSearch && matchesOffice && matchesQuick;
      if (!showClosed && isEncerrado) pass = false;
      
      return pass;
    });
  }, [cases, deferredSearch, showClosed, officeFilter, quickFilter]);

  const handleExportCSV = useCallback(() => {
    if (filtered.length === 0) {
      toast({ title: "Lista vazia", description: "Não há dados filtrados para exportar.", variant: "destructive" });
      return;
    }

    const headers = [
      'CLIENTE', 'PROTOCOLO', 'TRIBUNAL', 'ADVOGADO', 'ESCRITORIO', 'STATUS',
      'PROXIMO_PRAZO', 'ULTIMO_RETORNO', 'OBSERVACAO', 'TELEFONE',
      'TEM_NOVO_ANDAMENTO', 'ENCERRADO_TRIBUNAL', 'INDICIO_BA', 'CUMPRIMENTO_SENTENCA',
      'DATAJUD_ULTIMO_MOV', 'DATAJUD_DATA_MOV'
    ];

    const rows = filtered.map(c => {
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
        c.datajud_ultimo_nome || '',
        c.datajud_ultimo_movimento ? format(new Date(c.datajud_ultimo_movimento), 'dd/MM/yyyy') : ''
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(';');
    });

    const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `processos_lexis_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Exportação Concluída", description: `${filtered.length} registros processados.` });
  }, [filtered, toast]);

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-border/50 bg-card/60 backdrop-blur-xl flex items-center justify-between px-10 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <h1 className="font-black text-xl text-foreground uppercase tracking-tight">Processos do Gabinete</h1>
          </div>
          <div className="flex items-center gap-3">
            {isOperador && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchUpdateStatus}
                disabled={isUpdating || loading}
                className="h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest border-primary/20 hover:bg-primary/5"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCcw size={16} className="mr-2 text-primary" />}
                Recalibrar Prazos
              </Button>
            )}
            {isOperador && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDataJudScan}
                disabled={isScanning || loading}
                className="h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest border-primary/20 hover:bg-primary/5"
              >
                {isScanning ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Zap size={16} className="mr-2 text-primary" />}
                Varredura DataJud
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest border-primary/20 hover:bg-primary/5"
            >
              <FileDown size={16} className="mr-2 text-primary" />
              Exportar Planilha
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowClosed(!showClosed)}
              className={cn(
                "h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all",
                showClosed ? "bg-black text-white" : "text-muted-foreground hover:bg-secondary"
              )}
            >
              {showClosed ? <Eye size={16} className="mr-2" /> : <EyeOff size={16} className="mr-2" />}
              {showClosed ? "Ocultar Encerrados" : "Mostrar Encerrados"}
            </Button>
            {isOperador && (
              <Button onClick={() => { setEditingCase(null); setIsModalOpen(true); }} className="h-11 px-6 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase text-[10px] tracking-widest shadow-xl">
                <Plus className="w-4 h-4 mr-2" /> Novo Registro
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={loadData} className="h-10 w-10 rounded-xl hover:bg-secondary">
              <RefreshCcw className={cn("w-5 h-5", loading && "animate-spin")} />
            </Button>
          </div>
        </header>

        <div className="flex-1 flex flex-col p-8 overflow-hidden">
          <div className="premium-card flex-1 flex flex-col overflow-hidden border-none">
            <div className="p-5 border-b border-border/30 flex items-center justify-between gap-6 shrink-0">
              <div className="flex flex-1 items-center gap-4 max-w-5xl">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input 
                    placeholder="Pesquisar por titular ou CNJ..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-11 h-11 bg-secondary/30 border-none rounded-xl text-xs font-bold uppercase"
                  />
                </div>
                
                <div className="w-48">
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

                <div className="w-48">
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
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="sticky top-0 bg-card z-20 border-b border-border shadow-sm">
                  <tr className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                    <th className="px-8 py-5">Identificação / Auditoria</th>
                    <th className="px-8 py-5">Tribunal</th>
                    <th className="px-8 py-5">Advocacia</th>
                    <th className="px-8 py-5">Prazo Final</th>
                    <th className="px-8 py-5">Contatos & Tribunal</th>
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
                          telefone: caseItem.telefone || ''
                        });
                        setIsModalOpen(true);
                      }} 
                      onDelete={async (id) => {
                        if (confirm('Excluir definitivamente?')) {
                          setCases(cases.filter(item => item.id !== id));
                          toast({ title: "Removido" });
                        }
                      }}
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
                      onClick={handleGenerateScript} 
                      variant="outline" 
                      className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-black uppercase text-[10px] rounded-xl h-10 px-4"
                    >
                      <MessageSquare size={14} className="mr-2" /> Sugerir Resposta
                    </Button>
                  </div>
                </div>
                <DialogDescription className="text-[10px] uppercase font-bold text-white/40">Visualização detalhada da cronologia processual do tribunal e ferramentas de despacho.</DialogDescription>
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
        </Suspense>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[600px] rounded-2xl border-none shadow-2xl">
            <form onSubmit={handleSaveCase}>
              <DialogHeader className="p-6 bg-secondary/20 border-b">
                <DialogTitle className="font-black uppercase tracking-tight">
                  {editingCase ? 'Editar Registro' : 'Novo Registro de Gabinete'}
                </DialogTitle>
                <DialogDescription className="text-[10px] uppercase font-bold text-muted-foreground">Formulário para cadastro ou edição de processos no gabinete.</DialogDescription>
              </DialogHeader>
              <div className="p-6 space-y-4">
                <div className="grid gap-2">
                  <Label className="uppercase text-[9px] font-black text-muted-foreground">Nome do Titular</Label>
                  <Input value={formState.cliente} onChange={e => setFormState({...formState, cliente: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/30 border-none font-bold uppercase" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black text-muted-foreground">Protocolo (CNJ)</Label>
                    <Input value={formState.protocolo} onChange={e => setFormState({...formState, protocolo: e.target.value})} className="rounded-xl h-11 bg-secondary/30 border-none font-mono" required />
                  </div>
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black text-muted-foreground">WhatsApp</Label>
                    <Input value={formState.telefone} onChange={e => setFormState({...formState, telefone: e.target.value})} className="rounded-xl h-11 bg-secondary/30 border-none font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black text-muted-foreground">Advogado</Label>
                    <Input value={formState.advogado} onChange={e => setFormState({...formState, advogado: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/30 border-none font-bold uppercase" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black text-muted-foreground">Situação</Label>
                    <Select value={formState.situacao} onValueChange={val => setFormState({...formState, situacao: val})}>
                      <SelectTrigger className="rounded-xl h-11 bg-secondary/30 border-none font-bold text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EM ANDAMENTO" className="text-[10px] font-bold uppercase">EM ANDAMENTO</SelectItem>
                        <SelectItem value="ENCERRADO" className="text-[10px] font-bold uppercase">ENCERRADO</SelectItem>
                        <SelectItem value="ARQUIVADO" className="text-[10px] font-bold uppercase">ARQUIVADO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black text-muted-foreground">Status Especial (Sobreescrever Motor)</Label>
                    <Select value={formState.statusManual} onValueChange={val => setFormState({...formState, statusManual: val})}>
                      <SelectTrigger className="rounded-xl h-11 bg-secondary/30 border-none font-bold text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Automatico" className="text-[10px] font-bold uppercase">Automático (Por Prazos)</SelectItem>
                        <SelectItem value="Caso Crítico" className="text-[10px] font-bold uppercase text-red-600 font-black">⚠ CASO CRÍTICO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black text-muted-foreground">Vencimento</Label>
                    <Input value={formState.proximoPrazo} onChange={e => setFormState({...formState, proximoPrazo: e.target.value})} className="rounded-xl h-11 bg-secondary/30 border-none font-bold" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="uppercase text-[9px] font-black text-muted-foreground">Último Atendimento</Label>
                  <Input value={formState.ultimoRetorno} onChange={e => setFormState({...formState, ultimoRetorno: e.target.value})} className="rounded-xl h-11 bg-secondary/30 border-none font-bold" />
                </div>
                <div className="grid gap-2">
                  <Label className="uppercase text-[9px] font-black text-muted-foreground">Notas</Label>
                  <Textarea value={formState.observacao} onChange={e => setFormState({...formState, observacao: e.target.value.toUpperCase()})} className="rounded-xl min-h-[80px] bg-secondary/30 border-none font-bold text-[10px] uppercase resize-none" />
                </div>
              </div>
              <DialogFooter className="p-6 pt-0">
                <Button type="submit" className="w-full h-12 bg-black text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl">
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
