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
  Globe, Bot, Download, ChevronRight, ChevronDown, ChevronUp, UserCheck, Building2, ExternalLink, FileDown,
  Briefcase, RefreshCcw, Plus
} from 'lucide-react';
import {LegalCase, processarCaso, formatDateToISO, extrairTribunal} from '@/lib/case-logic'
import { filterCases, sortCasesByPrazo, listAdvogados, type SortPrazoMode } from '@/lib/case-filters';
import { CaseBadges } from '@/components/cases/case-badges';
import { cn, formatWhatsAppLink } from '@/lib/utils';
import { CaseResumoChip } from '@/components/cases/case-resumo-chip'
import { isAtendidoNestaSemana, isAtendidoHoje, hojeBrasilYmd } from '@/lib/atendimento-semana';
import { computeKpiCarteira } from '@/lib/kpi-carteira';
import { countEditadosAppSemana, countEditadosAppHoje, countAuditadosNestaSemana, countAuditadosHoje, countAuditadosTribunalSemana, patchAtendimentoComEdicao, patchAuditoriaEdicao } from '@/lib/processos-auditados';
import { ui } from '@/lib/responsive-ui';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { fetchRepoCases, syncRepoCases, scanSingleCaseAction, recalibrateCasesAction, registrarAtendimentoAction, registrarAuditoriaEventAction, backfillEncerradosHojeAction } from '@/app/actions/case-actions';
import { loadCarteiraComCache, writeCarteiraCache, invalidateCarteiraCache } from '@/lib/session-carteira-cache';
import { fetchCarteiraDeduped } from '@/lib/carteira-fetch-client';
import { listAssignableUsersAction, type AssignableUser } from '@/app/actions/team-list-actions';
import { updateCaseCnjAction } from '@/app/actions/update-case-cnj';
import { saveOneCaseAction, transferCasesOwnerAction, reassignCaseOwnerAction } from '@/app/actions/case-save-actions';
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
import { plainTextFromDjen, summarizeDjenKeywords, djenTextsRecentFirst, sortDjenComunicacoesRecentFirst } from '@/lib/djen';
// djenTextsRecentFirst usado no rascunho;
import { Checkbox } from '@/components/ui/checkbox';
import { getSinalCapa } from '@/lib/sinal-capa';
import { linhaFase, linhaDonoAto, linhaDonoPasso, diasDesdeTribunal } from '@/lib/fase-resumo';
import { OpsCaseLine } from '@/components/ops/ops-case-line';
import { FaseFilterBar, filtrarPorFase } from '@/components/cases/fase-filter-bar';
import type { FiltroFaseParado } from '@/lib/processos-parados';
import { appendScanLog } from '@/lib/scan-event-log';
import { AndamentoLeigoBlock } from '@/components/ops/andamento-leigo';
import { descreverPrazo } from '@/lib/prazos-cpc';

const CaseRow = React.memo(({ 
  c, isOperador, onLogReturn, onEdit, onDelete, onScan, onSuggest, onDossie,
  selectable, selected, onToggleSelect
}: { 
  c: LegalCase;
  isOperador: boolean;
  onLogReturn: (c: LegalCase) => void;
  onEdit: (c: LegalCase) => void;
  onDelete: (id: string) => void;
  onScan: (c: LegalCase) => void;
  onSuggest: (c: LegalCase) => void;
  onDossie?: (c: LegalCase) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (protocolo: string, on: boolean) => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const sinal = useMemo(() => getSinalCapa(c), [c]);

  return (
    <tr className="hover:bg-secondary/30 transition-all border-b border-border/50 group">
      <td className="px-6 py-4 align-top">
        <div className="relative pl-8 flex flex-col gap-1.5 min-w-0 max-w-[380px]">
      {selectable && (
        <div className="absolute left-2 top-3 z-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={!!selected}
            onCheckedChange={(v) => onToggleSelect?.(String(c.protocolo || ''), !!v)}
          />
        </div>
      )}
          <div className="flex items-start gap-2 min-w-0">
            <span className="text-foreground font-semibold text-[13px] leading-snug tracking-tight group-hover:text-primary transition-colors line-clamp-2">
              {c.cliente}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <CaseBadges c={c} showPriority className="gap-1" />
            {((c as any).sentenca_procedente || (c as any).merito_resultado === 'procedente') && (
              <Badge className="h-5 px-1.5 rounded-md bg-emerald-600/90 text-white font-medium text-[8px]">Procedente</Badge>
            )}
            {((c as any).sentenca_improcedente || (c as any).merito_resultado === 'improcedente') && (
              <Badge className="h-5 px-1.5 rounded-md bg-slate-600 text-white font-medium text-[8px]">Improcedente</Badge>
            )}
            {(c as any).tem_audiencia && (
              <Badge className="h-5 px-1.5 rounded-md bg-cyan-600/90 text-white font-medium text-[8px]">Audiência</Badge>
            )}
            {(c as any).tem_custas && (
              <Badge className="h-5 px-1.5 rounded-md bg-orange-500/90 text-white font-medium text-[8px]">Custas</Badge>
            )}
          </div>
          <span className={cn("text-[11px] font-mono text-muted-foreground", ui.cnj)}>{c.protocolo}</span>
          <OpsCaseLine c={c} className="mt-0.5" />
          {sinal.titulo && !/BUSCA E APREENS/i.test(String(sinal.titulo)) ? (
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1">
              {sinal.titulo}
              {sinal.data ? (
                <span> · {(() => { try { return format(parseISO(sinal.data), 'dd/MM/yy'); } catch { return ''; } })()}</span>
              ) : null}
            </p>
          ) : null}
          <AndamentoLeigoBlock
            caseData={c}
            showPrazo={false}
            showAtividades={false}
            className="!p-0 !border-0 !bg-transparent !shadow-none mt-0.5"
          />
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
  const auditadosSemana = useMemo(() => countAuditadosNestaSemana(cases as any), [cases]);
  const auditadosTribunal = useMemo(() => countAuditadosTribunalSemana(cases as any), [cases]);
  const editadosApp = useMemo(() => countEditadosAppSemana(cases as any), [cases]);
  const auditadosHoje = useMemo(() => countAuditadosHoje(cases as any), [cases]);
  // Fonte única: kpiCarteira.atendidosSemana (mesmo número no Dashboard/Supervisão)

  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [quickFilter, setQuickFilter] = useState(searchParams.get('filter') || searchParams.get('quick') || 'all');
  const [lawyerFilter, setLawyerFilter] = useState('all');
  const [sortPrazo, setSortPrazo] = useState<SortPrazoMode>('ops');
  const [filtrosFase, setFiltrosFase] = useState<FiltroFaseParado[]>([]);
  const [isRecalibrating, setIsRecalibrating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<LegalCase | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [ownerAuthId, setOwnerAuthId] = useState<string>('self');
  const [selectedProtos, setSelectedProtos] = useState<Set<string>>(new Set());
  const [bulkOwnerId, setBulkOwnerId] = useState<string>('');
  const [bulkTransferring, setBulkTransferring] = useState(false);
  const [visibleCount, setVisibleCount] = useState(80);
  const PAGE_SIZE = 80;
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyResult, setHistoryResult] = useState<{ case: LegalCase, movimentos: any[], djenComunicacoes?: any[] } | null>(null);
  const [suggestedScripts, setSuggestedScripts] = useState<ScriptSuggestion[]>([]);
  const [showScripts, setShowScripts] = useState(false);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [isGeneratingAIDraft, setIsGeneratingAIDraft] = useState(false);
  const [selectedMotor, setSelectedMotor] = useState<string>('omni');

  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [activeGroup, setActiveGroup] = useState<LegalCase | null>(null);
  const [attendanceForm, setAttendanceForm] = useState({ observacao: '', proximoRetorno: '', situacao: 'EM ANDAMENTO', applyToAll: true });

  const { isOperador, profile, isSupervisor, isSuperAdmin, canExport, canCopy, canScan, isViewer } = useAdmin();
  const kpiCarteira = useMemo(
    () => computeKpiCarteira(cases as any, { userId: (profile as any)?.auth_user_id || (profile as any)?.id }),
    [cases, profile]
  );
  const canAssignOwner = isSupervisor || isSuperAdmin || profile?.cargo === 'Administrador';
  const { toast } = useToast();
  
  const [formState, setFormState] = useState({ cliente: '', protocolo: '', advogado: '', proximoPrazo: '', situacao: 'EM ANDAMENTO', ultimoRetorno: '', statusManual: 'Automatico', observacao: '', telefone: '', escritorio: '', cpf: '', email: '', estado_civil: '', emprego: '', nacionalidade: 'BRASILEIRA', parte_passiva: '', parte_passiva_cnpj: '', classe_acao: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCarteiraDeduped(() => fetchRepoCases());
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
    if (!canExport) {
      toast({ title: 'Modo visualização', description: 'Exportação bloqueada neste perfil.', variant: 'destructive' });
      return;
    }
    setExporting(true);
    try {
      await runCasesPlanilhaExport(toast);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (!canExport) {
      toast({ title: 'Modo visualização', description: 'Exportação bloqueada neste perfil.', variant: 'destructive' });
      return;
    }
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
      appendScanLog({ cnj: c.protocolo, motor: 'djen', ok: (res as any)?.success !== false });
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
      appendScanLog({ cnj: c.protocolo, motor: 'datajud+djen', ok: (res as any)?.success !== false });
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
        cumprimento_pendente_necessario: !!(caseData as any)?.cumprimento_pendente_necessario,
        is_procedente: !!(caseData as any)?.is_procedente,
        oportunidade_elegivel: !!(caseData as any)?.oportunidade_elegivel,
        oportunidade_tipo_credito: (caseData as any)?.oportunidade_tipo_credito || null,
        oportunidade_score: (caseData as any)?.oportunidade_score ?? null,
        texto_pobre: !!(caseData as any)?.texto_pobre,
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
        description: movimentos.length || comunicacoes.length
          ? `${movimentos.length} mov. DataJud · ${comunicacoes.length} DJEN`
          : ((res as any).error || (res as any).message || 'Sem movimentos — timeout, 403 geo ou CNJ ausente no índice. Tente de novo (não use fast).'),
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
      const res = await gerarRascunhoEstrategico({ clienteNome: historyResult.case.cliente, protocolo: historyResult.case.protocolo, ultimoRetorno: historyResult.case.ultimoRetorno, movimentos: historyResult.movimentos, djenTexts, eventoTipo: historyResult.case.evento_tipo, eventoResumo: historyResult.case.evento_resumo, preferredModel: selectedMotor === "local_only" || selectedMotor === "local" ? "local_only" : "omni", empresaId: profile?.empresa_id, tem_novo_andamento: historyResult.case.tem_novo_andamento, datajud_encerrado_tribunal: historyResult.case.datajud_encerrado_tribunal, indicio_busca_apreensao: historyResult.case.indicio_busca_apreensao, cumprimento_pendente_necessario: !!(historyResult.case as any)?.cumprimento_pendente_necessario,
        is_procedente: !!(historyResult.case as any)?.is_procedente,
        oportunidade_elegivel: !!(historyResult.case as any)?.oportunidade_elegivel,
        oportunidade_tipo_credito: (historyResult.case as any)?.oportunidade_tipo_credito || null,
        oportunidade_score: (historyResult.case as any)?.oportunidade_score ?? null,
        texto_pobre: !!(historyResult.case as any)?.texto_pobre,
        em_cumprimento_sentenca: historyResult.case.em_cumprimento_sentenca });
      if (res.rascunho) { setAiDraft(res.rascunho); toast({ title: "Draft Gerado" }); }
    } finally { setIsGeneratingAIDraft(false); }
  };


  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await backfillEncerradosHojeAction();
        if (cancelled || !r?.success || !r.updated) return;
        const fresh = await fetchRepoCases();
        if (!cancelled && Array.isArray(fresh)) setCases(fresh);
        toast({ title: 'Encerrados de hoje contabilizados', description: `${r.updated} processo(s)` });
      } catch { /* */ }
    })();
    return () => { cancelled = true; };
  }, []);
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
      const todayStr = hojeBrasilYmd();
      const updatedCases = cases.map(c => {
        if (attendanceForm.applyToAll ? c.cliente === activeGroup.cliente : c.protocolo === activeGroup.protocolo) {
          return processarCaso({ 
            ...c, 
            situacao: attendanceForm.situacao, 
            ...patchAtendimentoComEdicao((profile as any)?.auth_user_id || (profile as any)?.id, todayStr), 
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
      if (res.success) {
        setCases(updatedCases);
        setIsAttendanceOpen(false);
        setActiveGroup(null);
        const touched = updatedCases
          .filter((c) =>
            attendanceForm.applyToAll
              ? c.cliente === activeGroup.cliente
              : c.protocolo === activeGroup.protocolo
          )
          .map((c) => c.protocolo);
        const isEncerrado = String(attendanceForm.situacao || '').toUpperCase() === 'ENCERRADO';
        try {
          if (isEncerrado) {
            await registrarAuditoriaEventAction('encerramento', touched, { via: 'cases', ultimoRetorno: todayStr });
          } else {
            await registrarAtendimentoAction(touched, { via: 'cases', ultimoRetorno: todayStr });
          }
        } catch { /* */ }
        toast({
          title: isEncerrado ? 'Encerrado e contabilizado' : 'Atendimento registrado',
          description: `Retorno ${todayStr}`,
        });
        try {
          const fresh = await fetchRepoCases();
          if (Array.isArray(fresh) && fresh.length) setCases(fresh);
        } catch { /* */ }
      }
    } finally { setIsSavingAttendance(false); }
  };

  const copyScript = (text: string) => {
    if (!canCopy) {
      toast({ title: 'Modo visualização', description: 'Copiar está desabilitado neste perfil.', variant: 'destructive' });
      return;
    }
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
    setOwnerAuthId(String((c as any).created_by || 'self'));
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


  const withEncerradoRetorno = (c: LegalCase): LegalCase => {
    const sit = String((c as any).situacao || c.status || '').toUpperCase();
    if (!sit.includes('ENCERR')) return c;
    const uid = (profile as any)?.auth_user_id || (profile as any)?.id || null;
    return processarCaso({
      ...c,
      situacao: (c as any).situacao || 'ENCERRADO',
      ...patchAtendimentoComEdicao(uid, hojeBrasilYmd()),
      proximoPrazo: '',
    });
  };

  const toggleSelectProto = (protocolo: string, on: boolean) => {
    setSelectedProtos((prev) => {
      const n = new Set(prev);
      if (on) n.add(protocolo);
      else n.delete(protocolo);
      return n;
    });
  };

  const handleBulkTransfer = async () => {
    if (!canAssignOwner) return;
    if (!bulkOwnerId) {
      toast({ title: 'Escolha o responsável', description: 'Selecione para quem transferir.', variant: 'destructive' });
      return;
    }
    const list = Array.from(selectedProtos);
    if (!list.length) {
      toast({ title: 'Nada selecionado', description: 'Marque os processos na lista.', variant: 'destructive' });
      return;
    }
    const nomeDest =
      (assignableUsers || []).find((u) => String(u.auth_user_id) === String(bulkOwnerId))?.nome ||
      bulkOwnerId;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `Transferir ${list.length} processo(s) para ${nomeDest}?\n\nIsso muda a carteira (created_by). Quem atendia continua no histórico de atendimento.`
      )
    ) {
      return;
    }
    setBulkTransferring(true);
    try {
      const res = await transferCasesOwnerAction({ protocolos: list, novoOwnerAuthId: bulkOwnerId });
      if (res.success && res.updated > 0) {
        // Remove da lista local se não for mais "meu" (operador) ou atualiza created_by
        {
          const next = cases
            .map((c: LegalCase) =>
              list.includes(String(c.protocolo || ''))
                ? ({ ...c, created_by: bulkOwnerId } as LegalCase)
                : c
            )
            .filter((c: LegalCase) => {
              if (!isOperador) return true;
              return String((c as any).created_by || '') === String((profile as any)?.auth_user_id || '');
            });
          setCases(next);
        }
        setSelectedProtos(new Set());
        toast({ title: 'Transferência em massa', description: res.message });
      } else {
        toast({
          title: 'Transferência incompleta',
          description: res.message || '0 atualizados — verifique trigger SQL prevent_created_by_steal',
          variant: 'destructive',
        });
      }
    } finally {
      setBulkTransferring(false);
    }
  };

  const handleSaveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    const cliente = (formState.cliente || '').trim();
    const protocolo = (formState.protocolo || '').trim();
    if (!cliente || !protocolo) {
      toast({ title: 'Campos obrigatórios', description: 'Informe cliente e protocolo (CNJ).', variant: 'destructive' });
      return;
    }
    // ENCERRADO ou último retorno hoje/semana = conta como atendimento
    const isoForm = formatDateToISO(formState.ultimoRetorno) || '';
    const isEncerrado = String(formState.situacao || '').toUpperCase() === 'ENCERRADO';
    const formForSave =
      isEncerrado
        ? {
            ...formState,
            ...patchAtendimentoComEdicao(
              (profile as any)?.auth_user_id || (profile as any)?.id,
              hojeBrasilYmd()
            ),
            proximoPrazo: '',
            ultimoRetorno: hojeBrasilYmd(),
          }
        : isoForm && (isAtendidoHoje(isoForm) || isAtendidoNestaSemana(isoForm))
          ? {
              ...formState,
              ...patchAtendimentoComEdicao(
                (profile as any)?.auth_user_id || (profile as any)?.id,
                isoForm
              ),
              ultimoRetorno: isoForm,
            }
          : { ...formState, ultimoRetorno: isoForm || formState.ultimoRetorno };
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
      const auditPatch = patchAuditoriaEdicao((profile as any)?.auth_user_id || (profile as any)?.id);
      let updatedCase = processarCaso({
        ...editingCase,
        ...formForSave,
        ...auditPatch,
        cliente,
        protocolo,
        tribunal: tribunalData?.tribunal || editingCase.tribunal,
      });
      const prevOwner = String((editingCase as any).created_by || '');
      const nextOwner =
        canAssignOwner && ownerAuthId && ownerAuthId !== 'self'
          ? ownerAuthId
          : prevOwner;
      if (nextOwner) {
        (updatedCase as any).created_by = nextOwner;
      }
      // Transferência de carteira só quando o responsável mudou de propósito
      if (canAssignOwner && nextOwner && nextOwner !== prevOwner) {
        (updatedCase as any).force_transfer_owner = true;
      }
      if (cnjChanged) {
        const res = await updateCaseCnjAction(String(editingCase.protocolo || ''), updatedCase);
        if (res?.success) {
          if ((updatedCase as any).force_transfer_owner) {
            await saveOneCaseAction(updatedCase as any);
          }
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
      // 1) Transferência de carteira (reassign + service role + verificação pós-UPDATE)
      if (canAssignOwner && nextOwner && nextOwner !== prevOwner) {
        const tr = await reassignCaseOwnerAction({
          protocolo: String(updatedCase.protocolo || editingCase.protocolo || ''),
          novoOwnerAuthId: nextOwner,
        });
        if (!tr.success) {
          toast({
            title: 'Não transferiu o responsável',
            description:
              tr.message ||
              'SERVICE_ROLE no Vercel + DROP TRIGGER prevent_created_by_steal no Supabase.',
            variant: 'destructive',
          });
          // continua salvando demais campos; created_by pode permanecer
        } else {
          (updatedCase as any).created_by = nextOwner;
        }
      }
      // 2) Demais campos do processo
      const res = await saveOneCaseAction(updatedCase as any);
      if (res.success) {
        const saved = { ...(res as any).case, ...updatedCase, created_by: nextOwner || (updatedCase as any).created_by };
        const updatedList = cases.map(c => (c.id === editingCase.id ? { ...c, ...saved } : c));
        setCases(updatedList);
        setIsModalOpen(false);
        setEditingCase(null);
        const transferred = !!(prevOwner && nextOwner && prevOwner !== nextOwner);
        toast({
          title: transferred ? 'Responsável transferido' : 'Alterações salvas',
          description: transferred
            ? 'Carteira atualizada (created_by). Atualize a lista (F5) se o caso ainda aparecer.'
            : undefined,
        });
      } else {
        toast({ title: 'Falha ao salvar', description: (res as any).message || 'Tente novamente', variant: 'destructive' });
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
        : `new_${Date.now()}_${(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36))}`;
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
    if (canAssignOwner && ownerAuthId && ownerAuthId !== 'self') {
      (novo as any).created_by = ownerAuthId;
    }
    const updatedList = [novo, ...cases];
    const res = await syncRepoCases(updatedList);
    if (res.success) {
      setCases(updatedList);
      setIsModalOpen(false);
      setEditingCase(null);
      setFormState(emptyForm());
      setOwnerAuthId('self');
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


  useEffect(() => {
    if (!canAssignOwner) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listAssignableUsersAction();
        if (!cancelled) setAssignableUsers(list || []);
      } catch {
        if (!cancelled) setAssignableUsers([]);
      }
    })();
    return () => { cancelled = true; };
  }, [canAssignOwner]);

  const advogadosOptions = useMemo(() => listAdvogados(cases), [cases]);

  const filtered = useMemo(() => {
    const base = filterCases(cases, {
      search,
      quick: quickFilter,
      advogado: lawyerFilter,
    });
    const sorted = sortCasesByPrazo(base, sortPrazo);
    return filtrarPorFase(sorted, filtrosFase);
  }, [cases, search, quickFilter, lawyerFilter, sortPrazo, filtrosFase]);

  // Lista paginada — só a aba /cases; não afeta dashboard
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, quickFilter, lawyerFilter, sortPrazo, cases.length]);

  const visibleItems = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  const hasMore = visibleCount < filtered.length;
  const remaining = filtered.length - visibleCount;
  const showMore = (extra: number) =>
    setVisibleCount((prev) => Math.min(prev + extra, filtered.length));
  const showAll = () => setVisibleCount(filtered.length);
  const showLess = () => setVisibleCount(PAGE_SIZE);

  const unifiedHistory = useMemo(() => {
    if (!historyResult) return [];
    return buildUnifiedTimeline(historyResult.movimentos, historyResult.djenComunicacoes);
  }, [historyResult]);

  // KPIs da faixa orbital — calculados 1x por estado, sem refilter a cada render
  const opsNodes = useMemo(() => {
    let pendentes = 0,
      vencidos = 0,
      novidades = 0,
      ok = 0;
    for (const c of cases) {
      const st = String(c.status || '');
      if (st === 'É Hoje' || st === 'E Hoje' || c.tem_novo_andamento) pendentes++;
      if (st === 'Vencido' || st === 'Caso Crítico') vencidos++;
      if (c.tem_novo_andamento) novidades++;
      if (st === 'No Prazo') ok++;
    }
    return defaultOpsNodes({ total: cases.length, pendentes, vencidos, novidades, ok });
  }, [cases]);

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className={cn("flex-1 flex flex-col h-screen overflow-hidden", ui.main)}>
<div className="px-4 sm:px-6 pt-4">
            <OpsOrbitalStrip nodes={opsNodes} className="mb-4" />
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
              onClick={handleExportXlsx} disabled={exporting || !canExport} title={!canExport ? "Modo visualização: download bloqueado" : undefined}
              className="h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {exporting ? <Loader2 size={16} className="animate-spin mr-2" /> : <FileDown size={16} className="mr-2" />}
              {canExport ? "Exportar XLSX" : "Exportar (bloqueado)"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV} disabled={exporting || !canExport} title={!canExport ? "Modo visualização: download bloqueado" : undefined}
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
              <div className="w-full px-4 sm:px-10 pb-2"><FaseFilterBar value={filtrosFase} onChange={setFiltrosFase} /></div>
              <Select value={quickFilter} onValueChange={setQuickFilter}>
                <SelectTrigger className="h-12 w-44 bg-secondary/30 border-none rounded-xl font-semibold text-[10px] uppercase"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="hoje">É Hoje</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="atencao">Atenção</SelectItem>
                  <SelectItem value="sem_prazo">Sem prazo</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="updated">Com novidade</SelectItem>
                  <SelectItem value="closed">Arquivados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={lawyerFilter} onValueChange={setLawyerFilter}>
                <SelectTrigger className="h-12 w-48 bg-secondary/30 border-none rounded-xl font-semibold text-[10px] uppercase"><SelectValue placeholder="Advogado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos advogados</SelectItem>
                  {advogadosOptions.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortPrazo} onValueChange={(v) => setSortPrazo(v as SortPrazoMode)}>
                <SelectTrigger className="h-12 w-52 bg-secondary/30 border-none rounded-xl font-semibold text-[10px] uppercase"><SelectValue placeholder="Ordenar prazo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prioridade" className="font-black uppercase text-[10px]">Prioridade operacional</SelectItem>
                  <SelectItem value="ops" className="font-black uppercase text-[10px]">Score ops (réplica / silêncio / BA)</SelectItem>
                      <SelectItem value="mais_vencido">Mais vencido → menos</SelectItem>
                  <SelectItem value="menos_vencido">Menos vencido → mais</SelectItem>
                  <SelectItem value="prazo_asc">Próximo prazo (crescente)</SelectItem>
                  <SelectItem value="cliente">Cliente A–Z</SelectItem>
                  <SelectItem value="default">Ordem original</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn("flex-1", ui.tableWrap)}>
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead className="sticky top-0 bg-white z-20 border-b border-border">
                  <tr className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                    <th className="px-4 py-5 w-10"></th>
                    <th className="px-8 py-5">Identificação</th>
                    <th className="px-8 py-5">Tribunal</th>
                    <th className="px-8 py-5">Advogado</th>
                    <th className="px-8 py-5">Status / Prazo</th>
                    <th className="px-8 py-5">Último Retorno</th>
                    <th className="px-8 py-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {visibleItems.map((c) => (
                    <CaseRow
                      selectable={canAssignOwner}
                      selected={selectedProtos.has(String(c.protocolo || ""))}
                      onToggleSelect={toggleSelectProto} key={c.id} c={c} isOperador={isOperador} onLogReturn={handleLogReturn} onEdit={handleEdit} onDelete={handleDelete} onScan={handleSingleScan} onSuggest={handleSuggestClick} onDossie={handleDossieProcesso} />
                  ))}
                </tbody>
              </table>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-4 px-4 border-t border-border/30 bg-card/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Mostrando{' '}
                  <span className="text-foreground tabular-nums">
                    {Math.min(visibleCount, filtered.length)}
                  </span>{' '}
                  de{' '}
                  <span className="text-foreground tabular-nums">{filtered.length}</span>
                </p>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {hasMore && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 px-5 rounded-xl font-black uppercase text-[10px] tracking-wider border-primary/40 text-primary hover:bg-primary/5 flex items-center gap-2"
                        >
                          <ChevronDown size={14} />
                          Ver mais
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[9px] font-black">
                            {remaining}
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-56 rounded-xl border-2 border-border z-[100]">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Quantos a mais?
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-[11px] font-bold uppercase cursor-pointer" onClick={() => showMore(25)}>
                          +25 processos
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[11px] font-bold uppercase cursor-pointer" onClick={() => showMore(50)}>
                          +50 processos
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[11px] font-bold uppercase cursor-pointer" onClick={() => showMore(100)}>
                          +100 processos
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[11px] font-bold uppercase cursor-pointer" onClick={() => showMore(200)}>
                          +200 processos
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-[11px] font-black uppercase cursor-pointer text-primary" onClick={showAll}>
                          Ver todos ({filtered.length})
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {visibleCount > PAGE_SIZE && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={showLess}
                      className="h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-wider text-muted-foreground hover:text-foreground"
                    >
                      <ChevronUp size={14} className="mr-1" />
                      Mostrar menos
                    </Button>
                  )}
                </div>
              </div>
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
                          {item.type === 'djen' && (
                            <div className="mt-4 p-4 bg-white border border-blue-100 rounded-lg max-h-64 overflow-y-auto">
                              <p className="text-[11px] text-black leading-relaxed whitespace-pre-wrap">
                                {plainTextFromDjen(
                                  String(
                                    item.raw?.texto ||
                                      item.raw?.conteudo ||
                                      item.raw?.textoPublicacao ||
                                      item.subtitle ||
                                      ''
                                  )
                                ) || 'Teor não disponível nesta comunicação. Use Abrir no D.O. ou PDF.'}
                              </p>
                            </div>
                          )}
                          {item.type !== 'djen' && (item.subtitle || item.raw?.complemento) && (
                            <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                              {String(item.raw?.complemento || item.subtitle || '')}
                            </p>
                          )}
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
                
                {canAssignOwner && (
                  <div className="space-y-2 col-span-2">
                    <Label className={ui.label}>Responsável pelo contrato (carteira do operador)</Label>
                    <Select value={ownerAuthId} onValueChange={setOwnerAuthId}>
                      <SelectTrigger className="h-11 rounded-xl bg-secondary/20 border-none font-semibold text-xs">
                        <SelectValue placeholder="Quem fica com este processo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self">Eu (quem está logado)</SelectItem>
                        {assignableUsers.map((u) => (
                          <SelectItem key={u.auth_user_id} value={u.auth_user_id}>
                            {u.nome}{u.cargo ? ` · ${u.cargo}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      Ao salvar, o processo muda de carteira (created_by) para o responsável escolhido. Use “Transferir selecionados” para vários de uma vez. Operadores só veem os próprios.
                    </p>
                  </div>
                )}

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
