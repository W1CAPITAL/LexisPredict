/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  FileText, 
  Zap, 
  Loader2, 
  Edit3, 
  Upload,
  FileUp, 
  Shield,
  CheckCircle2,
  Building2,
  AlertCircle,
  MapPin,
  User,
  Mail,
  Phone,
  Trash2,
  Eye,
  Calendar,
  Fingerprint,
  Hash,
  Settings,
  Briefcase,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { extrairTextoDoPDFAction, extrairDadosProcuracaoAction, generateProcuracaoPDFAction } from '@/app/actions/document-actions';
import { listAdvogadosBanca } from '@/lib/server-db';
import Link from 'next/link';

export default function DocumentGenerator() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [banca, setBanca] = useState<any[]>([]);
  const [selectedLawyerId, setSelectedLawyerId] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [extractedData, setExtractedData] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [includeBankInfo, setIncludeBankInfo] = useState(true);
  const [includeProcessNumber, setIncludeProcessNumber] = useState(true);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const data = await listAdvogadosBanca();
      setBanca(data);
      if (data.length > 0) {
        setSelectedLawyerId(data[0].id);
        const firstUF = Object.keys(data[0].oabs || {})[0] || 'SP';
        setSelectedState(firstUF);
      }
    }
    load();
  }, []);

  const selectedLawyer = banca.find(a => a.id === selectedLawyerId);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileLoading(true);
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await extrairTextoDoPDFAction(formData);
      if (res.success) {
        setInputText(res.text || '');
        toast({ title: "Transcrição Concluída" });
      } else {
        toast({ title: "Falha na Leitura", description: res.error, variant: "destructive" });
      }
    } finally {
      setFileLoading(false);
    }
  };

  const handleExtract = async () => {
    if (!inputText || inputText.length < 50) {
      toast({ title: "Dados Insuficientes", variant: "destructive" });
      return;
    }
    if (!selectedLawyerId || !selectedState) {
      toast({ title: "Configuração Pendente", variant: "destructive" });
      return;
    }

    setLoading(true);
    setApiError(null);

    try {
      const res = await extrairDadosProcuracaoAction(inputText, selectedLawyer?.nome || '', selectedState);
      if (res.success) {
        setExtractedData({
          ...res,
          cliente: {
            ...res.cliente,
            email: res.cliente.email || '',
            telefone: res.cliente.telefone || '',
            estadoCivil: res.cliente.estadoCivil || 'casado(a)',
            profissao: res.cliente.profissao || 'autônomo(a)',
            nacionalidade: res.cliente.nacionalidade || 'brasileiro(a)',
          },
          processos: res.processos?.map((p: any) => ({
            ...p,
            cnpjBanco: p.cnpjBanco || '',
            acao: p.acao || 'AÇÃO DE REVISÃO CONTRATUAL COM PEDIDO DE TUTELA DE URGÊNCIA'
          })) || [{ banco: '', cnpjBanco: '', numero: '', acao: 'AÇÃO DE REVISÃO CONTRATUAL COM PEDIDO DE TUTELA DE URGÊNCIA' }],
          local: selectedState,
          dataExtenso: `${selectedState}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`
        });
        setStep(2);
      } else {
        setApiError(res.error || "Falha na triagem neural.");
      }
    } catch (err) {
      setApiError("Erro de comunicação.");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (category: string, field: string, value: string) => {
    setExtractedData((prev: any) => ({
      ...prev,
      [category]: { ...prev[category], [field]: value }
    }));
  };

  const updateProcessField = (index: number, field: string, value: string) => {
    setExtractedData((prev: any) => {
      const newProcessos = [...(prev.processos || [])];
      if (newProcessos[index]) {
        newProcessos[index] = { ...newProcessos[index], [field]: value };
      }
      return { ...prev, processos: newProcessos };
    });
  };

  const handleSeal = async () => {
    if (!selectedLawyer) return;
    setLoading(true);
    try {
      const payload = {
        ...extractedData,
        includeBankInfo,
        includeProcessNumber,
        advogado: {
          nome: selectedLawyer.nome,
          oab: selectedLawyer.oabs[selectedState] || Object.values(selectedLawyer.oabs)[0],
          nacionalidade: selectedLawyer.nacionalidade || (selectedLawyer.genero === 'F' ? 'brasileira' : 'brasileiro'),
          estadoCivil: selectedLawyer.estado_civil || selectedLawyer.estadoCivil || (selectedLawyer.genero === 'F' ? 'casada' : 'casado'),
          endereco: selectedLawyer.endereco,
          email: selectedLawyer.email
        }
      };
      const res = await generateProcuracaoPDFAction(payload);
      if (res.success && res.base64) {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${res.base64}`;
        link.download = `Procuracao_${extractedData.cliente.nome.replace(/\s/g, '_')}.pdf`;
        link.click();
        toast({ title: "Documento Selado" });
      } else {
        toast({ title: "Erro na Selagem", description: res.error, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f3f2f2] font-sans text-black relative z-10 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 border-b border-[#dddbda] bg-white flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-sm bg-black flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <h1 className="font-black text-xl text-black uppercase tracking-tighter">Gerador de Procurações</h1>
          </div>
          <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[10px]">Cloud Repository</Badge>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8 max-w-7xl mx-auto w-full">
          {banca.length === 0 ? (
            <Alert className="border-2 border-black rounded-none shadow-[8px_8px_0px_#000]">
               <Settings className="h-4 w-4" />
               <AlertTitle className="font-black uppercase text-xs">Atenção Gabinete</AlertTitle>
               <AlertDescription className="text-[10px] font-bold uppercase space-y-4">
                  <p>Nenhum advogado cadastrado para geração de peças.</p>
                  <Button asChild className="bg-black text-white rounded-none h-10 font-black uppercase text-[9px]">
                     <Link href="/settings">Configurar Banca Agora</Link>
                  </Button>
               </AlertDescription>
            </Alert>
          ) : step === 1 && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {apiError && (
                <Alert variant="destructive" className="border-2 border-red-600 rounded-none shadow-[8px_8px_0px_#000]">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="font-black uppercase text-xs">Erro de Triagem</AlertTitle>
                  <AlertDescription className="text-[10px] font-bold uppercase">{apiError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <Card className="bg-white border-2 border-black rounded-none shadow-[8px_8px_0px_#000]">
                    <CardHeader className="bg-black text-white py-3">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest">1. Configuração de Gabinete</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="uppercase text-[10px] font-black">Advogado Responsável</Label>
                          <Select value={selectedLawyerId} onValueChange={(val) => {
                             setSelectedLawyerId(val);
                             const adv = banca.find(a => a.id === val);
                             if (adv) setSelectedState(Object.keys(adv.oabs || {})[0] || 'SP');
                          }}>
                            <SelectTrigger className="w-full border-2 border-black h-12 font-black uppercase text-[11px] rounded-none bg-white">
                              <SelectValue placeholder="SELECIONE..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-2 border-black rounded-none">
                              {banca.map((adv) => (
                                <SelectItem key={adv.id} value={adv.id} className="font-black uppercase text-[10px]">{adv.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="uppercase text-[10px] font-black">UF de Atuação (OAB)</Label>
                          <Select value={selectedState} onValueChange={setSelectedState}>
                            <SelectTrigger className="w-full border-2 border-black h-12 font-black uppercase text-[11px] rounded-none bg-white">
                              <SelectValue placeholder="UF..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-2 border-black rounded-none">
                              {selectedLawyer && Object.keys(selectedLawyer.oabs || {}).map((uf) => (
                                <SelectItem key={uf} value={uf} className="font-black uppercase text-[10px]">{uf}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-2 border-black rounded-none shadow-[8px_8px_0px_#000]">
                    <CardContent className="p-6 space-y-4">
                      <Label className="uppercase text-[10px] font-black">2. Conteúdo do PDF ou Texto</Label>
                      <Textarea 
                        placeholder="COLE O CONTRATO OU QUALQUER DOCUMENTO AQUI..."
                        className="min-h-[300px] border-2 border-black font-black uppercase text-[11px] rounded-none resize-none bg-white"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                      />
                      <Button onClick={handleExtract} disabled={loading} className="w-full h-14 bg-black text-white font-black uppercase text-xs rounded-none border-2 border-black shadow-[6px_6px_0px_#22c55e]">
                        {loading ? <Loader2 className="animate-spin mr-2" /> : <Zap size={16} className="mr-2" />} Iniciar Triagem Neural
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card className="bg-white border-2 border-black rounded-none shadow-[8px_8px_0px_#000]">
                    <CardHeader className="bg-[#f8f9fb] border-b-2 border-black py-3">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Upload size={14} /> Importar PDF</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-black/20 p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-black group transition-all">
                        {fileLoading ? <Loader2 className="animate-spin text-black" size={32} /> : <FileUp size={48} className="text-black/20 group-hover:text-white mb-4" />}
                        <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {step === 2 && extractedData && (
            <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
              <div className="flex items-center justify-between border-b-2 border-black pb-4">
                <div className="flex items-center gap-3">
                  <Edit3 size={20} />
                  <h2 className="text-xl font-black uppercase tracking-tight text-black">Revisão de Dados Auditados</h2>
                </div>
                <Button variant="ghost" onClick={() => setStep(1)} className="font-black uppercase text-[10px] border-2 border-black rounded-none">Voltar ao Upload</Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="bg-white border-2 border-black rounded-none shadow-[6px_6px_0px_#000]">
                  <CardHeader className="bg-[#f8f9fb] border-b-2 border-black py-3">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><User size={14} /> Dados do Outorgante</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid gap-1"><Label className="text-[9px] font-black uppercase">Nome Completo</Label><Input value={extractedData.cliente.nome} onChange={(e) => updateField('cliente', 'nome', e.target.value)} className="border-black font-black uppercase rounded-none" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-1"><Label className="text-[9px] font-black uppercase">CPF</Label><Input value={extractedData.cliente.cpf} onChange={(e) => updateField('cliente', 'cpf', e.target.value)} className="border-black font-black uppercase rounded-none" /></div>
                      <div className="grid gap-1"><Label className="text-[9px] font-black uppercase">RG</Label><Input value={extractedData.cliente.rg} onChange={(e) => updateField('cliente', 'rg', e.target.value)} className="border-black font-black rounded-none" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-1"><Label className="text-[9px] font-black uppercase">E-mail</Label><Input value={extractedData.cliente.email} onChange={(e) => updateField('cliente', 'email', e.target.value)} className="border-black font-bold lowercase rounded-none" /></div>
                      <div className="grid gap-1"><Label className="text-[9px] font-black uppercase">Telefone</Label><Input value={extractedData.cliente.telefone} onChange={(e) => updateField('cliente', 'telefone', e.target.value)} className="border-black font-bold rounded-none" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-1"><Label className="text-[9px] font-black uppercase">Estado Civil</Label><Input value={extractedData.cliente.estadoCivil} onChange={(e) => updateField('cliente', 'estadoCivil', e.target.value)} className="border-black font-bold uppercase rounded-none" /></div>
                      <div className="grid gap-1"><Label className="text-[9px] font-black uppercase">Nacionalidade</Label><Input value={extractedData.cliente.nacionalidade} onChange={(e) => updateField('cliente', 'nacionalidade', e.target.value)} className="border-black font-bold uppercase rounded-none" /></div>
                    </div>
                    <div className="grid gap-1"><Label className="text-[9px] font-black uppercase"><Briefcase size={10} className="inline mr-1"/> Profissão</Label><Input value={extractedData.cliente.profissao} onChange={(e) => updateField('cliente', 'profissao', e.target.value)} className="border-black font-bold uppercase rounded-none" /></div>
                    <div className="grid gap-1"><Label className="text-[9px] font-black uppercase flex items-center gap-1.5"><MapPin size={10} /> Endereço Residencial</Label><Input value={extractedData.cliente.endereco} onChange={(e) => updateField('cliente', 'endereco', e.target.value)} className="border-black font-black uppercase rounded-none" /></div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="bg-white border-2 border-black rounded-none shadow-[6px_6px_0px_#000]">
                    <CardHeader className="bg-[#f8f9fb] border-b-2 border-black py-3 flex flex-row items-center justify-between">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Building2 size={14} /> Dados do Processo</CardTitle>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2"><Switch checked={includeBankInfo} onCheckedChange={setIncludeBankInfo} id="inc-bank" /><Label htmlFor="inc-bank" className="text-[8px] font-black uppercase">Banco</Label></div>
                        <div className="flex items-center gap-2"><Switch checked={includeProcessNumber} onCheckedChange={setIncludeProcessNumber} id="inc-proc" /><Label htmlFor="inc-proc" className="text-[8px] font-black uppercase">Processo</Label></div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className={cn("grid gap-4", !includeBankInfo && "opacity-20 pointer-events-none")}>
                          <div className="grid gap-1">
                            <Label className="text-[9px] font-black uppercase">Instituição Financeira (Réu)</Label>
                            <Input value={extractedData.processos?.[0]?.banco || "BANCO"} onChange={(e) => updateProcessField(0, 'banco', e.target.value)} className="border-black font-black uppercase rounded-none bg-white" />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-[9px] font-black uppercase">CNPJ da Instituição</Label>
                            <Input value={extractedData.processos?.[0]?.cnpjBanco || ""} onChange={(e) => updateProcessField(0, 'cnpjBanco', e.target.value)} className="border-black font-mono rounded-none bg-white" placeholder="00.000.000/0000-00" />
                          </div>
                        </div>
                        
                        <div className={cn("grid gap-1", !includeProcessNumber && "opacity-20 pointer-events-none")}>
                          <Label className="text-[9px] font-black uppercase">Processo (CNJ)</Label>
                          <Input value={extractedData.processos?.[0]?.numero || ""} onChange={(e) => updateProcessField(0, 'numero', e.target.value)} className="border-black font-black uppercase rounded-none bg-white font-mono" />
                        </div>

                        <div className="grid gap-1">
                          <Label className="text-[9px] font-black uppercase">Tipo de Ação (Para Cláusula de Poderes)</Label>
                          <Textarea value={extractedData.processos?.[0]?.acao || ""} onChange={(e) => updateProcessField(0, 'acao', e.target.value)} className="border-black font-bold uppercase rounded-none bg-white text-[10px] min-h-[80px]" />
                        </div>

                        <div className="grid gap-1">
                          <Label className="text-[9px] font-black uppercase">Data por Extenso</Label>
                          <Input value={extractedData.dataExtenso} onChange={(e) => setExtractedData({...extractedData, dataExtenso: e.target.value})} className="border-black font-bold uppercase rounded-none bg-white" />
                        </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card className="bg-white border-2 border-black rounded-none shadow-[8px_8px_0px_#000] overflow-hidden">
                <CardHeader className="bg-[#f8f9fb] border-b-2 border-black py-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Eye size={14} /> Preview Visual</CardTitle>
                </CardHeader>
                <CardContent className="p-10 text-black font-serif text-[11pt] leading-relaxed bg-white space-y-6">
                  <h3 className="text-center font-bold uppercase underline">PROCURAÇÃO "AD JUDICIA"</h3>
                  <p className="text-justify indent-10"><strong>{extractedData.cliente.nome.toUpperCase()}</strong>, {extractedData.cliente.nacionalidade}, {extractedData.cliente.estadoCivil}, {extractedData.cliente.profissao}, portador do RG sob Nº {extractedData.cliente.rg} e CPF sob Nº {extractedData.cliente.cpf}, residente em {extractedData.cliente.endereco}, nomeia como seu procurador <strong>{selectedLawyer?.nome.toUpperCase()}</strong>, {selectedLawyer?.nacionalidade || 'brasileiro'}, {selectedLawyer?.estado_civil || 'casado'}, OAB/{selectedState} {selectedLawyer?.oabs[selectedState]}, com endereço profissional em {selectedLawyer?.endereco}.</p>
                </CardContent>
              </Card>

              <Button onClick={handleSeal} disabled={loading} className="w-full h-14 bg-black text-white font-black uppercase text-xs rounded-none border-2 border-black hover:bg-white hover:text-black transition-all shadow-[6px_6px_0px_#22c55e]">
                {loading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 size={16} className="mr-2" />} Selar & Exportar PDF
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
