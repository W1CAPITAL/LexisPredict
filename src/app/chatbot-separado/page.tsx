"use client";
/**
 * @fileOverview Chatbot 100% Isolado e Independente v1.0
 * Não possui dependências com os fluxos de IA antigos do projeto.
 * Utiliza Server Actions locais para máxima segurança e portabilidade.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Bot, Send, Loader2, Zap, Settings2, Trash2, User, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { perguntarChatbotIndependente } from './actions';

export default function ChatbotSeparadoPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelo, setModelo] = useState<string>('xai');
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Carregar histórico local se existir
    const saved = localStorage.getItem('lexis_chatbot_separado_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        setMessages([]);
      }
    } else {
      setMessages([{
        role: 'assistant',
        content: 'Saudações. Sou o Consultor Estratégico Independente da W1 Capital. Como posso auxiliar o seu gabinete hoje?',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  }, []);

  useEffect(() => {
    // Auto-save no localStorage
    if (messages.length > 0) {
      localStorage.setItem('lexis_chatbot_separado_history', JSON.stringify(messages));
    }
    // Scroll para o fim
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, loading]);

  const handleClear = () => {
    if (confirm("Deseja expurgar o histórico desta conversa?")) {
      setMessages([{
        role: 'assistant',
        content: 'Histórico limpo. Unidade Neural pronta para nova consulta.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }]);
      localStorage.removeItem('lexis_chatbot_separado_history');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { 
      role: 'user', 
      content: input, 
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
    };

    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    const currentHistory = [...messages];
    setInput('');
    setLoading(true);

    try {
      const res = await perguntarChatbotIndependente(currentInput, currentHistory, modelo);
      
      if (res.sucesso) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: res.resposta,
          engine: (res as any).engineUtilizada || (res as any).engine,
          tokens: (res as any).tokens,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }]);
      } else {
        toast({ 
          title: "Falha Neural", 
          description: res.resposta, 
          variant: "destructive" 
        });
        // Remove a última mensagem do usuário para não poluir o histórico com erros
        setMessages(prev => prev.slice(0, -1));
        setInput(currentInput); // Restaura o input
      }
    } catch (err) {
      toast({ title: "Erro de conexão", description: "Verifique sua internet e tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8f9fb] font-sans text-black relative z-10 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-[#dddbda] bg-white/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-black text-white flex items-center justify-center rounded-xl shadow-lg border-2 border-black">
              <Bot size={24} className="text-[#00D1FF]" />
            </div>
            <div>
              <h1 className="font-black text-xl uppercase tracking-tighter">Consultoria Estratégica</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Módulo Independente • Authority v1.0</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger className="w-[200px] border-2 border-black font-black uppercase text-[10px] h-11 bg-white rounded-none shadow-[4px_4px_0px_#000]">
                <div className="flex items-center gap-2">
                  <Settings2 size={14} className="text-primary" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="border-2 border-black rounded-none">
                <SelectItem value="xai" className="font-black uppercase text-[10px]">xAI Grok 4.5 Elite</SelectItem>
                <SelectItem value="groq" className="font-black uppercase text-[10px]">Groq Llama 3.3 Ultra</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={handleClear} className="h-11 w-11 border-2 border-black rounded-none bg-white hover:bg-red-50 hover:text-red-600 transition-all">
              <Trash2 size={20} />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-4 lg:p-8 flex flex-col">
          <div className="flex-1 bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden max-w-5xl mx-auto w-full">
            <ScrollArea className="flex-1" ref={scrollRef}>
              <div className="p-8 space-y-10">
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
                    <div className="flex items-center gap-2 mb-2 opacity-30">
                       {msg.role === 'user' ? <User size={10} /> : <ShieldCheck size={10} />}
                       <span className="text-[8px] font-black uppercase tracking-widest">{msg.role === 'user' ? 'Gabinete' : 'Unidade Neural'}</span>
                    </div>
                    <div className={cn(
                      "relative max-w-[90%] p-6 border-2 border-black",
                      msg.role === 'user' ? "bg-[#f3f2f2] text-black" : "bg-black text-white"
                    )}>
                      <p className="text-xs font-black uppercase leading-relaxed whitespace-pre-wrap tracking-wide">{msg.content}</p>
                      <span className="text-[7px] font-black absolute -bottom-4 right-0 text-black/40 uppercase">
                        {msg.timestamp}
                      </span>
                    </div>
                    {msg.engine && (
                      <div className="mt-4 flex items-center gap-3 opacity-30 text-[7px] font-black uppercase tracking-widest">
                        <Badge variant="outline" className="text-[7px] px-1.5 py-0 border-black">{msg.engine}</Badge>
                        <span>{msg.tokens} Tokens Consumidos</span>
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-4 text-black font-black uppercase text-[10px] tracking-widest animate-pulse p-4 border-2 border-dashed border-black/10">
                    <Loader2 className="animate-spin text-primary" size={16} />
                    Processando consulta estratégica...
                  </div>
                )}
              </div>
            </ScrollArea>

            <form onSubmit={handleSend} className="p-6 border-t-2 border-black bg-[#f8f9fb] flex gap-4">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="DIGITE SUA SOLICITAÇÃO TÉCNICA..."
                className="flex-1 border-2 border-black h-16 text-xs font-black uppercase focus-visible:ring-0 rounded-none bg-white placeholder:text-black/20"
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !input.trim()} className="bg-black text-white border-2 border-black h-16 w-24 rounded-none shadow-[4px_4px_0px_#00D1FF] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                <Send size={24} />
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
