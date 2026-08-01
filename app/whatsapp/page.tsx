"use client";
/**
 * @fileOverview Terminal WhatsApp Elite v2500.0
 * Triagem de Tribunal Cópia/Cola + Histórico Real Supabase.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  MessageCircle, 
  Search, 
  Send, 
  User, 
  RefreshCcw,
  Zap,
  Loader2,
  Copyright,
  MessageSquare,
  ChevronLeft,
  BookOpen,
  Scale,
  Clock,
  Gavel
} from 'lucide-react';
import { LegalCase } from '@/lib/case-logic';
import { cn, formatWhatsAppLink } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { fetchRepoCases } from '@/app/actions/case-actions';
import { sendWhatsAppAction, fetchWhatsAppHistoryAction } from '@/app/actions/whatsapp-actions';
import { perguntarIA } from '@/ai/flows/chat-ai-flow';
import { executarVereditoAI } from '@/ai/flows/veredito-ai-flow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SCRIPTS_GABINETE = [
  { id: 'audiencia', title: 'Audiência Procedimento', text: 'Olá [CLIENTE]! Sobre sua audiência virtual: o link será enviado em um prazo de 24 a 72 horas após o comunicado. Estarão presentes o advogado da assessoria, representantes do banco, o mediador e o juiz.' },
  { id: 'eproc', title: 'Migração Eproc', text: 'Sr(a). [CLIENTE], o TJSP está migrando para o sistema Eproc. Se ao consultar o número aparecer "Cancelado", não se assuste. Significa apenas que o processo foi movido para a nova plataforma onde já estamos habilitados.' },
  { id: 'justica-negada', title: 'Justiça Gratuita Negada', text: 'O juiz entendeu que seu perfil possui condições de pagar as taxas judiciárias. Essas custas são revertidas para serviços do fórum e diário oficial. Solicitaremos a emissão da guia.' },
  { id: 'sentenca-imp', title: 'Sentença Improcedente', text: 'Infelizmente o juiz julgou improcedente a ação. Nossa equipe jurídica já está analisando a sentença para apresentar o recurso de apelação e buscar reverter essa decisão.' }
];

export default function WhatsAppHub() {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  
  const [aiResponse, setAiResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [courtHistoryRaw, setCourtHistoryRaw] = useState('');
  
  const [realHistory, setRealHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const { profile } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedContact) {
      loadRealHistory(selectedContact.telefone);
      setAiResponse('');
      setCourtHistoryRaw('');
    }
  }, [selectedContact]);

  const loadData = async () => {
    setLoading(true);
    try {
      const repoData = await fetchRepoCases();
      if (Array.isArray(repoData)) setCases(repoData);
    } finally { setLoading(false); }
  };

  const loadRealHistory = async (phone: string) => {
    if (!phone) return;
    setLoadingHistory(true);
    try {
      const res = await fetchWhatsAppHistoryAction(phone);
      if (res.success) setRealHistory(res.messages || []);
    } finally { setLoadingHistory(false); }
  };

  const contacts = useMemo(() => {
    const unique = new Map();
    cases.forEach(c => {
      if (c.telefone && !unique.has(c.cliente)) {
        unique.set(c.cliente, { ...c, nome: c.cliente, telefone: c.telefone });
      }
    });
    return Array.from(unique.values()).filter(c => 
      c.nome.toLowerCase().includes(search.toLowerCase()) || c.telefone.includes(search)
    );
  }, [cases, search]);

  const formatText = (text: string) => {
    if (!selectedContact) return text;
    return text
      .replace(/\[CLIENTE\]/g, selectedContact.nome)
      .replace(/\[PROTOCOLO\]/g, selectedContact.protocolo)
      .replace(/\[USUARIO\]/g, profile?.nome || "Setor Processual");
  };

  const handleSelectScript = (val: string) => {
    const script = SCRIPTS_GABINETE.find(s => s.id === val);
    if (script) setAiResponse(formatText(script.text));
  };

  const handleAnalyzeCourtHistory = async () => {
    if (!courtHistoryRaw.trim() || isAuditing) return;
    setIsAuditing(true);
    try {
      const res = await perguntarIA({ 
        pergunta: `Analise este histórico do tribunal e redija uma mensagem para o cliente ${selectedContact.nome}. Se houver algo sobre 'Conclusos para Sentença', explique que o processo está aguardando decisão final. HISTÓRICO: ${courtHistoryRaw}`
      });
      if (res?.resposta) setAiResponse(formatText(res.resposta));
    } finally { setIsAuditing(false); }
  };

  const handleSend = async () => {
    if (!selectedContact || !aiResponse || isSending) return;
    setIsSending(true);
    try {
      const res = await sendWhatsAppAction(selectedContact.telefone, aiResponse);
      if (res.success) {
        toast({ title: "Mensagem Enviada" });
        setAiResponse('');
        setTimeout(() => loadRealHistory(selectedContact.telefone), 2000);
      }
    } finally { setIsSending(false); }
  };

  return (
    <div className="flex h-screen bg-[#f3f2f2] font-sans text-black relative z-10 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 border-b border-[#dddbda] bg-white flex items-center justify-between px-6 shrink-0 z-40">
          <h1 className="font-black text-xl uppercase tracking-tighter">Terminal WhatsApp v25.0</h1>
          <Button variant="ghost" size="icon" onClick={loadData} className="border-2 border-black rounded-none bg-white">
            <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <aside className={cn("w-80 border-r-2 border-black bg-white flex flex-col shrink-0", selectedContact && "hidden lg:flex")}>
            <div className="p-4 border-b-2 border-black bg-[#f8f9fb]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 w-4 h-4" />
                <Input placeholder="BUSCAR CONTATO..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 border-black border-2 h-11 text-[10px] font-black uppercase rounded-none" />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {contacts.map((c) => (
                <button key={c.id} onClick={() => setSelectedContact(c)} className={cn("w-full p-4 flex items-center gap-3 hover:bg-black group transition-all text-left", selectedContact?.id === c.id ? "bg-black" : "bg-white")}>
                  <div className="w-10 h-10 border-2 border-black flex items-center justify-center bg-[#f3f2f2] group-hover:bg-white"><User size={20} /></div>
                  <div className="min-w-0">
                    <p className={cn("text-[11px] font-black uppercase truncate", selectedContact?.id === c.id ? "text-white" : "text-black")}>{c.nome}</p>
                    <p className={cn("text-[9px] font-mono", selectedContact?.id === c.id ? "text-white/40" : "text-black/40")}>{c.telefone}</p>
                  </div>
                </button>
              ))}
            </ScrollArea>
          </aside>

          <section className={cn("flex-1 bg-[#f3f2f2] flex flex-col overflow-hidden", !selectedContact && "hidden lg:flex")}>
            {selectedContact ? (
              <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setSelectedContact(null)} className="lg:hidden h-10 font-black border-2 border-black bg-white">Voltar</Button>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black flex items-center justify-center text-white"><User size={20} /></div>
                    <div><p className="text-sm font-black uppercase">{selectedContact.nome}</p></div>
                  </div>
                </div>

                <Tabs defaultValue="history" className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="bg-gray-200 border-2 border-black p-1 h-12 rounded-none">
                    <TabsTrigger value="history" className="flex-1 font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white h-full rounded-none">Histórico Real</TabsTrigger>
                    <TabsTrigger value="ia" className="flex-1 font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white h-full rounded-none">IA & Scripts</TabsTrigger>
                  </TabsList>

                  <TabsContent value="history" className="flex-1 bg-white border-2 border-black p-4 overflow-hidden flex flex-col">
                    <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                      {loadingHistory ? <div className="p-20 text-center animate-pulse uppercase">Sincronizando...</div> : 
                        realHistory.map((m) => (
                          <div key={m.id} className={cn("mb-4 p-4 border-2 border-black max-w-[85%]", m.from_me ? "ml-auto bg-black text-white" : "mr-auto bg-gray-50")}>
                            <p className="text-[11px] font-black uppercase leading-relaxed">{m.message_text}</p>
                            <span className="text-[8px] opacity-40 uppercase mt-2 block">{new Date(m.timestamp).toLocaleString()}</span>
                          </div>
                        ))
                      }
                    </ScrollArea>
                    <Button variant="ghost" onClick={() => loadRealHistory(selectedContact.telefone)} className="h-10 text-[9px] font-black border-t-2 border-black/5 mt-2 rounded-none uppercase">Forçar Sincronia</Button>
                  </TabsContent>

                  <TabsContent value="ia" className="flex-1 space-y-4 overflow-hidden flex flex-col">
                    <div className="bg-white border-2 border-black p-4 space-y-4">
                      <Label className="text-[9px] font-black uppercase opacity-40">Triagem de Tribunal (e-SAJ / PJE)</Label>
                      <Textarea value={courtHistoryRaw} onChange={(e) => setCourtHistoryRaw(e.target.value)} placeholder="Cole aqui o histórico bruto do tribunal..." className="min-h-[100px] border-none text-[10px] uppercase font-black" />
                      <Button onClick={handleAnalyzeCourtHistory} disabled={isAuditing} className="w-full h-10 bg-blue-600 text-white font-black uppercase text-[9px] rounded-none">
                        {isAuditing ? <Loader2 className="animate-spin" /> : <Zap size={14} className="mr-2" />} Analisar Histórico do Tribunal
                      </Button>
                    </div>

                    <div className="flex-1 bg-white border-2 border-black p-4 flex flex-col">
                      <Select onValueChange={handleSelectScript}>
                        <SelectTrigger className="border-2 border-black h-11 font-black uppercase text-[9px] mb-4">
                          <SelectValue placeholder="Script Processual" />
                        </SelectTrigger>
                        <SelectContent>{SCRIPTS_GABINETE.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}</SelectContent>
                      </Select>
                      <Textarea value={aiResponse} onChange={(e) => setAiResponse(e.target.value)} placeholder="Redija sua mensagem aqui..." className="flex-1 border-none text-xs font-black uppercase leading-relaxed" />
                    </div>

                    <Button onClick={handleSend} disabled={!aiResponse || isSending} className="h-14 bg-black text-white font-black uppercase text-[11px] rounded-none shadow-[6px_6px_0px_#00D1FF]">
                      {isSending ? <Loader2 className="animate-spin" /> : <Send size={16} className="mr-3" />} Enviar via Evolution API
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            ) : <div className="flex-1 flex flex-col items-center justify-center opacity-20"><MessageCircle size={64} /><p className="font-black uppercase mt-4">Selecione um contato</p></div>}
          </section>
        </div>
      </main>
    </div>
  );
}
