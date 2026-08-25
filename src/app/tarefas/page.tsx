"use client";

import { AtendimentoActions } from '@/components/ops/atendimento-actions';
import { PublicacaoDjenBlock } from '@/components/ops/publicacao-djen';
import { mensagemRapidaCliente } from '@/lib/mensagem-rapida';
import { ProtocoloChip } from '@/components/ops/protocolo-chip';
import { descreverPrazoForense } from '@/lib/calendario-tj';
import { useAdmin } from '@/hooks/use-admin';

import { OpsOrbitalStrip, defaultOpsNodes } from "@/components/ui/ops-orbital-strip";


import { openDjenPublicacaoAction } from '@/app/actions/open-djen-action';
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */

import React, { useState, useEffect, useMemo, useCallback, startTransition } from 'react';
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
import { LegalCase, processarCaso, formatDateToISO, EventoTipo } from '@/lib/case-logic'
import { linhaFase, linhaDonoAto, linhaDonoPasso } from '@/lib/fase-resumo';
import { OpsCaseLine } from '@/components/ops/ops-case-line';
import { computeOpsLinha, computeOpsKpis } from '@/lib/ops-linha';
import { listAdvogados, sortCasesByPrazo } from '@/lib/case-filters'
import { scoreGroupPriority } from '@/lib/case-priority';
import { CaseBadges } from '@/components/cases/case-badges';
import { gerarTarefasJuridicas } from '@/lib/automacao-tarefas';
import {
  temBaCarteira,
  temNovidadeIdentificada,
  temAudienciaPendente,
  isCasoProblematico,
  isCasoTranquilo,
  temCumprimento,
} from '@/lib/flags-operacionais'
import { isCasoParadoTribunal } from '@/lib/processos-parados';
import { faixaPrioridade, pesoFila, pesoGrupo, rotuloPreditivo, rotuloPrioridade, scorePreditivo } from '@/lib/fila-prioridade';
import { fetchBaHitProtocolosAction } from '@/app/actions/ba-metrics-actions';
import { cn, formatWhatsAppLink } from '@/lib/utils';
import { CaseResumoChip } from '@/components/cases/case-resumo-chip'
import { AndamentoLeigoBlock } from '@/components/ops/andamento-leigo'
import { isAtendidoNestaSemana, isAtendidoHoje, hojeBrasilYmd } from '@/lib/atendimento-semana';
import { computeKpiCarteira } from '@/lib/kpi-carteira';
import { countEditadosAppSemana, countEditadosAppHoje, countAuditadosNestaSemana, countAuditadosHoje, countAuditadosTribunalSemana, patchAtendimentoComEdicao, patchAuditoriaEdicao } from '@/lib/processos-auditados';
import {
  applyFilaListaToObs,
  groupFilaLista,
  isAtendimentoRecente,
  type FilaLista,
} from '@/lib/fila-listas';
import { ui } from '@/lib/responsive-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { fetchRepoCases, syncRepoCases, scanSingleCaseAction, registrarAtendimentoAction, registrarAuditoriaEventAction, backfillEncerradosHojeAction } from '@/app/actions/case-actions';
import { appendScanLog } from '@/lib/scan-event-log';
import { loadCarteiraComCache, writeCarteiraCache, invalidateCarteiraCache } from '@/lib/session-carteira-cache';
import { fetchCarteiraDeduped } from '@/lib/carteira-fetch-client';
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
import {  isCasoEncerrado, isBaixaTribunal  } from '@/lib/status-encerrado';
import { suggestScripts, ScriptSuggestion } from '@/lib/script-processual/suggest';
import { AiDraftPreview } from '@/components/ai/ai-draft-preview';
import { gerarRascunhoEstrategico } from '@/ai/motor-despacho';
import { useAuth } from '@/components/auth/auth-provider';
import { plainTextFromDjen, summarizeDjenKeywords, djenTextsRecentFirst, sortDjenComunicacoesRecentFirst } from '@/lib/djen';
// djenTextsRecentFirst usado no rascunho;
import { buildUnifiedTimeline } from '@/lib/timeline-normalize';
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
  hasAttendedWeek: boolean;
  eventoUnificadoResumo: string | null;
  eventoTipo: EventoTipo | null;
  statusScore: number;
  oldestReturnGap: number;
}

export default function TarefasPage() {
  const { canCopy, canExport, canScan, isViewer } = useAdmin();
  const [mounted, setMounted] = useState(false);
  const [cases, setCases] = useState<LegalCase[]>([]);
  const LIST_PAGE_SIZE = 80;
  const [listVisible, setListVisible] = useState(LIST_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const searchDebounced = useDebouncedValue(search, 300);
  // filtros persistidos entre abas
  const [filaFiltro, setFilaFiltro] = useState<'all' | 'novidade' | 'problematicos' | 'tranquilos' | 'audiencia' | 'ba' | 'blacklist' | 'tratamento' | 'parados' | 'replica' | 'silencio'>('all');
  const [baHitDigits, setBaHitDigits] = useState<string[]>([]);
  const [officeFilter, setOfficeFilter] = useState('all');
  const [lawyerFilter, setLawyerFilter] = useState('all');
  const [sortPrazo, setSortPrazo] = useState<'mais_vencido' | 'menos_vencido' | 'prazo_asc' | 'ops'>('ops');
  const [dailyMeta, setDailyMeta] = useState(25);
  const [somenteMeta, setSomenteMeta] = useState(true);
  const [contatadosHoje, setContatadosHoje] = useState<string[]>([]);
  const [showBacklog, setShowBacklog] = useState(false);
  
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [activeGroup, setActiveGroup] = useState<TaskGroup | null>(null);
  const [attendanceForm, setAttendanceForm] = useState({
    observacao: '',
    proximoRetorno: '',
    situacao: 'EM ANDAMENTO',
    applyToAll: true,
    /** normal | tratamento | blacklist */
    filaLista: 'normal' as FilaLista,
  });

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyResult, setHistoryResult] = useState<{ case: LegalCase, movimentos: any[], djenComunicacoes?: any[] } | null>(null);
  const [suggestedScripts, setSuggestedScripts] = useState<ScriptSuggestion[]>([]);
  const [showScripts, setShowScripts] = useState(false);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [isGeneratingAIDraft, setIsGeneratingAIDraft] = useState(false);
  const [selectedMotor, setSelectedMotor] = useState<string>('omni');

  const { profile } = useAuth();
  const kpiCarteira = useMemo(
    () => computeKpiCarteira(cases as any, { userId: (profile as any)?.auth_user_id || (profile as any)?.id }),
    [cases, profile]
  );

  const { toast } = useToast();
  const [soMeusHoje, setSoMeusHoje] = useState(false);
  const [kbIndex, setKbIndex] = useState(0);
  const opsKpis = useMemo(() => computeOpsKpis(cases as any), [cases]);

  const getTodayKey = () => {
    // Sempre calendário de Brasília (não UTC do toISOString)
    return `lexis_tarefas_contatados_${hojeBrasilYmd()}`;
  };

  useEffect(() => {
    setMounted(true);
    const savedMeta = localStorage.getItem('lexis_tarefas_meta');
    if (savedMeta) {
      const parsed = parseInt(savedMeta);
      if (!isNaN(parsed)) setDailyMeta(parsed);
    }
    const savedSomente = localStorage.getItem('lexis_tarefas_somente_meta');
    if (savedSomente === '0') setSomenteMeta(false);
    else if (savedSomente === '1') setSomenteMeta(true);
    const savedContatados = localStorage.getItem(getTodayKey());
    if (savedContatados) {
      try { setContatadosHoje(JSON.parse(savedContatados)); } catch (e) { setContatadosHoje([]); }
    }
  }, []);

  // Contatos de hoje = localStorage ∪ casos com ultimoRetorno = hoje (outras abas: WhatsApp/Processos)
  useEffect(() => {
    if (!cases.length) return;
    const fromDb = cases
      .filter((c) => isAtendidoHoje(c.ultimoRetorno || (c as any).ultimo_retorno))
      .map((c) => c.cliente)
      .filter(Boolean);
    if (!fromDb.length) return;
    setContatadosHoje((prev) => {
      const next = Array.from(new Set([...prev, ...fromDb]));
      try {
        localStorage.setItem(getTodayKey(), JSON.stringify(next));
      } catch { /* */ }
      return next;
    });
  }, [cases]);


  // Persistir filtros (não perdem ao trocar de aba)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lexis_tarefas_filters_v1');
      if (!raw) return;
      const f = JSON.parse(raw);
      if (f.search != null) setSearch(String(f.search));
      if (f.officeFilter) setOfficeFilter(String(f.officeFilter));
      if (f.lawyerFilter) setLawyerFilter(String(f.lawyerFilter));
      if (f.filaFiltro) setFilaFiltro(f.filaFiltro);
      if (f.sortPrazo) setSortPrazo(f.sortPrazo);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'lexis_tarefas_filters_v1',
        JSON.stringify({ search: searchDebounced, officeFilter, lawyerFilter, filaFiltro, sortPrazo })
      );
    } catch { /* ignore */ }
  }, [searchDebounced, officeFilter, lawyerFilter, filaFiltro, sortPrazo]);


  const adjustMeta = (amount: number) => {
    const newVal = Math.max(10, Math.min(100, dailyMeta + amount));
    setDailyMeta(newVal);
    localStorage.setItem('lexis_tarefas_meta', newVal.toString());
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const empId = (profile as any)?.empresa_id || null;
      const _pack = await loadCarteiraComCache({
        fetchNetwork: async () => (await fetchCarteiraDeduped(() => fetchRepoCases())) || [],
        empresaId: empId,
        onShow: (data) => { if (Array.isArray(data)) startTransition(() => setCases(data)); },
        allowStaleKpiFallback: false,
      });
      const data = _pack.cases;
      try {
        const baRes = await fetchBaHitProtocolosAction();
        if (baRes.success) setBaHitDigits(baRes.protocolDigits || []);
      } catch { /* */ }
      if (Array.isArray(data)) setCases(data);
      // Cache de outra sessão/empresa zerando a fila no browser: força rede limpa
      if (Array.isArray(data) && data.length === 0) {
        try { invalidateCarteiraCache(); } catch { /* */ }
      }
    } finally { setLoading(false); }
  }, [profile]);

  useEffect(() => { if (mounted) loadData(); }, [loadData, mounted]);

  const handleSingleScan = async (protocolo: string) => {
    if (!protocolo) return;
    setLoading(true);
    try {
      const res = await scanSingleCaseAction(protocolo, { mode: 'djen', fast: false });
      appendScanLog({ cnj: protocolo, motor: 'djen', ok: (res as any)?.success !== false });
      const coms = Array.isArray((res as any).comunicacoes) ? (res as any).comunicacoes : [];
      setHistoryResult({
        case: (res as any).case || ({ protocolo } as any),
        movimentos: [],
        djenComunicacoes: coms,
      });
      setIsHistoryModalOpen(true);
      setShowScripts(false);
      setSuggestedScripts([]);
      setAiDraft(null);
      if ((res as any).case) {
        setCases((prev) => prev.map((c) => (c.protocolo === protocolo ? (res as any).case! : c)));
      }
      toast({
        title: coms.length ? `DJEN: ${coms.length}` : 'DJEN sem retorno',
        description: coms.length ? 'Auditoria 3D' : String((res as any).error || 'Sem publicacoes'),
        variant: coms.length ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Falha Auditoria 3D', description: e?.message || 'Erro', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestClick = async (protocolo: string, cliente: string, ultimoRetorno: string | null) => {
    if (!protocolo) return;
    setLoading(true);
    setAiDraft(null);
    try {
      const res = await scanSingleCaseAction(protocolo, { mode: 'both', fast: false });
      appendScanLog({ cnj: protocolo, motor: 'datajud+djen', ok: (res as any)?.success !== false });
      const movimentos = Array.isArray((res as any).movimentos) ? (res as any).movimentos.slice(0, 80) : [];
      const comunicacoes = Array.isArray((res as any).comunicacoes) ? (res as any).comunicacoes : [];
      const caseData = (res as any).case || ({ protocolo, cliente, ultimoRetorno } as any);

      setHistoryResult({
        case: caseData,
        movimentos,
        djenComunicacoes: comunicacoes,
      });

      const djenTexts = comunicacoes
        .map((d: any) => plainTextFromDjen(d.texto || d.conteudo || d.inteiroTeor || ''))
        .filter(Boolean) as string[];

      const suggestions = suggestScripts({
        clienteNome: cliente || caseData?.cliente,
        protocolo,
        ultimoRetorno: ultimoRetorno || caseData?.ultimoRetorno,
        eventoTipo: caseData?.evento_tipo as any,
        eventoResumo: caseData?.evento_resumo,
        datajud_ultimo_nome: caseData?.datajud_ultimo_nome,
        movimentos,
        djenTexts,
        tem_novo_andamento: !!caseData?.tem_novo_andamento,
        datajud_encerrado_tribunal: !!caseData?.datajud_encerrado_tribunal,
        indicio_busca_apreensao: !!caseData?.indicio_busca_apreensao,
        cumprimento_pendente_necessario: !!(caseData as any)?.cumprimento_pendente_necessario,
        is_procedente: !!(caseData as any)?.is_procedente,
        oportunidade_elegivel: !!(caseData as any)?.oportunidade_elegivel,
        oportunidade_tipo_credito: (caseData as any)?.oportunidade_tipo_credito || null,
        oportunidade_score: (caseData as any)?.oportunidade_score ?? null,
        texto_pobre: !!(caseData as any)?.texto_pobre,
        em_cumprimento_sentenca: !!caseData?.em_cumprimento_sentenca,
      });
      setSuggestedScripts(suggestions);
      setShowScripts(true);
      setIsHistoryModalOpen(true);
      if (caseData?.protocolo) {
        setCases((prev) => prev.map((c) => (c.protocolo === protocolo ? { ...c, ...caseData } : c)));
      }
      toast({
        title: suggestions.length ? `${suggestions.length} resposta(s)` : 'Auditoria unificada',
        description: `${movimentos.length} mov. DataJud · ${comunicacoes.length} DJEN`,
        variant: movimentos.length || comunicacoes.length ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Falha ao sugerir', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAIDraft = async () => {
    if (!historyResult || isGeneratingAIDraft) return;
    setIsGeneratingAIDraft(true);
    setAiDraft(null);
    try {
      const djenTexts = djenTextsRecentFirst(historyResult.djenComunicacoes || []);
      const res = await gerarRascunhoEstrategico({
        clienteNome: historyResult.case.cliente,
        protocolo: historyResult.case.protocolo,
        ultimoRetorno: historyResult.case.ultimoRetorno,
        movimentos: historyResult.movimentos,
        djenTexts,
        eventoTipo: historyResult.case.evento_tipo,
        eventoResumo: historyResult.case.evento_resumo,
        preferredModel: selectedMotor === "local_only" || selectedMotor === "local" ? "local_only" : "omni",
        empresaId: profile?.empresa_id,
        tem_novo_andamento: historyResult.case.tem_novo_andamento,
        datajud_encerrado_tribunal: historyResult.case.datajud_encerrado_tribunal,
        indicio_busca_apreensao: false,
        cumprimento_pendente_necessario: !!(historyResult.case as any)?.cumprimento_pendente_necessario,
        is_procedente: !!(historyResult.case as any)?.is_procedente,
        oportunidade_elegivel: !!(historyResult.case as any)?.oportunidade_elegivel,
        oportunidade_tipo_credito: (historyResult.case as any)?.oportunidade_tipo_credito || null,
        oportunidade_score: (historyResult.case as any)?.oportunidade_score ?? null,
        texto_pobre: !!(historyResult.case as any)?.texto_pobre,
        em_cumprimento_sentenca: historyResult.case.em_cumprimento_sentenca,
      });
      if (res.rascunho) {
        setAiDraft(res.rascunho);
        toast({ title: "Rascunho Gerado" });
      }
    } catch (e) {
      toast({ title: "Erro na IA", variant: "destructive" });
    } finally {
      setIsGeneratingAIDraft(false);
    }
  };

  const handleExportDjenPDF = async (item: any) => {
    if (!historyResult) return;
    try {
      const texto = plainTextFromDjen(item.texto || item.conteudo || '');
      const res = await generateDjenPublicationPDFAction({
        titulo: item.tipoComunicacao || item.tipoDocumento || 'DECISÃO / PUBLICAÇÃO OFICIAL',
        protocolo: historyResult.case.protocolo,
        data: item.data_disponibilizacao
          ? new Date(item.data_disponibilizacao).toLocaleDateString('pt-BR')
          : 'S/D',
        orgao: item.nomeOrgao || item.siglaTribunal || '',
        texto: texto || 'Conteúdo não disponível.',
        useClaude: false,
      });
      if (res.success && res.base64) {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${res.base64}`;
        const tipo = (item.tipoComunicacao || 'publicacao').replace(/\s+/g, '_');
        link.download = `${tipo}_${historyResult.case.protocolo}.pdf`;
        link.click();
        toast({ title: 'PDF exportado', description: 'Decisão/publicação DJEN baixada.' });
      } else {
        toast({
          title: 'Falha no PDF',
          description: (res as any).error || 'Não foi possível gerar o arquivo.',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao exportar', description: e?.message || 'Falha', variant: 'destructive' });
    }
  };

  
  // Corrige encerrados de HOJE que ficaram sem ultimo_retorno
  useEffect(() => {
    let cancelled = false;
    // Depois do paint — não compete com a fila
    const t = window.setTimeout(async () => {
      try {
        const r = await backfillEncerradosHojeAction();
        if (cancelled || !r?.success || !r.updated) return;
        const fresh = await fetchRepoCases();
        if (!cancelled && Array.isArray(fresh)) setCases(fresh);
        toast({ title: 'Encerrados de hoje contabilizados', description: `${r.updated} processo(s)` });
      } catch { /* */ }
    }, 4000);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, []);

const handleSaveAttendance = async () => {
    if (!activeGroup || isSavingAttendance) return;
    setIsSavingAttendance(true);
    try {
      const todayStr = hojeBrasilYmd(); // YYYY-MM-DD Brasília — SEMPRE grava retorno (também no ENCERRADO)
      const isEncerrado = String(attendanceForm.situacao || '').toUpperCase() === 'ENCERRADO';
      const touched: string[] = [];
      const updatedCases = cases.map(c => {
        const isInGroup = attendanceForm.applyToAll
          ? c.cliente === activeGroup.cliente
          : activeGroup.cases.some(ac => ac.protocolo === c.protocolo);
        if (!isInGroup) return c;
        touched.push(c.protocolo);
        return processarCaso({
          ...c,
          situacao: attendanceForm.situacao,
          ...patchAtendimentoComEdicao((profile as any)?.auth_user_id || (profile as any)?.id, todayStr),
          observacao: applyFilaListaToObs(
            attendanceForm.observacao || c.observacao,
            attendanceForm.filaLista || 'normal'
          ),
          proximoPrazo: isEncerrado ? '' : attendanceForm.proximoRetorno,
          tem_atualizacao_pos_retorno: false,
          djen_nova_comunicacao: false,
          tem_novo_andamento: false,
        });
      });
      const result = await syncRepoCases(updatedCases);
      if (result.success) {
        setCases(updatedCases);
        const updatedContatados = Array.from(new Set([...contatadosHoje, activeGroup.cliente]));
        setContatadosHoje(updatedContatados);
        localStorage.setItem(getTodayKey(), JSON.stringify(updatedContatados));
        setIsAttendanceOpen(false);
        setActiveGroup(null);
        try {
          if (isEncerrado) {
            await registrarAuditoriaEventAction('encerramento', touched, {
              via: 'tarefas',
              ultimoRetorno: todayStr,
            });
          } else {
            await registrarAtendimentoAction(touched, {
              via: 'tarefas',
              ultimoRetorno: todayStr,
            });
          }
        } catch { /* */ }
        toast({
          title: isEncerrado ? 'Encerrado e contabilizado' : 'Atendimento registrado',
          description: `Retorno ${todayStr} · ${touched.length} processo(s)`,
        });
        try {
          const fresh = await fetchRepoCases();
          if (Array.isArray(fresh) && fresh.length) setCases(fresh);
        } catch { /* */ }
      } else {
        toast({
          title: 'Falha ao salvar',
          description: (result as any).error || (result as any).message || 'Tente de novo',
          variant: 'destructive',
        });
      }
    } finally { setIsSavingAttendance(false); }
  };

  const copyScript = (text: string) => {
    if (!canCopy) {
      toast({ title: "Modo visualização", description: "Copiar está desabilitado neste perfil.", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado" });
  };

  const auditadosSemanaKPI = useMemo(() => countAuditadosNestaSemana(cases as any), [cases]);
  const auditadosTribunalKPI = useMemo(() => countAuditadosTribunalSemana(cases as any), [cases]);
  const editadosAppKPI = useMemo(() => countEditadosAppSemana(cases as any), [cases]);
  const auditadosHojeKPI = useMemo(() => countAuditadosHoje(cases as any), [cases]);

  
  /** Fonte de verdade: banco (ultimoRetorno = hoje) + localStorage legado */
  const finalizadosHoje = useMemo(() => {
    const clientes = new Set<string>();
    let processos = 0;
    for (const c of cases) {
      if (isAtendidoHoje(c.ultimoRetorno || (c as any).ultimo_retorno)) {
        processos += 1;
        if (c.cliente) clientes.add(String(c.cliente).trim().toUpperCase());
      }
    }
    // une nomes só do localStorage (legado) que ainda não estão no DB
    for (const nome of contatadosHoje) {
      if (nome) clientes.add(String(nome).trim().toUpperCase());
    }
    return { clientes: clientes.size, processos: Math.max(processos, clientes.size) };
  }, [cases, contatadosHoje]);

  const taskData = useMemo(() => {
    const groups: Record<string, TaskGroup> = {};
    const contactedSet = new Set(
      contatadosHoje.map((n) => String(n).trim().toUpperCase())
    );
    for (const c of cases) {
      if (isAtendidoHoje(c.ultimoRetorno || (c as any).ultimo_retorno) && c.cliente) {
        contactedSet.add(String(c.cliente).trim().toUpperCase());
      }
    }
    const today = startOfDay(new Date());

    const activeCases = cases.filter(c => {
      if (!isCasoEncerrado(c)) return true;
      // Baixa no tribunal com valor residual: continua na fila de contato (prioridade)
      const d = (c as any).dados && typeof (c as any).dados === 'object' ? (c as any).dados : {};
      return !!(
        (c as any).precisa_revisar_encerramento ||
        d.precisa_revisar_encerramento ||
        (c as any).prioridade_revisao_encerrado ||
        d.prioridade_revisao_encerrado ||
        d.baixa_tribunal_pendente_revisao
      );
    });

    activeCases.forEach(c => {
      const nome = c.cliente || 'NÃO IDENTIFICADO';
      if (!groups[nome]) {
        groups[nome] = {
          cliente: nome, vencidos: 0, hoje: 0, totalAtivos: 0, diasAtrasoMax: 0,
          protocoloReferencia: c.protocolo, telefone: c.telefone || '', advogado: c.advogado || '', escritorio: (c.escritorio || '').trim().toUpperCase(),
          cases: [], hasBA: false, hasClosedCourt: false, hasUpdate: false, hasAttendedWeek: false, eventoUnificadoResumo: null, eventoTipo: null, statusScore: 0, oldestReturnGap: 0
        };
      }
      const g = groups[nome];
      g.totalAtivos++;
      g.cases.push(c);
      const baSet = new Set((baHitDigits || []).map((x) => String(x).replace(/\D/g, '')));
      if (temBaCarteira(c as any, baSet)) g.hasBA = true;
      if (isAtendidoNestaSemana(c.ultimoRetorno || (c as any).ultimo_retorno)) g.hasAttendedWeek = true;
      if (temNovidadeIdentificada(c as any)) g.hasUpdate = true;
      if (temAudienciaPendente(c as any)) (g as any).hasAudiencia = true;
      if (temCumprimento(c as any)) (g as any).hasCumprimento = true;
      if (isBaixaTribunal(c)) g.hasClosedCourt = true;
      if (c.tem_novo_andamento) g.hasUpdate = true;
      
      const res = c.evento_resumo || c.djen_ultimo_resumo || c.datajud_ultimo_nome;
      if (res) { g.eventoUnificadoResumo = res; g.eventoTipo = c.evento_tipo || null; }

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
      .filter(g => {
        const matchSearch = (g.cliente.toLowerCase().includes(searchDebounced.toLowerCase()) || g.protocoloReferencia.includes(searchDebounced));
        const officeKey = officeFilter === 'all' ? '' : String(officeFilter).trim().toUpperCase();
        const lawyerKey = lawyerFilter === 'all' ? '' : String(lawyerFilter).trim().toUpperCase();
        const matchOffice =
          officeFilter === 'all' ||
          String(g.escritorio || '').trim().toUpperCase() === officeKey ||
          (g.cases || []).some(
            (c: any) => String(c.escritorio || '').trim().toUpperCase() === officeKey
          );
        const matchLawyer =
          lawyerFilter === 'all' ||
          String(g.advogado || '').trim().toUpperCase() === lawyerKey ||
          (g.cases || []).some(
            (c: any) => String(c.advogado || '').trim().toUpperCase() === lawyerKey
          );
        if (!matchSearch || !matchOffice || !matchLawyer) return false;
        if (soMeusHoje) {
          const uid = String((profile as any)?.auth_user_id || (profile as any)?.id || '');
          const mine = (g.cases || []).some((c: any) =>
            String(c.created_by || '') === uid || String(c.atendido_por || '') === uid
          );
          const today = (g.cases || []).some((c: any) => isAtendidoHoje(c));
          if (!mine || !today) return false;
        }
        const baSet = new Set((baHitDigits || []).map((x) => String(x).replace(/\D/g, '')));
        const sample = g.cases[0] as any;
        if (filaFiltro === 'novidade') return g.hasUpdate || g.cases.some((c: any) => temNovidadeIdentificada(c));
        if (filaFiltro === 'ba') return g.hasBA;
        if (filaFiltro === 'audiencia') return !!(g as any).hasAudiencia || g.cases.some((c: any) => temAudienciaPendente(c));
        if (filaFiltro === 'problematicos') return g.cases.some((c: any) => isCasoProblematico(c, baSet)) || g.hasBA || g.hasClosedCourt || g.hasUpdate;
        if (filaFiltro === 'tranquilos') return g.cases.every((c: any) => isCasoTranquilo(c, baSet)) && !g.hasBA && !g.hasClosedCourt;
        if (filaFiltro === 'blacklist') return groupFilaLista(g.cases as any) === 'blacklist';
        if (filaFiltro === 'tratamento') return groupFilaLista(g.cases as any) === 'tratamento';
        if (filaFiltro === 'parados') return g.cases.some((c: any) => isCasoParadoTribunal(c, 60));
        if (filaFiltro === 'replica') return g.cases.some((c: any) => computeOpsLinha(c).tags.includes('réplica') || computeOpsLinha(c).fase.includes('Réplica'));
        if (filaFiltro === 'silencio') return g.cases.some((c: any) => (computeOpsLinha(c).diasTribunal || 0) >= 45);
        // Fila principal: esconde blacklist (fica na lista própria)
        if (filaFiltro === 'all' || !filaFiltro) {
          if (groupFilaLista(g.cases as any) === 'blacklist') return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortPrazo === 'ops') {
          const sa = Math.max(0, ...((a.cases || []).map((c: any) => computeOpsLinha(c).score)));
          const sb = Math.max(0, ...((b.cases || []).map((c: any) => computeOpsLinha(c).score)));
          if (sb !== sa) return sb - sa;
        }
        // ordenação por vencimento (mais/menos) alinhada ao filtro da UI
        if (sortPrazo === 'mais_vencido' || sortPrazo === 'menos_vencido' || sortPrazo === 'prazo_asc') {
          const diasGroup = (g: typeof a) => {
            const nums = (g.cases || [])
              .map((c: any) => (typeof c?.diasFaltando === 'number' ? c.diasFaltando : null))
              .filter((n: number | null): n is number => n !== null);
            if (nums.length) {
              // mais negativo = mais vencido
              return Math.min(...nums);
            }
            if (typeof g.diasAtrasoMax === 'number' && g.diasAtrasoMax > 0) {
              return -Math.abs(g.diasAtrasoMax);
            }
            return 9999;
          };
          const xa = diasGroup(a);
          const xb = diasGroup(b);
          if (typeof xa === 'number' && typeof xb === 'number') {
            if (sortPrazo === 'mais_vencido' && xa !== xb) return xa - xb;
            if (sortPrazo === 'menos_vencido') {
              const aV = xa < 0; const bV = xb < 0;
              if (aV && bV && xa !== xb) return xb - xa;
              if (aV !== bV) return aV ? -1 : 1;
              if (xa !== xb) return xa - xb;
            }
            if (sortPrazo === 'prazo_asc' && xa !== xb) return xa - xb;
          }
        }

        // Tratamento: depois de quem ainda não foi atendido
        const listaA = groupFilaLista(a.cases as any);
        const listaB = groupFilaLista(b.cases as any);
        const tratA = listaA === 'tratamento';
        const tratB = listaB === 'tratamento';
        if (tratA !== tratB) return tratA ? 1 : -1;

        // Atendimento recente (36h): cai na ordem — você já está tratando
        const recentA = a.cases.some((c: any) => isAtendimentoRecente(c.ultimoRetorno || c.ultimo_retorno, 36));
        const recentB = b.cases.some((c: any) => isAtendimentoRecente(c.ultimoRetorno || c.ultimo_retorno, 36));
        if (recentA !== recentB) return recentA ? 1 : -1;

        if (a.hasBA !== b.hasBA) return a.hasBA ? -1 : 1;
        const prioA = scoreGroupPriority(a.cases as any).score;
        const prioB = scoreGroupPriority(b.cases as any).score;
        if (prioB !== prioA) return prioB - prioA;
        // legacy continues:
        if (a.hasClosedCourt !== b.hasClosedCourt) return a.hasClosedCourt ? -1 : 1;
        
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

        if (b.statusScore !== a.statusScore) return b.statusScore - a.statusScore;
        if (b.oldestReturnGap !== a.oldestReturnGap) return b.oldestReturnGap - a.oldestReturnGap;
        return b.totalAtivos - a.totalAtivos;
      });

    const pending = sortedAll.filter(g => !contactedSet.has(String(g.cliente || '').trim().toUpperCase()));
    return { focus: pending.slice(0, dailyMeta), backlog: pending.slice(dailyMeta), completed: sortedAll.filter(g => contactedSet.has(String(g.cliente || '').trim().toUpperCase())), totalPendingCount: pending.length };
  }, [cases, searchDebounced, officeFilter, lawyerFilter, sortPrazo, contatadosHoje, dailyMeta, filaFiltro, baHitDigits, soMeusHoje, profile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (isAttendanceOpen) return;
      const n = taskData.focus.length;
      if (!n) return;
      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        setKbIndex((i) => Math.min(n - 1, i + 1));
      } else if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        setKbIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const g = taskData.focus[kbIndex];
        if (g) {
          setActiveGroup(g);
          setIsAttendanceOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [taskData.focus, kbIndex, isAttendanceOpen]);

  useEffect(() => {
    setKbIndex(0);
  }, [filaFiltro, searchDebounced, officeFilter, lawyerFilter, sortPrazo]);

  const autoTarefas = useMemo(() => {
    try {
      return gerarTarefasJuridicas(cases || [], { limit: 40 });
    } catch {
      return [];
    }
  }, [cases]);

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

        <header className="h-auto border-b border-border/50 bg-card/60 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:px-10 gap-4 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-black text-white rounded-lg shadow-lg"><CheckCircle size={20} className="text-primary" /></div>
            <h1 className="font-black text-base sm:text-xl text-foreground uppercase tracking-tight">Fila Crítica de Atendimento</h1>
            <span className="ml-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground tabular-nums" title={kpiCarteira.semanaLabel}>
              Atendidos sem.: {kpiCarteira.atendidosSemana}
              <span className="ml-2">Réplica {opsKpis.replicaPendente}</span>
              <span className="ml-2">Silêncio {opsKpis.silencio45}</span>
              <span className="ml-2 text-[9px] font-bold">J/K próximo caso</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="h-9 px-4 border-none bg-primary/5 text-primary font-black uppercase text-[10px]">Audit Híbrida Ativa</Badge>
            <Button asChild size="sm" className="h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest bg-black text-white hover:bg-primary hover:text-black">
              <Link href="/cases?new=1">
                <Plus size={16} className="mr-2 inline" />
                Novo Processo
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={loadData} className="h-10 w-10 rounded-xl hover:bg-secondary"><RefreshCcw className={cn("w-5 h-5", loading && "animate-spin text-primary")} /></Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-10 max-w-[1400px] mx-auto w-full space-y-10 pb-32">
          <section className={ui.metrics}>
            <div className="premium-card p-6 border-l-4 border-l-slate-400"><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Pendentes · auto {autoTarefas.length}</p><h3 className="text-3xl font-black text-foreground tabular-nums">{taskData.totalPendingCount}</h3></div>
            <div className="premium-card p-6 border-l-4 border-l-primary relative group space-y-3">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Meta do dia (fila ativa)</p>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-black text-foreground tabular-nums">{dailyMeta}</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <Button variant="outline" size="icon" onClick={() => adjustMeta(-5)} className="h-8 w-8"><Minus size={14} /></Button>
                  <Button variant="outline" size="icon" onClick={() => adjustMeta(5)} className="h-8 w-8"><Plus size={14} /></Button>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={somenteMeta}
                  onCheckedChange={(v) => {
                    const on = !!v;
                    setSomenteMeta(on);
                    try { localStorage.setItem('lexis_tarefas_somente_meta', on ? '1' : '0'); } catch { /* */ }
                  }}
                />
                <span className="text-[10px] font-bold uppercase text-muted-foreground leading-tight">
                  Só a meta — esconde os outros {taskData.totalPendingCount > dailyMeta ? taskData.totalPendingCount - dailyMeta : 0} pendentes
                </span>
              </label>
            </div>
            <div className="premium-card p-6 border-l-4 border-l-emerald-500" title="Clientes únicos com ultimo retorno = hoje (todas as abas) · processos no tooltip">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Finalizados</p>
              <h3 className="text-3xl font-black text-emerald-600 tabular-nums">{finalizadosHoje.clientes}</h3>
              <p className="text-[9px] text-muted-foreground font-bold mt-1">{finalizadosHoje.processos} processo(s) hoje</p>
            </div>
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
                
              <Select value={lawyerFilter} onValueChange={setLawyerFilter}>
                <SelectTrigger className="h-11 w-48 bg-secondary/30 border-none rounded-xl text-[10px] font-semibold uppercase"><SelectValue placeholder="Advogado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos advogados</SelectItem>
                  {listAdvogados(cases).map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortPrazo} onValueChange={(v: any) => setSortPrazo(v)}>
                <SelectTrigger className="h-11 w-48 bg-secondary/30 border-none rounded-xl text-[10px] font-semibold uppercase"><SelectValue placeholder="Prazo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ops">Score ops</SelectItem>
                  <SelectItem value="mais_vencido">Mais vencido</SelectItem>
                  <SelectItem value="menos_vencido">Menos vencido</SelectItem>
                  <SelectItem value="prazo_asc">Próximo prazo</SelectItem>
                </SelectContent>
              </Select>
<Button type="button" size="sm" variant={soMeusHoje ? "default" : "outline"} className="h-9 text-[10px] font-black uppercase" onClick={() => setSoMeusHoje((v) => !v)}>
                Meus hoje
              </Button>
              <Select value={filaFiltro} onValueChange={(v: any) => setFilaFiltro(v)}>
                   <SelectTrigger className="h-12 w-full md:w-[260px] bg-[#f8f9fb] border-none rounded-xl font-black uppercase text-[10px] tracking-widest px-6 shadow-sm"><SelectValue placeholder="FILTRO DA FILA" /></SelectTrigger>
                   <SelectContent className="bg-white border-2 border-black rounded-xl">
                      <SelectItem value="all" className="font-black uppercase text-[10px]">Toda a fila</SelectItem>
                      <SelectItem value="novidade" className="font-black uppercase text-[10px]">Novidade identificada</SelectItem>
                      <SelectItem value="tratamento" className="font-black uppercase text-[10px]">Crítico em tratamento</SelectItem>
                      <SelectItem value="blacklist" className="font-black uppercase text-[10px]">Blacklist / problemáticos</SelectItem>
                      <SelectItem value="problematicos" className="font-black uppercase text-[10px]">Casos problemáticos</SelectItem>
                      <SelectItem value="tranquilos" className="font-black uppercase text-[10px]">Casos tranquilos</SelectItem>
                      <SelectItem value="audiencia" className="font-black uppercase text-[10px]">Audiência pendente</SelectItem>
                      <SelectItem value="ba" className="font-black uppercase text-[10px]">Busca e apreensão</SelectItem>
                      <SelectItem value="parados" className="font-black uppercase text-[10px]">Parados tribunal (≥60d)</SelectItem>
                      <SelectItem value="replica" className="font-black uppercase text-[10px]">Réplica pendente</SelectItem>
                      <SelectItem value="silencio" className="font-black uppercase text-[10px]">Silêncio ≥45d</SelectItem>
                   </SelectContent>
                </Select>
             </div>
          </div>

          {/* Sub-abas da fila — fácil achar Blacklist e Em tratamento */}
          <div className="flex flex-wrap gap-2">
            {([
              { id: 'all', label: 'Fila prioritária' },
              { id: 'tratamento', label: 'Críticos em tratamento' },
              { id: 'blacklist', label: 'Blacklist' },
              { id: 'novidade', label: 'Novidades' },
              { id: 'ba', label: 'B.A.' },
              { id: 'replica', label: 'Réplica' },
              { id: 'silencio', label: 'Silêncio 45d' },
              { id: 'parados', label: 'Parados' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilaFiltro(tab.id as any)}
                className={cn(
                  "h-9 px-4 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors",
                  filaFiltro === tab.id
                    ? tab.id === 'blacklist'
                      ? "bg-slate-900 text-white border-slate-900"
                      : tab.id === 'tratamento'
                        ? "bg-amber-500 text-black border-amber-500"
                        : "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Target size={18} className="text-primary" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">
                {filaFiltro === 'blacklist'
                  ? 'Blacklist / problemáticos'
                  : filaFiltro === 'tratamento'
                    ? 'Críticos em tratamento'
                    : 'Fila de contato'}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {taskData.focus.slice(0, listVisible).map((group, idx) => (
                <TaskCard key={group.cliente} group={group} isFocus isKbFocus={idx === kbIndex} onMarkContacted={() => { setActiveGroup(group); setIsAttendanceOpen(true); }} onScan={handleSingleScan} onSuggest={() => handleSuggestClick(group.protocoloReferencia, group.cliente, group.cases[0]?.ultimoRetorno || null)} />
              ))}
            </div>
            {!loading && taskData.focus.length === 0 && (
              <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
                <p className="text-sm font-black uppercase tracking-wide text-foreground">
                  {cases.length === 0
                    ? 'Nenhum processo na carteira desta sessão'
                    : 'Nenhum caso na fila com os filtros atuais'}
                </p>
                <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                  {cases.length === 0
                    ? 'No browser (fora do app instalado) a sessão usa o cookie do login. Recarregue, entre de novo ou limpe o cache da carteira.'
                    : `Há ${cases.length} processo(s) carregados, mas filtros (escritório, advogado, fila, “meus hoje” ou contatados) esconderam todos.`}
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-[10px] font-black uppercase"
                    onClick={() => {
                      setSearch('');
                      setOfficeFilter('all');
                      setLawyerFilter('all');
                      setFilaFiltro('all');
                      setSoMeusHoje(false);
                      setSomenteMeta(false);
                      try {
                        localStorage.removeItem('lexis_tarefas_filters_v1');
                        localStorage.setItem('lexis_tarefas_somente_meta', '0');
                      } catch { /* */ }
                    }}
                  >
                    Limpar filtros
                  </Button>
                  <Button
                    type="button"
                    className="h-9 text-[10px] font-black uppercase"
                    onClick={() => { try { invalidateCarteiraCache(); } catch { /* */ } loadData(); }}
                  >
                    Recarregar carteira
                  </Button>
                </div>
              </div>
            )}
            {taskData.focus.length > listVisible && (
              <div className="flex flex-col items-center gap-2 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full h-10 px-6 text-[10px] font-black uppercase tracking-wider"
                  onClick={() => setListVisible((n) => Math.min(n + LIST_PAGE_SIZE, taskData.focus.length))}
                >
                  Ver mais ({taskData.focus.length - listVisible} restantes)
                </Button>
                <button
                  type="button"
                  className="text-[10px] font-bold uppercase text-muted-foreground hover:text-foreground"
                  onClick={() => setListVisible(taskData.focus.length)}
                >
                  Ver todos ({taskData.focus.length})
                </button>
              </div>
            )}
          </div>

          {!somenteMeta && taskData.backlog.length > 0 && (
            <div className="space-y-4 pt-10 border-t border-border/30">
               <Button variant="ghost" onClick={() => setShowBacklog(!showBacklog)} className="h-10 px-4 font-black uppercase text-[10px] tracking-widest text-muted-foreground rounded-xl">{showBacklog ? <ChevronUp size={16} className="mr-2"/> : <ChevronDown size={16} className="mr-2"/>} Ver Backlog ({taskData.backlog.length})</Button>
               {showBacklog && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {taskData.backlog.map((group) => <TaskCard key={group.cliente} group={group} onMarkContacted={() => { setActiveGroup(group); setIsAttendanceOpen(true); }} onScan={handleSingleScan} onSuggest={() => handleSuggestClick(group.protocoloReferencia, group.cliente, group.cases[0]?.ultimoRetorno || null)} />)}</div>}
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
                <div className="p-4 sm:p-6 space-y-8">
                  {/* Respostas ao cliente: bloco único após cronologia + IA */}

                  <section className="space-y-6">
                     <h3 className={cn("text-black flex items-center justify-between border-b-2 border-black/5 pb-2", ui.label)}><div className="flex items-center gap-2"><Globe size={14} className="text-primary"/> Cronologia Unificada</div></h3>
                     <div className="space-y-6">
                       {unifiedHistory.map((item, i) => (
                         <div key={i} className={cn("relative p-5 border-2 rounded-xl transition-all", item.type === 'djen' ? "border-blue-600 bg-blue-50/10 shadow-[4px_4px_0px_#2563eb]" : "border-slate-200 bg-slate-50/50")}>
                           <div className="flex items-start justify-between mb-3">
                             <div className="flex items-center gap-3">
                               <Badge className={cn("text-[8px] font-black uppercase rounded-none", item.type === 'djen' ? "bg-blue-600" : "bg-slate-500")}>{item.type === 'djen' ? 'Diário Oficial' : 'Tribunal'}</Badge>
                               {item.type === 'djen' && (item.raw.link || historyResult?.case?.djen_ultimo_link) && (
                                 <a href={item.raw.link || historyResult?.case?.djen_ultimo_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[8px] font-black text-blue-600 uppercase hover:underline">
                                   <Globe size={10} /> Abrir no D.O.
                                 </a>
                               )}
                               <span className="text-[10px] font-black text-muted-foreground uppercase">{item.date && !Number.isNaN(item.date.getTime()) && item.date.getTime() > 0 ? format(item.date, 'dd/MM/yyyy') : 'S/D'}</span>
                             </div>
                             {item.type === 'djen' && (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => handleExportDjenPDF(item.raw)}
                                 className="h-8 px-3 text-[9px] font-black uppercase border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white ml-auto gap-1"
                                 title={canExport ? "Exportar decisão / publicação em PDF" : "Modo visualização: download bloqueado"}
                               >
                                 <Download size={12} /> Exportar PDF
                               </Button>
                             )}
                           </div>
                           <h4 className="text-sm font-black uppercase text-foreground leading-tight mb-2">{item.title}</h4>
                           <p className="text-[9px] font-bold text-muted-foreground uppercase">{item.subtitle}</p>
                           {item.type === 'djen' && <div className="mt-4 p-4 bg-white border border-blue-100 rounded-lg"><p className={cn("text-black leading-relaxed italic", ui.readable)}>{plainTextFromDjen(item.raw.texto)}</p></div>}
                         </div>
                       ))}
                     </div>
                  </section>

                  <section className="space-y-6 pt-6 border-t">
                    <h3 className={cn("text-amber-600 flex items-center gap-2", ui.label)}><Sparkles size={14} /> Rascunho com IA (opcional)</h3>
                    <div className="bg-black text-white p-4 sm:p-6 space-y-4 rounded-xl">
                      <p className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Bot size={12}/> Motor Neural Lexis</p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Select value={selectedMotor} onValueChange={setSelectedMotor}>
                          <SelectTrigger className="h-10 bg-white/10 border-white/20 text-white font-black uppercase text-[10px] rounded-lg flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-white border-2 border-black rounded-lg">
                            <SelectItem value="local_only" className="text-[9px] font-black uppercase">Motor Lexis Soberano</SelectItem>
                            <SelectItem value="claude" className="text-[9px] font-black uppercase">Claude AI (OmniRoute)</SelectItem>
                            <SelectItem value="groq-llama" className="text-[9px] font-black uppercase">Groq Llama 3.3</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button onClick={handleGenerateAIDraft} disabled={isGeneratingAIDraft} className="h-10 px-6 bg-white text-black font-black uppercase text-[10px] rounded-lg">{isGeneratingAIDraft ? <Loader2 size={12} className="animate-spin" /> : "Gerar Rascunho"}</Button>
                      </div>
                      {(aiDraft !== null && aiDraft !== undefined) && (
                        <div className="mt-3 animate-in fade-in duration-500">
                          <AiDraftPreview text={aiDraft || ""} minHeight="140px" />
                        </div>
                      )}
                    </div>

                    {suggestedScripts.length > 0 && (
                      <div className="space-y-3 mt-2">
                        <h3 className="text-amber-600 flex items-center gap-2 text-sm font-black uppercase tracking-wide">
                          <MessageSquareQuote size={16} /> Resposta para o Cliente
                        </h3>
                        <p className="text-[11px] text-muted-foreground font-medium">
                          Baseado no teor DataJud/DJEN — copie e ajuste se precisar.
                        </p>
                        <div className="grid gap-4">
                          {suggestedScripts.map((script) => (
                            <div key={script.id || script.titulo} className="bg-amber-50 border-2 border-amber-600/40 p-5 rounded-xl shadow-sm space-y-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <Badge className="bg-black text-white text-[8px] font-black uppercase rounded-none">{script.titulo}</Badge>
                                <Button type="button" size="sm" onClick={() => copyScript(script.texto)} className="h-8 rounded-lg font-black uppercase text-[9px] gap-1">
                                  <Copy size={12} /> Copiar
                                </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground uppercase">{script.quandoUsar}</p>
                              <div className="p-4 bg-white border border-black/10 rounded-lg">
                                <p className={cn("text-black/85 whitespace-pre-wrap leading-relaxed", ui.readable)}>{script.texto}</p>
                              </div>
                            </div>
                          ))}
                        </div>
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
                  <div className="grid gap-2">
                    <Label className={ui.label}>Lista da fila</Label>
                    <Select
                      value={attendanceForm.filaLista || "normal"}
                      onValueChange={(val) => setAttendanceForm({ ...attendanceForm, filaLista: val as FilaLista })}
                    >
                      <SelectTrigger className="rounded-xl h-12 bg-secondary/30 border-none font-bold text-[11px] uppercase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal" className="text-[10px] font-bold uppercase">Fila normal (padrão)</SelectItem>
                        <SelectItem value="tratamento" className="text-[10px] font-bold uppercase text-amber-700">Crítico em tratamento (sai do topo)</SelectItem>
                        <SelectItem value="blacklist" className="text-[10px] font-bold uppercase text-red-600">Blacklist / problemático</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[9px] text-muted-foreground leading-snug">
                      Atendimento recente (36h) já reduz prioridade automaticamente. Use &quot;em tratamento&quot; para críticos que você está acompanhando, e blacklist para clientes problemáticos à parte.
                    </p>
                  </div>
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

function TaskCard({ group, isFocus = false, isKbFocus = false, onMarkContacted, onScan, onSuggest }: { group: TaskGroup, isFocus?: boolean, isKbFocus?: boolean, onMarkContacted: () => void, onScan: (protocolo: string) => void, onSuggest: () => void }) {
  return (
    <div className={cn("premium-card p-4 sm:p-6 bg-white flex flex-col transition-all group border-l-4", isKbFocus ? "ring-2 ring-primary border-l-primary shadow-md" : isFocus ? "border-l-primary shadow-md" : "border-l-slate-200 shadow-sm", group.hasBA && "border-l-red-600 bg-red-50/10", group.hasClosedCourt && "border-l-black bg-slate-50/50")}>
      <div className="flex justify-between items-start mb-6">
        <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all", group.hasBA ? "bg-red-600 text-white" : group.hasClosedCourt ? "bg-black text-white" : "bg-slate-50 text-slate-400 group-hover:bg-primary group-hover:text-white")}>
          {group.hasBA ? <ShieldAlert size={24} /> : group.hasClosedCourt ? <Gavel size={24} /> : <UserCheck size={24} />}
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          {group.cases?.[0] ? (
            <CaseBadges c={group.cases[0] as any} />
          ) : group.hasBA ? (
            <Badge className="bg-red-600 text-white text-[8px] font-black uppercase">B.A.</Badge>
          ) : null}        </div>
      </div>
      <div className="space-y-1 flex-1">
        <h3 className="font-black text-sm text-foreground uppercase tracking-tight truncate group-hover:text-primary transition-colors">{group.cliente}</h3>
        <p className="text-[11px] text-muted-foreground truncate">
          {linhaDonoPasso(group.cases[0])}
        </p>
        <OpsCaseLine c={group.cases[0]} className="mt-1" />
        <div className="mt-1"><ProtocoloChip protocolo={group.protocoloReferencia} size="md" /></div>
        <div className="mt-4 flex items-center gap-2">
           <Building2 size={12} className="text-black/30" />
           <span className="text-[9px] font-black uppercase text-black/40">{group.escritorio || 'GERAL'}</span>
        </div>
      </div>
      {group.cases[0] && (
        <div className="mt-4 space-y-2">
          <AndamentoLeigoBlock caseData={group.cases[0]} showPrazo />
          <PublicacaoDjenBlock caseData={group.cases[0]} />
          {(() => {
            const msg = mensagemRapidaCliente(group.cases[0], {
              clienteNome: group.cliente,
              protocolo: group.protocoloReferencia,
            });
            return (
              <div className="rounded-lg border border-border bg-background p-2.5 space-y-2 shadow-sm">
                <p className="text-[9px] font-semibold text-muted-foreground tracking-wide">
                  Atendimento rápido (1 → 2 → 3)
                </p>
                <p className="text-[11px] text-foreground leading-snug line-clamp-3 whitespace-pre-wrap">
                  {msg}
                </p>
                <AtendimentoActions
                  compact
                  telefone={group.telefone}
                  mensagem={msg}
                  onMarkContacted={onMarkContacted}
                />
              </div>
            );
          })()}
        </div>
      )}
      <div className="mt-6 pt-6 border-t border-border/30 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
           <Button variant="ghost" size="icon" onClick={onSuggest} className={cn("text-amber-600 hover:bg-amber-50", ui.touch)} title="Sugestão de Resposta"><MessageSquareQuote size={18} /></Button>
           <Button variant="ghost" size="icon" onClick={() => onScan(group.protocoloReferencia)} className={cn("text-primary hover:bg-primary/10", ui.touch)} title="Auditoria 3D"><FileSearch size={18} /></Button>
           <Button variant="ghost" size="icon" asChild className={cn("text-emerald-600 hover:bg-emerald-50", ui.touch)} title="Abrir terminal WhatsApp">
             <Link
               href={`/whatsapp?protocolo=${encodeURIComponent(group.protocoloReferencia || "")}&cliente=${encodeURIComponent(group.cliente || "")}&tel=${encodeURIComponent(group.telefone || "")}`}
             >
               <MessageCircle size={18} />
             </Link>
           </Button>
           <Button variant="ghost" size="icon" onClick={onMarkContacted} className={cn("text-slate-400 hover:text-emerald-600", ui.touch)} title="Marcar Contatado"><UserCheck size={18} /></Button>
        </div>
                {(() => {
           const djenCase = (group.cases || []).find((c: any) => c.djen_ultimo_link || c.djen_ultimo_resumo || c.djen_nova_comunicacao);
           if (!djenCase) return null;
           return (
             <Button
               variant="ghost"
               size="icon"
               className={cn("text-blue-600 hover:bg-blue-50", ui.touch)}
               title="Abrir publicação no Diário Oficial (DJEN)"
               onClick={async (e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 const proto = djenCase.protocolo || group.protocoloReferencia;
                 if (djenCase.djen_ultimo_link) {
                   window.open(djenCase.djen_ultimo_link, '_blank', 'noopener,noreferrer');
                   return;
                 }
                 const r = await openDjenPublicacaoAction(proto);
                 if ((r as any).success && (r as any).link) {
                   window.open((r as any).link, '_blank', 'noopener,noreferrer');
                 } else {
                   alert((r as any).error || 'Sem link DJEN no momento');
                 }
               }}
             >
               <Globe size={18} />
             </Button>
           );
        })()}
<Button variant="ghost" asChild className="h-10 px-3 sm:px-4 rounded-xl text-[10px] font-black uppercase hover:text-primary transition-all"><Link href={`/cases?search=${encodeURIComponent(group.cliente)}`}>Gerir <ChevronRight size={14} className="ml-1 hidden sm:inline" /></Link></Button>
      </div>
    </div>
  );
}
