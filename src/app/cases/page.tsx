
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense, useDeferredValue, useRef } from 'react';
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
  Copyright, 
  MessageCircle, 
  Zap, 
  Loader2, 
  CalendarDays, 
  Filter, 
  Download, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Sparkles, 
  User, 
  Calendar,
  UserCheck
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
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { fetchRepoCases, syncRepoCases, deleteAllCasesAction, recalibrateCasesAction } from '@/app/actions/case-actions';
import { exportCasesToCSVAction } from '@/app/actions/export-actions';
import { format } from 'date-fns';
import { useAdmin } from '@/hooks/use-admin';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { calcularProbabilidadeEncerramento } from '@/lib/probabilidade-encerramento';

const CaseRow = React.memo(({ 
  c, 
  isOperador, 
  onLogReturn, 
  onEdit, 
  onDelete 
}: { 
  c: LegalCase, 
  isOperador: boolean, 
  onLogReturn: (p: string) => void, 
  onEdit: (c: LegalCase) => void, 
  onDelete: (id: string) => void
}) => {
  const prob = calcularProbabilidadeEncerramento({
    status: c.status,
    situacao: c.situacao,
    observacao: c.observacao,
    diasVencidos: c.diasFaltando && c.diasFaltando < 0 ? Math.abs(c.diasFaltando) : 0
  });

  return (
    <tr className="hover:bg-secondary/30 transition-all border-b border-border/50 group">
      <td className="px-8 py-5">
        <div className="flex flex-col gap-1">
          <span className="text-foreground font-black text-[13px] uppercase leading-none tracking-tight group-hover:text-primary transition-colors">{c.cliente}</span>
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{c.protocolo}</span>
        </div>
      </td>
      <td className="px-8 py-5">
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className="bg-card border-border/50 font-black text-[9px] text-muted-foreground uppercase rounded-md h-7 px-3 w-fit">
            {c.tribunal}
          </Badge>
          <div className="flex items-center gap-1 text-[8px] font-black text-primary/60 uppercase tracking-tighter" title="Estimativa heurística automática">
            <Sparkles size={10} /> Prob. Encerramento: {prob}%
          </div>
        </div>
      </td>
      <td className="px-8 py-5 text-[11px] text-foreground font-bold uppercase">
        {c.advogado}
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
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg border border-border/50 flex items-center justify-center bg-secondary/50 group-hover:bg-background transition-all">
            <UserCheck size={16} className="text-emerald-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-muted-foreground uppercase leading-none mb-1">Retorno</span>
            <span className="text-[11px] text-foreground font-bold uppercase whitespace-nowrap">
              {c.ultimoRetorno || 'S/ Atendimento'}
            </span>
          </div>
        </div>
      </td>
      <td className="px-8 py-5 text-right">
        <div className="flex items-center justify-end gap-2">
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
  const [cases, setCases] = useState<LegalCase[]>([]);
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState(initialSearch);
  const deferredSearch = useDeferredValue(search);
  
  const [lawyerFilter, setLawyerFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [editingCase, setEditingCase] = useState<LegalCase | null>(null);
  const [mounted, setMounted] = useState(false);
  const { isAdmin, isOperador } = useAdmin();
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
  }, []);

  const handleBatchUpdateStatus = async () => {
    if (!isOperador || cases.length === 0 || isUpdating) return;
    setIsUpdating(true);
    
    try {
      const savedThreshold = localStorage.getItem('lexisPredict_urgency_alert');
      const alertLimit = savedThreshold ? parseInt(savedThreshold) : 3;

      const result = await recalibrateCasesAction(alertLimit);
      
      if (result.success) {
        toast({ title: "Recalibração Concluída", description: result.message });
        await loadData();
      } else {
        toast({ 
          title: "Falha na Recalibração", 
          description: result.error || "Erro desconhecido.", 
          variant: "destructive" 
        });
      }
    } catch (err: any) {
      toast({ 
        title: "Erro de Conexão", 
        description: "Não foi possível completar o reprocessamento.", 
        variant: "destructive" 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportPlanilha = async () => {
    if (cases.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const result = await exportCasesToCSVAction();
      if (result.success && result.base64) {
        const link = document.createElement('a');
        link.href = `data:text/csv;base64,${result.base64}`;
        link.download = result.filename || `export_processos.csv`;
        link.click();
        toast({ title: "Exportação Concluída" });
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handlePurgeDatabase = async () => {
    if (purgeConfirmText !== 'CONFIRME' || isPurging) return;
    setIsPurging(true);
    try {
      const res = await deleteAllCasesAction();
      if (res.success) {
        setCases([]);
        setIsPurgeModalOpen(false);
        setPurgeConfirmText('');
        toast({ title: "Base Purificada" });
      }
    } finally {
      setIsPurging(false);
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
      const processed = processarCaso({
        id: editingCase?.id,
        CLIENTE: formState.cliente,
        PROTOCOLO: formState.protocolo,
        ADVOGADO: formState.advogado,
        'PRÓXIMO PRAZO': formState.proximoPrazo,
        SITUAÇÃO: formState.situacao,
        ULTIMO_RETORNO: formState.ultimoRetorno,
        statusManual: formState.statusManual,
        OBSERVACAO: formState.observacao,
        TELEFONE: formState.telefone
      }, { alertLimit: savedThreshold ? parseInt(savedThreshold) : 3 });

      const updated = editingCase 
        ? cases.map(c => c.id === editingCase.id ? processed : c)
        : [processed, ...cases];
      
      const result = await syncRepoCases(updated);
      if (result.success) {
        setCases(updated);
        setIsModalOpen(false);
        setEditingCase(null);
        toast({ title: "Registro Atualizado" });
      }
    } catch (err) {}
  };

  const handleLogReturn = useCallback(async (protocolo: string) => {
    if (!isOperador) return;
    const today = format(new Date(), 'dd/MM/yyyy');
    const updated = cases.map(c => c.protocolo === protocolo ? { ...c, ultimoRetorno: today } : c);
    setCases(updated);
    await syncRepoCases(updated);
    toast({ title: "Atendimento Registrado" });
  }, [cases, isOperador, toast]);

  const handleEditClick = useCallback((c: LegalCase) => {
    if (!isOperador) return;
    setEditingCase(c);
    setFormState({
      cliente: c.cliente,
      protocolo: c.protocolo,
      advogado: c.advogado,
      proximoPrazo: c.proximoPrazo,
      situacao: c.situacao || 'EM ANDAMENTO',
      ultimoRetorno: c.ultimoRetorno || '',
      statusManual: c.statusManual || 'Automatico',
      observacao: c.observacao || '',
      telefone: c.telefone || ''
    });
    setIsModalOpen(true);
  }, [isOperador]);

  const openNewCaseModal = () => {
    if (!isOperador) return;
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
      telefone: ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteCase = useCallback(async (id: string) => {
    if (!isOperador) return;
    if (confirm('Deseja excluir definitivamente este registro?')) {
      const updated = cases.filter(c => c.id !== id);
      setCases(updated);
      await syncRepoCases(updated);
      toast({ title: "Registro Removido" });
    }
  }, [cases, isOperador, toast]);

  const lawyers = useMemo(() => {
    const list = Array.from(new Set(cases.map(c => c.advogado))).filter(Boolean).sort();
    return list;
  }, [cases]);

  const filtered = useMemo(() => {
    const searchLower = deferredSearch.toLowerCase();
    return cases.filter(c => {
      const matchesSearch = (c.cliente || '').toLowerCase().includes(searchLower) || 
                            (c.protocolo || '').includes(deferredSearch);
      
      const matchesLawyer = lawyerFilter === 'ALL' || c.advogado === lawyerFilter;
      
      const isEncerrado = isCasoEncerrado(c);
      
      let pass = matchesSearch && matchesLawyer;
      if (!showClosed && isEncerrado) pass = false;
      
      return pass;
    });
  }, [cases, deferredSearch, showClosed, lawyerFilter]);

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-border/50 bg-card/60 backdrop-blur-xl flex items-center justify-between px-10 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <h1 className="font-black text-xl text-foreground uppercase tracking-tight">Processos do Gabinete</h1>
            <Badge variant="outline" className="bg-secondary/50 border-none font-bold uppercase text-[9px] px-3 py-1 rounded-full">
              {isAdmin ? 'Privilégio Admin' : 'Operador'}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchUpdateStatus}
                disabled={isUpdating || loading || cases.length === 0}
                className="h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCcw size={16} className="mr-2" />}
                Recalibrar Prazos
              </Button>
            )}
            
            {isOperador && (
               <Dialog open={isPurgeModalOpen} onOpenChange={setIsPurgeModalOpen}>
                <Button variant="ghost" onClick={() => setIsPurgeModalOpen(true)} className="h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                  <Trash2 size={16} className="mr-2" /> Limpar Base
                </Button>
                <DialogContent className="rounded-2xl border-none shadow-2xl">
                   <DialogHeader>
                      <DialogTitle className="font-black uppercase text-red-600 flex items-center gap-2">
                        <ShieldAlert /> Ação Irreversível
                      </DialogTitle>
                      <div className="py-2 text-[10px] font-bold uppercase text-muted-foreground">
                        Você está prestes a apagar todos os {cases.length} processos desta conta. Esta ação não pode ser desfeita.
                      </div>
                   </DialogHeader>
                   <div className="py-6 space-y-4">
                      <Label className="font-black uppercase text-[10px] text-muted-foreground">Digite a palavra CONFIRME para prosseguir:</Label>
                      <Input 
                        value={purgeConfirmText}
                        onChange={(e) => setPurgeConfirmText(e.target.value.toUpperCase())}
                        placeholder="CONFIRME"
                        className="rounded-xl border-2 border-red-100 h-12 font-black uppercase text-center focus-visible:ring-red-600"
                      />
                   </div>
                   <DialogFooter>
                      <Button 
                        disabled={purgeConfirmText !== 'CONFIRME' || isPurging}
                        onClick={handlePurgeDatabase}
                        className="w-full h-12 bg-red-600 text-white rounded-xl font-black uppercase text-[11px] tracking-widest"
                      >
                        {isPurging ? <Loader2 className="animate-spin" /> : "Apagar Toda a Base Agora"}
                      </Button>
                   </DialogFooter>
                </DialogContent>
               </Dialog>
            )}
            {isOperador && (
              <Button onClick={handleExportPlanilha} disabled={isExporting || cases.length === 0} variant="ghost" className="h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest text-muted-foreground hover:bg-secondary">
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download size={16} className="mr-2 text-primary" />}
                Extrair Planilha
              </Button>
            )}
            {isOperador && (
              <Button onClick={openNewCaseModal} className="h-11 px-6 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase text-[10px] tracking-widest shadow-xl">
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
              <div className="flex flex-1 items-center gap-4 max-w-2xl">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input 
                    placeholder="Pesquisar por titular ou protocolo judicial..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-11 h-11 bg-secondary/30 border-none rounded-xl text-xs font-bold uppercase focus-visible:ring-primary/20"
                  />
                </div>
                
                <div className="w-64">
                  <Select value={lawyerFilter} onValueChange={setLawyerFilter}>
                    <SelectTrigger className="h-11 bg-secondary/30 border-none rounded-xl text-[10px] font-black uppercase">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-primary" />
                        <SelectValue placeholder="FILTRAR ADVOGADO" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-[10px] font-black uppercase">TODOS OS ADVOGADOS</SelectItem>
                      {lawyers.map(l => (
                        <SelectItem key={l} value={l} className="text-[10px] font-black uppercase">{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                 <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase h-9 px-5 rounded-lg flex items-center gap-2 border-none">
                   <Filter size={14} /> {filtered.length} Registros
                 </Badge>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {filtered.length > 0 ? (
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="sticky top-0 bg-card z-20 border-b border-border shadow-sm">
                    <tr className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                      <th className="px-8 py-5">Identificação</th>
                      <th className="px-8 py-5">Tribunal</th>
                      <th className="px-8 py-5">Advocacia</th>
                      <th className="px-8 py-5">Prazo Final (Vencimento)</th>
                      <th className="px-8 py-5">Último Atendimento</th>
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
                        onEdit={handleEditClick} 
                        onDelete={handleDeleteCase}
                      />
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <EmptyState 
                    icon={Briefcase} 
                    title={loading ? "Sincronizando..." : "Base Vazia"} 
                    description={loading ? "Acessando repositório de alta segurança." : "Não localizamos processos com este filtro."}
                    actionLabel={!loading && isOperador ? "Adicionar Caso" : undefined}
                    onAction={openNewCaseModal}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MODAL DE GESTÃO DE REGISTRO */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[600px] rounded-2xl border-none shadow-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSaveCase}>
              <DialogHeader className="p-6 bg-secondary/20 border-b">
                <DialogTitle className="font-black uppercase tracking-tight">
                  {editingCase ? 'Editar Registro' : 'Novo Registro de Gabinete'}
                </DialogTitle>
              </DialogHeader>
              <div className="p-6 space-y-4">
                <div className="grid gap-2">
                  <Label className="uppercase text-[9px] font-black text-muted-foreground">Nome do Titular / Cliente</Label>
                  <Input 
                    value={formState.cliente} 
                    onChange={e => setFormState({...formState, cliente: e.target.value.toUpperCase()})} 
                    className="rounded-xl h-11 bg-secondary/30 border-none font-bold uppercase" 
                    placeholder="NOME COMPLETO" 
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black text-muted-foreground">Protocolo Judicial (CNJ)</Label>
                    <Input 
                      value={formState.protocolo} 
                      onChange={e => setFormState({...formState, protocolo: e.target.value})} 
                      className="rounded-xl h-11 bg-secondary/30 border-none font-mono" 
                      placeholder="0000000-00.0000.0.00.0000" 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black text-muted-foreground">Telefone WhatsApp</Label>
                    <Input 
                      value={formState.telefone} 
                      onChange={e => setFormState({...formState, telefone: e.target.value})} 
                      className="rounded-xl h-11 bg-secondary/30 border-none font-mono" 
                      placeholder="(00) 00000-0000" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black text-muted-foreground">Advogado Responsável</Label>
                    <Input 
                      value={formState.advogado} 
                      onChange={e => setFormState({...formState, advogado: e.target.value.toUpperCase()})} 
                      className="rounded-xl h-11 bg-secondary/30 border-none font-bold uppercase" 
                      placeholder="NOME DO ADVOGADO" 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black text-muted-foreground">Situação Operacional</Label>
                    <Select value={formState.situacao} onValueChange={val => setFormState({...formState, situacao: val})}>
                      <SelectTrigger className="rounded-xl h-11 bg-secondary/30 border-none font-bold text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EM ANDAMENTO" className="text-[10px] font-bold uppercase">EM ANDAMENTO</SelectItem>
                        <SelectItem value="ENCERRADO" className="text-[10px] font-bold uppercase">ENCERRADO</SelectItem>
                        <SelectItem value="ARQUIVADO" className="text-[10px] font-bold uppercase">ARQUIVADO</SelectItem>
                        <SelectItem value="SUSPENSO" className="text-[10px] font-bold uppercase">SUSPENSO</SelectItem>
                        <SelectItem value="IMOVEL" className="text-[10px] font-bold uppercase">IMÓVEL / PATRIMONIAL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black text-muted-foreground">Data de Vencimento (Próximo Prazo)</Label>
                    <Input 
                      value={formState.proximoPrazo} 
                      onChange={e => setFormState({...formState, proximoPrazo: e.target.value})} 
                      className="rounded-xl h-11 bg-secondary/30 border-none font-bold" 
                      placeholder="DD/MM/AAAA" 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black text-muted-foreground">Último Atendimento / Retorno</Label>
                    <Input 
                      value={formState.ultimoRetorno} 
                      onChange={e => setFormState({...formState, ultimoRetorno: e.target.value})} 
                      className="rounded-xl h-11 bg-secondary/30 border-none font-bold" 
                      placeholder="DD/MM/AAAA" 
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="uppercase text-[9px] font-black text-muted-foreground">Controle de Status</Label>
                  <Select value={formState.statusManual} onValueChange={val => setFormState({...formState, statusManual: val})}>
                    <SelectTrigger className="rounded-xl h-11 bg-secondary/30 border-none font-bold text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Automatico" className="text-[10px] font-bold uppercase">Cálculo Automático (Prazo)</SelectItem>
                      <SelectItem value="Caso Crítico" className="text-[10px] font-bold uppercase text-red-600">⚠ Caso Crítico (Manual)</SelectItem>
                      <SelectItem value="Arquivado" className="text-[10px] font-bold uppercase">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="uppercase text-[9px] font-black text-muted-foreground">Observações Técnicas</Label>
                  <Textarea 
                    value={formState.observacao} 
                    onChange={e => setFormState({...formState, observacao: e.target.value.toUpperCase()})} 
                    className="rounded-xl min-h-[80px] bg-secondary/30 border-none font-bold text-[10px] uppercase resize-none" 
                    placeholder="NOTAS DE GABINETE..." 
                  />
                </div>
              </div>
              <DialogFooter className="p-6 pt-0">
                <Button type="submit" disabled={loading} className="w-full h-12 bg-black text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl">
                  {editingCase ? "Salvar Alterações" : "Ativar Novo Registro"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <footer className="h-10 border-t border-border/30 bg-card/60 flex items-center justify-center gap-6 text-[10px] text-muted-foreground/60 font-bold uppercase tracking-[0.3em] shrink-0">
          <Copyright size={10} /> 2026 W1 Capital • Advanced Legal Operations
        </footer>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: any }) {
  const styles: Record<string, string> = {
    'Vencido': "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30",
    'É Hoje': "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 animate-pulse",
    'Caso Crítico': "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30",
    'Atenção': "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-100 dark:border-orange-900/30",
    'No Prazo': "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30",
    'Arquivado': "bg-secondary text-muted-foreground border-border",
    'Encerrado': "bg-secondary text-muted-foreground border-border",
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
