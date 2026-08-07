"use client";
import { OpsOrbitalStrip, defaultOpsNodes } from "@/components/ui/ops-orbital-strip";


/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Search, Trash2, Edit2, CheckCircle2, Zap, Loader2, CalendarDays, Sparkles, 
  History, AlertCircle, FileSearch, ShieldAlert, Copy, MessageSquareQuote, 
  Globe, Bot, Download, ChevronRight, UserCheck, Building2, ExternalLink, FileDown,
  Briefcase, RefreshCcw, Plus
} from 'lucide-react';
import {LegalCase, processarCaso, formatDateToISO, extrairTribunal} from '@/lib/case-logic';
import { cn, formatWhatsAppLink } from '@/lib/utils'
import { isAtendidoNestaSemana } from '@/lib/atendimento-semana';
import { ui } from '@/lib/responsive-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { fetchRepoCases, syncRepoCases, scanSingleCaseAction, recalibrateCasesAction } from '@/app/actions/case-actions';
import { updateCaseCnjAction } from '@/app/actions/update-case-cnj';
import { openDjenPublicacaoAction } from '@/app/actions/open-djen-action';
import { generateDossieProcessoPDFAction } from '@/app/actions/dossie-processo-actions';
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
import { buildUnifiedTimeline } from '@/lib/timeline-normalize';
import { plainTextFromDjen, summarizeDjenKeywords } from '@/lib/djen';
import { Checkbox } from '@/components/ui/checkbox';
import { getSinalCapa } from '@/lib/sinal-capa';

const CaseRow = React.memo(({ 
  c, isOperador, onLogReturn, onEdit, onDelete, onScan, onSuggest, onDossie
}: { 
  c: LegalCase;
  isOperador: boolean;
  onLogReturn: (c: LegalCase) => void;
  onEdit: (c: LegalCase) => void;
  onDelete: (id: string) => void;
  onScan: (c: LegalCase) => void;
  onSuggest: (c: LegalCase) => void;
  onDossie?: (c: LegalCase) => void;
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
            {isAtendidoNestaSemana(c.ultimoRetorno || (c as any).ultimo_retorno) && <Badge className="badge-semana h-5 px-2 rounded-md font-black uppercase text-[8px]">Atendido semana</Badge>}
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
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-[9px] font-black text-blue-600 uppercase hover:underline disabled:opacity-50"
                    disabled={loading}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (c.djen_ultimo_link) {
                        window.open(c.djen_ultimo_link, '_blank', 'noopener,noreferrer');
                        return;
                      }
                      setLoading(true);
                      try {
                        const r = await openDjenPublicacaoAction(c.protocolo);
                        if (r.success && (r as any).link) {
                          window.open((r as any).link, '_blank', 'noopener,noreferrer');
                        } else {
                          alert((r as any).error || 'Sem link DJEN no momento');
                        }
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <Globe size={10} />
                    {c.djen_ultimo_link
                      ? 'Abrir publicação no Diário Oficial'
                      : 'Abrir publicação DJEN (buscar link)'}
                  </button>
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
          <button type="button" onClick={() => onDossie?.(c)} className={cn("text-slate-700 hover:bg-slate-100 w-10 h-10 rounded-xl flex items-center justify-center transition-colors", ui.touch)} title="Dossiê do processo (PDF)">
            <FileDown size={18} />
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
  
  const [formState, setFormState] = useState({ cliente: '', protocolo: '', advogado: '', proximoPrazo: '', situacao: 'EM ANDAMENTO', ultimoRetorno: '', statusManual: 'Automatico', observacao: '', telefone: '', escritorio: '', cpf: '', email: '', estado_civil: '', emprego: '', nacionalidade: 'BRASILEIRA', parte_passiva: '', parte_passiva_cnpj: '', classe_acao: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRepoCases();
      if (Array.isArray(data)) setCases(data);
    } finally { setLoading(false); }
  }, [setCases]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && isOperador) {
      setEditingCase(null);
      setFormState({
        cliente: '',
        protocolo: '',
        advogado: '',
        proximoPrazo: '',
        situacao: 'EM ANDAMENTO',
        ultimoRetorno: '',
        statusManual: 'Automatico',
        observacao: '',
        telefone: '',
        escritorio: '',
        cpf: '',
        email: '',
        estado_civil: '',
        emprego: '',
        nacionalidade: 'BRASILEIRA',
        parte_passiva: '',
        parte_passiva_cnpj: '',
        classe_acao: '',
      });
      setIsModalOpen(true);
    }
  }, [searchParams, isOperador]);

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
      // Auditoria 3D: so DJEN (rapido)
      const res = await scanSingleCaseAction(c.protocolo, { mode: 'djen', fast: false });
      const coms = Array.isArray((res as any).comunicacoes) ? (res as any).comunicacoes : [];
      setHistoryResult({
        case: (res as any).case || c,
        movimentos: [],
        djenComunicacoes: coms,
      });
      setIsHistoryModalOpen(true);
      setShowScripts(false);
      setSuggestedScripts([]);
      setAiDraft(null);
      if ((res as any).casePatch) {
        updateCaseByProtocolo(c.protocolo, ((res as any).casePatch as Record<string, any>) || {});
      }
      toast({
        title: coms.length ? `DJEN: ${coms.length} publicacao(oes)` : 'DJEN sem retorno',
        description: coms.length
          ? 'Auditoria 3D (somente diario oficial).'
          : String((res as any).error || 'Sem publicacoes no periodo ou falha de rede.'),
        variant: coms.length ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Falha Auditoria 3D', description: e?.message || 'Erro DJEN', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestClick = async (c: LegalCase) => {
    if (!c.protocolo) return;
    setLoading(true);
    setAiDraft(null);
    try {
      // Auditoria unificada: DataJud + DJEN (obrigatorio para Sugerir resposta)
      const res = await scanSingleCaseAction(c.protocolo, { mode: 'both', fast: false });
      const movimentos = normalizeMovList((res as any).movimentos);
      const comunicacoes = Array.isArray((res as any).comunicacoes) ? (res as any).comunicacoes : [];
      const caseData = (res as any).case || c;

      setHistoryResult({
        case: caseData,
        movimentos,
        djenComunicacoes: comunicacoes,
      });

      const djenTexts = comunicacoes
        .map((d: any) => plainTextFromDjen(d.texto || d.conteudo || d.inteiroTeor || ''))
        .filter(Boolean);

      const suggestions = suggestScripts({
        clienteNome: c.cliente || caseData.cliente,
        protocolo: c.protocolo,
        ultimoRetorno: c.ultimoRetorno || caseData.ultimoRetorno,
        eventoTipo: caseData.evento_tipo || c.evento_tipo,
        eventoResumo: caseData.evento_resumo || c.evento_resumo,
        datajud_ultimo_nome: caseData.datajud_ultimo_nome || c.datajud_ultimo_nome,
        movimentos,
        djenTexts,
        tem_novo_andamento: caseData.tem_novo_andamento ?? c.tem_novo_andamento,
        datajud_encerrado_tribunal: caseData.datajud_encerrado_tribunal ?? c.datajud_encerrado_tribunal,
        indicio_busca_apreensao: caseData.indicio_busca_apreensao ?? c.indicio_busca_apreensao,
        em_cumprimento_sentenca: caseData.em_cumprimento_sentenca ?? c.em_cumprimento_sentenca,
      });
      setSuggestedScripts(suggestions);
      setShowScripts(true);
      setIsHistoryModalOpen(true);
      if ((res as any).casePatch) {
        updateCaseByProtocolo(c.protocolo, (res as any).casePatch || {});
      }
      toast({
        title: suggestions.length
          ? `${suggestions.length} resposta(s) pronta(s)`
          : 'Auditoria unificada',
        description: `${movimentos.length} mov. DataJud · ${comunicacoes.length} DJEN`,
        variant: movimentos.length || comunicacoes.length ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({
        title: 'Falha na auditoria unificada',
        description: e?.message || 'Erro ao consultar DataJud/DJEN',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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

  const handleDossieProcesso = async (c: LegalCase) => {
    if (!c?.protocolo) {
      toast({ title: 'Protocolo ausente', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await generateDossieProcessoPDFAction(c.protocolo, { useClaude: true });
      if (!(res as any)?.success || !(res as any)?.base64) {
        toast({
          title: 'Falha no dossiê',
          description: (res as any)?.error || 'Não foi possível gerar o PDF',
          variant: 'destructive',
        });
        return;
      }
      const a = document.createElement('a');
      a.href = `data:application/pdf;base64,${(res as any).base64}`;
      a.download =
        (res as any).filename ||
        `Dossie_${String(c.cliente || 'processo').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({ title: 'Dossiê PDF gerado', description: c.protocolo });
    } catch (e: any) {
      toast({
        title: 'Falha no dossiê',
        description: e?.message || 'Erro',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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

  const emptyForm = () => ({
    cliente: '',
    protocolo: '',
    advogado: '',
    proximoPrazo: '',
    situacao: 'EM ANDAMENTO',
    ultimoRetorno: '',
    statusManual: 'Automatico',
    observacao: '',
    telefone: '',
    escritorio: '',
    cpf: '',
    email: '',
    estado_civil: '',
    emprego: '',
    nacionalidade: 'BRASILEIRA',
    parte_passiva: '',
    parte_passiva_cnpj: '',
    classe_acao: '',
  });

  const handleNewCase = () => {
    setEditingCase(null);
    setFormState(emptyForm());
    setIsModalOpen(true);
  };

  const handleEdit = (c: LegalCase) => {
    setEditingCase(c);
    setFormState({
      cliente: c.cliente || '',
      protocolo: c.protocolo || '',
      advogado: c.advogado || '',
      proximoPrazo: c.proximoPrazo || '',
      situacao: c.situacao || 'EM ANDAMENTO',
      ultimoRetorno: c.ultimoRetorno || '',
      statusManual: c.statusManual || 'Automatico',
      observacao: c.observacao || '',
      telefone: c.telefone || '',
      escritorio: c.escritorio || '',
      cpf: (c as any).cpf || '',
      email: (c as any).email || '',
      estado_civil: (c as any).estado_civil || '',
      emprego: (c as any).emprego || '',
      nacionalidade: (c as any).nacionalidade || 'BRASILEIRA',
      parte_passiva: (c as any).parte_passiva || '',
      parte_passiva_cnpj: (c as any).parte_passiva_cnpj || '',
      classe_acao: (c as any).classe_acao || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    const cliente = (formState.cliente || '').trim();
    const protocolo = (formState.protocolo || '').trim();
    if (!cliente || !protocolo) {
      toast({ title: 'Campos obrigatórios', description: 'Informe cliente e protocolo (CNJ).', variant: 'destructive' });
      return;
    }
    if (editingCase) {
      const digits = protocolo.replace(/\D/g, '');
      if (digits.length !== 20) {
        toast({ title: 'CNJ inválido', description: 'O protocolo deve ter 20 dígitos.', variant: 'destructive' });
        return;
      }
      const oldDigits = String(editingCase.protocolo || '').replace(/\D/g, '');
      const cnjChanged = digits !== oldDigits;
      if (cnjChanged) {
        const dup = cases.some(
          c => c.id !== editingCase.id && String(c.protocolo || '').replace(/\D/g, '') === digits
        );
        if (dup) {
          toast({ title: 'Protocolo já existe', description: 'Este CNJ já está na carteira.', variant: 'destructive' });
          return;
        }
      }
      const tribunalData = extrairTribunal(protocolo);
      const updatedCase = processarCaso({
        ...editingCase,
        ...formState,
        cliente,
        protocolo,
        tribunal: tribunalData?.tribunal || editingCase.tribunal,
      });
      if (cnjChanged) {
        const res = await updateCaseCnjAction(String(editingCase.protocolo || ''), updatedCase);
        if (res?.success) {
          const updatedList = cases.map(c => (c.id === editingCase.id ? updatedCase : c));
          setCases(updatedList);
          setIsModalOpen(false);
          setEditingCase(null);
          toast({ title: 'CNJ atualizado', description: `${editingCase.protocolo} → ${protocolo}` });
        } else {
          toast({ title: 'Falha ao salvar CNJ', description: (res as any)?.error || (res as any)?.message || 'Tente novamente', variant: 'destructive' });
        }
        return;
      }
      const updatedList = cases.map(c => (c.id === editingCase.id ? updatedCase : c));
      const res = await syncRepoCases(updatedList);
      if (res.success) {
        setCases(updatedList);
        setIsModalOpen(false);
        setEditingCase(null);
        toast({ title: 'Alterações salvas' });
      } else {
        toast({ title: 'Falha ao salvar', description: (res as any).error || 'Tente novamente', variant: 'destructive' });
      }
      return;
    }
    // Novo processo
    const dup = cases.some(c => String(c.protocolo || '').replace(/\D/g, '') === protocolo.replace(/\D/g, ''));
    if (dup) {
      toast({ title: 'Protocolo já existe', description: 'Este CNJ já está na carteira.', variant: 'destructive' });
      return;
    }
    const id =
      (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `new_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const novo = processarCaso({
      id,
      cliente: cliente.toUpperCase(),
      protocolo,
      advogado: (formState.advogado || '').toUpperCase(),
      escritorio: (formState.escritorio || '').toUpperCase(),
      telefone: formState.telefone || '',
      proximoPrazo: formState.proximoPrazo || '',
      situacao: formState.situacao || 'EM ANDAMENTO',
      ultimoRetorno: formState.ultimoRetorno || '',
      statusManual: formState.statusManual || 'Automatico',
      observacao: (formState.observacao || '').toUpperCase(),
      status: 'EM ANDAMENTO',
      cpf: formState.cpf || '',
      email: formState.email || '',
      estado_civil: formState.estado_civil || '',
      emprego: formState.emprego || '',
      nacionalidade: formState.nacionalidade || 'BRASILEIRA',
      parte_passiva: formState.parte_passiva || '',
      parte_passiva_cnpj: formState.parte_passiva_cnpj || '',
      classe_acao: formState.classe_acao || '',
    } as any);
    const updatedList = [novo, ...cases];
    const res = await syncRepoCases(updatedList);
    if (res.success) {
      setCases(updatedList);
      setIsModalOpen(false);
      setEditingCase(null);
      setFormState(emptyForm());
      toast({ title: 'Processo adicionado', description: protocolo });
    } else {
      toast({ title: 'Falha ao adicionar', description: (res as any).error || 'Tente novamente', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja remover este processo permanentemente do gabinete?')) {
      const updatedList = cases.filter(c => c.id !== id);
      const res = await syncRepoCases(updatedList);
      if (res.success) {
        removeCase(id);
        toast({ title: 'Processo removido' });
      }
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
    return buildUnifiedTimeline(historyResult.movimentos, historyResult.djenComunicacoes);
  }, [historyResult]);

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className={cn("flex-1 flex flex-col h-screen overflow-hidden", ui.main)}>
          <div className="px-4 sm:px-6 pt-4">
            <OpsOrbitalStrip
              nodes={defaultOpsNodes({
                total: cases.length,
                pendentes: cases.filter((c: any) => c.status === "É Hoje" || c.tem_novo_andamento).length,
                vencidos: cases.filter((c: any) => c.status === "Vencido" || c.status === "Caso Crítico").length,
                novidades: cases.filter((c: any) => c.tem_novo_andamento).length,
                ok: cases.filter((c: any) => c.status === "No Prazo").length,
              })}
              className="mb-4"
            />
          </div>

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
            {isOperador && (
              <Button
                size="sm"
                onClick={handleNewCase}
                className="h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest bg-black text-white hover:bg-primary hover:text-black"
              >
                <Plus size={16} className="mr-2" />
                Novo Processo
              </Button>
            )}
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
                    <CaseRow key={c.id} c={c} isOperador={isOperador} onLogReturn={handleLogReturn} onEdit={handleEdit} onDelete={handleDelete} onScan={handleSingleScan} onSuggest={handleSuggestClick} onDossie={handleDossieProcesso} />
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
                                      title="PDF rápido sem IA"
                                      onClick={async () => {
                                        try {
                                          const texto = (item.raw.texto || item.raw.conteudo || historyResult?.case.djen_ultimo_resumo || '').toString();
                                          const res = await generateDjenPublicationPDFAction({
                                            titulo: item.raw.tipoComunicacao || item.raw.tipoDocumento || item.title || 'PUBLICAÇÃO DJEN',
                                            protocolo: historyResult?.case.protocolo || '',
                                            data: item.date ? item.date.toLocaleDateString('pt-BR') : 'S/D',
                                            orgao: item.raw.nomeOrgao || item.subtitle || '',
                                            texto: texto || 'Conteúdo não disponível.',
                                            useClaude: false,
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
                                      <Download size={10} /> PDF rápido
                                    </button>
                                    <button
                                      type="button"
                                      className="flex items-center gap-1 text-[8px] font-black text-violet-700 uppercase hover:underline"
                                      title="PDF com explicação (Claude)"
                                      onClick={async () => {
                                        try {
                                          const texto = (item.raw.texto || item.raw.conteudo || historyResult?.case.djen_ultimo_resumo || '').toString();
                                          const res = await generateDjenPublicationPDFAction({
                                            titulo: item.raw.tipoComunicacao || item.raw.tipoDocumento || item.title || 'PUBLICAÇÃO DJEN',
                                            protocolo: historyResult?.case.protocolo || '',
                                            data: item.date ? item.date.toLocaleDateString('pt-BR') : 'S/D',
                                            orgao: item.raw.nomeOrgao || item.subtitle || '',
                                            texto: texto || 'Conteúdo não disponível.',
                                            useClaude: true,
                                          });
                                          if (res.success && res.base64) {
                                            const a = document.createElement('a');
                                            a.href = `data:application/pdf;base64,${res.base64}`;
                                            a.download = `DJEN_detalhado_${historyResult?.case.protocolo || 'pub'}.pdf`;
                                            a.click();
                                          }
                                        } catch { /* */ }
                                      }}
                                    >
                                      <Download size={10} /> PDF detalhado
                                    </button>
                                  </div>
                                )}
                             </div>
                             <span className="text-[10px] font-black text-muted-foreground uppercase">{item.date && !Number.isNaN(item.date.getTime()) && item.date.getTime() > 0 ? format(item.date, 'dd/MM/yyyy') : 'S/D'}</span>
                          </div>
                          <h4 className="text-sm font-black uppercase text-foreground mb-1 leading-tight">{item.title}</h4>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">{item.subtitle}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                  {showScripts && suggestedScripts.length > 0 && (
                    <section className="space-y-4 pt-6 border-t">
                      <h3 className={cn("text-emerald-700 flex items-center gap-2", ui.label)}>
                        <MessageSquareQuote size={14} /> Sugerir resposta (scripts fixos — sem IA)
                      </h3>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">
                        Respostas padronizadas do gabinete. Revise antes de enviar. IA só no botão Rascunho abaixo.
                      </p>
                      <div className="space-y-3">
                        {suggestedScripts.map((s, idx) => (
                          <div key={s.id || idx} className="border-2 border-black p-4 rounded-xl bg-white space-y-2 shadow-[3px_3px_0_#000]">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] font-black uppercase text-black">{s.titulo}</p>
                              <span className="text-[8px] font-bold text-muted-foreground uppercase">{s.quandoUsar}</span>
                            </div>
                            <p className="text-xs text-black/80 whitespace-pre-wrap leading-relaxed">{s.texto}</p>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 w-full text-[9px] font-black uppercase border-2 border-black rounded-lg"
                              onClick={() => copyScript(s.texto)}
                            >
                              Copiar resposta
                            </Button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  <section className="space-y-6 pt-6 border-t">
                    <h3 className={cn("text-amber-600 flex items-center gap-2", ui.label)}><Sparkles size={14} /> Rascunho opcional (IA)</h3>
                    <div className="bg-black text-white p-6 space-y-4 rounded-xl">
                      <p className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Bot size={12}/> Só gera se você clicar — não mistura com Sugerir Resposta</p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Select value={selectedMotor} onValueChange={setSelectedMotor}>
                          <SelectTrigger className="h-10 bg-white/10 border-white/20 text-white font-black uppercase text-[10px] rounded-lg flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-white border-2 border-black rounded-lg">
                            <SelectItem value="local_only" className="text-[9px] font-black uppercase">Script Lexis (sem IA)</SelectItem>
                            <SelectItem value="claude" className="text-[9px] font-black uppercase">Claude AI (OmniRoute)</SelectItem>
                            <SelectItem value="groq-llama" className="text-[9px] font-black uppercase">Groq Llama 3.3</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button onClick={handleGenerateAIDraft} disabled={isGeneratingAIDraft} className="h-10 px-6 bg-white text-black font-black uppercase text-[10px] rounded-lg shadow-lg">
                          {isGeneratingAIDraft ? <Loader2 size={12} className="animate-spin" /> : "Gerar Rascunho"}
                        </Button>
                      </div>
                      {aiDraft && <div className="space-y-3 mt-2"><div className="p-4 bg-white/5 border border-white/10 rounded-lg"><p className="text-white/80 italic text-xs whitespace-pre-wrap">"{aiDraft}"</p></div><Button onClick={() => copyScript(aiDraft)} variant="ghost" className="h-10 w-full text-[9px] font-black uppercase border border-white/20 hover:bg-white/10 text-white rounded-lg">Copiar Rascunho</Button></div>}
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

        <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) setEditingCase(null); }}>
          <DialogContent className="sm:max-w-[600px] rounded-2xl border-none shadow-2xl p-0 h-[90vh] flex flex-col overflow-hidden">
            <form onSubmit={handleSaveCase} className="flex flex-col h-full">
              <DialogHeader className="p-6 bg-secondary/20 border-b shrink-0">
                <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
                  {editingCase ? <Edit2 size={18} className="text-primary"/> : <Plus size={18} className="text-primary"/>}
                  {editingCase ? 'Editar Registro' : 'Novo Processo'}
                </DialogTitle>
              </DialogHeader>
              <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className={ui.label}>Cliente *</Label><Input required value={formState.cliente} onChange={e => setFormState({...formState, cliente: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/20 border-none font-black uppercase text-xs" placeholder="NOME COMPLETO" /></div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className={ui.label}>Protocolo (CNJ) *</Label>
                      {editingCase && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                          Editável · altera a chave no banco
                        </span>
                      )}
                    </div>
                    <Input
                      required
                      value={formState.protocolo}
                      onChange={e => setFormState({ ...formState, protocolo: e.target.value })}
                      onBlur={e => {
                        const d = e.target.value.replace(/\D/g, '');
                        if (d.length === 20) {
                          const fmt = `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16,20)}`;
                          setFormState(s => ({ ...s, protocolo: fmt }));
                        }
                      }}
                      className="rounded-xl h-11 bg-secondary/20 border-none font-mono text-xs"
                      placeholder="0000000-00.0000.0.00.0000"
                    />
                    {editingCase && formState.protocolo.replace(/\D/g, '') !== String(editingCase.protocolo || '').replace(/\D/g, '') && (
                      <p className="text-[10px] text-muted-foreground">
                        CNJ anterior: <span className="font-mono">{editingCase.protocolo}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className={ui.label}>Advogado</Label><Input value={formState.advogado} onChange={e => setFormState({...formState, advogado: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/20 border-none font-bold uppercase text-xs" /></div>
                  <div className="space-y-2"><Label className={ui.label}>Escritório</Label><Input value={formState.escritorio} onChange={e => setFormState({...formState, escritorio: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/20 border-none font-bold uppercase text-xs" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className={ui.label}>Próximo Prazo</Label><Input value={formState.proximoPrazo} onChange={e => setFormState({...formState, proximoPrazo: e.target.value})} className="rounded-xl h-11 bg-secondary/20 border-none font-bold text-xs" placeholder="dd/mm/aaaa" /></div>
                  <div className="space-y-2"><Label className={ui.label}>Telefone</Label><Input value={formState.telefone} onChange={e => setFormState({...formState, telefone: e.target.value})} className="rounded-xl h-11 bg-secondary/20 border-none font-mono text-xs" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className={ui.label}>CPF</Label><Input value={formState.cpf} onChange={e => setFormState({...formState, cpf: e.target.value})} className="rounded-xl h-11 bg-secondary/20 border-none font-mono text-xs" placeholder="000.000.000-00" /></div>
                  <div className="space-y-2"><Label className={ui.label}>E-mail</Label><Input value={formState.email} onChange={e => setFormState({...formState, email: e.target.value})} className="rounded-xl h-11 bg-secondary/20 border-none text-xs" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className={ui.label}>Estado civil</Label><Input value={formState.estado_civil} onChange={e => setFormState({...formState, estado_civil: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/20 border-none font-bold uppercase text-xs" /></div>
                  <div className="space-y-2"><Label className={ui.label}>Emprego</Label><Input value={formState.emprego} onChange={e => setFormState({...formState, emprego: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/20 border-none font-bold uppercase text-xs" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className={ui.label}>Nacionalidade</Label><Input value={formState.nacionalidade} onChange={e => setFormState({...formState, nacionalidade: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/20 border-none font-bold uppercase text-xs" /></div>
                  <div className="space-y-2"><Label className={ui.label}>Classe / ação</Label><Input value={formState.classe_acao} onChange={e => setFormState({...formState, classe_acao: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/20 border-none font-bold uppercase text-xs" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className={ui.label}>Parte passiva</Label><Input value={formState.parte_passiva} onChange={e => setFormState({...formState, parte_passiva: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/20 border-none font-bold uppercase text-xs" placeholder="BANCO..." /></div>
                  <div className="space-y-2"><Label className={ui.label}>CNPJ passivo</Label><Input value={formState.parte_passiva_cnpj} onChange={e => setFormState({...formState, parte_passiva_cnpj: e.target.value})} className="rounded-xl h-11 bg-secondary/20 border-none font-mono text-xs" /></div>
                </div>
                <div className="space-y-2">
                  <Label className={ui.label}>Situação</Label>
                  <Select value={formState.situacao} onValueChange={(val) => setFormState({...formState, situacao: val})}>
                    <SelectTrigger className="rounded-xl h-11 bg-secondary/20 border-none font-bold uppercase text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EM ANDAMENTO" className="text-[10px] font-bold uppercase">EM ANDAMENTO</SelectItem>
                      <SelectItem value="ENCERRADO" className="text-[10px] font-bold uppercase">ENCERRADO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label className={ui.label}>Observações</Label><Textarea value={formState.observacao} onChange={e => setFormState({...formState, observacao: e.target.value.toUpperCase()})} className="rounded-xl bg-secondary/20 border-none font-bold uppercase text-xs min-h-[120px] resize-none" /></div>
              </div>
              <DialogFooter className="p-6 bg-secondary/10 border-t shrink-0">
                <Button type="submit" className="w-full h-14 bg-black text-white font-black uppercase text-[11px] rounded-xl shadow-xl">
                  {editingCase ? 'Salvar Alterações' : 'Adicionar Processo'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function normalizeMovList(movs: any): any[] {
  if (!Array.isArray(movs)) return [];
  return movs.slice(0, 80).map((m: any) => ({
    ...m,
    dataHora: m?.dataHora || m?.data || m?.dataMovimento || null,
    nome: m?.nome || m?.nomeMovimento || m?.descricao || 'Movimentação',
    complemento: m?.complemento || m?.observacao || '',
  }));
}

export default function CasesPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" size={48} /></div>}>
      <CasesContent />
    </Suspense>
  );
}
