
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
  Activity
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
import { createClient } from '@/lib/supabase/client';

const CaseRow = React.memo(({ 
  c, 
  isOperador, 
  onLogReturn, 
  onEdit, 
  onDelete,
  onScan,
  mniScan
}: { 
  c: LegalCase, 
  isOperador: boolean, 
  onLogReturn: (p: string) => void, 
  onEdit: (c: LegalCase) => void, 
  onDelete: (id: string) => void,
  onScan: (c: LegalCase) => void,
  mniScan?: any
}) => {
  const prob = calcularProbabilidadeEncerramento({
    status: c.status,
    situacao: c.situacao,
    observacao: c.observacao,
    diasVencidos: c.diasFaltando && c.diasFaltando < 0 ? Math.abs(c.diasFaltando) : 0
  });

  const [loading, setLoading] = useState(false);

  return (
    <tr className="hover:bg-secondary/30 transition-all border-b border-border/50 group">
      <td className="px-8 py-5">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground font-black text-[13px] uppercase leading-none tracking-tight group-hover:text-primary transition-colors">{c.cliente}</span>
            
            {/* FLAG MNI INTELIGENTE */}
            {mniScan && (
              <Badge className={cn(
                "h-5 px-2 rounded-md font-black uppercase text-[8px] border-2",
                mniScan.status === 'PROCESSO ENCERRADO' ? "bg-red-600 text-white border-black" : "bg-primary text-black border-black"
              )}>
                <Activity size={10} className="mr-1" /> MNI: {mniScan.status}
              </Badge>
            )}

            {c.indicio_busca_apreensao && (
              <Badge className="h-5 px-2 rounded-md bg-red-600 text-white font-black uppercase text-[8px] animate-bounce">
                <ShieldAlert size={10} className="mr-1" /> BUSCA E APREENSÃO
              </Badge>
            )}

            {c.tem_atualizacao_pos_retorno && (
              <Badge variant="destructive" className="h-5 px-2 rounded-md font-black uppercase text-[8px] animate-pulse">
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
          <div className="flex items-center gap-1 text-[8px] font-black text-primary/60 uppercase tracking-tighter">
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
              <span className="text-[11px] text-foreground font-bold uppercase whitespace-nowrap">
                {c.ultimoRetorno || 'S/ Atendimento'}
              </span>
            </div>
          </div>
          {(c.datajud_ultimo_nome || mniScan?.metadata?.ultimo_evento) && (
            <div className="flex items-center gap-3 pl-0.5">
              <div className="w-7 h-7 rounded-lg border border-border/30 flex items-center justify-center bg-primary/5">
                <History size={14} className="text-primary/60" />
              </div>
              <div className="flex flex-col max-w-[180px]">
                <span className="text-[8px] font-black text-primary/60 uppercase mb-1 tracking-widest">Último Evento</span>
                <span className="text-[10px] text-foreground font-black uppercase truncate leading-tight">
                  {mniScan?.metadata?.ultimo_evento || c.datajud_ultimo_nome}
                </span>
              </div>
            </div>
          )}
        </div>
      </td>
      <td className="px-8 py-5 text-right">
        <div className="flex items-center justify-end gap-2">
          <button title="Andamentos DataJud" onClick={async () => { setLoading(true); await onScan(c); setLoading(false); }} className="text-primary hover:bg-primary/10 h-9 w-9 flex items-center justify-center rounded-lg transition-colors">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <FileSearch size={18} />}
          </button>
          {isOperador && (
            <button title="Registrar Atendimento Hoje" onClick={(e) => { e.stopPropagation(); onLogReturn(c.protocolo); }} className="text-emerald-600 hover:bg-emerald-50 h-9 w-9 flex items-center justify-center rounded-lg transition-colors">
              <CheckCircle2 size={18} />
            </button>
          )}
          {c.telefone && (
             <a href={formatWhatsAppLink(c.telefone)} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all h-9 w-9 flex items-center justify-center rounded-lg">
               <MessageCircle size={18} />
             </a>
          )}
          <a href={c.linkConsulta} target="_blank" rel="noopener noreferrer" title="Tribunal" className="text-muted-foreground hover:bg-secondary h-9 w-9 flex items-center justify-center rounded-lg transition-colors">
            <ExternalLink size={18} />
          </a>
        </div>
      </td>
    </tr>
  );
});

CaseRow.displayName = 'CaseRow';

function CasesContent() {
  const { cases, setCases, updateCaseByProtocolo, updateCase, addCase } = useAppStore();
  const [mniScans, setMniScans] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<LegalCase | null>(null);
  const [mounted, setMounted] = useState(false);
  const { isOperador } = useAdmin();
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const repoData = await fetchRepoCases();
      if (Array.isArray(repoData)) setCases(repoData);
      
      const supabase = createClient();
      const { data: scans } = await supabase.from('process_scans').select('*');
      if (scans) setMniScans(scans);
    } finally {
      setLoading(false);
    }
  }, [setCases]);

  useEffect(() => { setMounted(true); loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const searchLower = deferredSearch.toLowerCase();
    return cases.filter(c => {
      const matchesSearch = (c.cliente || '').toLowerCase().includes(searchLower) || (c.protocolo || '').includes(deferredSearch);
      const isEncerrado = isCasoEncerrado(c);
      if (!showClosed && isEncerrado) return false;
      return matchesSearch;
    });
  }, [cases, deferredSearch, showClosed]);

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-border/50 bg-card/60 backdrop-blur-xl flex items-center justify-between px-10 shrink-0 z-40">
          <h1 className="font-black text-xl text-foreground uppercase tracking-tight">Processos do Gabinete</h1>
          <div className="flex items-center gap-3">
             <Button variant="outline" size="sm" onClick={() => setShowClosed(!showClosed)} className={cn("h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest", showClosed && "bg-black text-white")}>
               {showClosed ? <Eye size={16} className="mr-2" /> : <EyeOff size={16} className="mr-2" />}
               {showClosed ? "Ocultar Encerrados" : "Mostrar Encerrados"}
             </Button>
             <Button variant="ghost" size="icon" onClick={loadData} className="h-10 w-10 rounded-xl hover:bg-secondary">
               <RefreshCcw className={cn("w-5 h-5", loading && "animate-spin")} />
             </Button>
          </div>
        </header>

        <div className="flex-1 flex flex-col p-8 overflow-hidden">
          <div className="premium-card flex-1 flex flex-col overflow-hidden border-none">
            <div className="p-5 border-b border-border/30 flex items-center justify-between gap-6 shrink-0">
               <div className="relative flex-1 max-w-xl">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                 <Input placeholder="Pesquisar por titular ou CNJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11 h-11 bg-secondary/30 border-none rounded-xl text-xs font-bold uppercase" />
               </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="sticky top-0 bg-card z-20 border-b border-border shadow-sm">
                  <tr className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                    <th className="px-8 py-5">Identificação / Auditoria MNI</th>
                    <th className="px-8 py-5">Tribunal</th>
                    <th className="px-8 py-5">Advocacia</th>
                    <th className="px-8 py-5">Prazo Final</th>
                    <th className="px-8 py-5">Histórico & Tribunal</th>
                    <th className="px-8 py-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filtered.map((c) => {
                    const mniScan = mniScans.find(s => s.cnj === c.protocolo);
                    return (
                      <CaseRow 
                        key={c.id} 
                        c={c} 
                        mniScan={mniScan}
                        isOperador={isOperador} 
                        onLogReturn={async () => {}} 
                        onScan={async () => {}}
                        onEdit={() => {}} 
                        onDelete={async () => {}}
                      />
                    );
                  })}
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
