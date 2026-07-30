"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  UserPlus, 
  Mail, 
  Copyright,
  MoreVertical,
  Loader2,
  Users,
  Zap,
  Gavel,
  ClipboardList,
  Shield,
  ArrowUp,
  ArrowDown,
  Trash2,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { removeEmpresaUser, updateUserRole, createEmpresaUserAction } from '@/lib/server-db';
import { UserProfile, UserRole, checkIfSuperAdmin, checkIfSupervisor } from '@/lib/supabase';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getTranslation, Locale } from '@/lib/i18n';
import { fetchTeamPerformanceAction } from '@/app/actions/case-actions';
import { LegalCase } from '@/lib/case-logic';
import { calcularScoreAdvogado, calcularScoreAssessor, ScoreResult } from '@/lib/score-engine';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';

const ROLE_WEIGHTS: Record<UserRole, number> = {
  'Superadmin': 100,
  'Supervisor': 80,
  'Administrador': 60,
  'Operador': 40,
  'Visualizador': 20
};

export default function TeamManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isNewUserOpen, setIsNewClientOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'management' | 'performance'>('management');
  const [locale, setLocale] = useState<Locale>('pt');
  
  const [selectedAudit, setSelectedAudit] = useState<ScoreResult | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  
  const { profile } = useAuth();
  const { toast } = useToast();
  const t = getTranslation(locale);
  
  const currentUserWeight = useMemo(() => {
    if (!profile?.cargo) return 0;
    return ROLE_WEIGHTS[profile.cargo as UserRole] || 0;
  }, [profile]);

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
      // Carrega dados de performance da empresa (bypass de isolamento para o ranking)
      const { users: usersData, cases: casesData } = await fetchTeamPerformanceAction();
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
    const res = await updateUserRole(userId, newRole);
    if (res.success) {
      toast({ title: "Cargo Atualizado" });
      loadData();
    } else {
      toast({ title: "Ação Negada", description: res.error, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja revogar o acesso deste usuário permanentemente?')) return;
    const res = await removeEmpresaUser(id);
    if (res.success) {
      toast({ title: "Acesso Revogado" });
      loadData();
    } else {
      toast({ title: "Falha na Exclusão", description: res.error, variant: "destructive" });
    }
  };

  const canManageUser = (target: UserProfile) => {
    if (target.auth_user_id === profile?.auth_user_id) return false;
    const targetWeight = ROLE_WEIGHTS[target.cargo as UserRole] || 0;
    return currentUserWeight > targetWeight;
  };

  const performanceData = useMemo(() => {
    if (users.length === 0) return { advRank: [], assRank: [] };

    const normalizeStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // RANKING OPERACIONAL: Todos da empresa aparecem aqui
    const assRank = users.map(user => {
      const userNorm = normalizeStr(user.nome);
      const userCases = cases.filter(c => {
        if (c.created_by === user.auth_user_id) return true;
        const atendente = normalizeStr(c.atendente || '');
        return atendente.includes(userNorm);
      });
      return {
        name: user.nome,
        result: calcularScoreAssessor(userCases)
      };
    }).sort((a, b) => (b.result?.score ?? 0) - (a.result?.score ?? 0));

    // RANKING DE BANCA: Advogados citados nos processos
    const uniqueLawyers = Array.from(new Set(cases.map(c => (c.advogado || '').trim()))).filter(n => n && n !== 'NÃO ATRIBUÍDO');
    
    const advRank = uniqueLawyers.map(lawyerName => {
      const lawyerCases = cases.filter(c => c.advogado === lawyerName);
      return {
        name: lawyerName.toUpperCase(),
        result: calcularScoreAdvogado(lawyerCases)
      };
    }).sort((a, b) => (b.result?.score ?? 0) - (a.result?.score ?? 0));

    return { advRank, assRank };
  }, [cases, users]);

  const formatInfiniteScore = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

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
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-0.5">Ranking & Governança da Empresa</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as any)} className="bg-secondary/20 p-1 rounded-xl">
              <TabsList className="bg-transparent h-9 border-none gap-1">
                <TabsTrigger value="management" className="rounded-lg px-4 font-black uppercase text-[9px] data-[state=active]:bg-black data-[state=active]:text-white">Gestão</TabsTrigger>
                <TabsTrigger value="performance" className="rounded-lg px-4 font-black uppercase text-[9px] data-[state=active]:bg-black data-[state=active]:text-white">Ranking Operacional</TabsTrigger>
              </TabsList>
            </Tabs>

            {isSuperAdmin && (
              <Button onClick={() => setIsNewUserOpen(true)} className="bg-black text-white font-black h-10 px-6 rounded-xl uppercase text-[10px] tracking-widest shadow-xl">
                <UserPlus size={16} className="mr-2 text-primary" /> Novo Membro
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 max-w-6xl mx-auto w-full">
          {viewMode === 'management' && (
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20 animate-in fade-in duration-500">
              {users.map((user) => {
                const canManage = canManageUser(user);
                return (
                  <Card key={user.id} className={cn(
                    "premium-card bg-white border-border/40 rounded-2xl group hover:border-black transition-all",
                    user.auth_user_id === profile?.auth_user_id && "border-primary/40 bg-primary/[0.02]"
                  )}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center font-black text-xs">
                          {user.nome.substring(0, 2)}
                        </div>
                        <div className="flex flex-col">
                          <p className="text-[12px] font-black uppercase truncate max-w-[150px]">
                            {user.nome} {user.auth_user_id === profile?.auth_user_id && <span className="text-[8px] text-primary ml-1">(VOCÊ)</span>}
                          </p>
                          <Badge variant="outline" className={cn(
                            "text-[7px] font-black uppercase h-5",
                            user.cargo === 'Superadmin' ? "bg-black text-white" : 
                            user.cargo === 'Supervisor' ? "bg-blue-600 text-white" : "text-black"
                          )}>
                            {user.cargo}
                          </Badge>
                        </div>
                      </div>
                      
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreVertical size={16} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="p-2 min-w-[180px] rounded-none border-2 border-black shadow-[6px_6px_0px_#000]">
                             <DropdownMenuLabel className="text-[8px] font-black uppercase opacity-40 px-2 pb-1">Alterar Autoridade</DropdownMenuLabel>
                             
                             {currentUserWeight > ROLE_WEIGHTS['Supervisor'] && (
                               <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'Supervisor')} className="text-[9px] font-black uppercase cursor-pointer gap-2">
                                  <Shield size={12} className="text-blue-600" /> Supervisor
                               </DropdownMenuItem>
                             )}
                             
                             {currentUserWeight > ROLE_WEIGHTS['Administrador'] && (
                               <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'Administrador')} className="text-[9px] font-black uppercase cursor-pointer gap-2">
                                  <ArrowUp size={12} className="text-emerald-600" /> Administrador
                               </DropdownMenuItem>
                             )}

                             {currentUserWeight > ROLE_WEIGHTS['Operador'] && (
                               <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'Operador')} className="text-[9px] font-black uppercase cursor-pointer gap-2">
                                  <ArrowDown size={12} className="text-orange-600" /> Operador
                               </DropdownMenuItem>
                             )}

                             <DropdownMenuSeparator className="bg-black/5" />
                             <DropdownMenuItem onClick={() => handleDelete(user.id)} className="text-[9px] font-black uppercase cursor-pointer text-red-600 gap-2">
                                <Trash2 size={12} /> Revogar Acesso
                             </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 text-muted-foreground p-2.5 bg-secondary/30 rounded-lg">
                        <Mail size={12} />
                        <span className="text-[9px] font-mono lowercase truncate">{user.email}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          )}

          {viewMode === 'performance' && (
            <section className="space-y-12 pb-20 animate-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Ranking Operacional (Todos da Empresa) */}
                <div className="space-y-6">
                   <div className="flex items-center gap-3 border-b-2 border-black pb-4">
                      <div className="w-10 h-10 bg-blue-600 text-white flex items-center justify-center rounded-lg shadow-lg"><ClipboardList size={20}/></div>
                      <h3 className="text-lg font-black uppercase tracking-tighter">Ranking Operacional</h3>
                   </div>
                   <div className="space-y-4">
                      {performanceData.assRank.map((s, i) => (
                        <div key={s.name} className="bg-white border-2 border-black p-5 flex items-center justify-between group hover:translate-x-1 transition-all">
                           <div className="flex items-center gap-4">
                              <span className="font-black text-black/20 text-xl">{i + 1}º</span>
                              <div>
                                 <p className="text-[11px] font-black uppercase">{s.name}</p>
                                 <p className="text-[8px] font-bold text-muted-foreground uppercase">{s.result.totalCasos} Atendimentos</p>
                              </div>
                           </div>
                           <button onClick={() => { setSelectedAudit(s.result); setIsAuditModalOpen(true); }} className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                 <p className={cn("text-2xl font-black tabular-nums", s.result.score < 0 ? "text-red-600" : "text-emerald-600")}>
                                   {formatInfiniteScore(s.result.score)}
                                 </p>
                                 {s.result.score > 0 ? <TrendingUp size={16} className="text-emerald-500"/> : <TrendingDown size={16} className="text-red-500"/>}
                              </div>
                              <p className="text-[7px] font-black uppercase opacity-40">Efficiency Index</p>
                           </button>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Ranking de Banca */}
                <div className="space-y-6">
                   <div className="flex items-center gap-3 border-b-2 border-black pb-4">
                      <div className="w-10 h-10 bg-black text-primary flex items-center justify-center rounded-lg shadow-lg"><Gavel size={20}/></div>
                      <h3 className="text-lg font-black uppercase tracking-tighter">Ranking de Banca</h3>
                   </div>
                   <div className="space-y-4">
                      {performanceData.advRank.map((s, i) => (
                        <div key={s.name} className="bg-white border-2 border-black p-5 flex items-center justify-between group hover:translate-x-1 transition-all">
                           <div className="flex items-center gap-4">
                              <span className="font-black text-black/20 text-xl">{i + 1}º</span>
                              <div>
                                 <p className="text-[11px] font-black uppercase">{s.name}</p>
                                 <p className="text-[8px] font-bold text-muted-foreground uppercase">{s.result.totalCasos} Processos</p>
                              </div>
                           </div>
                           <button onClick={() => { setSelectedAudit(s.result); setIsAuditModalOpen(true); }} className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                 <p className={cn("text-2xl font-black tabular-nums", s.result.score < 0 ? "text-red-600" : "text-primary")}>
                                   {formatInfiniteScore(s.result.score)}
                                 </p>
                                 {s.result.score > 0 ? <TrendingUp size={16} className="text-primary"/> : <TrendingDown size={16} className="text-red-500"/>}
                              </div>
                              <p className="text-[7px] font-black uppercase opacity-40">Authority Score</p>
                           </button>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
           <DialogContent className="sm:max-w-[650px] rounded-none border-2 border-black shadow-[12px_12px_0px_#000]">
              <DialogHeader><DialogTitle className="font-black uppercase tracking-widest text-sm flex items-center gap-3"><Zap size={18} className="text-primary"/> Ficha de Desempenho Real</DialogTitle></DialogHeader>
              <div className="py-6 space-y-6">
                 <div className="flex justify-between items-center bg-secondary/20 p-4 border border-black/5">
                    <div>
                       <p className="text-[8px] font-black uppercase opacity-40">Casos no Repositório</p>
                       <p className="text-sm font-black uppercase">{selectedAudit?.totalCasos} Auditados</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[8px] font-black uppercase opacity-40">Pontuação Líquida</p>
                       <p className={cn("text-3xl font-black", (selectedAudit?.score ?? 0) < 0 ? "text-red-600" : "text-emerald-600")}>
                         {formatInfiniteScore(selectedAudit?.score || 0)}
                       </p>
                    </div>
                 </div>
                 <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                       {selectedAudit?.pontos.map((p, idx) => (
                          <div key={idx} className={cn(
                            "p-4 bg-white border flex flex-col gap-2 transition-all",
                            p.peso > 0 ? "border-emerald-200 bg-emerald-50/20" : "border-red-200 bg-red-50/20"
                          )}>
                             <div className="flex justify-between items-start">
                                <div>
                                   <p className="text-[10px] font-black uppercase">{p.cliente}</p>
                                   <p className="text-[9px] font-black uppercase opacity-60">{p.tipo}</p>
                                </div>
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-[9px] font-black uppercase rounded-none border-2",
                                    p.peso > 0 ? "border-emerald-600 text-emerald-700 bg-white" : "border-red-600 text-red-700 bg-white"
                                  )}
                                >
                                   {p.peso > 0 ? `+${formatInfiniteScore(p.peso)}` : formatInfiniteScore(p.peso)} pts
                                </Badge>
                             </div>
                             <p className={cn(
                               "text-[10px] font-bold uppercase leading-tight italic",
                               p.peso > 0 ? "text-emerald-800" : "text-red-800"
                             )}>
                               "{p.motivo}"
                             </p>
                             <p className="text-[7px] font-mono opacity-40 uppercase tracking-widest">{p.protocolo}</p>
                          </div>
                       ))}
                       {selectedAudit?.pontos && selectedAudit.pontos.length === 0 && (
                         <p className="py-12 text-center opacity-30 uppercase font-black text-[10px]">Nenhum registro de movimentação de pontos.</p>
                       )}
                    </div>
                 </ScrollArea>
              </div>
           </DialogContent>
        </Dialog>

        <footer className="h-10 border-t border-border/30 bg-white flex items-center justify-center gap-6 text-[9px] text-muted-foreground/60 font-black uppercase tracking-[0.4em] shrink-0 print:hidden">
          <div className="flex items-center gap-2"><Copyright size={10} /> 2026 W1 Capital.</div>
          <span>Ranking Elite • LexisPredict Authority</span>
        </footer>
      </main>
    </div>
  );
}