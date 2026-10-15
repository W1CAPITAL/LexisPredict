"use client";
import { DocumentsCarteiraPicker } from "@/components/documents/documents-carteira-picker";
import type { DocumentCase } from "@/app/actions/document-case-actions";
import { clientAsParte } from "@/lib/documents/document-case-prefill";

import { downloadGeneratedPdf } from "@/lib/documents/download-generated-pdf";

import { EditablePartesPanel } from "@/components/documents/editable-partes-panel";
import { usePartesEditaveis } from "@/hooks/use-partes-editaveis";

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */

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
import { listDocumentLawyersFast } from "@/lib/documents/fast-banca-client";
import Link from 'next/link';

function oathFromRegistration(adv: any, requestedUf: string) {
  const oabs = adv?.oabs || {};
  const uf = oabs[requestedUf] ? requestedUf : (oabs.SP ? "SP" : Object.keys(oabs)[0]);
  const raw = String(uf ? oabs[uf] || "" : "").trim();
  return { uf:uf || "",raw,label:raw ? "OAB/"+uf+" "+raw : "" };
}

export default function SubstabelecimentoGenerator() {
  const partes = usePartesEditaveis();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [manualClient, setManualClient] = useState('');
  const [carteiraCase, setCarteiraCase] = useState<DocumentCase | null>(null);
  const [manualCnj, setManualCnj] = useState('');
  const [manualAcao, setManualAcao] = useState('');
  const [manualBanco, setManualBanco] = useState('');
  const [manualComarca, setManualComarca] = useState('');
  const [bancaLoading, setBancaLoading] = useState(true);
  const [bancaError, setBancaError] = useState('');
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

  const loadBanca = async () => {
    setBancaLoading(true);
    setBancaError('');
    try {
      const data = await listDocumentLawyersFast();
      setBanca(Array.isArray(data) ? data : []);
      if (data?.length) {
        setAdvLeavingId(prev => data.some((adv: any) => adv.id === prev) ? prev : data[0].id);
        setAdvEnteringId(prev => data.some((adv: any) => adv.id === prev && adv.id !== data[0].id)
          ? prev : (data[1]?.id || ''));
        const enter = data[1] || data[0];
        const ufs = Object.keys(enter.oabs || {});
        setSelectedState(ufs.includes('SP') ? 'SP' : (ufs[0] || 'SP'));
      } else {
        setBancaError('A banca não retornou dados para este usuário. Verifique a autenticação e a empresa vinculada.');
      }
    } catch (error) {
      setBanca([]);
      setBancaError('Falha ao consultar banca; renove o login e tente novamente.');
      console.error('[substabelecimento] Falha ao buscar banca', error);
    } finally {
      setBancaLoading(false);
    }
  };
  useEffect(() => { void loadBanca(); }, []);

  const advLeaving = banca.find(a => a.id === advLeavingId);
  const advEntering = banca.find(a => a.id === advEnteringId);

  const handleManualReview = () => {
    if (!advLeaving || !advEntering || advLeaving.id === advEntering.id) {
      toast({ title: 'Selecione dois advogados distintos', variant: 'destructive' });
      return;
    }
    if (!manualClient.trim() || !manualAcao.trim() || !manualComarca.trim()) {
      toast({ title: 'Preencha cliente, tipo de ação e comarca', variant: 'destructive' });
      return;
    }
    if (manualCnj.trim() && manualCnj.replace(/\D/g, '').length !== 20) {
      toast({ title: 'Número CNJ inválido: informe 20 dígitos', variant: 'destructive' });
      return;
    }
    const registeredOab = (lawyer: any, preferred: string) => {
      const map = lawyer?.oabs || {};
      const uf = map[preferred] ? preferred : (map.SP ? 'SP' : Object.keys(map)[0]);
      const number = String(map[uf] || '').trim();
      return { uf, number, completa: number ? 'OAB/' + uf + ' n.º ' + number : '' };
    };
    const leavingOab = registeredOab(advLeaving, selectedState);
    const enteringOab = registeredOab(advEntering, selectedState);
    if (!leavingOab.number || !enteringOab.number) {
      toast({ title: 'Inscrição OAB ausente no cadastro', variant: 'destructive' });
      return;
    }
    setApiError(null);
    setIncludeBankInfo(Boolean(manualBanco.trim()));
    setIncludeProcessNumber(Boolean(manualCnj.trim()));
    setExtractedData({
      cliente: {
        nome: manualClient.trim(), cpf: '', rg: '', endereco: '', email: '', telefone: '',
      },
      processo: {
        banco: manualBanco.trim(), cnpjBanco: '', numero: manualCnj.trim(), acao: manualAcao.trim(),
      },
      substabelecente: {
        nome: advLeaving.nome, genero: advLeaving.genero || 'M',
        nacionalidade: advLeaving.nacionalidade || '', estadoCivil: advLeaving.estado_civil || '',
        oabCompleta: leavingOab.completa, oabCurta: leavingOab.completa,
      },
      substabelecido: {
        nome: advEntering.nome, genero: advEntering.genero || 'M',
        nacionalidade: advEntering.nacionalidade || '', estadoCivil: advEntering.estado_civil || '',
        oabCompleta: enteringOab.completa, oabCurta: enteringOab.completa,
      },
      comarca: manualComarca.trim(),
      dataExtenso: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
    });
    setStep(2);
  };

  useEffect(() => {
    if (!carteiraCase || !advLeaving || !advEntering || advLeaving.id === advEntering.id) return;
    const oldOab=oathFromRegistration(advLeaving,selectedState);
    const nextOab=oathFromRegistration(advEntering,selectedState);
    if (!oldOab.raw || !nextOab.raw) return;
    setExtractedData({
      cliente: {
        nome:carteiraCase.cliente,cpf:carteiraCase.cpf,rg:carteiraCase.rg,
        endereco:carteiraCase.endereco,email:carteiraCase.email,telefone:carteiraCase.telefone,
        nacionalidade:carteiraCase.nacionalidade,estadoCivil:carteiraCase.estadoCivil,profissao:carteiraCase.profissao,
      },
      processo: {
        numero:carteiraCase.cnj,banco:carteiraCase.banco,cnpjBanco:carteiraCase.cnpjBanco,acao:carteiraCase.classeAcao,
      },
      substabelecente:{
        nome:advLeaving.nome,genero:advLeaving.genero||"M",nacionalidade:advLeaving.nacionalidade||"",
        estadoCivil:advLeaving.estado_civil||"",oabCompleta:oldOab.label,oabCurta:oldOab.label,
      },
      substabelecido:{
        nome:advEntering.nome,genero:advEntering.genero||"M",nacionalidade:advEntering.nacionalidade||"",
        estadoCivil:advEntering.estado_civil||"",oabCompleta:nextOab.label,oabCurta:nextOab.label,
      },
      comarca:carteiraCase.comarca,
      dataExtenso:new Date().toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"}),
    });
    setIncludeBankInfo(Boolean(carteiraCase.banco));
    setIncludeProcessNumber(Boolean(carteiraCase.cnj));
    setStep(2);
  }, [carteiraCase, advLeavingId, advEnteringId, selectedState, banca]);

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
            nacionalidade: advLeaving.nacionalidade || '',
            estadoCivil: advLeaving.estado_civil || advLeaving.estadoCivil || '',
            oabCompleta: `OAB/${selectedState} sob o n.º ${advLeaving.oabs[selectedState] || ''}`,
            oabCurta: `OAB/${selectedState} ${advLeaving.oabs[selectedState] || ''}`
          },
          substabelecido: {
            nome: advEntering.nome,
            genero: advEntering.genero || 'M',
            nacionalidade: advEntering.nacionalidade || '',
            estadoCivil: advEntering.estado_civil || advEntering.estadoCivil || '',
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
    if (!extractedData.cliente?.nome?.trim() || !extractedData.substabelecente?.oabCompleta || !extractedData.substabelecido?.oabCompleta) {
      toast({ title: 'Confira cliente e OABs antes da geração', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await generateSubstabelecimentoPDFAction({ 
        ...extractedData, 
        includeBankInfo, 
        includeProcessNumber 
      });
      if (res.success && res.base64) {
        downloadGeneratedPdf(res.base64, `Substabelecimento_${extractedData.cliente.nome.replace(/\s/g, '_')}.pdf`);
        toast({ title: "Documento Selado" });
      } else {
        toast({ title: "Erro na Selagem", description: res.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: 'Falha ao gerar ou baixar o PDF', description: error instanceof Error ? error.message : 'Erro inesperado', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f3f2f2] font-sans text-black relative z-10 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <DocumentsCarteiraPicker onSelected={(item: DocumentCase) => {
          setCarteiraCase(item);
          setManualClient(item.cliente);
          setManualCnj(item.cnj);
          setManualAcao(item.classeAcao);
          setManualBanco(item.banco);
          setManualComarca(item.comarca);
          partes.setCliente(clientAsParte(item));
        }} />
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
          {banca.length === 0 && (
            <Alert className="border-l-4 border-amber-500 bg-white p-3 text-xs">
               <Settings className="h-4 w-4" />
               <AlertTitle className="font-black uppercase text-xs">Configuração Requerida</AlertTitle>
               <AlertDescription className="text-[10px] font-bold uppercase space-y-4">
                  <p>{bancaLoading ? 'Consultando os advogados cadastrados...' : (bancaError || 'Nenhum advogado acessível na sessão atual. Não recadastre antes de verificar seu login.')}</p>
                  <Button metal={false} onClick={() => void loadBanca()} disabled={bancaLoading} className="bg-black text-white rounded-none h-10 font-black uppercase text-[9px]">Recarregar banca</Button>
                  <span className="text-xs normal-case font-medium">Você pode preencher cliente e processo enquanto os advogados carregam.</span>
               </AlertDescription>
            </Alert>
          )}
          {step === 1 && (
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
                      <div className="rounded border-2 border-[#6f1d2b] bg-[#fffaf0] p-4 space-y-3">
                        <p className="text-xs font-black text-[#6f1d2b]">Gerar substabelecimento agora — sem IA</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1"><Label>Cliente / outorgante *</Label><Input value={manualClient} onChange={e => setManualClient(e.target.value)} placeholder="Nome completo" /></div>
                          <div className="space-y-1"><Label>Número CNJ (se houver)</Label><Input value={manualCnj} onChange={e => setManualCnj(e.target.value)} placeholder="0000000-00.0000.0.00.0000" /></div>
                          <div className="space-y-1"><Label>Tipo da ação / poderes *</Label><Input value={manualAcao} onChange={e => setManualAcao(e.target.value)} placeholder="Confirme o objeto real" /></div>
                          <div className="space-y-1"><Label>Comarca / cidade *</Label><Input value={manualComarca} onChange={e => setManualComarca(e.target.value)} placeholder="Cidade correta" /></div>
                          <div className="space-y-1 sm:col-span-2"><Label>Instituição financeira (opcional)</Label><Input value={manualBanco} onChange={e => setManualBanco(e.target.value)} placeholder="Preencher somente se pertinente" /></div>
                        </div>
                        <Button metal={false} onClick={handleManualReview} disabled={banca.length < 2} className="w-full bg-[#6f1d2b] text-white">Revisar documento sem IA e gerar PDF</Button>
                        <p className="text-xs">Os dois advogados e suas respectivas inscrições são carregados do cadastro. Confira o mandato original, as OABs e a ciência prévia do cliente para substabelecimento sem reserva.</p>
                      </div>
                      <Label className="uppercase text-[10px] font-black">2. Importar documento antigo (opcional)</Label>
                      <Textarea 
                        placeholder="COLE O CONTRATO OU PROCURAÇÃO ANTIGA AQUI..."
                        className="min-h-[300px] border-2 border-black font-black uppercase text-[11px] rounded-none resize-none bg-white"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                      />
                      <Button metal={false} onClick={handleExtract} disabled={loading} className="w-full h-14 bg-black text-white font-black uppercase text-xs rounded-none border-2 border-black shadow-[6px_6px_0px_#22c55e]">
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

          
          {step === 1 && (
            <div className="max-w-5xl mx-auto mt-6 mb-4">
              <div className="bg-white border-2 border-black rounded-none shadow-[6px_6px_0px_#000] p-4">
                <p className="text-[10px] font-black uppercase tracking-widest mb-2">Partes 100% editáveis (antes da revisão)</p>
                <p className="text-[10px] text-muted-foreground mb-3">Selecione a banca ou preencha — tudo editável.</p>
                <EditablePartesPanel
            banca={partes.banca}
            setBanca={partes.setBanca}
            advogados={partes.advogados}
            setAdvogados={partes.setAdvogados}
            cliente={partes.cliente}
            setCliente={partes.setCliente}
          />
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
                <Button metal={false} variant="ghost" onClick={() => setStep(1)} className="font-black uppercase text-[10px] border-2 border-black rounded-none h-10 px-4">Voltar</Button>
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

              <Button metal={false} onClick={handleSeal} disabled={loading} className="w-full h-14 bg-black text-white font-black uppercase text-xs rounded-none border-2 border-black hover:bg-white hover:text-black transition-all shadow-[6px_6px_0px_#22c55e]">
                {loading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 size={16} className="mr-2" />} Selar & Exportar Substabelecimento
              </Button>
            </div>
          )}
        </div>
      
        <div className="max-w-4xl mx-auto w-full px-4 py-4">
</div>

      </main>
    </div>
  );
}
