/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Search, Trash2, Edit2, CheckCircle2, Zap, Loader2, CalendarDays, Sparkles, 
  History, AlertCircle, FileSearch, ShieldAlert, Copy, MessageSquareQuote, 
  Globe, Bot, Download, ChevronRight, UserCheck, Building2, ExternalLink, FileDown,
  Briefcase, RefreshCcw
} from 'lucide-react';
import { LegalCase, processarCaso, formatDateToISO } from '@/lib/case-logic';
import { cn, formatWhatsAppLink } from '@/lib/utils';
import { ui } from '@/lib/responsive-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { fetchRepoCases, syncRepoCases, scanSingleCaseAction, recalibrateCasesAction } from '@/app/actions/case-actions';
import { exportCasesToCSVAction, exportDossieXlsxAction } from '@/app/actions/export-actions';
import { runCasesPlanilhaExport } from '@/lib/run-cases-export';
import { format, parseISO, isValid } from 'date-fns';
import { useAdmin } from '@/hooks/use-admin';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { useAppStore } from '@/store/use-app-store';
import { suggestScripts, ScriptSuggestion } from '@/lib/script-processual/suggest';
import { gerarRascunhoEstrategico } from '@/ai/motor-despacho';
import { generateDjenPublicationPDFAction } from '@/app/actions/document-actions';
import { plainTextFromDjen, summarizeDjenKeywords } from '@/lib/djen';
import { Checkbox } from '@/components/ui/checkbox';
import { getSinalCapa } from '@/lib/sinal-capa';

const CaseRow = React.memo(({ 
  c, isOperador, onLogReturn, onEdit, onDelete, onScan, onSuggest
}: { 
  c: LegalCase, isOperador: boolean, onLogReturn: (c: LegalCase) => void, onEdit: (c: LegalCase) => void, onDelete: (id: string) => void, onScan: (c: LegalCase) => void, onSuggest: (c: LegalCase) => void
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const sinal = useMemo(() => getSinalCapa(c), [c]);

  return (
    <tr className="hover:bg-secondary/30 transition-all border-b border-border/50 group">
      <td className="px-8 py-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground font-black text-[14px] uppercase leading-none tracking-tight group-hover:text-primary transition-colors">{c.cliente}</span>
            {c.indicio_busca_apreensao && <Badge className="h-5 px-2 rounded-md bg-red-600 text-white font-black uppercase text-[8px] animate-pulse"><ShieldAlert size={10} className="mr-1" /> B.A.{(c as any).ba_tipo ? ` ${(c as any).ba_tipo}` : ''}</Badge>}
            {c.datajud_encerrado_tribunal && <Badge className="h-5 px-2 rounded-md bg-black text-red-500 font-black uppercase text-[8px] border-2 border-red-500 animate-pulse">Encerrado</Badge>}
            {(c.em_cumprimento_sentenca || (c as any).cumprimento_sentenca) && <Badge className="h-5 px-2 rounded-md bg-amber-500 text-black font-black uppercase text-[8px]">Cumprimento</Badge>}
            {((c as any).sentenca_procedente || (c as any).merito_resultado === 'procedente') && <Badge className="h-5 px-2 rounded-md bg-emerald-600 text-white font-black uppercase text-[8px]">Procedente</Badge>}
            {((c as any).sentenca_improcedente || (c as any).merito_resultado === 'improcedente') && <Badge className="h-5 px-2 rounded-md bg-slate-700 text-white font-black uppercase text-[8px]">Improcedente</Badge>}
            {((c as any).sentenca_parcial || (c as any).merito_resultado === 'parcial') && <Badge className="h-5 px-2 rounded-md bg-blue-600 text-white font-black uppercase text-[8px]">Parcial</Badge>}
            {(c as any).tem_liminar && <Badge className="h-5 px-2 rounded-md bg-violet-600 text-white font-black uppercase text-[8px]">Liminar</Badge>}
            {(c as any).tem_audiencia && <Badge className="h-5 px-2 rounded-md bg-cyan-600 text-white font-black uppercase text-[8px]">Audiência</Badge>}
            {(c as any).tem_custas && <Badge className="h-5 px-2 rounded-md bg-orange-500 text-black font-black uppercase text-[8px]">Custas</Badge>}
            {(c as any).alerta_ia && <Badge className="h-5 px-2 rounded-md bg-red-700 text-white font-black uppercase text-[8px] animate-pulse">Alerta IA</Badge>}
            {c.tem_novo_andamento && <Badge variant="destructive" className="h-5 px-2 rounded-md font-black uppercase text-[8px] animate-pulse">Novidade</Badge>}
            {(c as any).ai_engine && <Badge variant="outline" className="h-5 px-2 rounded-md font-black uppercase text-[7px] border-primary/40 text-primary">IA {(String((c as any).ai_engine).split(':')[0])}</Badge>}
          </div>
          <span className={cn("text-[10px] font-mono text-muted-foreground uppercase tracking-widest", ui.cnj)}>{c.protocolo}</span>
          
          <div className="mt-3 space-y-1.5 max-w-[450px]">
             <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-[8px] font-black uppercase h-5 px-2 rounded-none border-2", sinal.prioridade >= 80 ? "border-red-600 text-red-600 bg-red-50" : "border-black/10 text-black/40")}>
                  {sinal.fonte === 'datajud' ? 'Tribunal' : sinal.fonte === 'djen' ? 'Diário Oficial' : 'Híbrido'}
                </Badge>
                <span className="text-[9px] font-black text-black/60 uppercase">{sinal.titulo}</span>
                {sinal.data && <span className="text-[8px] font-bold text-black/30 ml-auto">{format(parseISO(sinal.data), 'dd/MM/yy')}</span>}
             </div>
             <p className="text-[11px] font-bold text-foreground/80 uppercase italic leading-tight line-clamp-2">{sinal.detalhe}</p>
             {(c.djen_ultimo_link || c.djen_ultimo_resumo || c.djen_nova_comunicacao) && (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {c.djen_ultimo_link ? (
                    <a href={c.djen_ultimo_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[9px] font-black text-blue-600 uppercase hover:underline">
                       <Globe size={10} /> Abrir no D.O. / Baixar comunicação
                    </a>
                  ) : (
                    <span className="text-[9px] font-black text-blue-700/80 uppercase">Há publicação DJEN — abra a Auditoria 3D para o link</span>
                  )}
                </div>
             )}
          </div>
        </div>
      </td>
      <td className="px-8 py-5">
        <Badge variant="outline" className="bg-card border-border/50 font-black text-[9px] text-muted-foreground uppercase rounded-md h-7 px-3 w-fit">{c.tribunal}</Badge>
      </td>
      <td className="px-8 py-5 text-[11px] text-foreground font-bold uppercase truncate max-w-[120px]"><span>{c.advogado}</span></td>
      <td className="px-8 py-5">
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className={cn("px-3 py-1 text-[10px] font-black uppercase rounded-lg border-none", (c.status === 'Vencido' || c.status === 'Caso Crítico') ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>{c.status}</Badge>
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tight text-foreground"><CalendarDays size={14} className="text-primary" /><span>{c.proximoPrazo || 'S/ Prazo'}</span></div>
        </div>
      </td>
      <td className="px-8 py-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg border border-border/50 flex items-center justify-center bg-secondary/50 group-hover:bg-background transition-all"><CheckCircle2 size={16} className="text-emerald-500" /></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-muted-foreground uppercase leading-none mb-1 tracking-widest">Retorno</span>
              <span className="text-[11px] text-foreground font-bold uppercase">{c.ultimoRetorno || 'S/ Registro'}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-8 py-5 text-right">
        <div className="flex items-center justify-end gap-2">
          <button disabled={suggestLoading} onClick={async () => { setSuggestLoading(true); await onSuggest(c); setSuggestLoading(false); }} className={cn("text-amber-600 hover:bg-amber-50 w-10 h-10 rounded-xl flex items-center justify-center transition-colors", ui.touch)} title="Sugerir Resposta">
            {suggestLoading ? <Loader2 size={18} className="animate-spin" /> : <MessageSquareQuote size={18} />}
          </button>
          <button disabled={loading} onClick={async () => { setLoading(true); await onScan(c); setLoading(false); }} className={cn("text-primary hover:bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center transition-colors", ui.touch)} title="Auditoria 3D">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <FileSearch size={18} />}
          </button>
          {isOperador && <button onClick={() => onLogReturn(c)} className={cn("text-emerald-600 hover:bg-emerald-50 w-10 h-10 rounded-xl flex items-center justify-center transition-colors", ui.touch)} title="Log de Retorno"><UserCheck size={18} /></button>}
          {isOperador && (
            <>
              <button onClick={() => onEdit(c)} className={cn("text-muted-foreground hover:bg-secondary w-10 h-10 rounded-xl flex items-center justify-center transition-colors", ui.touch)} title="Editar"><Edit2 size={18} /></button>
              <button onClick={() => onDelete(c.id)} className={cn("text-muted-foreground hover:text-red-600 hover:bg-red-50 w-10 h-10 rounded-xl flex items-center justify-center transition-colors", ui.touch)} title="Excluir"><Trash2 size={18} /></button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
});

CaseRow.displayName = 'CaseRow';

function CasesContent() {
  const { cases, setCases, updateCaseByProtocolo, removeCase } = useAppStore();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [quickFilter, setQuickFilter] = useState(searchParams.get('filter') || searchParams.get('quick') || 'all');
  const [isRecalibrating, setIsRecalibrating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<LegalCase | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyResult, setHistoryResult] = useState<{ case: LegalCase, movimentos: any[], djenComunicacoes?: any[] } | null>(null);
  const [suggestedScripts, setSuggestedScripts] = useState<ScriptSuggestion[]>([]);
  const [showScripts, setShowScripts] = useState(false);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [isGeneratingAIDraft, setIsGeneratingAIDraft] = useState(false);
  const [selectedMotor, setSelectedMotor] = useState<string>('local_only');

  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [activeGroup, setActiveGroup] = useState<LegalCase | null>(null);
  const [attendanceForm, setAttendanceForm] = useState({ observacao: '', proximoRetorno: '', situacao: 'EM ANDAMENTO', applyToAll: true });

  const { isOperador, profile } = useAdmin();
  const { toast } = useToast();
  
  const [formState, setFormState] = useState({ cliente: '', protocolo: '', advogado: '', proximoPrazo: '', situacao: 'EM ANDAMENTO', ultimoRetorno: '', statusManual: 'Automatico', observacao: '', telefone: '', escritorio: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRepoCases();
      if (Array.isArray(data)) setCases(data);
    } finally { setLoading(false); }
  }, [setCases]);

  useEffect(() => { loadData(); }, [loadData]);

  
  const handleRecalibratePrazos = async () => {
    if (isRecalibrating) return;
    setIsRecalibrating(true);
    try {
      const res = await recalibrateCasesAction();
      if (res.success) {
        await loadData();
        toast({ title: "Prazos recalibrados", description: res.message || `${res.updated} processos atualizados.` });
      } else {
        toast({ title: "Falha na recalibração", description: res.error || "Tente novamente", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha", variant: "destructive" });
    } finally {
      setIsRecalibrating(false);
    }
  };

  const handleExportXlsx = async () => {
    setExporting(true);
    try {
      await runCasesPlanilhaExport(toast);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await exportCasesToCSVAction();
      if (res.success && (res as any).base64) {
        const a = document.createElement('a');
        a.href = `data:text/csv;base64,${(res as any).base64}`;
        a.download = (res as any).filename || 'export_processos.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast({ title: 'CSV exportado', description: `${(res as any).count || ''} processos` });
      } else {
        toast({ title: 'Falha CSV', description: (res as any).error || 'Erro', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Falha CSV', description: e?.message || 'Erro', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleSingleScan = async (c: LegalCase) => {
    if (!c.protocolo) return;
    setLoading(true);
    try {
      const res = await scanSingleCaseAction(c.protocolo, { mode: 'both' });
      if (res.success && res.case) {
        setHistoryResult({ case: res.case, movimentos: res.movimentos || [], djenComunicacoes: res.comunicacoes || [] });
        setIsHistoryModalOpen(true);
        setShowScripts(false);
        setAiDraft(null);
        updateCaseByProtocolo(c.protocolo, (res.casePatch as Record<string, any>) || {});
      }
    } finally { setLoading(false); }
  };

  const handleSuggestClick = async (c: LegalCase) => {
    if (!c.protocolo) return;
    setLoading(true);
    try {
      const res = await scanSingleCaseAction(c.protocolo, { mode: 'both' });
      if (res.success && res.case) {
        setHistoryResult({ case: res.case, movimentos: res.movimentos || [], djenComunicacoes: res.comunicacoes || [] });
        setAiDraft(null);
        const djenTexts = (res.comunicacoes || []).map(d => plainTextFromDjen(d.texto)).filter(Boolean);
        const suggestions = suggestScripts({ clienteNome: c.cliente, protocolo: c.protocolo, ultimoRetorno: c.ultimoRetorno, eventoTipo: res.case.evento_tipo, eventoResumo: res.case.evento_resumo, movimentos: res.movimentos || [], djenTexts, tem_novo_andamento: res.case.tem_novo_andamento, datajud_encerrado_tribunal: res.case.datajud_encerrado_tribunal, indicio_busca_apreensao: res.case.indicio_busca_apreensao, em_cumprimento_sentenca: res.case.em_cumprimento_sentenca });
        setSuggestedScripts(suggestions);
        setShowScripts(true);
        setIsHistoryModalOpen(true);
        updateCaseByProtocolo(c.protocolo, (res.casePatch as Record<string, any>) || {});
      }
    } finally { setLoading(false); }
  };

  const handleGenerateAIDraft = async () => {
    if (!historyResult || isGeneratingAIDraft) return;
    setIsGeneratingAIDraft(true);
    setAiDraft(null);
    try {
      const djenTexts = (historyResult.djenComunicacoes || []).map(d => plainTextFromDjen(d.texto)).filter(Boolean);
      const res = await gerarRascunhoEstrategico({ clienteNome: historyResult.case.cliente, protocolo: historyResult.case.protocolo, ultimoRetorno: historyResult.case.ultimoRetorno, movimentos: historyResult.movimentos, djenTexts, eventoTipo: historyResult.case.evento_tipo, eventoResumo: historyResult.case.evento_resumo, preferredModel: selectedMotor, empresaId: profile?.empresa_id, tem_novo_andamento: historyResult.case.tem_novo_andamento, datajud_encerrado_tribunal: historyResult.case.datajud_encerrado_tribunal, indicio_busca_apreensao: historyResult.case.indicio_busca_apreensao, em_cumprimento_sentenca: historyResult.case.em_cumprimento_sentenca });
      if (res.rascunho) { setAiDraft(res.rascunho); toast({ title: "Draft Gerado" }); }
    } finally { setIsGeneratingAIDraft(false); }
  };

  const handleLogReturn = (c: LegalCase) => {
    setActiveGroup(c);
    setAttendanceForm({ observacao: c.observacao || '', proximoRetorno: c.proximoPrazo || '', situacao: c.situacao || 'EM ANDAMENTO', applyToAll: true });
    setIsAttendanceOpen(true);
  };

  const handleSaveAttendance = async () => {
    if (!activeGroup || isSavingAttendance) return;
    setIsSavingAttendance(true);
    try {
      const todayStr = format(new Date(), 'dd/MM/yyyy');
      const updatedCases = cases.map(c => {
        if (attendanceForm.applyToAll ? c.cliente === activeGroup.cliente : c.protocolo === activeGroup.protocolo) {
          return processarCaso({ 
            ...c, 
            situacao: attendanceForm.situacao, 
            ultimoRetorno: todayStr, 
            observacao: attendanceForm.observacao || c.observacao, 
            proximoPrazo: attendanceForm.situacao === 'ENCERRADO' ? '' : attendanceForm.proximoRetorno, 
            tem_atualizacao_pos_retorno: false, 
            djen_nova_comunicacao: false, 
            tem_novo_andamento: false 
          });
        }
        return c;
      });
      const res = await syncRepoCases(updatedCases);
      if (res.success) { setCases(updatedCases); setIsAttendanceOpen(false); setActiveGroup(null); toast({ title: "Registro Sincronizado" }); }
    } finally { setIsSavingAttendance(false); }
  };

  const copyScript = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado" });
  };

  const handleEdit = (c: LegalCase) => {
    setEditingCase(c);
    setFormState({ cliente: c.cliente, protocolo: c.protocolo, advogado: c.advogado, proximoPrazo: c.proximoPrazo, situacao: c.situacao, ultimoRetorno: c.ultimoRetorno, statusManual: c.statusManual, observacao: c.observacao || '', telefone: c.telefone || '', escritorio: c.escritorio || '' });
    setIsModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase) return;
    const updatedCase = processarCaso({ ...editingCase, ...formState });
    const updatedList = cases.map(c => c.id === editingCase.id ? updatedCase : c);
    const res = await syncRepoCases(updatedList);
    if (res.success) { setCases(updatedList); setIsModalOpen(false); toast({ title: "Alterações Salvas" }); }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Deseja remover este processo permanentemente do gabinete?")) {
      const updatedList = cases.filter(c => c.id !== id);
      const res = await syncRepoCases(updatedList);
      if (res.success) { removeCase(id); toast({ title: "Processo Removido" }); }
    }
  };

    const filtered = useMemo(() => {
    const q = (search || '').toLowerCase().trim();
    return cases.filter(c => {
      const match =
        !q ||
        (c.cliente || '').toLowerCase().includes(q) ||
        (c.protocolo || '').toLowerCase().includes(q) ||
        (c.advogado || '').toLowerCase().includes(q) ||
        (c.observacao || '').toLowerCase().includes(q);
      if (!match) return false;
      if (quickFilter === 'updated') return !!c.tem_novo_andamento;
      if (quickFilter === 'active') return !isCasoEncerrado(c);
      if (quickFilter === 'closed') return isCasoEncerrado(c);
      if (quickFilter === 'hoje' || quickFilter === 'today') {
        const st = String(c.status || '');
        return st === 'É Hoje' || st === 'E Hoje' || st.toLowerCase() === 'é hoje';
      }
      if (quickFilter === 'vencido') return String(c.status || '') === 'Vencido';
      return true;
    });
  }, [cases, search, quickFilter]);

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
        <header className="h-auto border-b border-border/50 bg-card/60 backdrop-blur-xl flex items-center justify-between p-4 sm:px-10 shrink-0 z-40">
          <div className="flex items-center gap-4">
             <Briefcase size={20} className="text-primary" />
             <h1 className="font-black text-xl text-foreground uppercase tracking-tight">Carteira do Gabinete</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="default"
              size="sm"
              onClick={handleExportXlsx}
              disabled={exporting}
              className="h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {exporting ? <Loader2 size={16} className="animate-spin mr-2" /> : <FileDown size={16} className="mr-2" />}
              Exportar XLSX
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={exporting}
              className="h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest border-2 border-border/50 hover:bg-secondary"
            >
              {exporting ? <Loader2 size={16} className="animate-spin mr-2" /> : <FileDown size={16} className="mr-2" />}
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalibratePrazos}
              disabled={isRecalibrating || loading}
              className="h-10 px-3 rounded-xl font-black uppercase text-[9px] tracking-widest border-2 border-border/50 hover:bg-secondary"
              title="Recalcular Vencido / É Hoje / Atenção a partir do próximo prazo"
            >
              {isRecalibrating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CalendarDays className="w-4 h-4 mr-1" />}
              Recalibrar Prazos
            </Button>
            <Button variant="ghost" size="icon" onClick={loadData} className="h-10 w-10 rounded-xl hover:bg-secondary">
              <RefreshCcw className={cn("w-5 h-5", loading && "animate-spin text-primary")} />
            </Button>
          </div>
        </header>

        <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden">
          <div className="premium-card flex-1 flex flex-col overflow-hidden border-none bg-white">
            <div className="p-4 border-b border-border/30 flex flex-col lg:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 w-full"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" /><Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11 h-12 bg-secondary/30 border-none rounded-xl" /></div>
              <Select value={quickFilter} onValueChange={setQuickFilter}>
                <SelectTrigger className="h-12 w-52 bg-secondary/30 border-none rounded-xl font-black uppercase text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="hoje">É Hoje</SelectItem><SelectItem value="vencido">Vencido</SelectItem><SelectItem value="active">Ativos</SelectItem><SelectItem value="updated">Com Novidade</SelectItem><SelectItem value="closed">Arquivados</SelectItem></SelectContent>
              </Select>
            </div>
            <div className={cn("flex-1", ui.tableWrap)}>
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead className="sticky top-0 bg-white z-20 border-b border-border">
                  <tr className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                    <th className="px-8 py-5">Identificação</th>
                    <th className="px-8 py-5">Tribunal</th>
                    <th className="px-8 py-5">Advogado</th>
                    <th className="px-8 py-5">Status / Prazo</th>
                    <th className="px-8 py-5">Último Retorno</th>
                    <th className="px-8 py-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filtered.map((c) => (
                    <CaseRow key={c.id} c={c} isOperador={isOperador} onLogReturn={handleLogReturn} onEdit={handleEdit} onDelete={handleDelete} onScan={handleSingleScan} onSuggest={handleSuggestClick} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
          <DialogContent className="sm:max-w-[950px] w-[calc(100vw-2rem)] rounded-2xl border-none shadow-2xl p-0 overflow-hidden h-[90vh] flex flex-col">
            <DialogHeader className="p-4 sm:p-6 bg-black text-white shrink-0">
              <DialogTitle className="font-black uppercase tracking-tight text-lg sm:text-xl flex items-center gap-3">
                <FileSearch className="text-primary" /> Auditoria Unificada (Audit 3D)
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col flex-1 bg-white overflow-hidden min-h-0">
              <ScrollArea className="flex-1 w-full h-full">
                <div className="p-4 sm:p-6 space-y-10">
                  <section className="space-y-6">
                    <h3 className={cn("text-black flex items-center gap-2 border-b-2 border-black/5 pb-2", ui.label)}><Globe size={14} className="text-primary"/> Cronologia Unificada</h3>
                    <div className="space-y-6">
                      {unifiedHistory.map((item, i) => (
                        <div key={i} className={cn("relative p-5 border-2 rounded-xl transition-all", item.type === 'djen' ? "border-blue-600 bg-blue-50/10 shadow-[4px_4px_0px_#2563eb]" : "border-slate-200 bg-slate-50/50")}>
                          <div className="flex items-start justify-between mb-3">
                             <div className="flex items-center gap-2">
                                <Badge className={cn("text-[8px] font-black uppercase rounded-none", item.type === 'djen' ? "bg-blue-600" : "bg-slate-500")}>{item.type === 'djen' ? 'Diário Oficial' : 'Tribunal'}</Badge>
                                {item.type === 'djen' && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {(item.raw.link || historyResult?.case.djen_ultimo_link) && (
                                      <a href={item.raw.link || historyResult?.case.djen_ultimo_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[8px] font-black text-blue-600 uppercase hover:underline">
                                        <Globe size={10} /> Abrir no D.O.
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      className="flex items-center gap-1 text-[8px] font-black text-emerald-700 uppercase hover:underline"
                                      onClick={async () => {
                                        try {
                                          const texto = (item.raw.texto || item.raw.conteudo || historyResult?.case.djen_ultimo_resumo || '').toString();
                                          const res = await generateDjenPublicationPDFAction({
                                            titulo: item.raw.tipoComunicacao || item.raw.tipoDocumento || item.title || 'PUBLICAÇÃO DJEN',
                                            protocolo: historyResult?.case.protocolo || '',
                                            data: item.date ? item.date.toLocaleDateString('pt-BR') : 'S/D',
                                            orgao: item.raw.nomeOrgao || item.subtitle || '',
                                            texto: texto || 'Conteúdo não disponível.',
                                          });
                                          if (res.success && res.base64) {
                                            const a = document.createElement('a');
                                            a.href = `data:application/pdf;base64,${res.base64}`;
                                            a.download = `DJEN_${historyResult?.case.protocolo || 'pub'}.pdf`;
                                            a.click();
                                          }
                                        } catch { /* */ }
                                      }}
                                    >
                                      <Download size={10} /> Exportar PDF
                                    </button>
                                  </div>
                                )}
                             </div>
                             <span className="text-[10px] font-black text-muted-foreground uppercase">{format(item.date, 'dd/MM/yyyy')}</span>
                          </div>
                          <h4 className="text-sm font-black uppercase text-foreground mb-1 leading-tight">{item.title}</h4>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">{item.subtitle}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="space-y-6 pt-6 border-t">
                    <h3 className={cn("text-amber-600 flex items-center gap-2", ui.label)}><Sparkles size={14} /> Sugestões Estratégicas</h3>
                    <div className="bg-black text-white p-6 space-y-4 rounded-xl">
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
                        <Button onClick={handleGenerateAIDraft} disabled={isGeneratingAIDraft} className="h-10 px-6 bg-white text-black font-black uppercase text-[10px] rounded-lg shadow-lg">
                          {isGeneratingAIDraft ? <Loader2 size={12} className="animate-spin" /> : "Gerar Rascunho"}
                        </Button>
                      </div>
                      {aiDraft && <div className="space-y-3 mt-2"><div className="p-4 bg-white/5 border border-white/10 rounded-lg"><p className="text-white/80 italic text-xs">"{aiDraft}"</p></div><Button onClick={() => copyScript(aiDraft)} variant="ghost" className="h-10 w-full text-[9px] font-black uppercase border border-white/20 hover:bg-white/10 text-white rounded-lg">Copiar Rascunho</Button></div>}
                    </div>
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
              <DialogHeader className="p-6 bg-secondary/20 border-b shrink-0">
                <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2"><UserCheck className="text-primary" /> Registrar Atendimento</DialogTitle>
              </DialogHeader>
              <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
                  <div className="grid gap-2">
                    <Label className={ui.label}>Resultado do Contato</Label>
                    <Select value={attendanceForm.situacao} onValueChange={(val) => setAttendanceForm({...attendanceForm, situacao: val})}>
                      <SelectTrigger className="rounded-xl h-12 bg-secondary/30 border-none font-bold text-[11px] uppercase"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EM ANDAMENTO" className="text-[10px] font-bold uppercase">Manter Ativo</SelectItem>
                        <SelectItem value="ENCERRADO" className="text-[10px] font-bold uppercase text-red-600">Encerrar Caso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className={ui.label}>Próximo retorno</Label>
                    <Input type="date" value={attendanceForm.proximoRetorno} onChange={(e) => setAttendanceForm({...attendanceForm, proximoRetorno: e.target.value})} disabled={attendanceForm.situacao === 'ENCERRADO'} className="rounded-xl h-12 bg-secondary/30 border-none font-bold uppercase" />
                  </div>
                  <div className="grid gap-2">
                    <Label className={ui.label}>Observações de Gabinete</Label>
                    <Textarea placeholder="Descreva o que foi conversado..." value={attendanceForm.observacao} onChange={(e) => setAttendanceForm({...attendanceForm, observacao: e.target.value.toUpperCase()})} className="rounded-xl min-h-[100px] bg-secondary/30 border-none font-bold uppercase resize-none" />
                  </div>
                  <div className="flex items-center space-x-3 pt-2">
                    <Checkbox id="applyToAll" checked={attendanceForm.applyToAll} onCheckedChange={(val) => setAttendanceForm({...attendanceForm, applyToAll: !!val})} />
                    <Label htmlFor="applyToAll" className="text-[10px] font-black uppercase cursor-pointer leading-tight">Aplicar a toda carteira do cliente</Label>
                  </div>
              </div>
              <DialogFooter className="p-6 pt-0 shrink-0"><Button type="button" onClick={handleSaveAttendance} disabled={isSavingAttendance} className="w-full h-14 bg-black text-white rounded-xl font-black uppercase text-[11px] shadow-xl">{isSavingAttendance ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />} Sincronizar Registro</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[600px] rounded-2xl border-none shadow-2xl p-0 h-[90vh] flex flex-col overflow-hidden">
            <form onSubmit={handleSaveEdit} className="flex flex-col h-full">
              <DialogHeader className="p-6 bg-secondary/20 border-b shrink-0">
                <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2"><Edit2 size={18} className="text-primary"/> Editar Registro</DialogTitle>
              </DialogHeader>
              <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className={ui.label}>Cliente</Label><Input value={formState.cliente} onChange={e => setFormState({...formState, cliente: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/20 border-none font-black uppercase text-xs" /></div>
                  <div className="space-y-2"><Label className={ui.label}>Protocolo (CNJ)</Label><Input value={formState.protocolo} onChange={e => setFormState({...formState, protocolo: e.target.value})} className="rounded-xl h-11 bg-secondary/20 border-none font-mono text-xs" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className={ui.label}>Advogado</Label><Input value={formState.advogado} onChange={e => setFormState({...formState, advogado: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/20 border-none font-bold uppercase text-xs" /></div>
                  <div className="space-y-2"><Label className={ui.label}>Escritório</Label><Input value={formState.escritorio} onChange={e => setFormState({...formState, escritorio: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/20 border-none font-bold uppercase text-xs" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className={ui.label}>Próximo Prazo</Label><Input value={formState.proximoPrazo} onChange={e => setFormState({...formState, proximoPrazo: e.target.value})} className="rounded-xl h-11 bg-secondary/20 border-none font-bold text-xs" /></div>
                  <div className="space-y-2"><Label className={ui.label}>Telefone</Label><Input value={formState.telefone} onChange={e => setFormState({...formState, telefone: e.target.value})} className="rounded-xl h-11 bg-secondary/20 border-none font-mono text-xs" /></div>
                </div>
                <div className="space-y-2"><Label className={ui.label}>Observações</Label><Textarea value={formState.observacao} onChange={e => setFormState({...formState, observacao: e.target.value.toUpperCase()})} className="rounded-xl bg-secondary/20 border-none font-bold uppercase text-xs min-h-[120px] resize-none" /></div>
              </div>
              <DialogFooter className="p-6 bg-secondary/10 border-t shrink-0"><Button type="submit" className="w-full h-14 bg-black text-white font-black uppercase text-[11px] rounded-xl shadow-xl">Salvar Alterações</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default function CasesPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" size={48} /></div>}>
      <CasesContent />
    </Suspense>
  );
}
