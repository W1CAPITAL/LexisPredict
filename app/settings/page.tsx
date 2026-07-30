/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
"use client";

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
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { AUTHORITY_PRESETS, applyGlobalTheme } from '@/lib/theme';
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
import { saveAs } from 'file-saver';
import { useAuth } from '@/components/auth/auth-provider';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('Hardware');
  const { profile } = useAuth();
  
  // Banca
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
    endereco: '',
    email: '',
    oabs: [] as { uf: string, num: string }[]
  });

  // Cores
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [bgSecondaryColor, setBgSecondaryColor] = useState('#F3F4F6');
  const [fontColor, setFontColor] = useState('#0A0A0A');
  const [fontMutedColor, setFontMutedColor] = useState('#6B7280');
  const [primaryColor, setPrimaryColor] = useState('#00D1FF');
  const [accentColor, setAccentColor] = useState('#E5E7EB');
  const [radius, setRadius] = useState(4);
  
  // Atmosfera
  const [bgOpacity, setBgOpacity] = useState(85);
  const [sidebarOpacity, setSidebarOpacity] = useState(90);
  const [glassBlur, setGlassBlur] = useState(8);
  const [wallpaper, setWallpaper] = useState('');
  
  // IA
  const [iaModel, setIaModel] = useState('xai');
  const [isMasterUnlocked, setIsMasterUnlocked] = useState(false);

  // Export
  const [exportPassword, setExportPassword] = useState('');
  const [isExportUnlocked, setIsExportUnlocked] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const userAvatarInputRef = useRef<HTMLInputElement>(null);
  const advAvatarInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    setIaModel(localStorage.getItem('lexisPredict_preferred_ia') || 'xai');
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
  }, []);

  const fetchBanca = async () => {
    setLoadingBanca(true);
    const data = await listAdvogadosBanca();
    setAdvogados(data);
    setLoadingBanca(false);
  };

  const handleUserAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    const res = await uploadUserAvatarAction(formData);
    if (res.success) {
      toast({ title: "Foto de Perfil Atualizada" });
      window.location.reload(); // Refresh para atualizar todos os componentes
    } else {
      toast({ title: "Erro no Upload", description: res.error, variant: "destructive" });
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
    } else {
      toast({ title: "Erro no Upload", description: res.error, variant: "destructive" });
    }
    setIsUploading(false);
  };

  const handleSaveAdvogado = async (e: React.FormEvent) => {
    e.preventDefault();
    const oabsJson: Record<string, string> = {};
    advForm.oabs.forEach(o => { if(o.uf && o.num) oabsJson[o.uf] = o.num; });

    if (!advForm.nome || Object.keys(oabsJson).length === 0) {
      toast({ title: "Dados incompletos", description: "Informe o nome e ao menos uma OAB.", variant: "destructive" });
      return;
    }

    const res = await upsertAdvogadoBanca({
      id: editingAdv?.id,
      nome: advForm.nome,
      genero: advForm.genero,
      nacionalidade: advForm.nacionalidade,
      estado_civil: advForm.estadoCivil,
      endereco: advForm.endereco,
      email: advForm.email,
      oabs: oabsJson
    });

    if (res.success) {
      toast({ title: "Advogado Sincronizado" });
      setIsAdvModalOpen(false);
      fetchBanca();
    } else {
      toast({ title: "Erro ao salvar", description: res.error, variant: "destructive" });
    }
  };

  const openAddAdv = () => {
    setEditingAdv(null);
    setAdvForm({ 
      nome: '', 
      genero: 'M', 
      nacionalidade: 'brasileiro', 
      estadoCivil: 'casado', 
      endereco: '', 
      email: '', 
      oabs: [{ uf: 'SP', num: '' }] 
    });
    setIsAdvModalOpen(true);
  };

  const openEditAdv = (adv: any) => {
    setEditingAdv(adv);
    const oabList = Object.entries(adv.oabs || {}).map(([uf, num]) => ({ uf, num: num as string }));
    setAdvForm({
      nome: adv.nome,
      genero: adv.genero || 'M',
      nacionalidade: adv.nacionalidade || (adv.genero === 'F' ? 'brasileira' : 'brasileiro'),
      estadoCivil: adv.estado_civil || adv.estadoCivil || (adv.genero === 'F' ? 'casada' : 'casado'),
      endereco: adv.endereco || '',
      email: adv.email || '',
      oabs: oabList.length > 0 ? oabList : [{ uf: 'SP', num: '' }]
    });
    setIsAdvModalOpen(true);
  };

  const handleApplyHardware = () => {
    const customColors = {
      background: bgColor,
      bgSecondary: bgSecondaryColor,
      foreground: fontColor,
      fontMuted: fontMutedColor,
      primary: primaryColor,
      accent: accentColor,
      border: fontColor
    };
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
      <main className="flex-1 flex flex-col h-screen overflow-hidden glass-panel">
        <header className="h-16 border-b border-border bg-background/40 backdrop-blur-xl flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
             <h1 className="font-black text-sm tracking-[0.2em] uppercase">Gabinete Mission Control</h1>
          </div>
          <Badge variant="outline" className="text-primary text-[9px] uppercase font-black tracking-[0.3em] rounded-none px-3 py-1 border-primary/50">Enterprise Edition v25.0</Badge>
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
                    <button 
                      onClick={() => userAvatarInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                       {isUploading ? <Loader2 className="animate-spin" /> : <Camera size={24} />}
                    </button>
                    <input type="file" className="hidden" ref={userAvatarInputRef} onChange={handleUserAvatarUpload} accept="image/*" />
                 </div>
                 <div>
                    <p className="font-black text-xs uppercase">{profile?.nome}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{profile?.cargo}</p>
                 </div>
                 {profile?.avatar_url && (
                    <Button variant="ghost" size="sm" onClick={() => removeAvatarAction('user')} className="h-6 text-[8px] font-black uppercase text-red-500 hover:bg-red-50">Remover Foto</Button>
                 )}
              </section>

              <nav className="space-y-1">
                <NavButton active={activeTab === 'Hardware'} onClick={() => setActiveTab('Hardware')} icon={<Palette size={14}/>} label="Hardware Visual" />
                <NavButton active={activeTab === 'Banca'} onClick={() => setActiveTab('Banca')} icon={<Gavel size={14}/>} label="Banca de Advogados" />
                <NavButton active={activeTab === 'Engine'} onClick={() => setActiveTab('Engine')} icon={<Cpu size={14}/>} label="Núcleo Neural" />
                {isMasterUnlocked && (
                  <NavButton active={activeTab === 'Export'} onClick={() => setActiveTab('Export')} icon={<Archive size={14}/>} label="Exportação Master" />
                )}
              </nav>
            </aside>

            <div className="md:col-span-3 space-y-12 pb-20">
              {activeTab === 'Hardware' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                       <Label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Authority Presets</Label>
                       <Button variant="ghost" onClick={handleApplyHardware} className="h-8 text-[10px] font-black uppercase hover:bg-primary hover:text-black">
                         <RefreshCcw size={12} className="mr-2"/> Sincronizar Tudo
                       </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                       {AUTHORITY_PRESETS.map((p) => (
                         <button key={p.id} onClick={() => {
                             setBgColor(p.colors.background);
                             setBgSecondaryColor(p.colors.bgSecondary);
                             setFontColor(p.colors.foreground);
                             setFontMutedColor(p.colors.fontMuted);
                             setPrimaryColor(p.colors.primary);
                             setAccentColor(p.colors.accent);
                             setRadius(p.radius);
                             applyGlobalTheme(p.colors, p.radius, bgOpacity / 100, sidebarOpacity / 100, glassBlur);
                             toast({ title: `Tema ${p.name} Ativado` });
                         }} className={cn("p-4 border border-border hover:border-primary/50 transition-all flex flex-col items-center gap-3 bg-background/20 backdrop-blur-md rounded-lg relative overflow-hidden group", bgColor === p.colors.background && "border-primary")}>
                            <div className="w-10 h-10 rounded-md border border-border group-hover:scale-110 transition-transform shadow-lg" style={{ backgroundColor: p.colors.background }}>
                               <div className="w-full h-1/2 rounded-t-md" style={{ backgroundColor: p.colors.primary }} />
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-center leading-tight">{p.name}</span>
                         </button>
                       ))}
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

              {activeTab === 'Banca' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                   <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Advogados Ativos</Label>
                      <Button onClick={openAddAdv} className="bg-black text-white border-2 border-black hover:bg-primary hover:text-black font-black uppercase text-[10px] rounded-none px-6 shadow-[4px_4px_0px_#00D1FF] transition-all">
                        <Plus size={14} className="mr-2"/> Cadastrar Novo
                      </Button>
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
                                <button 
                                  onClick={() => { setEditingAdv(adv); advAvatarInputRef.current?.click(); }}
                                  className="absolute inset-0 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity"
                                >
                                   <Camera size={14} />
                                </button>
                              </div>
                              <div>
                                 <p className="font-black text-sm uppercase tracking-tight">{adv.nome}</p>
                                 <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[9px] text-muted-foreground uppercase font-bold">OAB: {Object.values(adv.oabs || {}).join(' | ')}</p>
                                    <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
                                    <p className="text-[9px] text-muted-foreground uppercase italic">{adv.nacionalidade || 'brasileiro'} · {adv.estado_civil || 'casado'}</p>
                                 </div>
                              </div>
                           </div>
                           <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditAdv(adv)} className="h-8 w-8 hover:bg-primary hover:text-black rounded-sm"><Edit2 size={14}/></Button>
                              <Button variant="ghost" size="icon" onClick={async () => { if(confirm('Remover advogado?')) { await desativarAdvogadoBanca(adv.id); fetchBanca(); } }} className="h-8 w-8 hover:bg-red-500 hover:text-white rounded-sm"><Trash2 size={14}/></Button>
                           </div>
                        </div>
                      ))}
                      <input type="file" className="hidden" ref={advAvatarInputRef} onChange={(e) => editingAdv && handleAdvogadoAvatarUpload(editingAdv.id, e)} accept="image/*" />
                      {advogados.length === 0 && !loadingBanca && (
                        <div className="p-12 text-center border-2 border-dashed border-border/20 rounded-lg">
                           <p className="text-[10px] font-black uppercase text-muted-foreground">Nenhum advogado cadastrado no gabinete.</p>
                        </div>
                      )}
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
                      <RadioGroup value={iaModel} onValueChange={(val) => { setIaModel(val); localStorage.setItem('lexisPredict_preferred_ia', val); toast({ title: "Prioridade Alterada" }); }}>
                        <div className="grid gap-4">
                          <EngineOption id="xai" label="xAI GROK 4.5" desc="Raciocínio jurídico sênior." status="ONLINE" />
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
                                {isExporting ? <Loader2 className="animate-spin mr-3" /> : <FileArchive className="mr-3" />}
                                Baixar Código-Fonte SaaS
                            </Button>
                         </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <Dialog open={isAdvModalOpen} onOpenChange={setIsAdvModalOpen}>
           <DialogContent className="sm:max-w-[550px] rounded-none border-2 border-black shadow-[12px_12px_0px_#000]">
              <form onSubmit={handleSaveAdvogado}>
                 <DialogHeader>
                    <DialogTitle className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                       <User size={16} className="text-primary"/> Perfil de Advogado Banca
                    </DialogTitle>
                 </DialogHeader>
                 <div className="space-y-6 py-6">
                    <div className="grid grid-cols-4 gap-4">
                       <div className="col-span-3 space-y-2">
                          <Label className="text-[9px] font-black uppercase">Nome Completo</Label>
                          <Input value={advForm.nome} onChange={e => setAdvForm({...advForm, nome: e.target.value.toUpperCase()})} className="border-black rounded-none h-11 uppercase font-black text-xs" required />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[9px] font-black uppercase">Gênero</Label>
                          <Select value={advForm.genero} onValueChange={v => setAdvForm({...advForm, genero: v})}>
                             <SelectTrigger className="border-black rounded-none h-11"><SelectValue /></SelectTrigger>
                             <SelectContent><SelectItem value="M">MASC</SelectItem><SelectItem value="F">FEM</SelectItem></SelectContent>
                          </Select>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="text-[9px] font-black uppercase"><Globe size={10} className="inline mr-1"/> Nacionalidade</Label>
                          <Input value={advForm.nacionalidade} onChange={e => setAdvForm({...advForm, nacionalidade: e.target.value.toLowerCase()})} placeholder="Ex: brasileiro" className="border-black rounded-none h-11 font-bold text-xs" />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[9px] font-black uppercase"><Info size={10} className="inline mr-1"/> Estado Civil</Label>
                          <Select value={advForm.estadoCivil} onValueChange={v => setAdvForm({...advForm, estadoCivil: v})}>
                             <SelectTrigger className="border-black rounded-none h-11"><SelectValue /></SelectTrigger>
                             <SelectContent>
                                <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                                <SelectItem value="casado">Casado(a)</SelectItem>
                                <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                                <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                                <SelectItem value="uniao estavel">União Estável</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="text-[9px] font-black uppercase"><Mail size={10} className="inline mr-1"/> Email Corporativo</Label>
                          <Input type="email" value={advForm.email} onChange={e => setAdvForm({...advForm, email: e.target.value.toLowerCase()})} className="border-black rounded-none h-11 lowercase font-bold text-xs" />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[9px] font-black uppercase"><MapPin size={10} className="inline mr-1"/> Endereço Profissional</Label>
                          <Input value={advForm.endereco} onChange={e => setAdvForm({...advForm, endereco: e.target.value.toUpperCase()})} className="border-black rounded-none h-11 uppercase font-bold text-[10px]" />
                       </div>
                    </div>

                    <div className="space-y-4">
                       <Label className="text-[9px] font-black uppercase flex items-center justify-between border-b pb-1">
                          Inscrições OAB <Button type="button" variant="ghost" onClick={() => setAdvForm({...advForm, oabs: [...advForm.oabs, { uf: 'SP', num: '' }]})} className="h-6 text-[8px] border-none"><Plus size={10} className="mr-1"/> Add UF</Button>
                       </Label>
                       <div className="max-h-[120px] overflow-auto space-y-3 pr-2">
                          {advForm.oabs.map((o, idx) => (
                             <div key={idx} className="flex gap-2 items-center">
                                <Select value={o.uf} onValueChange={v => { const n = [...advForm.oabs]; n[idx].uf = v; setAdvForm({...advForm, oabs: n}); }}>
                                   <SelectTrigger className="w-24 border-black rounded-none h-10"><SelectValue /></SelectTrigger>
                                   <SelectContent>
                                      {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                                   </SelectContent>
                                </Select>
                                <Input placeholder="000.000" value={o.num} onChange={e => { const n = [...advForm.oabs]; n[idx].num = e.target.value; setAdvForm({...advForm, oabs: n}); }} className="border-black rounded-none h-10 uppercase font-mono text-xs" />
                                <Button type="button" variant="ghost" onClick={() => { const n = [...advForm.oabs]; n.splice(idx,1); setAdvForm({...advForm, oabs: n}); }} className="text-red-500"><Trash2 size={14}/></Button>
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>
                 <DialogFooter>
                    <Button type="submit" className="w-full h-12 bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-[10px] tracking-widest rounded-none shadow-[6px_6px_0px_#22c55e]">Sincronizar Advogado</Button>
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
