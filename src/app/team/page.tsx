
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  ShieldCheck, 
  Shield, 
  UserPlus, 
  RefreshCcw, 
  Mail, 
  Copyright,
  MoreVertical,
  ChevronRight,
  Activity,
  Loader2,
  UserCheck,
  Crown,
  LayoutGrid,
  Trophy,
  Medal,
  Eye,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Star,
  Users,
  Zap,
  Printer,
  Scale,
  Info,
  FileText,
  Gavel,
  ClipboardList
} from 'lucide-react';
import { getEmpresaUsers, removeEmpresaUser, updateUserRole, createEmpresaUserAction } from '@/lib/server-db';
import { UserProfile, UserRole, checkIfSuperAdmin, checkIfSupervisor } from '@/lib/supabase';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getTranslation, Locale } from '@/lib/i18n';
import { fetchRepoCases } from '@/app/actions/case-actions';
import { LegalCase } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { calcularScoreAdvogado, calcularScoreAssessor, ScoreResult } from '@/lib/score-engine';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';

export default function TeamManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isNewUserOpen, setIsNewClientOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'management' | 'hierarchy' | 'performance'>('management');
  const [locale, setLocale] = useState<Locale>('pt');
  
  // Auditoria de Score
  const [selectedAudit, setSelectedAudit] = useState<ScoreResult | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  
  const { profile } = useAuth();
  const { toast } = useToast();
  const t = getTranslation(locale);
  
  const isSuperAdmin = checkIfSuperAdmin(profile);
  const isSupervisor = checkIfSupervisor(profile);

  const [userForm, setUserForm] = useState({
    nome: '',
    email: '',
    cargo: 'Operador' as UserRole,
    password: ''
  });

  useEffect(() => {
    const savedLocale = localStorage.getItem('lexisPredict_locale') as Locale;
    if (savedLocale) setLocale(savedLocale);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, casesData] = await Promise.all([
        getEmpresaUsers(),
        fetchRepoCases()
      ]);
      setUsers(usersData);
      setCases(casesData || []);
    } catch (e) {
      toast({ title: "Erro na Sincronia de Dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || isSaving) return;

    setIsSaving(true);
    try {
      const res = await createEmpresaUserAction(userForm);
      if (res.success) {
        toast({ title: "Operador Ativado" });
        setIsNewClientOpen(false);
        setUserForm({ nome: '', email: '', cargo: 'Operador', password: '' });
        loadData();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast({ title: "Falha no Provisionamento", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    if (!isSuperAdmin) return;
    const res = await updateUserRole(userId, newRole);
    if (res.success) {
      toast({ title: "Cargo Atualizado" });
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!isSuperAdmin) return;
    if (!confirm('Deseja revogar o acesso deste usuário permanentemente?')) return;
    const res = await removeEmpresaUser(id);
    if (res.success) {
      toast({ title: "Acesso Revogado" });
      loadData();
    }
  };

  // --- LÓGICA DE PERFORMANCE DUAL ---
  const performanceData = useMemo(() => {
    const advStats: Record<string, { name: string, cases: LegalCase[] }> = {};
    const assStats: Record<string, { name: string, cases: LegalCase[] }> = {};

    cases.forEach(c => {
      // Agrupamento Advogado
      const lawyer = (c.advogado || 'NÃO ATRIBUÍDO').trim().toUpperCase();
      if (!advStats[lawyer]) advStats[lawyer] = { name: lawyer, cases: [] };
      advStats[lawyer].cases.push(c);

      // Agrupamento Assessor
      const assessor = (c.atendente || 'NÃO ATRIBUÍDO').trim().toUpperCase();
      if (!assStats[assessor]) assStats[assessor] = { name: assessor, cases: [] };
      assStats[assessor].cases.push(c);
    });

    const advRank = Object.values(advStats).map(s => ({
      name: s.name,
      result: calcularScoreAdvogado(s.cases)
    })).sort((a, b) => b.result.score - a.score.score);

    const assRank = Object.values(assStats).map(s => ({
      name: s.name,
      result: calcularScoreAssessor(s.cases)
    })).sort((a, b) => b.result.score - a.score.score);

    return { advRank, assRank };
  }, [cases]);

  return (
    <div className="flex h-screen bg-[#f8f9fb] font-sans text-foreground overflow-hidden">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-border/30 bg-white/60 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 z-40 print:hidden">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-black text-white rounded-lg shadow-lg">
              <Users size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="font-black text-xl uppercase tracking-tighter">{t.teamTitle}</h1>
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-0.5">Autoridade de Gabinete</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as any)} className="bg-secondary/20 p-1 rounded-xl">
              <TabsList className="bg-transparent h-9 border-none gap-1">
                <TabsTrigger value="management" className="rounded-lg px-4 font-black uppercase text-[9px] data-[state=active]:bg-black data-[state=active]:text-white">
                  <LayoutGrid size={12} className="mr-2"/> Gestão
                </TabsTrigger>
                <TabsTrigger value="hierarchy" className="rounded-lg px-4 font-black uppercase text-[9px] data-[state=active]:bg-black data-[state=active]:text-white">
                  <Trophy size={12} className="mr-2"/> Hierarquia
                </TabsTrigger>
                <TabsTrigger value="performance" className="rounded-lg px-4 font-black uppercase text-[9px] data-[state=active]:bg-black data-[state=active]:text-white">
                  <Zap size={12} className="mr-2"/> Performance
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {isSuperAdmin && (
              <Button onClick={() => setIsNewUserOpen(true)} className="bg-black text-white font-black h-10 px-6 rounded-xl uppercase text-[10px] tracking-widest shadow-xl">
                <UserPlus size={16} className="mr-2 text-primary" /> Novo Membro
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 max-w-6xl mx-auto w-full print:p-0 print:max-w-none">
          {viewMode === 'management' && (
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20 animate-in fade-in duration-500">
              {users.map((user) => (
                <Card key={user.id} className="premium-card bg-white border-border/40 rounded-2xl group hover:border-black transition-all">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center font-black text-xs">
                        {user.nome.substring(0, 2)}
                      </div>
                      <div className="flex flex-col">
                        <p className="text-[12px] font-black uppercase truncate max-w-[150px]">{user.nome}</p>
                        <Badge variant="outline" className="text-[7px] font-black uppercase h-5">{user.cargo}</Badge>
                      </div>
                    </div>
                    {isSuperAdmin && !checkIfSuperAdmin(user) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical size={16} /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="p-2 min-w-[140px]">
                           <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'Supervisor')} className="text-[9px] font-black uppercase cursor-pointer">Tornar Supervisor</DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'Administrador')} className="text-[9px] font-black uppercase cursor-pointer">Tornar Admin</DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'Operador')} className="text-[9px] font-black uppercase cursor-pointer">Tornar Operador</DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleDelete(user.id)} className="text-[9px] font-black uppercase cursor-pointer text-red-600">Revogar Acesso</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 text-muted-foreground p-2.5 bg-secondary/30 rounded-lg">
                      <Mail size={12} />
                      <span className="text-[9px] font-mono lowercase truncate">{user.email}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {viewMode === 'performance' && (
            <section className="space-y-12 pb-20 animate-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* RANKING OPERACIONAL (ASSESSORES) */}
                <div className="space-y-6">
                   <div className="flex items-center gap-3 border-b-2 border-black pb-4">
                      <div className="w-10 h-10 bg-blue-600 text-white flex items-center justify-center rounded-lg shadow-lg"><ClipboardList size={20}/></div>
                      <div>
                        <h3 className="text-lg font-black uppercase tracking-tighter">Performance Operacional</h3>
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Responsabilidade de Assessoria (Retornos e Cadastro)</p>
                      </div>
                   </div>
                   <div className="space-y-4">
                      {performanceData.assRank.map((s, i) => (
                        <div key={s.name} className="bg-white border-2 border-black p-5 flex items-center justify-between group hover:translate-x-1 transition-all">
                           <div className="flex items-center gap-4">
                              <span className="font-black text-black/20 text-xl">{i + 1}º</span>
                              <div>
                                 <p className="text-[11px] font-black uppercase">{s.name}</p>
                                 <p className="text-[8px] font-bold text-muted-foreground uppercase">{s.result.totalCasos} Casos Auditados</p>
                              </div>
                           </div>
                           <button onClick={() => { setSelectedAudit(s.result); setIsAuditModalOpen(true); }} className="flex flex-col items-end">
                              <span className={cn("text-xl font-black tabular-nums", s.result.score > 80 ? "text-emerald-600" : s.result.score > 50 ? "text-blue-600" : "text-red-600")}>
                                {s.result.score}
                              </span>
                              <span className="text-[7px] font-black uppercase opacity-40">Efficiency pts</span>
                           </button>
                        </div>
                      ))}
                   </div>
                </div>

                {/* RANKING JURÍDICO (ADVOGADOS) */}
                <div className="space-y-6">
                   <div className="flex items-center gap-3 border-b-2 border-black pb-4">
                      <div className="w-10 h-10 bg-black text-primary flex items-center justify-center rounded-lg shadow-lg"><Gavel size={20}/></div>
                      <div>
                        <h3 className="text-lg font-black uppercase tracking-tighter">Performance de Banca</h3>
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Responsabilidade Técnica (Petições e Mérito)</p>
                      </div>
                   </div>
                   <div className="space-y-4">
                      {performanceData.advRank.map((s, i) => (
                        <div key={s.name} className="bg-white border-2 border-black p-5 flex items-center justify-between group hover:translate-x-1 transition-all">
                           <div className="flex items-center gap-4">
                              <span className="font-black text-black/20 text-xl">{i + 1}º</span>
                              <div>
                                 <p className="text-[11px] font-black uppercase">{s.name}</p>
                                 <p className="text-[8px] font-bold text-muted-foreground uppercase">{s.result.totalCasos} Peças Auditadas</p>
                              </div>
                           </div>
                           <button onClick={() => { setSelectedAudit(s.result); setIsAuditModalOpen(true); }} className="flex flex-col items-end">
                              <span className={cn("text-xl font-black tabular-nums", s.result.score > 80 ? "text-emerald-600" : s.result.score > 50 ? "text-primary" : "text-red-600")}>
                                {s.result.score}
                              </span>
                              <span className="text-[7px] font-black uppercase opacity-40">Authority Score</span>
                           </button>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              {/* RODAPÉ EXPLICATIVO */}
              <div className="bg-white border-2 border-black p-8 rounded-none flex items-start gap-6 shadow-[10px_10px_0px_rgba(0,0,0,0.05)]">
                 <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center shrink-0"><Info size={24}/></div>
                 <div className="space-y-2">
                    <h4 className="font-black uppercase text-xs">Entendendo a Auditoria Dual</h4>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground leading-relaxed">
                       O score opercional (Assessor) foca na experiência do cliente e pontualidade de contato. O score de banca (Advogado) foca na integridade do processo judicial. Falhas causadas pelo cliente são automaticamente detectadas e expurgadas da média de performance para garantir justiça na avaliação da equipe.
                    </p>
                 </div>
              </div>
            </section>
          )}
        </div>

        {/* Modal de Auditoria Detalhada */}
        <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
           <DialogContent className="sm:max-w-[650px] rounded-none border-2 border-black shadow-[12px_12px_0px_#000]">
              <DialogHeader>
                 <DialogTitle className="font-black uppercase tracking-widest text-sm flex items-center gap-3">
                    <Zap size={18} className="text-primary"/> Detalhes da Auditoria {selectedAudit?.label}
                 </DialogTitle>
              </DialogHeader>
              <div className="py-6 space-y-6">
                 <div className="flex justify-between items-center bg-secondary/20 p-4 border border-black/5">
                    <div>
                       <p className="text-[8px] font-black uppercase opacity-40">Fator de Proteção (Cliente)</p>
                       <p className="text-sm font-black uppercase">{selectedAudit?.ignoradosCliente} Falhas Ignoradas</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[8px] font-black uppercase opacity-40">Score de Rito</p>
                       <p className="text-2xl font-black">{selectedAudit?.score}/100</p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Histórico de Penalidades Atribuíveis</Label>
                    <ScrollArea className="h-[250px] border-2 border-black/5 p-4 bg-gray-50">
                       <div className="space-y-3">
                          {selectedAudit?.penalidades.map((p, idx) => (
                             <div key={idx} className="p-4 bg-white border border-black/10 flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                   <div className="space-y-0.5">
                                      <p className="text-[10px] font-black uppercase">{p.cliente}</p>
                                      <p className="text-[8px] font-mono text-muted-foreground">{p.protocolo}</p>
                                   </div>
                                   <Badge variant="destructive" className="text-[8px] font-black">-{p.peso} pts</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                   <Badge className="bg-black text-white text-[7px] font-black uppercase px-1.5">{p.tipo}</Badge>
                                   <p className="text-[9px] font-bold text-muted-foreground italic">"{p.motivo}..."</p>
                                </div>
                             </div>
                          ))}
                          {selectedAudit?.penalidades.length === 0 && (
                             <div className="py-12 text-center opacity-30">
                                <CheckCircle2 size={32} className="mx-auto mb-3" />
                                <p className="font-black uppercase text-[10px]">Nenhuma falha técnica atribuível.</p>
                             </div>
                          )}
                       </div>
                    </ScrollArea>
                 </div>
              </div>
           </DialogContent>
        </Dialog>

        <footer className="h-10 border-t border-border/30 bg-white flex items-center justify-center gap-6 text-[9px] text-muted-foreground/60 font-black uppercase tracking-[0.4em] shrink-0 print:hidden">
          <div className="flex items-center gap-2"><Copyright size={10} /> 2026 W1 Capital.</div>
          <span>Governança de Equipe • FUNDADOR DAVI ALVES FIGUEREDO</span>
        </footer>
      </main>
    </div>
  );
}

