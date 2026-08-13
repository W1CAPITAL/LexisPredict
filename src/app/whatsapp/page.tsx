"use client";

/**
 * Terminal WhatsApp — layout de conversa + histórico + sugestões por tribunal.
 * Envio: Evolution (se env) OU wa.me (sem API).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MessageCircle,
  Search,
  Send,
  ExternalLink,
  Loader2,
  Sparkles,
  Phone,
  RefreshCcw,
  Copy,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  User,
  UserCheck,
  FileSearch,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { fetchRepoCases } from "@/app/actions/case-actions";
import {
  sendWhatsAppAction,
  fetchWhatsAppHistoryAction,
} from "@/app/actions/whatsapp-actions";
import { registrarAtendimentoAction } from "@/app/actions/case-actions";
import { saveOneCaseAction } from "@/app/actions/case-save-actions";
import { suggestScripts } from "@/lib/script-processual/suggest";
import { plainTextFromDjen } from "@/lib/djen";
import type { LegalCase } from "@/lib/case-logic";
import { isCasoEncerrado } from "@/lib/status-encerrado";
import { openWhatsAppClient } from "@/lib/whatsapp-links";
import { scanSingleCaseAction } from "@/app/actions/case-actions";
import { gerarRascunhoEstrategico } from "@/ai/motor-despacho";
import { AiDraftPreview } from "@/components/ai/ai-draft-preview";
import { MOTORS } from "@/lib/ai/motors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ChatMsg = {
  id: string;
  direction: "out" | "in" | "system";
  body: string;
  at: string;
  source?: string;
};

function digitsPhone(t?: string | null) {
  return String(t || "").replace(/\D/g, "");
}

function waMeUrl(phone: string, text: string) {
  let d = digitsPhone(phone);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

function caseLabel(c: LegalCase) {
  return c.cliente || c.protocolo || "Cliente";
}

function signalBadge(c: LegalCase): { label: string; className: string } | null {
  if (c.indicio_busca_apreensao || c.evento_tipo === "ba")
    return { label: "B.A.", className: "bg-red-600 text-white" };
  if (c.datajud_encerrado_tribunal)
    return { label: "Baixa", className: "bg-emerald-600 text-white" };
  if (c.em_cumprimento_sentenca || c.evento_tipo === "cumprimento_sentenca")
    return { label: "Cumprimento", className: "bg-violet-600 text-white" };
  if (c.evento_tipo === "sentenca_improcedente")
    return { label: "Improcedente", className: "bg-orange-600 text-white" };
  if (c.evento_tipo === "sentenca_procedente")
    return { label: "Procedente", className: "bg-sky-600 text-white" };
  if (c.tem_novo_andamento || c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao)
    return { label: "Novo andamento", className: "bg-amber-500 text-black" };
  return null;
}

function WhatsAppTerminalInner() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [deepLinkDone, setDeepLinkDone] = useState(false);

  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<LegalCase | null>(null);
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [evolutionOk, setEvolutionOk] = useState<boolean | null>(null);
  const [attSaving, setAttSaving] = useState(false);
  const [tribunalMovimentos, setTribunalMovimentos] = useState<any[]>([]);
  const [djenComunicacoes, setDjenComunicacoes] = useState<any[]>([]);
  const [loadingTribunal, setLoadingTribunal] = useState(false);
  const [selectedMotor, setSelectedMotor] = useState<string>("local_only");
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [isGeneratingAIDraft, setIsGeneratingAIDraft] = useState(false);
  const [waScripts, setWaScripts] = useState<{ id: string; titulo: string; texto: string; quandoUsar?: string }[]>([]);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRepoCases();
      setCases(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Falha ao carregar carteira", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);




  const contacts = useMemo(() => {
    const term = q.trim().toLowerCase();
    const termDigits = term.replace(/\D/g, "");
    // Com busca: inclui sem telefone / encerrados. Sem busca: só ativos com telefone.
    const base = term
      ? cases
      : cases.filter((c) => !isCasoEncerrado(c) && digitsPhone(c.telefone).length >= 10);

    const filtered = !term
      ? base
      : base.filter((c) => {
          const nome = String(c.cliente || "").toLowerCase();
          const proto = String(c.protocolo || "").toLowerCase();
          const protoDigits = proto.replace(/\D/g, "");
          const tel = digitsPhone(c.telefone);
          const adv = String(c.advogado || "").toLowerCase();
          if (nome.includes(term)) return true;
          if (proto.includes(term)) return true;
          if (termDigits.length >= 5 && (protoDigits.includes(termDigits) || tel.includes(termDigits))) return true;
          if (adv.includes(term)) return true;
          return false;
        });

    return filtered
      .sort((a, b) => {
        const score = (c: LegalCase) => {
          let s = 0;
          if (c.indicio_busca_apreensao) s += 100;
          if (c.datajud_encerrado_tribunal) s += 80;
          if (c.tem_novo_andamento || c.tem_atualizacao_pos_retorno) s += 50;
          if (c.status === "Vencido" || c.status === "Caso Crítico") s += 40;
          if (c.status === "É Hoje") s += 30;
          if (digitsPhone(c.telefone).length >= 10) s += 5;
          return s;
        };
        return score(b) - score(a);
      })
      .slice(0, 300);
  }, [cases, q]);

  const suggestions = useMemo(() => {
    if (!selected) return [];
    try {
      const djenBits = [
        selected.djen_ultimo_resumo,
        (selected as any).djen_ultimo_texto,
        selected.evento_resumo,
        selected.datajud_ultimo_nome,
        selected.evento_tipo,
      ]
        .filter(Boolean)
        .map((x) => plainTextFromDjen(String(x)));

      const raw = suggestScripts({
        clienteNome: selected.cliente,
        protocolo: selected.protocolo,
        ultimoRetorno: selected.ultimoRetorno || (selected as any).ultimo_retorno,
        evento_tipo: selected.evento_tipo,
        evento_resumo: selected.evento_resumo,
        djen_ultimo_resumo: selected.djen_ultimo_resumo,
        datajud_ultimo_nome: selected.datajud_ultimo_nome,
        djenTexts: djenBits,
        tem_novo_andamento: selected.tem_novo_andamento,
        tem_atualizacao_pos_retorno: selected.tem_atualizacao_pos_retorno,
        djen_nova_comunicacao: selected.djen_nova_comunicacao,
        indicio_busca_apreensao: selected.indicio_busca_apreensao,
        datajud_encerrado_tribunal: selected.datajud_encerrado_tribunal,
        em_cumprimento_sentenca: selected.em_cumprimento_sentenca,
        movimentos: [
          {
            nome: selected.datajud_ultimo_nome || selected.evento_tipo || '',
            complemento: selected.evento_resumo || selected.djen_ultimo_resumo || '',
            descricao: plainTextFromDjen(String((selected as any).djen_ultimo_texto || selected.djen_ultimo_resumo || '')),
            dataHora:
              (selected as any).datajud_ultima_data ||
              (selected as any).datajud_ultimo_data ||
              (selected as any).djen_ultima_data ||
              selected.ultimoRetorno ||
              '',
          },
        ],
      });

      // Tom WhatsApp: remove linhas vazias excessivas e limita tamanho
      return raw.map((s) => {
        let texto = String(s.texto || "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        // Evita formalismo longo no terminal
        if (texto.length > 900) {
          texto = texto.slice(0, 880).trim() + "…";
        }
        return {
          ...s,
          titulo: s.titulo || "Sugestão",
          texto,
          quandoUsar: s.quandoUsar || "Resposta rápida no WhatsApp",
        };
      });
    } catch {
      return [];
    }
  }, [selected]);

  const loadHistory = useCallback(
    async (c: LegalCase) => {
      setHistLoading(true);
      setHistory([]);
      try {
        const res = await fetchWhatsAppHistoryAction(c.telefone || "");
        if (res?.success && Array.isArray(res.messages) && res.messages.length > 0) {
          const mapped: ChatMsg[] = res.messages.map((m: any, i: number) => ({
            id: String(m.id || i),
            direction: m.direction === "in" || m.from_me === false ? "in" : "out",
            body: m.body || m.message || m.text || "",
            at: m.created_at || m.timestamp || new Date().toISOString(),
            source: m.source || "db",
          }));
          setHistory(mapped);
        } else {
          // Histórico local da sessão
          const key = `lexis_wa_local_${digitsPhone(c.telefone)}`;
          const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
          if (raw) {
            setHistory(JSON.parse(raw));
          } else {
            setHistory([
              {
                id: "sys-1",
                direction: "system",
                body: "Sem histórico no banco. Mensagens enviadas por aqui nesta sessão ficam salvas localmente. Para histórico real da Evolution, grave webhooks em whatsapp_messages.",
                at: new Date().toISOString(),
              },
            ]);
          }
        }
      } catch {
        setHistory([
          {
            id: "sys-err",
            direction: "system",
            body: "Não foi possível carregar histórico remoto.",
            at: new Date().toISOString(),
          },
        ]);
      } finally {
        setHistLoading(false);
      }
    },
    []
  );

  const selectCase = (c: LegalCase) => {
    setSelected(c);
    setDraft("");
    loadHistory(c);
  };

  const todayBR = () => new Date().toLocaleDateString("pt-BR");

  /** Marca último atendimento (mesmo fluxo operacional de Tarefas/Processos). */
  const registerAttendance = async () => {
    if (!selected || attSaving) return;
    setAttSaving(true);
    try {
      const hoje = todayBR();
      const updated: LegalCase = {
        ...selected,
        ultimoRetorno: hoje,
        tem_novo_andamento: false,
        djen_nova_comunicacao: false,
        tem_atualizacao_pos_retorno: false,
      };
      const res = await saveOneCaseAction(updated);
      if (res.success) {
        await registrarAtendimentoAction([selected.protocolo], {
          situacao: selected.situacao || "EM ANDAMENTO",
          via: "whatsapp-terminal",
          observacao: draft.trim() ? `WA: ${draft.trim().slice(0, 200)}` : "Contato via terminal WhatsApp",
        });
        setSelected(updated);
        setCases((prev) =>
          prev.map((c) => (c.protocolo === selected.protocolo ? { ...c, ultimoRetorno: hoje } : c))
        );
        toast({ title: "Atendimento registrado", description: `${selected.cliente} · ${hoje}` });
      } else {
        toast({ title: "Falha ao registrar", description: res.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Não foi possível salvar", variant: "destructive" });
    } finally {
      setAttSaving(false);
    }
  };


  /** Carrega andamentos DataJud + DJEN (igual Tarefas) e scripts locais. */
  const loadTribunalContext = async (c?: LegalCase | null) => {
    const target = c || selected;
    if (!target?.protocolo) {
      toast({ title: "Selecione um processo", variant: "destructive" });
      return;
    }
    setLoadingTribunal(true);
    setAiDraft(null);
    try {
      const res = await scanSingleCaseAction(target.protocolo, { mode: "both", fast: false });
      const movimentos = Array.isArray((res as any).movimentos) ? (res as any).movimentos.slice(0, 40) : [];
      const comunicacoes = Array.isArray((res as any).comunicacoes) ? (res as any).comunicacoes : [];
      const caseData = (res as any).case || target;

      setTribunalMovimentos(movimentos);
      setDjenComunicacoes(comunicacoes);
      if (caseData?.protocolo) {
        setSelected((prev) => (prev ? { ...prev, ...caseData } : caseData));
      }

      const djenTexts = comunicacoes
        .map((d: any) => plainTextFromDjen(d.texto || d.conteudo || d.inteiroTeor || ""))
        .filter(Boolean);

      const scripts = suggestScripts({
        clienteNome: caseData.cliente || target.cliente,
        protocolo: target.protocolo,
        ultimoRetorno: target.ultimoRetorno || caseData.ultimoRetorno,
        evento_tipo: caseData.evento_tipo,
        evento_resumo: caseData.evento_resumo,
        djen_ultimo_resumo: caseData.djen_ultimo_resumo,
        datajud_ultimo_nome: caseData.datajud_ultimo_nome,
        djenTexts,
        movimentos,
        tem_novo_andamento: !!caseData.tem_novo_andamento,
        tem_atualizacao_pos_retorno: !!caseData.tem_atualizacao_pos_retorno,
        djen_nova_comunicacao: !!caseData.djen_nova_comunicacao,
        datajud_encerrado_tribunal: !!caseData.datajud_encerrado_tribunal,
        indicio_busca_apreensao: !!caseData.indicio_busca_apreensao,
        em_cumprimento_sentenca: !!caseData.em_cumprimento_sentenca,
      });

      setWaScripts(
        scripts.map((s) => ({
          id: s.id,
          titulo: s.titulo,
          texto: String(s.texto || "")
            .replace(/
{3,}/g, "

")
            .trim()
            .slice(0, 1200),
          quandoUsar: s.quandoUsar,
        }))
      );

      toast({
        title: "Contexto do tribunal",
        description: `${movimentos.length} andamento(s) · ${comunicacoes.length} DJEN · ${scripts.length} script(s)`,
      });
    } catch (e: any) {
      toast({
        title: "Falha ao carregar andamentos",
        description: e?.message || "Tente de novo",
        variant: "destructive",
      });
    } finally {
      setLoadingTribunal(false);
    }
  };

  const handleGenerateAIDraft = async () => {
    if (!selected || isGeneratingAIDraft) return;
    setIsGeneratingAIDraft(true);
    setAiDraft(null);
    try {
      if (selectedMotor === "local_only") {
        if (waScripts[0]) {
          setAiDraft(waScripts[0].texto);
          setDraft(waScripts[0].texto);
        } else {
          await loadTribunalContext(selected);
        }
        toast({ title: "Motor local", description: "Script Lexis (sem API)" });
        return;
      }

      const djenTexts = djenComunicacoes
        .map((d: any) => plainTextFromDjen(d.texto || d.conteudo || ""))
        .filter(Boolean);

      // Garante contexto se ainda não carregou
      let movs = tribunalMovimentos;
      if (!movs.length && !djenTexts.length) {
        await loadTribunalContext(selected);
        movs = tribunalMovimentos;
      }

      const res = await gerarRascunhoEstrategico({
        clienteNome: selected.cliente,
        protocolo: selected.protocolo,
        ultimoRetorno: selected.ultimoRetorno,
        movimentos: movs.length ? movs : tribunalMovimentos,
        djenTexts:
          djenTexts.length > 0
            ? djenTexts
            : [selected.djen_ultimo_resumo, selected.evento_resumo].filter(Boolean).map(String),
        eventoTipo: selected.evento_tipo,
        eventoResumo: selected.evento_resumo,
        preferredModel: selectedMotor,
        tem_novo_andamento: selected.tem_novo_andamento,
        datajud_encerrado_tribunal: selected.datajud_encerrado_tribunal,
        indicio_busca_apreensao: selected.indicio_busca_apreensao,
        em_cumprimento_sentenca: selected.em_cumprimento_sentenca,
        // tom WhatsApp
        canal: "whatsapp",
      } as any);

      const text = (res as any)?.rascunho || (res as any)?.texto || (res as any)?.draft || "";
      if (text) {
        setAiDraft(text);
        setDraft(text);
        toast({
          title: "Rascunho IA",
          description: (res as any)?.engine || selectedMotor,
        });
      } else {
        toast({
          title: "Sem rascunho",
          description: (res as any)?.message || "Motor não retornou texto",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Erro IA", description: e?.message || "Falha", variant: "destructive" });
    } finally {
      setIsGeneratingAIDraft(false);
    }
  };

  const applyBestSuggestion = () => {
    // agora abre fluxo completo: andamentos + scripts
    void loadTribunalContext(selected);
  };



  // Deep link: /whatsapp?protocolo=&cliente=&tel= (vindo de Tarefas/Processos)
  useEffect(() => {
    if (deepLinkDone || loading || !cases.length) return;
    const proto = (searchParams.get("protocolo") || searchParams.get("cnj") || "").replace(/\D/g, "");
    const cliente = (searchParams.get("cliente") || "").trim().toLowerCase();
    const tel = digitsPhone(searchParams.get("tel") || searchParams.get("telefone") || "");
    if (!proto && !cliente && !tel) {
      setDeepLinkDone(true);
      return;
    }
    const found =
      cases.find((c) => proto && String(c.protocolo || "").replace(/\D/g, "") === proto) ||
      cases.find((c) => tel && digitsPhone(c.telefone) && digitsPhone(c.telefone).endsWith(tel.slice(-8))) ||
      cases.find((c) => cliente && String(c.cliente || "").toLowerCase() === cliente) ||
      cases.find((c) => cliente && String(c.cliente || "").toLowerCase().includes(cliente));
    if (found) {
      selectCase(found);
      setQ(found.cliente || found.protocolo || "");
      toast({
        title: "Contato aberto",
        description: `${found.cliente || "Cliente"} · terminal WhatsApp`,
      });
    } else if (cliente || tel) {
      setQ(cliente || tel);
      toast({
        title: "Contato não encontrado na carteira",
        description: "Use a busca à esquerda ou confira o telefone no cadastro.",
        variant: "destructive",
      });
    }
    setDeepLinkDone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases, loading, searchParams, deepLinkDone]);

  const persistLocal = (phone: string, msgs: ChatMsg[]) => {
    try {
      localStorage.setItem(`lexis_wa_local_${digitsPhone(phone)}`, JSON.stringify(msgs.slice(-80)));
    } catch {
      //
    }
  };

  const applySuggestion = (text: string) => {
    setDraft(text);
  };

  const openWaMe = () => {
    if (!selected?.telefone || !draft.trim()) {
      toast({ title: "Selecione contato e texto", variant: "destructive" });
      return;
    }
    openWhatsAppClient({ phone: selected.telefone, text: draft.trim() });
    const msg: ChatMsg = {
      id: `local-${Date.now()}`,
      direction: "out",
      body: draft.trim(),
      at: new Date().toISOString(),
      source: "wa.me",
    };
    const next = [...history.filter((h) => h.direction !== "system"), msg];
    setHistory(next);
    persistLocal(selected.telefone, next);
    toast({ title: "WhatsApp aberto", description: "Revise e envie no app do celular/desktop." });
  };

  const sendViaEvolution = async () => {
    if (!selected?.telefone || !draft.trim()) return;
    setSending(true);
    try {
      const res = await sendWhatsAppAction(selected.telefone, draft.trim());
      if (res?.success) {
        setEvolutionOk(true);
        const msg: ChatMsg = {
          id: `evo-${Date.now()}`,
          direction: "out",
          body: draft.trim(),
          at: new Date().toISOString(),
          source: "evolution",
        };
        const next = [...history.filter((h) => h.direction !== "system"), msg];
        setHistory(next);
        persistLocal(selected.telefone, next);
        setDraft("");
        toast({ title: "Enviado via Evolution" });
      } else {
        setEvolutionOk(false);
        toast({
          title: "Evolution indisponível",
          description: res?.message || "Use “Abrir no WhatsApp” (wa.me) sem API.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      setEvolutionOk(false);
      toast({
        title: "Falha no envio",
        description: e?.message || "Configure EVOLUTION_* ou use wa.me",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const copyDraft = async () => {
    if (!draft.trim()) return;
    await navigator.clipboard.writeText(draft);
    toast({ title: "Copiado" });
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-border/60 bg-card/80 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <MessageCircle size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="font-black uppercase text-sm sm:text-base tracking-tight truncate">
                Terminal WhatsApp
              </h1>
              <p className="text-[10px] text-muted-foreground font-medium truncate">
                Sugestões por andamento · Histórico · wa.me ou Evolution
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {evolutionOk === true && (
              <Badge className="bg-emerald-600 text-[9px] uppercase">Evolution OK</Badge>
            )}
            {evolutionOk === false && (
              <Badge variant="outline" className="text-[9px] uppercase text-amber-600 border-amber-300">
                Só wa.me
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={loadCases} className="h-9 w-9 rounded-xl">
              <RefreshCcw size={16} className={cn(loading && "animate-spin")} />
            </Button>
          </div>
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
          {/* Lista de contatos */}
          <aside className="lg:col-span-4 xl:col-span-3 border-r border-border/50 flex flex-col min-h-0 bg-card/40">
            <div className="p-3 border-b border-border/40">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cliente, CNJ ou telefone"
                  className="pl-9 h-10 rounded-xl bg-background border-border/60"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {loading && (
                  <div className="flex justify-center py-10 text-muted-foreground">
                    <Loader2 className="animate-spin" />
                  </div>
                )}
                {!loading && contacts.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8 px-4">
                    Nenhum contato com telefone válido na carteira ativa.
                  </p>
                )}
                {contacts.map((c) => {
                  const sig = signalBadge(c);
                  const active = selected?.protocolo === c.protocolo;
                  return (
                    <button
                      key={c.protocolo}
                      type="button"
                      onClick={() => selectCase(c)}
                      className={cn(
                        "w-full text-left rounded-xl p-3 transition-colors border border-transparent",
                        active
                          ? "bg-emerald-600/10 border-emerald-600/30"
                          : "hover:bg-muted/60"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User size={16} className="text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold truncate">{caseLabel(c)}</span>
                            {sig && (
                              <span
                                className={cn(
                                  "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                                  sig.className
                                )}
                              >
                                {sig.label}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                            {c.protocolo}
                          </p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone size={10} /> {c.telefone}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-2" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          {/* Conversa */}
          <section className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 min-w-0">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground gap-3">
                <MessageCircle size={40} className="opacity-30" />
                <p className="text-sm font-medium max-w-sm">
                  Selecione um cliente à esquerda. As sugestões usam o último sinal do tribunal
                  (DataJud / DJEN) gravado na carteira.
                </p>
                <AlertCircle size={16} className="opacity-40" />
                <p className="text-[11px] max-w-md leading-relaxed">
                  Histórico completo da conversa do WhatsApp só existe se a Evolution (ou Cloud API)
                  gravar mensagens no Supabase. Sem isso, usamos histórico local da sessão + wa.me.
                </p>
              </div>
            ) : (
              <>
                {/* Barra do contato */}
                <div className="shrink-0 border-b border-border/50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-card/50">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{caseLabel(selected)}</p>
                    <p className="text-[10px] font-mono text-muted-foreground truncate">
                      {selected.protocolo} · {selected.telefone}
                    </p>
                    {(selected.evento_resumo || selected.datajud_ultimo_nome || selected.djen_ultimo_resumo) && (
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 line-clamp-2">
                        Sinal:{" "}
                        {selected.evento_resumo ||
                          selected.datajud_ultimo_nome ||
                          selected.djen_ultimo_resumo}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild className="rounded-xl text-[10px] font-bold uppercase">
                    <Link href={`/cases?search=${encodeURIComponent(selected.protocolo)}`}>
                      Abrir processo
                    </Link>
                  </Button>
                </div>

                {/* Mensagens */}
                <ScrollArea className="flex-1 px-4 py-4">
                  {histLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-3 max-w-3xl mx-auto">
                      {history.map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            "flex",
                            m.direction === "out" && "justify-end",
                            m.direction === "in" && "justify-start",
                            m.direction === "system" && "justify-center"
                          )}
                        >
                          <div
                            className={cn(
                              "rounded-2xl px-3.5 py-2 text-sm max-w-[85%] shadow-sm",
                              m.direction === "out" && "bg-emerald-600 text-white rounded-br-md",
                              m.direction === "in" && "bg-muted text-foreground rounded-bl-md",
                              m.direction === "system" &&
                                "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-[11px] border border-amber-200/50"
                            )}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                            <p
                              className={cn(
                                "text-[9px] mt-1 opacity-60",
                                m.direction === "out" && "text-right"
                              )}
                            >
                              {m.source ? `${m.source} · ` : ""}
                              {m.at ? new Date(m.at).toLocaleString("pt-BR") : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                

                {/* Ações: andamentos + motores IA (como Tarefas) */}
                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 rounded-xl font-black uppercase text-[10px] tracking-wider gap-1.5 bg-amber-500 hover:bg-amber-600 text-black"
                    onClick={() => loadTribunalContext(selected)}
                    disabled={!selected || loadingTribunal}
                  >
                    {loadingTribunal ? <Loader2 size={14} className="animate-spin" /> : <FileSearch size={14} />}
                    Ver andamentos + scripts
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-xl font-black uppercase text-[10px] tracking-wider gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                    onClick={registerAttendance}
                    disabled={!selected || attSaving}
                  >
                    {attSaving ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                    Registrar atendimento
                  </Button>
                  {selected?.ultimoRetorno ? (
                    <span className="text-[9px] font-bold uppercase text-muted-foreground">
                      Último retorno: {selected.ultimoRetorno}
                    </span>
                  ) : null}
                </div>

                {/* Motor IA */}
                <div className="rounded-xl border border-border/60 bg-card/50 p-3 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <Sparkles size={12} /> Sugerir resposta · escolha o motor
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Select value={selectedMotor} onValueChange={setSelectedMotor}>
                      <SelectTrigger className="h-9 min-w-[200px] rounded-xl text-[10px] font-bold uppercase">
                        <SelectValue placeholder="Motor" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {MOTORS.map((m) => (
                          <SelectItem key={m.id} value={m.id} className="text-[10px] font-bold uppercase">
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 rounded-xl font-black uppercase text-[10px] gap-1.5"
                      onClick={handleGenerateAIDraft}
                      disabled={!selected || isGeneratingAIDraft || loadingTribunal}
                    >
                      {isGeneratingAIDraft ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      Gerar rascunho
                    </Button>
                  </div>
                  {aiDraft ? (
                    <div className="space-y-2">
                      <AiDraftPreview text={aiDraft} minHeight="100px" />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 w-full rounded-lg text-[9px] font-black uppercase"
                        onClick={() => setDraft(aiDraft)}
                      >
                        Usar no campo de envio
                      </Button>
                    </div>
                  ) : null}
                </div>

                {/* Andamentos do tribunal — para você validar se o texto está certo */}
                {(tribunalMovimentos.length > 0 || djenComunicacoes.length > 0 || loadingTribunal) && (
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2 max-h-48 overflow-y-auto">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground sticky top-0 bg-muted/20">
                      O que aconteceu no processo
                      {loadingTribunal ? " · carregando…" : ""}
                    </p>
                    {tribunalMovimentos.slice(0, 12).map((m: any, i: number) => (
                      <div key={`mv-${i}`} className="text-[11px] leading-snug border-l-2 border-primary/40 pl-2 py-0.5">
                        <span className="text-[9px] font-bold text-muted-foreground tabular-nums">
                          {m.dataHora || m.data || m.data_hora || "—"}
                        </span>
                        <p className="font-semibold text-foreground/90">
                          {m.nome || m.descricao || m.complemento || "Movimento"}
                        </p>
                        {(m.complemento || m.descricao) && (m.nome) ? (
                          <p className="text-muted-foreground line-clamp-2">
                            {plainTextFromDjen(String(m.complemento || m.descricao || ""))}
                          </p>
                        ) : null}
                      </div>
                    ))}
                    {djenComunicacoes.slice(0, 5).map((d: any, i: number) => (
                      <div key={`dj-${i}`} className="text-[11px] leading-snug border-l-2 border-blue-500/50 pl-2 py-0.5">
                        <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                          DJEN · {d.data_disponibilizacao || d.data || "—"}
                        </span>
                        <p className="font-semibold">{d.tipoComunicacao || d.tipoDocumento || "Comunicação"}</p>
                        <p className="text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                          {plainTextFromDjen(String(d.texto || d.conteudo || "")).slice(0, 500)}
                        </p>
                      </div>
                    ))}
                    {!loadingTribunal && !tribunalMovimentos.length && !djenComunicacoes.length ? (
                      <p className="text-[10px] text-muted-foreground">Nenhum andamento retornado. Rode o scanner no processo.</p>
                    ) : null}
                  </div>
                )}

                {/* Scripts locais (WhatsApp) */}
                {waScripts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <Sparkles size={12} /> Scripts prontos (tom WhatsApp)
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {waScripts.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setDraft(s.texto);
                            toast({ title: "Script aplicado", description: s.titulo });
                          }}
                          className="w-full text-left rounded-xl border border-border/50 bg-background/80 p-2.5 hover:border-primary/40 transition-colors"
                        >
                          <p className="text-[10px] font-black uppercase text-primary">{s.titulo}</p>
                          {s.quandoUsar ? (
                            <p className="text-[9px] text-muted-foreground mb-1">{s.quandoUsar}</p>
                          ) : null}
                          <p className="text-[11px] line-clamp-3 text-foreground/80 whitespace-pre-wrap">{s.texto}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Escreva a mensagem ou escolha uma sugestão acima…"
                    className="min-h-[88px] max-h-40 rounded-xl resize-none text-sm"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-1.5"
                      onClick={copyDraft}
                      disabled={!draft.trim()}
                    >
                      <Copy size={14} /> Copiar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="rounded-xl gap-1.5"
                      onClick={openWaMe}
                      disabled={!draft.trim()}
                    >
                      <ExternalLink size={14} /> Abrir no WhatsApp
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white ml-auto"
                      onClick={sendViaEvolution}
                      disabled={sending || !draft.trim()}
                    >
                      {sending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      Enviar (Evolution)
                    </Button>
                  </div>
                  <p className="text-[9px] text-muted-foreground leading-relaxed">
                    <strong>Abrir no WhatsApp</strong> não usa API (wa.me).{" "}
                    <strong>Enviar (Evolution)</strong> exige variáveis EVOLUTION_* na Vercel.
                    Histórico oficial de conversas depende de webhook/gravação no banco — o WhatsApp
                    não libera inbox completa sem Cloud API ou bridge.
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default function WhatsAppTerminalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
          Carregando terminal WhatsApp…
        </div>
      }
    >
      <WhatsAppTerminalInner />
    </Suspense>
  );
}
