/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  FileSearch, 
  History, 
  FileText, 
  Search, 
  Copyright, 
  Send, 
  Bot, 
  Clock, 
  Copy, 
  MessageCircle, 
  Zap, 
  Loader2, 
  AlertCircle,
  Gavel,
  ShieldCheck,
  Target,
  Cpu,
  Info,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { executarVereditoAI } from '@/ai/flows/veredito-ai-flow';
import { perguntarIA } from '@/ai/flows/chat-ai-flow';
import { sendWhatsAppAction } from '@/app/actions/whatsapp-actions';
import { fetchRepoCases, scanSingleCaseAction, searchProcessesByCpfAction, searchProcessesByNomeAction } from '@/app/actions/case-actions';
import { searchDataJudByNome, searchDataJudByCpf, fetchDataJud } from '@/lib/datajud';
import { cn, formatWhatsAppLink } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChanceEncerramentoCard } from '@/components/dashboard/chance-encerramento-card';
import { analisarChanceEncerramento } from '@/lib/chance-encerramento-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';

export default function VereditoPage() {
  const [cnj, setCnj] = useState('');
  const [searchMode, setSearchMode] = useState<'cnj' | 'cpf' | 'nome'>('cnj');
  const [cpfQuery, setCpfQuery] = useState('');
  const [nomeQuery, setNomeQuery] = useState('');
  const [listaResultados, setListaResultados] = useState<any[]>([]);
  const [filtroBA, setFiltroBA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [model, setModel] = useState<string>('xai');
  const [apiError, setApiError] = useState<{ engine: string, message: string } | null>(null);
  const [sendingApi, setSendingApi] = useState(false);
  const [repoCases, setRepoCases] = useState<any[]>([]);
  const isMounted = useRef(false);
  
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  useEffect(() => {
    isMounted.current = true;
    const savedIA = localStorage.getItem('lexisPredict_preferred_ia') || 'xai';
    setModel(savedIA === 'airforce' ? 'xai' : savedIA);
    
    fetchRepoCases().then(data => {
      if (isMounted.current) setRepoCases(data || []);
    });

    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const abrirProcesso = async (numero: string) => {
    setCnj(numero);
    setListaResultados([]);
    setLoading(true);
    setResult(null);
    setChatMessages([]);
    setApiError(null);
    try {
      const data = await executarVereditoAI({ cnj: numero, preferredModel: model });
      if (isMounted.current) {
        if (!data.success && !data.dataJudRaw) {
           setApiError({ engine: model, message: data.message || "CNJ não localizado." });
           toast({ title: "Falha na Triagem", description: data.message, variant: "destructive" });
        } else {
           setResult(data);
           toast({ title: data.isDeterministic ? "Parecer local (DataJud)" : "Auditoria 3D Concluída" });
        }
      }
    } catch {
      if (isMounted.current) {
        setApiError({ engine: model, message: "Instabilidade no motor." });
        toast({ title: "Erro Crítico", variant: "destructive" });
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;

    setLoading(true);
    setResult(null);
    setChatMessages([]);
    setApiError(null);
    setListaResultados([]);

    try {
      // --- MODO CPF: carteira local + aviso DataJud ---
      if (searchMode === 'cpf') {
        const digits = cpfQuery.replace(/\D/g, '');
        if (digits.length < 11) {
          toast({ title: 'CPF/CNPJ inválido', description: 'Informe ao menos 11 dígitos.', variant: 'destructive' });
          setLoading(false);
          return;
        }

        // 1) Carteira local (match em campos textuais)
        const locais = (repoCases || []).filter((c: any) => {
          const blob = `${c.observacao || ''} ${c.cliente || ''} ${c.telefone || ''} ${c.protocolo || ''}`;
          return blob.replace(/\D/g, '').includes(digits);
        });

        // 2) DataJud multi-tribunal por documento (CPF/CNPJ) — skill produção
        const remoto = await searchProcessesByCpfAction(digits, filtroBA);
        const remotos = remoto.items || [];

        // 3) Se vazio e há nomes na carteira, fallback por nome
        if (remotos.length === 0 && locais.length > 0) {
          for (const nome of Array.from(new Set(locais.map((c: any) => c.cliente).filter(Boolean))).slice(0, 3)) {
            const r = await searchProcessesByNomeAction(String(nome));
            if (r.success) remotos.push(...(r.items || []));
          }
        }

        const merged = [
          ...locais.map((c: any) => ({
            origem: 'carteira',
            numeroProcesso: c.protocolo,
            classe: c.situacao || c.status || c.evento_tipo,
            poloAtivo: [c.cliente].filter(Boolean),
            poloPassivo: [],
            tribunal: c.tribunal,
            grau: null,
            isBuscaApreensao: false,
          })),
          ...remotos.map((r: any) => ({ ...r, origem: r.origem || 'datajud' })),
        ];

        // Dedup por número
        const seen = new Set<string>();
        let finalList = merged.filter((x) => {
          const n = String(x.numeroProcesso || '').replace(/\D/g, '');
          if (!n || seen.has(n)) return false;
          seen.add(n);
          return true;
        });

        if (filtroBA) {
          finalList = finalList.filter(
            (x) => x.isBuscaApreensao || /BUSCA\s*E?\s*APREENS/i.test(String(x.classe || ''))
          );
        }

        setListaResultados(finalList);
        if (finalList.length === 0) {
          setApiError({
            engine: 'datajud',
            message:
              'Nenhum processo encontrado. Nem todos os tribunais indexam CPF no DataJud público. Tente por NOME da parte ou CNJ.',
          });
          toast({ title: 'Sem resultados', description: 'Tente nome da parte ou CNJ.', variant: 'destructive' });
        } else {
          toast({ title: `${finalList.length} processo(s) encontrado(s)`, description: filtroBA ? 'Filtro BA ativo' : 'Todos os tipos' });
        }
        setLoading(false);
        return;
      }

      // --- MODO NOME ---
      if (searchMode === 'nome') {
        if (nomeQuery.trim().length < 5) {
          toast({ title: 'Nome curto', variant: 'destructive' });
          setLoading(false);
          return;
        }
        const r = await searchDataJudByNome(nomeQuery.trim(), { size: 10 });
        let items = r.items || [];
        if (filtroBA) items = items.filter((x: any) => /BUSCA|APREENS/i.test(String(x.classe || '')));
        setListaResultados(items.map((x: any) => ({ ...x, origem: 'datajud' })));
        toast({ title: `${items.length} processo(s) no DataJud` });
        setLoading(false);
        return;
      }

      // --- MODO CNJ (padrão) ---
      if (!cnj) {
        setLoading(false);
        return;
      }
      const data = await executarVereditoAI({ cnj, preferredModel: model });
      if (isMounted.current) {
        if (!data.success && !data.dataJudRaw) {
           setApiError({ engine: model, message: data.message || "CNJ não localizado." });
           toast({ title: "Falha na Triagem", description: data.message, variant: "destructive" });
        } else {
           setResult(data);
           if (data.error) {
              toast({ title: "Aviso de Auditoria", description: data.message });
           } else {
              toast({ title: "Auditoria 3D Concluída" });
           }
        }
      }
    } catch (error: any) {
      if (isMounted.current) {
        setApiError({ engine: model, message: "Instabilidade crítica no motor neural." });
        toast({ title: "Erro Crítico", variant: "destructive" });
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const handleSwitchAndRetry = () => {
    const engines = ['xai', 'groq'];
    const currentIndex = engines.indexOf(model);
    const nextIA = engines[(currentIndex + 1) % engines.length];
    
    setModel(nextIA);
    localStorage.setItem('lexisPredict_preferred_ia', nextIA);
    setApiError(null);
    toast({ title: "Migrando Motor", description: `Iniciando via ${nextIA.toUpperCase()}...` });
    setTimeout(() => handleSearch(), 500);
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading || !result) return;

    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    const currentInput = chatInput;
    setChatInput('');
    setChatLoading(true);

    try {
      const context = `Contexto Auditoria. DataJud: ${JSON.stringify(result.dataJudRaw)}. Resumo Anterior: ${result.resumoTecnico}. Pergunta: ${currentInput}`;
      const response = await perguntarIA({ 
        pergunta: context, 
        historico: chatMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        preferredModel: model
      });

      if (isMounted.current && response) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: response.resposta }]);
      }
    } catch (error: any) {
      if (isMounted.current) toast({ title: "Falha na Resposta", variant: "destructive" });
    } finally {
      if (isMounted.current) setChatLoading(false);
    }
  };

  const handleApiSend = async () => {
    if (!result || !result.mensagemCliente || sendingApi) return;
    
    const phone = result.dataJudRaw?.contatoTelefone || "";
    if (!phone) {
      toast({ title: "Aviso de Envio", description: "Telefone não identificado.", variant: "destructive" });
      return;
    }

    setSendingApi(true);
    try {
      const res = await sendWhatsAppAction(phone, result.mensagemCliente);
      if (res.success) {
        toast({ title: "Evolution API: Sucesso" });
      } else {
        toast({ title: "Falha no Envio", description: res.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro de Conexão", variant: "destructive" });
    } finally {
      setSendingApi(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado para Área de Transferência" });
  };

  const chanceAnalysis = useMemo(() => {
    if (!result || !result.dataJudRaw) return null;
    const processNumber = result.dataJudRaw.numeroProcesso;
    const existingCase = repoCases.find(c => c.protocolo === processNumber);
    const lawyerName = existingCase?.advogado;
    let performanceRate = 0;
    if (lawyerName) {
      const lawyerCases = repoCases.filter(c => c.advogado === lawyerName);
      const closedCases = lawyerCases.filter(c => isCasoEncerrado(c));
      performanceRate = lawyerCases.length > 0 ? closedCases.length / lawyerCases.length : 0;
    }
    return analisarChanceEncerramento({
      situacao: result.dataJudRaw.classe || '',
      observacao: result.resumoTecnico || ''
    }, lawyerName ? performanceRate : undefined);
  }, [result, repoCases]);

  const sortedMovimentos = useMemo(() => {
    const movs = result?.dataJudRaw?.movimentos;
    if (!Array.isArray(movs)) return [];
    return [...movs].sort((a, b) => {
      const dateA = new Date(a.dataHora || 0).getTime();
      const dateB = new Date(b.dataHora || 0).getTime();
      return dateB - dateA;
    });
  }, [result]);

  return (
    <div className="flex h-screen bg-[#f3f2f2] font-sans text-black relative z-10">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden text-black relative">
        <header className="h-auto bg-white border-b border-[#dddbda] px-6 py-6 shrink-0 z-40">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="icon-3d-wrapper shrink-0">
                <div className="icon-3d-block black w-14 h-14 rounded-md">
                  <FileSearch size={32} className="text-white" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Unidade de Auditoria 3D</p>
                <h1 className="text-xl font-black uppercase tracking-tighter">
                  {result ? `Processo ${result.dataJudRaw?.numeroProcesso || cnj}` : "Triagem Técnica de Gabinete"}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={model} onValueChange={(val) => { setModel(val); localStorage.setItem('lexisPredict_preferred_ia', val); }}>
                <SelectTrigger className="w-[200px] border-2 border-black font-black uppercase text-[10px] h-11 rounded-none bg-white">
                  <SelectValue placeholder="Motor Neural" />
                </SelectTrigger>
                <SelectContent className="bg-white border-2 border-black rounded-none">
                  <SelectItem value="xai" className="font-black uppercase text-[10px]">xAI Grok Elite</SelectItem>
                  <SelectItem value="groq" className="font-black uppercase text-[10px]">Groq Llama 3.3</SelectItem>
                </SelectContent>
              </Select>
              {result && (
                <Badge className="bg-black text-white font-black uppercase text-[10px] px-4 py-2 flex items-center gap-2 rounded-none">
                  <Zap size={12} className="text-yellow-400 fill-yellow-400" /> Motor Ativo
                </Badge>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 relative">
          <div className="max-w-7xl mx-auto space-y-6">
            {!result && (
              <div className="max-w-2xl mx-auto py-20 text-center space-y-8">
                {apiError && (
                  <Alert variant="destructive" className="border-2 border-red-600 bg-red-50 rounded-none shadow-[6px_6px_0px_#000] text-left">
                    <AlertCircle className="h-5 v-5" />
                    <AlertTitle className="font-black uppercase text-xs">Erro de Triagem</AlertTitle>
                    <AlertDescription className="mt-2 space-y-3">
                      <p className="text-[10px] font-bold uppercase">{apiError.message}</p>
                      <Button onClick={handleSwitchAndRetry} className="bg-black text-white border-2 border-black h-10 font-black uppercase text-[9px] rounded-none hover:bg-white hover:text-black transition-all px-6">
                        Alternar Motor Neural
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <h2 className="text-3xl font-black tracking-tighter uppercase">Audit 3D Elite</h2>
                <p className="text-sm font-black text-black/40 uppercase tracking-widest">
                  Busque por CNJ, CPF/CNPJ ou nome da parte. Resultado com polo ativo e passivo.
                </p>

                <div className="flex flex-wrap gap-2 justify-center">
                  {([
                    ['cnj', 'CNJ'],
                    ['cpf', 'CPF / CNPJ'],
                    ['nome', 'Nome da parte'],
                  ] as const).map(([k, label]) => (
                    <Button
                      key={k}
                      type="button"
                      variant={searchMode === k ? 'default' : 'outline'}
                      onClick={() => { setSearchMode(k); setListaResultados([]); setApiError(null); }}
                      className="h-9 px-4 font-black uppercase text-[10px] rounded-none border-2 border-black"
                    >
                      {label}
                    </Button>
                  ))}
                  <label className="flex items-center gap-2 ml-2 text-[10px] font-black uppercase cursor-pointer">
                    <input type="checkbox" checked={filtroBA} onChange={(e) => setFiltroBA(e.target.checked)} />
                    Só Busca e Apreensão
                  </label>
                </div>
                
                <form onSubmit={handleSearch} className="flex gap-3 bg-white p-3 border-2 border-black shadow-[10px_10px_0px_#000]">
                  {searchMode === 'cnj' && (
                  <Input 
                    placeholder="DIGITE O CNJ (20 DÍGITOS)..." 
                    value={cnj} 
                    onChange={(e) => setCnj(e.target.value)} 
                    className="border-none h-14 text-xl focus-visible:ring-0 font-mono text-black bg-white rounded-none flex-1" 
                  />
                  )}
                  {searchMode === 'cpf' && (
                  <Input 
                    placeholder="CPF OU CNPJ (SÓ NÚMEROS)..." 
                    value={cpfQuery} 
                    onChange={(e) => setCpfQuery(e.target.value)} 
                    className="border-none h-14 text-xl focus-visible:ring-0 font-mono text-black bg-white rounded-none flex-1" 
                  />
                  )}
                  {searchMode === 'nome' && (
                  <Input 
                    placeholder="NOME COMPLETO DA PARTE..." 
                    value={nomeQuery} 
                    onChange={(e) => setNomeQuery(e.target.value)} 
                    className="border-none h-14 text-xl focus-visible:ring-0 font-mono text-black bg-white rounded-none flex-1" 
                  />
                  )}
                  <Button type="submit" disabled={loading} className="h-14 px-10 rounded-none bg-black text-white font-black uppercase text-[10px] border-2 border-black hover:bg-white hover:text-black transition-all">
                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Search size={18} className="mr-2" />}
                    Realizar Auditoria
                  </Button>
                </form>

                {listaResultados.length > 0 && (
                  <div className="mt-10 text-left space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest">
                      {listaResultados.length} processo(s) — clique para auditar
                    </h3>
                    <div className="grid gap-3">
                      {listaResultados.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => runVereditoForCnj(String(item.numeroProcesso || ''))}
                          className="w-full text-left bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000] hover:bg-slate-50 transition-all"
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-mono text-sm font-black">{item.numeroProcesso}</span>
                            {item.tribunal && (
                              <Badge className="rounded-none text-[9px] font-black uppercase bg-black text-white">{item.tribunal}</Badge>
                            )}
                            {item.grau && (
                              <Badge variant="outline" className="rounded-none text-[9px] font-black uppercase border-black">
                                {String(item.grau).toUpperCase().includes('2') ? '2ª instância' : String(item.grau).toUpperCase().includes('1') ? '1ª instância' : item.grau}
                              </Badge>
                            )}
                            {(item.isBuscaApreensao || /BUSCA|APREENS/i.test(String(item.classe || ''))) && (
                              <Badge className="rounded-none text-[9px] font-black uppercase bg-red-600 text-white">Busca e Apreensão</Badge>
                            )}
                            {item.origem && (
                              <Badge variant="outline" className="rounded-none text-[9px] font-black uppercase">{item.origem}</Badge>
                            )}
                          </div>
                          {item.classe && (
                            <p className="text-[11px] font-bold uppercase text-black/70 mb-2">{item.classe}</p>
                          )}
                          <div className="grid sm:grid-cols-2 gap-2 text-[10px] font-bold uppercase">
                            <div className="border border-black/10 p-2 bg-emerald-50/50">
                              <p className="opacity-50 mb-1">Polo ativo</p>
                              <p>{(item.poloAtivo && item.poloAtivo.length) ? item.poloAtivo.join(', ') : '—'}</p>
                            </div>
                            <div className="border border-black/10 p-2 bg-rose-50/50">
                              <p className="opacity-50 mb-1">Polo passivo</p>
                              <p>{(item.poloPassivo && item.poloPassivo.length) ? item.poloPassivo.join(', ') : '—'}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {result && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
                <div className="lg:col-span-2 space-y-6">
                  <Alert className="border-2 border-amber-500 bg-amber-50 rounded-none shadow-[4px_4px_0px_#f59e0b]">
                    <Info className="h-5 w-5 text-amber-600" />
                    <AlertTitle className="text-[10px] font-black uppercase tracking-widest text-amber-800">Protocolo de Integridade de Fonte</AlertTitle>
                    <AlertDescription className="text-[10px] font-bold uppercase text-amber-700 leading-relaxed mt-1">
                      Fonte: DataJud (CNJ). Use para triagem rápida; confira o tribunal para a verdade operacional final.
                    </AlertDescription>
                  </Alert>

                  {(result.dataJudRaw?.poloAtivo?.length > 0 || result.dataJudRaw?.poloPassivo?.length > 0) && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="border-2 border-black p-4 bg-emerald-50">
                        <p className="text-[9px] font-black uppercase opacity-50 mb-1">Polo ativo</p>
                        <p className="text-xs font-black uppercase">{(result.dataJudRaw.poloAtivo || []).join(', ') || '—'}</p>
                      </div>
                      <div className="border-2 border-black p-4 bg-rose-50">
                        <p className="text-[9px] font-black uppercase opacity-50 mb-1">Polo passivo</p>
                        <p className="text-xs font-black uppercase">{(result.dataJudRaw.poloPassivo || []).join(', ') || '—'}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-black text-white px-6 py-3 rounded-none border-2 border-black shadow-[4px_4px_0px_#00D1FF]">
                     <div className="flex items-center gap-3">
                        <Cpu size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Motor Processual: {result.engineUsed || "N/A"}</span>
                     </div>
                  </div>

                  <Tabs defaultValue="details" className="w-full">
                    <TabsList className="bg-gray-200 p-1 h-12 w-full justify-start rounded-none mb-0 border-2 border-black border-b-0">
                      <TabsTrigger value="details" className="data-[state=active]:bg-black data-[state=active]:text-white font-black text-xs px-8 h-10 uppercase rounded-none">Parecer de Gabinete</TabsTrigger>
                      <TabsTrigger value="whatsapp" className="data-[state=active]:bg-black data-[state=active]:text-white font-black text-xs px-8 h-10 uppercase rounded-none">Despacho WhatsApp</TabsTrigger>
                      <TabsTrigger value="chatter" className="data-[state=active]:bg-black data-[state=active]:text-white font-black text-xs px-8 h-10 uppercase rounded-none">Consultoria Neural</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="mt-0">
                      <div className="space-y-6">
                        <Card className="bg-white border-2 border-black shadow-none rounded-none border-t-0">
                          <CardHeader className="bg-[#f8f9fb] border-b-2 border-black py-4">
                            <CardTitle className="text-[10px] font-black text-black uppercase flex items-center gap-2">
                              <FileText size={16} /> Diagnóstico Estratégico Senior
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-8 space-y-10">
                            <div className="space-y-3 p-6 bg-[#f3f2f2] border-2 border-black">
                              <Label className="text-[10px] font-black uppercase opacity-60">Resumo Resolutivo</Label>
                              <p className="text-sm leading-relaxed text-black font-black uppercase italic">{result.resumoTecnico}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                              <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase text-red-600">Análise de Risco</Label>
                                <p className="text-[11px] text-black leading-relaxed border-l-4 border-black pl-5 font-black uppercase">{result.analiseRisco}</p>
                              </div>
                              <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase text-blue-600">Estratégia Operacional</Label>
                                <p className="text-[11px] text-black leading-relaxed border-l-4 border-black pl-5 font-black uppercase">{result.proximosPassos}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           {chanceAnalysis && <ChanceEncerramentoCard analysis={chanceAnalysis} />}
                           {result.conclusaoEncerramento && (
                             <Card className="bg-primary/5 border-2 border-black shadow-[8px_8px_0px_#000] rounded-none">
                               <CardHeader className="bg-black text-white p-4">
                                  <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck size={14} /> Conclusão Neural
                                  </CardTitle>
                               </CardHeader>
                               <CardContent className="p-6">
                                  <p className="text-[11px] font-black uppercase leading-relaxed text-black/80 italic">{result.conclusaoEncerramento}</p>
                               </CardContent>
                             </Card>
                           )}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="whatsapp" className="mt-0">
                       <Card className="bg-white border-2 border-black shadow-none rounded-none border-t-0">
                        <CardHeader className="bg-green-50 border-b-2 border-black py-4">
                          <CardTitle className="text-[10px] font-black text-green-900 uppercase flex items-center gap-2">
                            <MessageCircle size={16} /> Mensagem Pronta para o Cliente
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                           <div className="bg-[#fafafa] border-2 border-dashed border-black/10 p-8 rounded-none relative">
                              <p className="text-sm text-black font-black uppercase leading-relaxed italic">{result.mensagemCliente}</p>
                              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(result.mensagemCliente)} className="absolute top-4 right-4 hover:bg-black hover:text-white transition-all"><Copy size={16} /></Button>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <Button disabled={sendingApi} onClick={handleApiSend} className="h-14 bg-black text-white border-2 border-black font-black uppercase text-[10px] rounded-none shadow-[6px_6px_0px_#00D1FF] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                                {sendingApi ? <Loader2 className="animate-spin mr-2" /> : <Zap size={18} className="mr-2 text-yellow-400 fill-yellow-400" />}
                                Disparo API Evolution
                              </Button>
                              <Button asChild className="h-14 bg-white text-black border-2 border-black font-black uppercase text-[10px] rounded-none">
                                <a href={formatWhatsAppLink('', result.mensagemCliente)} target="_blank" rel="noopener noreferrer">
                                  <MessageCircle size={18} className="mr-2" /> Link Manual WhatsApp
                                </a>
                              </Button>
                           </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="chatter" className="mt-0">
                      <Card className="bg-white border-2 border-black shadow-none rounded-none border-t-0 flex flex-col h-[500px]">
                        <ScrollArea className="flex-1 p-6 bg-[#f3f2f2]" ref={scrollRef}>
                          <div className="space-y-6">
                            {chatMessages.map((msg, i) => (
                              <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                <div className={cn(
                                  "p-4 border-2 border-black shadow-sm max-w-[85%]",
                                  msg.role === 'user' ? "bg-black text-white" : "bg-white text-black"
                                )}>
                                  <p className="text-[11px] font-black uppercase leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                </div>
                              </div>
                            ))}
                            {chatLoading && <div className="flex gap-2 text-black/40 animate-pulse font-black uppercase text-[10px]"><Bot size={14} /> IA Processando dúvida técnica...</div>}
                          </div>
                        </ScrollArea>
                        <form onSubmit={handleChat} className="p-4 border-t-2 border-black bg-white flex gap-3">
                          <Input placeholder="DÚVIDA SOBRE O PARECER..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="flex-1 bg-[#f3f2f2] border-2 border-black text-[10px] font-black uppercase h-12 rounded-none" />
                          <Button type="submit" size="icon" className="h-12 w-12 bg-black text-white border-2 border-black rounded-none">
                            <Send size={18} />
                          </Button>
                        </form>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="space-y-6">
                   <Card className="bg-white border-2 border-black shadow-none rounded-none overflow-hidden">
                      <CardHeader className="bg-black text-white py-4 flex flex-row items-center justify-between">
                         <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 tracking-widest">
                            <History size={16} /> Cronologia DataJud
                         </CardTitle>
                         <Button variant="ghost" asChild className="h-7 px-2 text-[8px] font-black text-primary border border-primary/20 rounded-none">
                           <a href={result.dataJudRaw?.linkConsulta} target="_blank" rel="noopener noreferrer">VER NO TRIBUNAL <ExternalLink size={8} className="ml-1" /></a>
                         </Button>
                      </CardHeader>
                      <CardContent className="p-0 bg-white">
                         <div className="divide-y-2 divide-black/5 max-h-[600px] overflow-auto">
                            {sortedMovimentos.length > 0 ? sortedMovimentos.map((m: any, i: number) => (
                               <div key={i} className="p-5 hover:bg-black group transition-all">
                                  <div className="flex items-center gap-3 mb-2">
                                     <Clock size={12} className="text-black/30 group-hover:text-white/40" />
                                     <span className="text-[9px] font-black text-black/50 group-hover:text-white/60 uppercase">
                                       {m.dataHora ? new Date(m.dataHora).toLocaleDateString('pt-BR') : 'S/ DATA'}
                                     </span>
                                  </div>
                                  <p className="text-[11px] font-black text-black group-hover:text-white uppercase leading-tight tracking-tight">{m.nome}</p>
                               </div>
                            )) : (
                              <div className="p-10 text-center space-y-4 opacity-40">
                                 <Gavel size={32} className="mx-auto" />
                                 <p className="text-[10px] font-black uppercase">{result.dataJudRaw?.message || "Sem histórico disponível."}</p>
                              </div>
                            )}
                         </div>
                      </CardContent>
                   </Card>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="h-10 border-t border-[#dddbda] bg-white flex items-center justify-center gap-6 text-[10px] text-black/60 font-black uppercase tracking-[0.2em] shrink-0">
          <div className="flex items-center gap-2"><Copyright size={10} /> 2026 W1 Capital.</div>
          <span className="text-black">Relatório Consolidado • FUNDADOR DAVI ALVES FIGUEREDO</span>
        </footer>
      </main>
    </div>
  );
}
