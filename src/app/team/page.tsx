
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
  Eye
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

export default function TeamManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isNewUserOpen, setIsNewClientOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'management' | 'hierarchy'>('management');
  const [locale, setLocale] = useState<Locale>('pt');
  
  const { profile } = useAuth();
  const { toast } = useToast();
  const t = getTranslation(locale);
  
  const isSuperAdmin = checkIfSuperAdmin(profile);
  const isSupervisor = checkIfSupervisor(profile);
  const isAdmin = profile?.cargo === 'Administrador' || isSuperAdmin || isSupervisor;

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

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEmpresaUsers();
      setUsers(data);
    } catch (e) {
      toast({ title: "Erro na Sincronia de Equipe", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || isSaving) return;

    setIsSaving(true);
    try {
      const res = await createEmpresaUserAction(userForm);
      
      if (res.success) {
        toast({ title: "Operador Ativado", description: "O novo membro já pode acessar o gabinete." });
        setIsNewClientOpen(false);
        setUserForm({ nome: '', email: '', cargo: 'Operador', password: '' });
        loadTeam();
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
      loadTeam();
    } else {
      toast({ title: "Ação Negada", description: res.error, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!isSuperAdmin) return;
    const res = await removeEmpresaUser(id);
    if (res.success) {
      toast({ title: "Acesso Revogado" });
      loadTeam();
    } else {
      toast({ title: "Ação Negada", description: res.error, variant: "destructive" });
    }
  };

  const roleWeights: Record<string, number> = {
    'Superadmin': 5000,
    'Supervisor': 4000,
    'Administrador': 3000,
    'Operador': 2000,
    'Visualizador': 1000
  };

  const rankedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const weightA = roleWeights[a.cargo] || 0;
      const weightB = roleWeights[b.cargo] || 0;
      if (weightA !== weightB) return weightB - weightA;
      return a.nome.localeCompare(b.nome);
    });
  }, [users]);

  return (
    <div className="flex h-screen bg-[#f8f9fb] font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-border/30 bg-white/60 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-black text-white rounded-lg shadow-lg">
              <UserCheck size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="font-black text-xl uppercase tracking-tighter">{t.teamTitle}</h1>
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-0.5">INSTÂNCIA: {profile?.empresa_id?.split('-')[0] || "GABINETE"} • NÍVEL {isSuperAdmin ? 'MESTRE' : 'ADMIN'}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as any)} className="bg-secondary/20 p-1 rounded-xl">
              <TabsList className="bg-transparent h-9 border-none gap-1">
                <TabsTrigger value="management" className="rounded-lg px-4 font-black uppercase text-[9px] data-[state=active]:bg-black data-[state=active]:text-white">
                  <LayoutGrid size={12} className="mr-2"/> {t.viewManagement}
                </TabsTrigger>
                <TabsTrigger value="hierarchy" className="rounded-lg px-4 font-black uppercase text-[9px] data-[state=active]:bg-black data-[state=active]:text-white">
                  <Trophy size={12} className="mr-2"/> {t.viewHierarchy}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-3">
               {isSuperAdmin && (
                 <Button onClick={() => setIsNewUserOpen(true)} className="bg-black text-white font-black h-10 px-6 rounded-xl uppercase text-[10px] tracking-widest hover:bg-black/90 transition-all shadow-xl">
                   <UserPlus size={16} className="mr-2 text-primary" /> Novo Operador
                 </Button>
               )}
               <Button variant="ghost" size="icon" onClick={loadTeam} className="h-10 w-10 rounded-xl hover:bg-secondary">
                  <RefreshCcw size={18} className={cn(loading && "animate-spin text-primary")} />
               </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 max-w-6xl mx-auto w-full">
          {viewMode === 'management' ? (
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20 animate-in fade-in duration-500">
              {users.map((user) => {
                const targetIsSuper = checkIfSuperAdmin(user);
                const targetIsSupervisor = checkIfSupervisor(user);
                const canManage = isSuperAdmin && !targetIsSuper;

                return (
                  <Card key={user.id} className="premium-card bg-white border-border/40 rounded-2xl group hover:border-black transition-all overflow-hidden relative">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center border transition-all",
                          targetIsSuper ? "bg-black text-[#FFD700] border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.3)]" : 
                          targetIsSupervisor ? "bg-primary/20 text-primary border-primary" :
                          user.cargo === 'Administrador' ? "bg-black text-primary border-black shadow-lg" : "bg-[#f8f9fb] border-border/50 text-muted-foreground"
                        )}>
                          {targetIsSuper ? <Crown size={24} /> : 
                           targetIsSupervisor ? <Eye size={24} /> :
                           user.cargo === 'Administrador' ? <ShieldCheck size={24} /> : user.cargo === 'Operador' ? <Shield size={24} /> : <Activity size={24} />}
                        </div>
                        <div className="flex flex-col">
                          <p className="text-[12px] font-black uppercase tracking-tight truncate max-w-[150px]">{user.nome}</p>
                          <RoleBadge role={user.cargo as any} t={t} isSuper={targetIsSuper} />
                        </div>
                      </div>
                      {isSuperAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-secondary">
                              <MoreVertical size={16} className="text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white border-border/50 rounded-xl shadow-2xl min-w-[160px] p-2">
                            {!canManage && (
                               <DropdownMenuItem disabled className="text-[8px] font-black uppercase text-red-500 text-center bg-red-50">
                                 Autoridade Protegida
                               </DropdownMenuItem>
                            )}
                            
                            {canManage && (
                              <>
                                <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'Supervisor')} className="text-[9px] font-black uppercase cursor-pointer hover:bg-secondary rounded-lg px-3 py-2 text-primary font-bold">
                                   Tornar Supervisor
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'Administrador')} className="text-[9px] font-black uppercase cursor-pointer hover:bg-secondary rounded-lg px-3 py-2">
                                   Tornar Administrador
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'Operador')} className="text-[9px] font-black uppercase cursor-pointer hover:bg-secondary rounded-lg px-3 py-2">
                                   Tornar Operador
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'Visualizador')} className="text-[9px] font-black uppercase cursor-pointer hover:bg-secondary rounded-lg px-3 py-2">
                                   Tornar Visualizador
                                </DropdownMenuItem>
                                <div className="h-px bg-border/50 my-2" />
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(user.id)}
                                  className="text-[9px] font-black uppercase cursor-pointer text-red-600 focus:bg-red-50 rounded-lg px-3 py-2"
                                >
                                  Revogar Acesso
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-3 text-muted-foreground p-3 bg-[#f8f9fb] rounded-xl border border-border/20">
                        <Mail size={14} className="shrink-0 text-primary" />
                        <span className="text-[10px] font-mono lowercase truncate">{user.email}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                           <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Sessão Ativa</span>
                        </div>
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">P0 SECURITY</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {loading && Array.from({length: 3}).map((_, i) => (
                <div key={i} className="h-44 bg-white animate-pulse border border-border/20 rounded-2xl" />
              ))}
            </section>
          ) : (
            <section className="space-y-4 pb-20 animate-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black text-primary flex items-center justify-center rounded-2xl shadow-2xl">
                       <Trophy size={28} />
                    </div>
                    <div>
                       <h2 className="text-xl font-black uppercase tracking-tight">Cadeia de Comando</h2>
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Hierarchy Ranking • Gabinete W1</p>
                    </div>
                 </div>
                 <Badge variant="outline" className="bg-white border-black border-2 text-black font-black uppercase text-[10px] px-6 h-10">Elite Authority Status</Badge>
              </div>

              <div className="space-y-3">
                {rankedUsers.map((user, index) => {
                   const isSuper = checkIfSuperAdmin(user);
                   const isSupervisor = checkIfSupervisor(user);
                   const rank = index + 1;
                   
                   return (
                     <div key={user.id} className={cn(
                       "flex items-center justify-between p-5 bg-white border-2 border-border/40 rounded-2xl hover:border-black transition-all group",
                       (isSuper || isSupervisor) && "border-black shadow-[6px_6px_0px_rgba(0,0,0,0.1)]"
                     )}>
                        <div className="flex items-center gap-6">
                           <div className={cn(
                             "w-10 h-10 rounded-full flex items-center justify-center font-black text-sm",
                             rank === 1 ? "bg-black text-[#FFD700]" : rank === 2 ? "bg-gray-100 text-gray-700" : "bg-[#f8f9fb] text-muted-foreground"
                           )}>
                              {rank === 1 ? <Medal size={20} /> : `#${rank}`}
                           </div>
                           
                           <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                                isSuper ? "bg-black text-[#FFD700]" : 
                                isSupervisor ? "bg-primary text-white" : "bg-secondary/50 text-muted-foreground"
                              )}>
                                 {isSuper ? <Crown size={20} /> : isSupervisor ? <Eye size={20} /> : <UserCheck size={20} />}
                              </div>
                              <div>
                                 <p className="font-black text-sm uppercase tracking-tight leading-none mb-1.5">{user.nome}</p>
                                 <div className="flex items-center gap-2">
                                    <RoleBadge role={user.cargo as any} t={t} isSuper={isSuper} />
                                    <span className="text-[8px] font-black text-muted-foreground uppercase opacity-40">• Authority Score: {roleWeights[user.cargo] || 0}</span>
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="flex items-center gap-10">
                           <div className="hidden sm:flex flex-col items-end">
                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-60">Status de Perfil</p>
                              <Badge className={cn(
                                "bg-emerald-50 text-emerald-700 border-none text-[8px] font-black uppercase px-3",
                                isSuper && "bg-black text-[#FFD700]",
                                isSupervisor && "bg-primary text-white"
                              )}>
                                Ativo no Núcleo
                              </Badge>
                           </div>
                           <div className="w-8 h-8 rounded-full border-2 border-border/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronRight size={14} className="text-muted-foreground" />
                           </div>
                        </div>
                     </div>
                   );
                })}
              </div>
            </section>
          )}
        </div>

        <Dialog open={isNewUserOpen} onOpenChange={setIsNewClientOpen}>
          <DialogContent className="sm:max-w-[450px] rounded-2xl border-none shadow-2xl">
            <form onSubmit={handleAddUser}>
              <DialogHeader className="p-6 bg-secondary/20 border-b">
                <DialogTitle className="font-black uppercase tracking-tight">Ativar Novo Operador</DialogTitle>
              </DialogHeader>
              <div className="p-6 space-y-4">
                <div className="grid gap-2">
                  <Label className="uppercase text-[9px] font-black">Nome Completo</Label>
                  <Input value={userForm.nome} onChange={e => setUserForm({...userForm, nome: e.target.value.toUpperCase()})} className="rounded-xl h-11 bg-secondary/30 border-none font-bold" required />
                </div>
                <div className="grid gap-2">
                  <Label className="uppercase text-[9px] font-black">E-mail Corporativo</Label>
                  <Input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value.toLowerCase()})} className="rounded-xl h-11 bg-secondary/30 border-none font-mono" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black">Cargo / Permissão</Label>
                    <Select value={userForm.cargo} onValueChange={val => setUserForm({...userForm, cargo: val as UserRole})}>
                      <SelectTrigger className="rounded-xl h-11 bg-secondary/30 border-none font-bold text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Supervisor" className="text-[10px] font-bold">SUPERVISOR (MASTER)</SelectItem>
                        <SelectItem value="Administrador" className="text-[10px] font-bold">ADMINISTRADOR</SelectItem>
                        <SelectItem value="Operador" className="text-[10px] font-bold">OPERADOR</SelectItem>
                        <SelectItem value="Visualizador" className="text-[10px] font-bold">VISUALIZADOR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="uppercase text-[9px] font-black">Senha Provisória</Label>
                    <Input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="rounded-xl h-11 bg-secondary/30 border-none" required />
                  </div>
                </div>
              </div>
              <DialogFooter className="p-6 pt-0">
                <Button type="submit" disabled={isSaving} className="w-full h-12 bg-black text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl">
                  {isSaving ? <Loader2 className="animate-spin" /> : "Provisionar Acesso"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <footer className="h-10 border-t border-border/30 bg-white flex items-center justify-center gap-6 text-[9px] text-muted-foreground/60 font-black uppercase tracking-[0.4em] shrink-0">
          <div className="flex items-center gap-2"><Copyright size={10} /> 2026 W1 Capital.</div>
          <span>Advanced Management • Davi Alves Figueredo</span>
        </footer>
      </main>
    </div>
  );
}

function RoleBadge({ role, t, isSuper }: { role: UserRole, t: any, isSuper: boolean }) {
  const styles: Record<string, string> = {
    'Superadmin': "text-[#FFD700] border-[#FFD700]/40 bg-black shadow-[0_0_10px_rgba(255,215,0,0.2)]",
    'Supervisor': "text-primary border-primary bg-primary/10 shadow-sm",
    'Administrador': "text-primary border-primary/20 bg-black shadow-sm",
    'Operador': "text-blue-500 border-blue-500/20 bg-blue-50",
    'Visualizador': "text-muted-foreground border-border bg-secondary/50",
  };

  const label = isSuper ? t.roleSuperAdmin : 
                role === 'Supervisor' ? t.roleSupervisor :
                role === 'Administrador' ? t.roleAdmin : 
                role === 'Operador' ? t.roleOperator : t.roleViewer;

  return (
    <Badge variant="outline" className={cn("px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.1em] rounded-md", styles[isSuper ? 'Superadmin' : role] || styles.Visualizador)}>
      {label}
    </Badge>
  );
}
