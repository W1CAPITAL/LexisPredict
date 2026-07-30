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
  Repeat, 
  Eye,
  Fingerprint,
  Hash,
  Settings,
  Briefcase,
  Mail,
  Phone,
  Scale
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
  SelectValue 
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { extrairTextoDoPDFAction, extrairDadosProcuracaoAction, generateSubstabelecimentoPDFAction } from '@/app/actions/document-actions';
import { listAdvogadosBanca } from '@/lib/server-db';
import Link from 'next/link';

export default function SubstabelecimentoGenerator() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [banca, setBanca] = useState<any[]>([]);
  const [advLeavingId, setAdvLeavingId] = useState('');
  const [advEnteringId, setAdvEnteringId] = useState('');
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
        setAdvLeavingId(data[0].id);
        setAdvEnteringId(data[0].id);
        setSelectedState(Object.keys(data[0].oabs || {})[0] || 'SP');
      }
    }
    load();
  }, []);

  const advLeaving = banca.find(a => a.id === advLeavingId);
  const advEntering = banca.find(a => a.id === advEnteringId);

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
    if (!inputText || !advLeaving || !advEntering) {
      toast({ title: "Configuração incompleta", variant: "destructive" });
      return;
    }
    setLoading(true);
    setApiError(null);
    try {
      const res = await extrairDadosProcuracaoAction(inputText, advEntering.nome, selectedState);
      if (res.success) {
        const data = res as any;
        setExtractedData({
          cliente: {
            nome: data.cliente?.nome || "CLIENTE",
            cpf: data.cliente?.cpf || "",
            rg: data.cliente?.rg || "",
            endereco: data.cliente?.endereco || "",
            email: data.cliente?.email || "",
            telefone: data.cliente?.telefone || ""
          },
          processo: {
            banco: data.processos?.[0]?.banco || "INSTITUIÇÃO FINANCEIRA",
            cnpjBanco: data.processos?.[0]?.cnpjBanco || "",
            numero: data.processos?.[0]?.numero || "S/N",
            acao: data.processos?.[0]?.acao || "AÇÃO DE REVISÃO CONTRATUAL COM PEDIDO DE TUTELA DE URGÊNCIA"
          },
          substabelecente: {
            nome: advLeaving.nome,
            genero: advLeaving.genero || 'M',
            nacionalidade: advLeaving.nacionalidade || 'brasileiro',
            estadoCivil: advLeaving.estado_civil || advLeaving.estadoCivil || (advLeaving.genero === 'F' ? 'casada' : 'casado'),
            oabCompleta: `OAB/${selectedState} sob o n.º ${advLeaving.oabs[selectedState] || ''}`,
            oabCurta: `OAB/${selectedState} ${advLeaving.oabs[selectedState] || ''}`
          },
          substabelecido: {
            nome: advEntering.nome,
            genero: advEntering.genero || 'M',
            nacionalidade: advEntering.nacionalidade || 'brasileiro',
            estadoCivil: advEntering.estado_civil || advEntering.estadoCivil || (advEntering.genero === 'F' ? 'casada' : 'casado'),
            oabCompleta: `OAB/${selectedState} sob o n.º ${advEntering.oabs[selectedState] || ''}`,
            oabCurta: `OAB/${selectedState} ${advEntering.oabs[selectedState] || ''}`
          },
          comarca: selectedState === 'SP' ? 'São Paulo' : 'Comarca Local',
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

  const handleSeal = async () => {
    if (!extractedData) return;
    setLoading(true);
    try {
      const res = await generateSubstabelecimentoPDFAction({ 
        ...extractedData, 
        includeBankInfo, 
        includeProcessNumber 
      });
      if (res.success && res.base64) {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${res.base64}`;
        link.download = `Substabelecimento_${extractedData.cliente.nome.replace(/\s/g, '_')}.pdf`;
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
            <div className="w-10 h-10 rounded-sm bg-primary flex items-center justify-center">
              <Repeat size={20} className="text-white" />
            </div>
            <h1 className="font-black text-xl text-black uppercase tracking-tighter">Substabelecimento</h1>
          </div>
          <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[10px]">Cloud Repository</Badge>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8 max-w-7xl mx-auto w-full">
          {banca.length === 0 ? (
            <Alert className="border-2 border-black rounded-none shadow-[8px_8px_0px_#000]">
               <Settings className="h-4 w-4" />
               <AlertTitle className="font-black uppercase text-xs">Configuração Requerida</AlertTitle>
               <AlertDescription className="text-[10px] font-bold uppercase space-y-4">
                  <p>Cadastre os advogados da sua banca em Configurações para habilitar este módulo.</p>
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
                          <Label className="uppercase text-[10px] font-black">Advogado Cedente (Sai)</Label>
                          <Select value={advLeavingId} onValueChange={setAdvLeavingId}>
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
                          <Label className="uppercase text-[10px] font-black">Advogado Substabelecido (Entra)</Label>
                          <Select value={advEnteringId} onValueChange={setAdvEnteringId}>
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
                      </div>
                      <div className="space-y-2">
                        <Label className="uppercase text-[10px] font-black">UF de Atuação (OAB)</Label>
                        <Select value={selectedState} onValueChange={setSelectedState}>
                          <SelectTrigger className="w-full border-2 border-black h-12 font-black uppercase text-[11px] rounded-none bg-white">
                            <SelectValue placeholder="UF..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-2 border-black rounded-none">
                            {advEntering && Object.keys(advEntering.oabs || {}).map((uf) => (
                              <SelectItem key={uf} value={uf} className="font-black uppercase text-[10px]">{uf}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-2 border-black rounded-none shadow-[8px_8px_0px_#000]">
                    <CardContent className="p-6 space-y-4">
                      <Label className="uppercase text-[10px] font-black">2. Texto do Documento Antigo</Label>
                      <Textarea 
                        placeholder="COLE O CONTRATO OU PROCURAÇÃO ANTIGA AQUI..."
                        className="min-h-[300px] border-2 border-black font-black uppercase text-[11px] rounded-none resize-none bg-white"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                      />
                      <Button onClick={handleExtract} disabled={loading} className="w-full h-14 bg-black text-white font-black uppercase text-xs rounded-none border-2 border-black shadow-[6px_6px_0px_#22c55e]">
                        {loading ? <Loader2 className="animate-spin mr-2" /> : <Repeat size={16} className="mr-2" />} Gerar Draft do Substabelecimento
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
                        <p className="text-[10px] font-black uppercase text-black/40 group-hover:text-white/40">Selecione o arquivo original</p>
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
                  <h2 className="text-xl font-black uppercase tracking-tight text-black">Revisão do Substabelecimento</h2>
                </div>
                <Button variant="ghost" onClick={() => setStep(1)} className="font-black uppercase text-[10px] border-2 border-black rounded-none h-10 px-4">Voltar</Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="bg-white border-2 border-black rounded-none shadow-[6px_6px_0px_#000]">
                  <CardHeader className="bg-[#f8f9fb] border-b-2 border-black py-3">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><User size={14} /> Dados do Cliente</CardTitle>
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
                            <Label className="text-[9px] font-black uppercase">Instituição Financeira</Label>
                            <Input value={extractedData.processo.banco} onChange={(e) => updateField('processo', 'banco', e.target.value)} className="border-black font-black uppercase rounded-none bg-white" />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-[9px] font-black uppercase">CNPJ da Instituição</Label>
                            <Input value={extractedData.processo.cnpjBanco} onChange={(e) => updateField('processo', 'cnpjBanco', e.target.value)} className="border-black font-mono rounded-none bg-white" />
                          </div>
                        </div>
                        
                        <div className={cn("grid gap-1", !includeProcessNumber && "opacity-20 pointer-events-none")}>
                          <Label className="text-[9px] font-black uppercase">Processo (CNJ)</Label>
                          <Input value={extractedData.processo.numero} onChange={(e) => updateField('processo', 'numero', e.target.value)} className="border-black font-black uppercase rounded-none bg-white font-mono" />
                        </div>

                        <div className="grid gap-1">
                          <Label className="text-[9px] font-black uppercase">Tipo de Ação</Label>
                          <Textarea value={extractedData.processo.acao} onChange={(e) => updateField('processo', 'acao', e.target.value)} className="border-black font-bold uppercase rounded-none bg-white text-[10px] min-h-[60px]" />
                        </div>

                        <div className="grid gap-1">
                          <Label className="text-[9px] font-black uppercase">Local e Data</Label>
                          <Input value={extractedData.dataExtenso} onChange={(e) => setExtractedData({...extractedData, dataExtenso: e.target.value})} className="border-black font-bold uppercase rounded-none bg-white" />
                        </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card className="bg-white border-2 border-black rounded-none shadow-[8px_8px_0px_#000] overflow-hidden">
                <CardHeader className="bg-black text-white py-3">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Eye size={14} /> Preview Técnico</CardTitle>
                </CardHeader>
                <CardContent className="p-10 text-black font-serif text-[11pt] leading-relaxed bg-white space-y-6">
                  <h3 className="text-center font-bold uppercase underline">SUBSTABELECIMENTO</h3>
                  <p className="text-center font-bold">(sem reserva de poderes)</p>
                  <p className="text-justify indent-10">O <strong>{extractedData.substabelecente.nome.toUpperCase()}</strong>, {extractedData.substabelecente.nacionalidade}, {extractedData.substabelecente.estadoCivil}, advogado, inscrito na {extractedData.substabelecente.oabCompleta}, <strong>SUBSTABELECE SEM RESERVA DE PODERES</strong> na pessoa do {extractedData.substabelecido.nome.toUpperCase()}, {extractedData.substabelecido.nacionalidade}, {extractedData.substabelecido.estadoCivil}, inscrito na {extractedData.substabelecido.oabCompleta}, os poderes conferidos por {extractedData.cliente.nome.toUpperCase()}, para a promoção de {extractedData.processo.acao.toUpperCase()} {includeBankInfo ? `contra o ${extractedData.processo.banco.toUpperCase()}` : ""} {includeProcessNumber ? `, processo nº ${extractedData.processo.numero}` : ""}...</p>
                </CardContent>
              </Card>

              <Button onClick={handleSeal} disabled={loading} className="w-full h-14 bg-black text-white font-black uppercase text-xs rounded-none border-2 border-black hover:bg-white hover:text-black transition-all shadow-[6px_6px_0px_#22c55e]">
                {loading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 size={16} className="mr-2" />} Selar & Exportar Substabelecimento
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
