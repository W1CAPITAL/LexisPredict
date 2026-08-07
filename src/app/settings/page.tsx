"use client";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Cpu,
  Palette,
  Archive,
  Lock,
  Shield,
  Loader2,
  Code2,
  Waves,
  Layout,
  RefreshCcw,
  Zap,
  CheckCircle2,
  Activity,
  Server,
  Plus,
  Trash2,
  KeyRound,
  FileArchive,
  Gavel,
  Edit2,
  User,
  Mail,
  MapPin,
  Fingerprint,
  Globe,
  Info,
  Camera,
  X,
  BookOpen,
  FileUp,
  Tags,
  ShieldCheck,
  Eye,
  EyeOff,
  Briefcase,
  Unlock,
  Type,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { AUTHORITY_PRESETS, applyGlobalTheme, applyPresetById, getPresetColors, saveCustomTheme, CUSTOM_PRESET_ID } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { 
  applyWallpaperUrl, 
  resetWallpaper, 
  loadVisualStateFromStorage,
  saveWallpaperFile
} from '@/lib/visual-hardware';
import { exportFullSourceCodeAction } from '@/app/actions/system-actions';
import { listAdvogadosBanca, upsertAdvogadoBanca, desativarAdvogadoBanca } from '@/lib/server-db';
import { uploadUserAvatarAction, uploadAdvogadoAvatarAction, removeAvatarAction } from '@/app/actions/avatar-actions';
import { fetchKnowledgeDocsAction, uploadKnowledgeDocAction, deleteKnowledgeDocAction } from '@/app/actions/knowledge-actions';
import { saveAs } from 'file-saver';
import { useAuth } from '@/components/auth/auth-provider';
import { checkIfSuperAdmin } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('Hardware');
  const { profile } = useAuth();
  
  const [advogados, setAdvogados] = useState<any[]>([]);
  const [loadingBanca, setLoadingBanca] = useState(false);
  const [isAdvModalOpen, setIsAdvModalOpen] = useState(false);
  const [editingAdv, setEditingAdv] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [advForm, setAdvForm] = useState({
    nome: '',
    genero: 'M',
    nacionalidade: 'brasileiro',
    estadoCivil: 'casado',
    cpf: '',
    rg: '',
    endereco: '',
    cidade: '',
    uf: 'SP',
    cep: '',
    email: '',
    emailProfissional: '',
    telefone: '',
    celular: '',
    site: '',
    observacao: '',
    oabs: [] as { uf: string, num: string }[]
  });

  const [knowledgeDocs, setKnowledgeDocs] = useState<any[]>([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);
  const [isUploadingKnowledge, setIsUploadingKnowledge] = useState(false);
  const [knowledgeUnlocked, setKnowledgeUnlocked] = useState(false);
  const [knowledgePassword, setKnowledgePassword] = useState('');
  const [knowledgeForm, setKnowledgeForm] = useState({
    title: '',
    type: 'script',
    tags: '',
    useInDispatch: true,
    rawText: ''
  });
  const [knowledgeInputType, setKnowledgeInputType] = useState('file');
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);

  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [bgSecondaryColor, setBgSecondaryColor] = useState('#F3F4F6');
  const [fontColor, setFontColor] = useState('#0A0A0A');
  const [fontMutedColor, setFontMutedColor] = useState('#6B7280');
  const [primaryColor, setPrimaryColor] = useState('#00D1FF');
  const [accentColor, setAccentColor] = useState('#E5E7EB');
  const [radius, setRadius] = useState(4);
  
  const [bgOpacity, setBgOpacity] = useState(85);
  const [sidebarOpacity, setSidebarOpacity] = useState(90);
  const [glassBlur, setGlassBlur] = useState(8);
  const [wallpaper, setWallpaper] = useState('');
  
  const [iaModel, setIaModel] = useState('xai');
  const [isMasterUnlocked, setIsMasterUnlocked] = useState(false);

  const [exportPassword, setExportPassword] = useState('');
  const [isExportUnlocked, setIsExportUnlocked] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const userAvatarInputRef = useRef<HTMLInputElement>(null);
  const advAvatarInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isSupervisor = profile?.cargo === 'Supervisor' || profile?.cargo === 'Superadmin';
  const isAdmin = profile?.cargo === 'Administrador' || isSupervisor;
  const isSuperadmin = checkIfSuperAdmin(profile);

  useEffect(() => {
    setMounted(true);
    const savedIA = localStorage.getItem('lexisPredict_preferred_ia') || 'xai';
    setIaModel(savedIA === 'airforce' ? 'xai' : savedIA);
    setIsMasterUnlocked(localStorage.getItem('lexis_master_unlock') === 'true');
    
    setBgColor(localStorage.getItem('lexisPredict_bg_color') || '#FFFFFF');
    setBgSecondaryColor(localStorage.getItem('lexisPredict_bg_secondary_color') || '#F3F4F6');
    setFontColor(localStorage.getItem('lexisPredict_font_color') || '#0A0A0A');
    setFontMutedColor(localStorage.getItem('lexisPredict_font_muted_color') || '#6B7280');
    setPrimaryColor(localStorage.getItem('lexisPredict_btn_bg_color') || '#00D1FF');
    setAccentColor(localStorage.getItem('lexisPredict_btn_inactive_color') || '#E5E7EB');
    setRadius(parseInt(localStorage.getItem('lexisPredict_border_radius') || '4'));

    const visual = loadVisualStateFromStorage();
    setWallpaper(visual.wallpaper);
    setBgOpacity(Math.round(visual.bgOpacity01 * 100));
    setSidebarOpacity(Math.round(visual.sidebarOpacity01 * 100));
    setGlassBlur(visual.glassBlur);

    fetchBanca();
    fetchKnowledge();
  }, []);

  const fetchBanca = async () => {
    setLoadingBanca(true);
    const data = await listAdvogadosBanca();
    setAdvogados(data);
    setLoadingBanca(false);
  };

  const fetchKnowledge = async () => {
    setLoadingKnowledge(true);
    const res = await fetchKnowledgeDocsAction();
    if (res.success) setKnowledgeDocs(res.docs || []);
    setLoadingKnowledge(false);
  };

  const handleUnlockKnowledge = () => {
    if (knowledgePassword === 'Ashley@25472053') {
      setKnowledgeUnlocked(true);
      toast({ title: "Modo de Edição Liberado" });
    } else {
      toast({ title: "Senha de Gabinete Inválida", variant: "destructive" });
    }
  };

  const handleKnowledgeUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!knowledgeUnlocked) return;
    
    const file = knowledgeFileInputRef.current?.files?.[0];
    const rawText = knowledgeForm.rawText;

    if (knowledgeInputType === 'file' && !file) {
      toast({ title: "Arquivo não selecionado", variant: "destructive" });
      return;
    }
    if (knowledgeInputType === 'text' && !rawText.trim()) {
      toast({ title: "Texto vazio", variant: "destructive" });
      return;
    }

    setIsUploadingKnowledge(true);
    const formData = new FormData();
    if (knowledgeInputType === 'file' && file) formData.append('file', file);
    if (knowledgeInputType === 'text') formData.append('rawText', rawText);
    
    formData.append('title', knowledgeForm.title);
    formData.append('type', knowledgeForm.type);
    formData.append('tags', knowledgeForm.tags);
    formData.append('useInDispatch', String(knowledgeForm.useInDispatch));

    const res = await uploadKnowledgeDocAction(formData);
    if (res.success) {
      toast({ title: "Conhecimento Sincronizado" });
      setIsKnowledgeModalOpen(false);
      setKnowledgeForm({ title: '', type: 'script', tags: '', useInDispatch: true, rawText: '' });
      fetchKnowledge();
    } else {
      toast({ title: "Erro na Ingestão", description: res.error, variant: "destructive" });
    }
    setIsUploadingKnowledge(false);
  };

  const handleDeleteKnowledge = async (docId: string) => {
    if (!knowledgeUnlocked) {
      toast({ title: "Desbloqueie para alterar", variant: "destructive" });
      return;
    }
    if (!confirm('Deseja remover este documento?')) return;
    const res = await deleteKnowledgeDocAction(docId);
    if (res.success) {
      toast({ title: "Conhecimento Removido" });
      fetchKnowledge();
    }
  };

  const handleUserAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    const res = await uploadUserAvatarAction(formData);
    if (res.success) {
      toast({ title: "Foto Atualizada" });
      window.location.reload();
    }
    setIsUploading(false);
  };

  const handleAdvogadoAvatarUpload = async (advId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    const res = await uploadAdvogadoAvatarAction(advId, formData);
    if (res.success) {
      toast({ title: "Foto do Advogado Atualizada" });
      fetchBanca();
    }
    setIsUploading(false);
  };

    const handleSaveAdvogado = async (e: React.FormEvent) => {
    e.preventDefault();
    const oabsJson: Record<string, string> = {};
    advForm.oabs.forEach(o => { if (o.uf && o.num) oabsJson[o.uf] = o.num.trim(); });
    if (!advForm.nome?.trim()) {
      toast({ title: "Informe o nome", variant: "destructive" });
      return;
    }
    if (Object.keys(oabsJson).length === 0) {
      toast({ title: "Informe ao menos uma OAB", variant: "destructive" });
      return;
    }
    const res = await upsertAdvogadoBanca({
      id: editingAdv?.id,
      nome: advForm.nome.trim().toUpperCase(),
      genero: advForm.genero,
      nacionalidade: advForm.nacionalidade,
      estado_civil: advForm.estadoCivil,
      cpf: (advForm.cpf || '').replace(/\D/g, '') || null,
      rg: advForm.rg || null,
      endereco: advForm.endereco || null,
      cidade: advForm.cidade || null,
      uf: advForm.uf || null,
      cep: (advForm.cep || '').replace(/\D/g, '') || null,
      email: advForm.email || null,
      email_profissional: advForm.emailProfissional || null,
      telefone: advForm.telefone || null,
      celular: advForm.celular || null,
      site: advForm.site || null,
      observacao: advForm.observacao || null,
      oabs: oabsJson,
      ativo: true,
    });
    if (res?.success) {
      toast({ title: "Advogado Sincronizado" });
      setIsAdvModalOpen(false);
      fetchBanca();
    } else {
      toast({ title: "Erro ao salvar", description: (res as any)?.error || "Verifique as colunas no Supabase", variant: "destructive" });
    }
  };

  const openAddAdv = () => {
    setEditingAdv(null);
    setAdvForm({
      nome: '', genero: 'M', nacionalidade: 'brasileiro', estadoCivil: 'casado',
      cpf: '', rg: '', endereco: '', cidade: '', uf: 'SP', cep: '',
      email: '', emailProfissional: '', telefone: '', celular: '', site: '', observacao: '',
      oabs: [{ uf: 'SP', num: '' }],
    });
    setIsAdvModalOpen(true);
  };

  const openEditAdv = (adv: any) => {
    setEditingAdv(adv);
    const oabList = Object.entries(adv.oabs || {}).map(([uf, num]) => ({ uf, num: num as string }));
    setAdvForm({
      nome: (adv.nome || '').trim(),
      genero: adv.genero || 'M',
      nacionalidade: adv.nacionalidade || (adv.genero === 'F' ? 'brasileira' : 'brasileiro'),
      estadoCivil: adv.estado_civil || adv.estadoCivil || 'casado',
      cpf: adv.cpf || '',
      rg: adv.rg || '',
      endereco: adv.endereco || '',
      cidade: adv.cidade || '',
      uf: adv.uf || 'SP',
      cep: adv.cep || '',
      email: adv.email || '',
      emailProfissional: adv.email_profissional || '',
      telefone: adv.telefone || '',
      celular: adv.celular || '',
      site: adv.site || '',
      observacao: adv.observacao || '',
      oabs: oabList.length > 0 ? oabList : [{ uf: 'SP', num: '' }],
    });
    setIsAdvModalOpen(true);
  };

  const handleApplyHardware = () => {
    const customColors = { background: bgColor, bgSecondary: bgSecondaryColor, foreground: fontColor, fontMuted: fontMutedColor, primary: primaryColor, accent: accentColor, border: fontColor };
    saveCustomTheme(customColors, radius);
    applyGlobalTheme(customColors, radius, bgOpacity / 100, sidebarOpacity / 100, glassBlur);
    if (wallpaper) applyWallpaperUrl(wallpaper);
    toast({ title: "Hardware Visual Aplicado" });
  };

  const handleUnlockExport = () => {
    if (exportPassword === 'Abaira@185') {
      setIsExportUnlocked(true);
      toast({ title: "Acesso Autorizado" });
    } else {
      toast({ title: "Acesso Negado", variant: "destructive" });
    }
  };

  const handleFullBackupZip = async () => {
    setIsExporting(true);
    try {
      const result = await exportFullSourceCodeAction();
      if (result.success && result.base64) {
        const byteCharacters = atob(result.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        saveAs(new Blob([byteArray], { type: "application/zip" }), result.filename);
        toast({ title: "Exportação Concluída" });
      }
    } finally {
      setIsExporting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-transparent font-sans text-foreground overflow-hidden relative z-10">
      <Sidebar />
      <div className="fixed bottom-4 right-4 z-50 rounded-full border bg-card shadow-lg p-1">
        <ThemeToggle />
      </div>
      <main className="flex-1 flex flex-col h-screen overflow-hidden glass-panel">
        <header className="h-16 border-b border-border bg-background/40 backdrop-blur-xl flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
             <h1 className="font-black text-sm tracking-[0.2em] uppercase">Gabinete Mission Control</h1>
          </div>
          <div className="flex items-center gap-3">
            {isSuperadmin && (
              <Button asChild variant="outline" size="sm" className="h-9 rounded-xl font-black uppercase text-[9px] tracking-widest border-2 border-primary/50">
                <Link href="/ops">
                  <Database size={12} className="mr-2" />
                  Operações de dados
                </Link>
              </Button>
            )}
            <Badge variant="outline" className="text-primary text-[9px] uppercase font-black tracking-[0.3em] rounded-none px-3 py-1 border-primary/50">Enterprise Edition v25.0</Badge>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 max-w-6xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <aside className="space-y-4">
              <section className="p-6 border border-border rounded-lg bg-background/20 backdrop-blur-xl flex flex-col items-center text-center space-y-4 shadow-xl">
                 <div className="relative group">
                    <Avatar className="w-24 h-24 border-4 border-primary/20">
                       <AvatarImage src={profile?.avatar_url || ''} />
                       <AvatarFallback className="bg-black text-primary font-black text-xl">{profile?.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <button onClick={() => userAvatarInputRef.current?.click()} className="absolute inset-0 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       {isUploading ? <Loader2 className="animate-spin" /> : <Camera size={24} />}
                    </button>
                    <input type="file" className="hidden" ref={userAvatarInputRef} onChange={handleUserAvatarUpload} accept="image/*" />
                 </div>
                 <div>
                    <p className="font-black text-xs uppercase">{profile?.nome}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{profile?.cargo}</p>
                 </div>
              </section>

              <nav className="space-y-1">
                <NavButton active={activeTab === 'Hardware'} onClick={() => setActiveTab('Hardware')} icon={<Palette size={14}/>} label="Hardware Visual" />
                <NavButton active={activeTab === 'Banca'} onClick={() => setActiveTab('Banca')} icon={<Gavel size={14}/>} label="Banca de Advogados" />
                <NavButton active={activeTab === 'Knowledge'} onClick={() => setActiveTab('Knowledge')} icon={<BookOpen size={14}/>} label="Base de Conhecimento" />
                <NavButton active={activeTab === 'Engine'} onClick={() => setActiveTab('Engine')} icon={<Cpu size={14}/>} label="Núcleo Neural" />
                {isMasterUnlocked && <NavButton active={activeTab === 'Export'} onClick={() => setActiveTab('Export')} icon={<Archive size={14}/>} label="Exportação Master" />}
                {isSuperadmin && (
                  <Link
                    href="/ops"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all text-left border-2 border-primary/40 bg-primary/10 text-foreground hover:bg-primary hover:text-black"
                  >
                    <Database size={14} />
                    Operações de dados
                  </Link>
                )}
              </nav>
            </aside>

            <div className="md:col-span-3 space-y-12 pb-20">
              {activeTab === 'Hardware' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                       <Label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Authority Presets</Label>
                       <Button variant="ghost" onClick={handleApplyHardware} className="h-8 text-[10px] font-black uppercase hover:bg-primary hover:text-black"><RefreshCcw size={12} className="mr-2"/> Sincronizar Tudo</Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                       {AUTHORITY_PRESETS.map((p) => {
                         const light = getPresetColors(p, 'light');
                         const dark = getPresetColors(p, 'dark');
                         const active = bgColor === light.background || bgColor === dark.background;
                         return (
                         <button key={p.id} onClick={() => {
                             applyPresetById(p.id);
                             setBgColor(light.background); setBgSecondaryColor(light.bgSecondary); setFontColor(light.foreground); setFontMutedColor(light.fontMuted); setPrimaryColor(light.primary); setAccentColor(light.accent); setRadius(p.radius);
                             toast({ title: `Tema ${p.name} Ativado` });
                         }} className={cn("p-4 border border-border hover:border-primary/50 transition-all flex flex-col items-center gap-3 bg-background/20 backdrop-blur-md rounded-lg relative overflow-hidden group", active && "border-primary")}>
                            <div className="flex items-center gap-2">
                               <div className="w-10 h-10 rounded-md border border-border group-hover:scale-110 transition-transform shadow-lg overflow-hidden" style={{ backgroundColor: light.background }}>
                                  <div className="w-full h-1/2 rounded-t-md" style={{ backgroundColor: light.primary }} />
                               </div>
                               <div className="w-10 h-10 rounded-md border border-border group-hover:scale-110 transition-transform shadow-lg overflow-hidden" style={{ backgroundColor: dark.background }}>
                                  <div className="w-full h-1/2 rounded-t-md" style={{ backgroundColor: dark.primary }} />
                               </div>
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-center leading-tight">{p.name}</span>
                            <span className="text-[7px] font-bold uppercase tracking-widest text-muted-foreground text-center leading-tight">Light + Dark</span>
                         </button>
                         );
                       })}
                    </div>
                  </section>
                  <section className="space-y-6">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Atmosfera & Vidro</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 bg-background/20 backdrop-blur-xl p-8 border border-border rounded-lg shadow-xl">
                       <div className="space-y-6">
                          <SliderControl label="Opacidade do Fundo" value={bgOpacity} onChange={setBgOpacity} icon={<Waves size={12}/>} />
                          <SliderControl label="Opacidade da Sidebar" value={sidebarOpacity} onChange={setSidebarOpacity} icon={<Layout size={12}/>} />
                       </div>
                       <div className="space-y-6">
                          <SliderControl label="Intensidade Blur" value={glassBlur} max={40} onChange={setGlassBlur} icon={<RefreshCcw size={12}/>} />
                          <div className="space-y-4">
                            <Label className="text-[9px] uppercase font-black flex items-center gap-2 text-foreground"><Layout size={12}/> Raio de Borda: {radius}px</Label>
                            <Slider value={[radius]} max={24} min={0} step={1} onValueChange={(v) => setRadius(v[0])} />
                          </div>
                       </div>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'Knowledge' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                   <div className="flex items-center justify-between">
                      <div className="space-y-1">
                         <Label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Base de Dados & Scripts Corporativos</Label>
                         <p className="text-[8px] font-bold uppercase text-muted-foreground tracking-widest">Acesso de consulta liberado para toda a empresa.</p>
                      </div>
                      {isAdmin && (
                        <Button onClick={() => {
                          if (!knowledgeUnlocked) {
                             const pass = prompt("Insira a senha master para gerenciar o conhecimento:");
                             if (pass === 'Ashley@25472053') {
                               setKnowledgeUnlocked(true);
                               toast({ title: "Acesso de Gestão Liberado" });
                               setIsKnowledgeModalOpen(true);
                             } else {
                               toast({ title: "Senha incorreta", variant: "destructive" });
                             }
                          } else {
                             setIsKnowledgeModalOpen(true);
                          }
                        }} className="bg-black text-white border-2 border-black hover:bg-primary hover:text-black font-black uppercase text-[10px] rounded-none px-6 shadow-[4px_4px_0px_#00D1FF] transition-all">
                          <Plus size={14} className="mr-2"/> {knowledgeUnlocked ? 'Ensinar IA' : 'Gerenciar Conhecimento'}
                        </Button>
                      )}
                   </div>

                   <div className="grid gap-4">
                      {loadingKnowledge ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary"/></div>
                      ) : knowledgeDocs.length > 0 ? (
                        knowledgeDocs.map((doc) => (
                        <div key={doc.id} className="p-6 border border-border rounded-lg bg-background/20 backdrop-blur-xl flex items-center justify-between group hover:border-primary/50 transition-all">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-black flex items-center justify-center text-primary rounded-lg border-2 border-black shadow-sm group-hover:shadow-primary/20"><BookOpen size={24} /></div>
                              <div>
                                 <div className="flex items-center gap-2">
                                    <p className="font-black text-sm uppercase tracking-tight">{doc.titulo}</p>
                                    <Badge variant="outline" className="text-[7px] font-black uppercase px-1.5 py-0 border-black/10">{doc.tipo}</Badge>
                                 </div>
                                 <div className="flex items-center gap-2 mt-1">
                                    <div className="flex gap-1">{doc.tags?.slice(0, 3).map((t: string) => (<span key={t} className="text-[7px] bg-secondary/50 text-muted-foreground px-1 py-0.5 rounded-sm font-black uppercase">{t}</span>))}</div>
                                    <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
                                    {doc.uso_despacho ? (<Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[7px] font-black uppercase flex items-center gap-1"><Eye size={8}/> Ativo em Despacho</Badge>) : (<Badge className="bg-slate-500/10 text-slate-500 border-none text-[7px] font-black uppercase flex items-center gap-1"><EyeOff size={8}/> Apenas Consulta</Badge>)}
                                 </div>
                              </div>
                           </div>
                           {isAdmin && knowledgeUnlocked && (
                             <div className="flex gap-2">
                               <Button variant="ghost" size="icon" onClick={() => handleDeleteKnowledge(doc.id)} className="h-8 w-8 hover:bg-red-500 hover:text-white rounded-sm">
                                 <Trash2 size={14}/>
                               </Button>
                             </div>
                           )}
                        </div>
                      ))) : (
                        <div className="py-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center opacity-30">
                           <BookOpen size={48} className="mb-4" />
                           <p className="font-black uppercase text-xs">Nenhum documento na base corporativa.</p>
                        </div>
                      )}
                   </div>
                </div>
              )}

              {activeTab === 'Banca' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                   <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Advogados Ativos</Label>
                      {isAdmin && <Button onClick={openAddAdv} className="bg-black text-white border-2 border-black hover:bg-primary hover:text-black font-black uppercase text-[10px] rounded-none px-6 shadow-[4px_4px_0px_#00D1FF] transition-all"><Plus size={14} className="mr-2"/> Cadastrar Novo</Button>}
                   </div>
                   <div className="grid gap-4">
                      {loadingBanca ? <Loader2 className="animate-spin mx-auto"/> : 
                        advogados.map((adv) => (
                        <div key={adv.id} className="p-6 border border-border rounded-lg bg-background/20 backdrop-blur-xl flex items-center justify-between group hover:border-primary/50 transition-all">
                           <div className="flex items-center gap-4">
                              <div className="relative group/avatar">
                                <Avatar className="w-12 h-12 border-2 border-primary/20">
                                   <AvatarImage src={adv.avatar_url || ''} />
                                   <AvatarFallback className="bg-black text-primary font-black text-sm">{adv.nome.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                {isAdmin && <button onClick={() => { setEditingAdv(adv); advAvatarInputRef.current?.click(); }} className="absolute inset-0 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity"><Camera size={14} /></button>}
                              </div>
                              <div>
                                 <p className="font-black text-sm uppercase tracking-tight">{adv.nome}</p>
                                 <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[9px] text-muted-foreground uppercase font-bold">OAB: {Object.values(adv.oabs || {}).join(' | ')}</p>
                                    <p className="text-[9px] text-muted-foreground truncate">{adv.email_profissional || adv.email || '—'} · {adv.telefone || adv.celular || '—'}</p>
                                    <p className="text-[9px] text-muted-foreground truncate">{adv.endereco || 'Sem endereço profissional'}</p>
                                 </div>
                              </div>
                           </div>
                           {isAdmin && (
                             <div className="flex gap-2">
                                <Button variant="ghost" size="icon" onClick={() => openEditAdv(adv)} className="h-8 w-8 hover:bg-primary hover:text-black rounded-sm"><Edit2 size={14}/></Button>
                                <Button variant="ghost" size="icon" onClick={async () => { if(confirm('Remover?')) { await desativarAdvogadoBanca(adv.id); fetchBanca(); } }} className="h-8 w-8 hover:bg-red-500 hover:text-white rounded-sm"><Trash2 size={14}/></Button>
                             </div>
                           )}
                        </div>
                      ))}
                      <input type="file" className="hidden" ref={advAvatarInputRef} onChange={(e) => editingAdv && handleAdvogadoAvatarUpload(editingAdv.id, e)} accept="image/*" />
                   </div>
                </div>
              )}

              {activeTab === 'Engine' && (
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                  <Card className="bg-background/40 backdrop-blur-xl border border-border rounded-lg shadow-2xl overflow-hidden">
                    <CardHeader className="border-b border-border bg-background/50">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Zap size={14} className="text-primary"/> Neural Infrastructure</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                      <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-4">
                         <ShieldCheck className="text-amber-500 mt-1 shrink-0" size={18} />
                         <div>
                            <p className="text-[10px] font-black uppercase text-amber-700">Protocolo de Sigilo Ativo</p>
                            <p className="text-[9px] font-bold text-amber-600/80 uppercase leading-relaxed mt-1">As IAs estão instruídas a nunca citar nomes de empresas. Todo despacho é gerado em tom institucional neutro.</p>
                         </div>
                      </div>
                      <RadioGroup value={iaModel} onValueChange={(val) => { 
                        if (!isAdmin) {
                           toast({ title: "Acesso Negado", description: "Apenas administradores alteram o motor neural.", variant: "destructive" });
                           return;
                        }
                        setIaModel(val); 
                        localStorage.setItem('lexisPredict_preferred_ia', val); 
                        toast({ title: "Prioridade Alterada" }); 
                      }}>
                        <div className="grid gap-4">
                          <EngineOption id="xai" label="xAI GROK 4.5" desc="Raciocínio jurídico sênior + RAG." status="ONLINE" />
                          <EngineOption id="groq-llama" label="GROQ LLAMA 3.3" desc="Velocidade ultra-fluida." status="ONLINE" />
                        </div>
                      </RadioGroup>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'Export' && isMasterUnlocked && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                  {!isExportUnlocked ? (
                    <div className="p-12 flex flex-col items-center justify-center space-y-6">
                        <Lock size={32} className="text-primary" />
                        <Input type="password" placeholder="SENHA MASTER..." value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} className="max-w-xs text-center border-2 border-black rounded-none h-12 uppercase font-black" />
                        <Button onClick={handleUnlockExport} className="h-12 bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-[10px] px-8 rounded-none shadow-[4px_4px_0px_#00D1FF]">Liberar Portal</Button>
                    </div>
                  ) : (
                    <Card className="bg-background/40 backdrop-blur-xl border border-border rounded-lg shadow-2xl">
                         <CardContent className="p-8">
                            <Button onClick={handleFullBackupZip} disabled={isExporting} className="w-full h-16 bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-[11px] tracking-[0.2em] shadow-[8px_8px_0px_#00D1FF] border-2 border-black rounded-none">
                                {isExporting ? <Loader2 className="animate-spin mr-3" /> : <FileArchive className="mr-3" />} Baixar Código-Fonte SaaS
                            </Button>
                         </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <Dialog open={isKnowledgeModalOpen} onOpenChange={setIsKnowledgeModalOpen}>
           <DialogContent className="sm:max-w-[500px] rounded-none border-2 border-black shadow-[12px_12px_0px_#000] p-0 overflow-hidden">
              <form onSubmit={handleKnowledgeUpload}>
                 <DialogHeader className="p-6 bg-black text-white">
                    <DialogTitle className="font-black uppercase tracking-widest text-sm flex items-center gap-3"><Zap size={20} className="text-primary"/> Ensinar Unidade Neural</DialogTitle>
                 </DialogHeader>
                 <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                    <div className="space-y-2">
                       <Label className="text-[9px] font-black uppercase">Título do Documento</Label>
                       <Input value={knowledgeForm.title} onChange={e => setKnowledgeForm({...knowledgeForm, title: e.target.value.toUpperCase()})} placeholder="EX: MANUAL DE CUSTAS 2026" className="border-black rounded-none h-11 uppercase font-black text-xs" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="text-[9px] font-black uppercase">Tipo</Label>
                          <Select value={knowledgeForm.type} onValueChange={v => setKnowledgeForm({...knowledgeForm, type: v})}>
                             <SelectTrigger className="border-black rounded-none h-11"><SelectValue /></SelectTrigger>
                             <SelectContent><SelectItem value="script">Script</SelectItem><SelectItem value="politica">Política</SelectItem><SelectItem value="manual">Manual</SelectItem></SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[9px] font-black uppercase">Tags (Vírgula)</Label>
                          <Input value={knowledgeForm.tags} onChange={e => setKnowledgeForm({...knowledgeForm, tags: e.target.value})} placeholder="JG, CUSTAS" className="border-black rounded-none h-11 uppercase font-bold text-xs" />
                       </div>
                    </div>
                    <div className="p-4 bg-secondary/20 border border-black/5 flex items-center justify-between">
                       <Label className="text-[10px] font-black uppercase">Usar em Despacho WhatsApp?</Label>
                       <Switch checked={knowledgeForm.useInDispatch} onCheckedChange={v => setKnowledgeForm({...knowledgeForm, useInDispatch: v})} />
                    </div>
                    <div className="space-y-4">
                      <Tabs value={knowledgeInputType} onValueChange={setKnowledgeInputType} className="w-full">
                         <TabsList className="grid w-full grid-cols-2 bg-gray-100 border-2 border-black rounded-none p-1">
                            <TabsTrigger value="file" className="rounded-none font-black uppercase text-[9px] data-[state=active]:bg-black data-[state=active]:text-white">Arquivo</TabsTrigger>
                            <TabsTrigger value="text" className="rounded-none font-black uppercase text-[9px] data-[state=active]:bg-black data-[state=active]:text-white">Texto</TabsTrigger>
                         </TabsList>
                         <TabsContent value="file" className="pt-4">
                            <div className="border-2 border-dashed border-black/20 p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-black group transition-all" onClick={() => knowledgeFileInputRef.current?.click()}>
                               <FileUp className="text-black/20 group-hover:text-white mb-2" size={32} />
                               <input type="file" ref={knowledgeFileInputRef} accept=".pdf,.md,.txt" className="hidden" />
                               <p className="text-[9px] font-black uppercase group-hover:text-white">Clique para selecionar</p>
                            </div>
                         </TabsContent>
                         <TabsContent value="text" className="pt-4">
                            <Textarea value={knowledgeForm.rawText} onChange={e => setKnowledgeForm({...knowledgeForm, rawText: e.target.value})} placeholder="COLE O CONTEÚDO AQUI..." className="min-h-[200px] border-2 border-black rounded-none uppercase font-bold text-[10px]" />
                         </TabsContent>
                      </Tabs>
                    </div>
                 </div>
                 <DialogFooter className="p-6 bg-[#f8f9fb] border-t-2 border-black">
                    <Button type="submit" disabled={isUploadingKnowledge} className="w-full h-14 bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-[11px] tracking-widest rounded-none shadow-[6px_6px_0px_#22c55e]">
                       {isUploadingKnowledge ? <Loader2 className="animate-spin mr-2"/> : <Zap size={14} className="mr-2"/>} Sincronizar com Unidade Neural
                    </Button>
                 </DialogFooter>
              </form>
           </DialogContent>
        </Dialog>

        <Dialog open={isAdvModalOpen} onOpenChange={setIsAdvModalOpen}>
           <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border-2 border-black shadow-[12px_12px_0px_#000]">
              <form onSubmit={handleSaveAdvogado}>
                 <DialogHeader>
                   <DialogTitle className="font-black uppercase tracking-widest text-sm">Perfil de Advogado</DialogTitle>
                 </DialogHeader>
                 <div className="space-y-4 py-4 text-xs">
                    <div className="space-y-1">
                       <Label className="text-[9px] font-black uppercase">Nome Completo *</Label>
                       <Input value={advForm.nome} onChange={e => setAdvForm({...advForm, nome: e.target.value.toUpperCase()})} className="border-black rounded-xl h-11 uppercase font-black text-xs" required />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase">Gênero</Label>
                        <Select value={advForm.genero} onValueChange={(v) => setAdvForm({...advForm, genero: v})}>
                          <SelectTrigger className="h-10 border-black rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="M">M</SelectItem>
                            <SelectItem value="F">F</SelectItem>
                            <SelectItem value="O">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase">Nacionalidade</Label>
                        <Input value={advForm.nacionalidade} onChange={e => setAdvForm({...advForm, nacionalidade: e.target.value})} className="h-10 border-black rounded-xl" />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-[9px] font-black uppercase">Estado civil</Label>
                        <Select value={advForm.estadoCivil} onValueChange={(v) => setAdvForm({...advForm, estadoCivil: v})}>
                          <SelectTrigger className="h-10 border-black rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                            <SelectItem value="casado">Casado(a)</SelectItem>
                            <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                            <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                            <SelectItem value="uniao_estavel">União estável</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase">CPF</Label>
                        <Input value={advForm.cpf} onChange={e => setAdvForm({...advForm, cpf: e.target.value})} className="h-10 border-black rounded-xl" placeholder="000.000.000-00" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase">RG</Label>
                        <Input value={advForm.rg} onChange={e => setAdvForm({...advForm, rg: e.target.value})} className="h-10 border-black rounded-xl" />
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl border border-black/20 p-3">
                       <div className="flex justify-between items-center">
                         <Label className="text-[9px] font-black uppercase">OABs *</Label>
                         <Button type="button" onClick={() => setAdvForm({...advForm, oabs: [...advForm.oabs, { uf: 'SP', num: '' }]})} variant="ghost" className="h-6 text-[8px] font-black uppercase">Add UF</Button>
                       </div>
                       {advForm.oabs.map((o, idx) => (
                          <div key={idx} className="flex gap-2">
                             <Select value={o.uf} onValueChange={(v) => { const newOabs = [...advForm.oabs]; newOabs[idx].uf = v; setAdvForm({...advForm, oabs: newOabs}); }}>
                                <SelectTrigger className="w-20 border-black rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent>{["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                             </Select>
                             <Input value={o.num} onChange={e => { const newOabs = [...advForm.oabs]; newOabs[idx].num = e.target.value; setAdvForm({...advForm, oabs: newOabs}); }} className="border-black rounded-xl flex-1" placeholder="238.759/MG" />
                          </div>
                       ))}
                    </div>

                    <div className="space-y-2 rounded-xl border border-black/20 p-3">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground">Correio eletrônico e telefones</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase">E-mail profissional</Label>
                          <Input type="email" value={advForm.emailProfissional} onChange={e => setAdvForm({...advForm, emailProfissional: e.target.value})} className="h-10 border-black rounded-xl" placeholder="nome@adv.oabsp.org.br" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase">E-mail</Label>
                          <Input type="email" value={advForm.email} onChange={e => setAdvForm({...advForm, email: e.target.value})} className="h-10 border-black rounded-xl" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase">Telefone</Label>
                          <Input value={advForm.telefone} onChange={e => setAdvForm({...advForm, telefone: e.target.value})} className="h-10 border-black rounded-xl" placeholder="(11) 3000-0000" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase">Celular</Label>
                          <Input value={advForm.celular} onChange={e => setAdvForm({...advForm, celular: e.target.value})} className="h-10 border-black rounded-xl" placeholder="(11) 90000-0000" />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-[9px] font-black uppercase">Site</Label>
                          <Input value={advForm.site} onChange={e => setAdvForm({...advForm, site: e.target.value})} className="h-10 border-black rounded-xl" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl border border-black/20 p-3">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground">Endereço profissional</Label>
                      <Input value={advForm.endereco} onChange={e => setAdvForm({...advForm, endereco: e.target.value})} className="h-10 border-black rounded-xl" placeholder="Rua, número, sala" />
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="space-y-1 col-span-2">
                          <Label className="text-[9px] font-black uppercase">Cidade</Label>
                          <Input value={advForm.cidade} onChange={e => setAdvForm({...advForm, cidade: e.target.value})} className="h-10 border-black rounded-xl" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase">UF</Label>
                          <Select value={advForm.uf} onValueChange={(v) => setAdvForm({...advForm, uf: v})}>
                            <SelectTrigger className="h-10 border-black rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>{["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase">CEP</Label>
                          <Input value={advForm.cep} onChange={e => setAdvForm({...advForm, cep: e.target.value})} className="h-10 border-black rounded-xl" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase">Observação</Label>
                      <Textarea value={advForm.observacao} onChange={e => setAdvForm({...advForm, observacao: e.target.value})} rows={3} className="border-black rounded-xl text-xs" />
                    </div>
                 </div>
                 <DialogFooter>
                   <Button type="submit" className="w-full h-12 bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-[10px] rounded-xl shadow-[6px_6px_0px_#22c55e]">
                     Salvar Advogado
                   </Button>
                 </DialogFooter>
              </form>
           </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function EngineOption({ id, label, desc, status }: any) {
  return (
    <label htmlFor={id} className="flex items-center justify-between p-6 border border-border rounded-lg hover:border-primary/40 transition-all cursor-pointer bg-background/20 group">
      <div className="flex items-center gap-5">
         <RadioGroupItem value={id} id={id} />
         <div className="text-left">
           <p className="font-black text-[11px] uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">{label}</p>
           <p className="text-[10px] text-muted-foreground uppercase mt-1">{desc}</p>
         </div>
      </div>
      <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[8px] font-black uppercase px-2 py-0.5">{status}</Badge>
    </label>
  );
}

function NavButton({ active, onClick, icon, label }: any) {
  return (
    <Button variant="ghost" onClick={onClick} className={cn("w-full justify-start rounded-md font-bold uppercase text-[10px] tracking-widest h-12 mb-1 transition-all", active ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-background/20")}>
      <span className="mr-4">{icon}</span> {label}
    </Button>
  );
}

function SliderControl({ label, value, onChange, icon, max = 100 }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-[9px] uppercase font-black flex items-center gap-2 text-foreground">{icon} {label}</Label>
        <span className="text-[10px] font-black">{value}%</span>
      </div>
      <Slider value={[value]} max={max} min={0} step={1} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}
