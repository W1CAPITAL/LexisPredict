
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Users, 
  Search, 
  Trash2, 
  Briefcase, 
  ChevronRight,
  Plus,
  UserPlus,
  ShieldAlert,
  Scale,
  MoreVertical,
  ExternalLink,
  Info,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { LegalCase, processarCaso } from '@/lib/case-logic';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { fetchRepoCases, syncRepoCases } from '@/app/actions/case-actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { useAdmin } from '@/hooks/use-admin';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ClientDirectory() {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  
  const { toast } = useToast();
  const { isOperador } = useAdmin();

  const [clientForm, setClientClientForm] = useState({
    nome: '',
    telefone: '',
    email: '',
    documento: '',
    endereco: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const repoData = await fetchRepoCases();
      if (repoData) setCases(repoData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const clientGroups = useMemo(() => {
    const groups: Record<string, { cases: LegalCase[], info: any }> = {};
    
    cases.forEach(c => {
      if (!groups[c.cliente]) {
        groups[c.cliente] = { 
          cases: [], 
          info: { 
            telefone: c.telefone || '', 
            email: (c as any).email || '',
            documento: (c as any).documento || '',
            endereco: (c as any).endereco || ''
          } 
        };
      }
      groups[c.cliente].cases.push(c);
    });
    
    return Object.entries(groups)
      .filter(([name]) => name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        // Ordenação por criticidade: Clientes com mais processos vencidos no topo
        const vencidosA = a[1].cases.filter(c => c.status === 'Vencido').length;
        const vencidosB = b[1].cases.filter(c => c.status === 'Vencido').length;
        
        if (vencidosB !== vencidosA) return vencidosB - vencidosA;
        
        // Desempate por volume total de processos
        return b[1].cases.length - a[1].cases.length;
      });
  }, [cases, search]);

  const handleDeleteClient = async (name: string) => {
    if (!isOperador) return;
    if (confirm(`EXCLUSÃO CRÍTICA: Deseja remover o cliente ${name} e todos os seus ${cases.filter(c => c.cliente === name).length} processos?`)) {
      setIsSaving(true);
      const updated = cases.filter(c => c.cliente !== name);
      const res = await syncRepoCases(updated);
      if (res.success) {
        setCases(updated);
        toast({ title: "Cliente e Processos Removidos", description: "Base de dados atualizada." });
      }
      setIsSaving(false);
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.nome || isSaving) return;

    setIsSaving(true);
    try {
      // Como não temos tabela de clientes separada, criamos um processo "dummy" ou atualizamos os existentes
      const newCase = processarCaso({
        CLIENTE: clientForm.nome,
        TELEFONE: clientForm.telefone,
        SITUAÇÃO: 'EM ANDAMENTO',
        PROTOCOLO: `CLI-${Date.now()}`,
        ADVOGADO: 'CADASTRO MANUAL'
      });

      const updated = [newCase, ...cases];
      const res = await syncRepoCases(updated);
      if (res.success) {
        setCases(updated);
        setIsNewClientOpen(false);
        setClientClientForm({ nome: '', telefone: '', email: '', documento: '', endereco: '' });
        toast({ title: "Cliente Provisionado" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const getClientRisk = (clientCases: LegalCase[]) => {
    const vencidos = clientCases.filter(c => c.status === 'Vencido').length;
    if (vencidos > 0) return { label: 'CRÍTICO', color: 'text-red-600', icon: <ShieldAlert size={14}/> };
    return { label: 'ESTÁVEL', color: 'text-emerald-600', icon: <CheckCircle2 size={14}/> };
  };

  return (
    <div className="flex h-screen bg-[#f8f9fb] font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-border/50 bg-white/60 backdrop-blur-xl flex items-center justify-between px-10 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-black text-white rounded-lg shadow-lg">
              <Users size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="font-black text-xl text-foreground uppercase tracking-tight">Diretório de Clientes</h1>
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-0.5">Gestão de Contas • {clientGroups.length} Ativos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isOperador && (
              <Dialog open={isNewClientOpen} onOpenChange={setIsNewClientOpen}>
                <DialogTrigger asChild>
                  <Button className="h-10 px-6 rounded-xl bg-black text-white hover:bg-black/90 font-black uppercase text-[10px] tracking-widest shadow-xl">
                    <UserPlus className="w-4 h-4 mr-2 text-primary" /> Novo Cliente
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[450px] rounded-2xl border-none shadow-2xl">
                  <form onSubmit={handleSaveClient}>
                    <DialogHeader className="p-6 bg-secondary/20 border-b">
                      <DialogTitle className="font-black uppercase tracking-tight">Provisionar Nova Conta</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                      <div className="grid gap-2">
                        <Label className="uppercase text-[9px] font-black text-muted-foreground">Nome Completo / Razão Social</Label>
                        <Input value={clientForm.nome} onChange={e => setClientClientForm({...clientForm, nome: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/30 border-none font-bold uppercase" placeholder="NOME DO CLIENTE" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label className="uppercase text-[9px] font-black text-muted-foreground">Telefone WhatsApp</Label>
                          <Input value={clientForm.telefone} onChange={e => setClientClientForm({...clientForm, telefone: e.target.value})} className="rounded-xl h-11 bg-secondary/30 border-none font-mono" placeholder="(00) 00000-0000" />
                        </div>
                        <div className="grid gap-2">
                          <Label className="uppercase text-[9px] font-black text-muted-foreground">CPF / CNPJ</Label>
                          <Input value={clientForm.documento} onChange={e => setClientClientForm({...clientForm, documento: e.target.value})} className="rounded-xl h-11 bg-secondary/30 border-none font-mono" placeholder="000.000.000-00" />
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="p-6 pt-0">
                      <Button type="submit" disabled={isSaving} className="w-full h-12 bg-black text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl">
                        {isSaving ? <Loader2 className="animate-spin" /> : "Ativar Cadastro"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </header>

        <div className="flex-1 flex flex-col p-8 overflow-hidden">
          <div className="mb-8 flex justify-between items-center bg-white border border-border/50 p-4 rounded-2xl shadow-sm">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Pesquisar por nome do titular..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 bg-[#f8f9fb] border-none h-12 text-xs font-bold uppercase rounded-xl focus-visible:ring-primary/20"
              />
            </div>
            <div className="flex items-center gap-3">
               <Badge className="bg-secondary text-secondary-foreground font-black text-[9px] uppercase px-4 h-9 flex items-center gap-2 border-none">
                 <Briefcase size={14} className="text-primary" /> {cases.length} Processos Totais
               </Badge>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {clientGroups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
                {clientGroups.map(([name, data]) => {
                  const risk = getClientRisk(data.cases);
                  return (
                    <div key={name} className="premium-card p-6 flex flex-col group hover:bg-black transition-all cursor-default">
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-xl bg-[#f8f9fb] flex items-center justify-center text-black border border-border/50 group-hover:bg-white/10 group-hover:text-white group-hover:border-white/20 transition-all shadow-sm">
                          <Users size={24} />
                        </div>
                        <div className="flex items-center gap-1">
                          {isOperador && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteClient(name)}
                              className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 group-hover:hover:bg-red-600 group-hover:hover:text-white"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-1.5">
                        <h3 className="font-black text-sm text-foreground uppercase tracking-tight group-hover:text-white transition-colors truncate pr-2" title={name}>{name}</h3>
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="bg-secondary/50 border-none text-[8px] font-black uppercase px-2 py-0.5 group-hover:bg-white/20 group-hover:text-white transition-all">
                             {data.cases.length} {data.cases.length === 1 ? 'Processo' : 'Processos'}
                           </Badge>
                           <span className={cn("text-[8px] font-black uppercase flex items-center gap-1", risk.color, "group-hover:text-white/60")}>
                             {risk.icon} {risk.label}
                           </span>
                        </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-border/30 group-hover:border-white/10 flex items-center justify-between transition-all">
                        <div className="flex -space-x-2">
                          {Array.from(new Set(data.cases.map(c => c.tribunal))).slice(0, 3).map(trib => (
                            <div key={trib} className="w-7 h-7 rounded-lg bg-black text-primary border-2 border-white flex items-center justify-center text-[7px] font-black group-hover:bg-white group-hover:text-black group-hover:border-black transition-all" title={trib}>
                              {trib}
                            </div>
                          ))}
                        </div>
                        <Button variant="ghost" size="sm" asChild className="h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-secondary group-hover:text-white group-hover:hover:bg-white/10 transition-all">
                          <Link href={`/cases?search=${encodeURIComponent(name)}`}>
                            Ver Perfil <ChevronRight size={14} className="ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <EmptyState 
                  icon={Users} 
                  title={loading ? "Sincronizando..." : "Diretório Vazio"} 
                  description={loading ? "Carregando contas ativas do gabinete." : "Não localizamos clientes com este critério."}
                  actionLabel={!loading && isOperador ? "Novo Cliente" : undefined}
                  onAction={() => setIsNewClientOpen(true)}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
