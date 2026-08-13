"use client";

/**
 * Terminal WhatsApp — conversa + histórico + andamentos + motores IA + atendimento.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  MessageCircle,
  Search,
  Send,
  ExternalLink,
  Loader2, MoreHorizontal, Trash2,
  Sparkles,
  RefreshCcw,
  Copy,
  User,
  UserCheck,
  FileSearch,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  fetchRepoCases,
  registrarAtendimentoAction,
  registrarAtendimentoCompletoAction,
  scanSingleCaseAction,
} from "@/app/actions/case-actions";
import {
  sendWhatsAppAction,
  fetchWhatsAppHistoryAction,
  diagnoseWhatsAppStorageAction,
  logOutboundWhatsAppAction,
  testSaveWhatsAppMessageAction,
  importEvolutionHistoryAction,
} from "@/app/actions/whatsapp-actions";
import { clearWhatsAppHistoryAction } from "@/app/actions/whatsapp-history-actions";
import { saveOneCaseAction } from "@/app/actions/case-save-actions";
import { suggestScripts } from "@/lib/script-processual/suggest";
import { plainTextFromDjen } from "@/lib/djen";
import type { LegalCase } from "@/lib/case-logic";
import { openWhatsAppClient } from "@/lib/whatsapp-links";
import { gerarRascunhoEstrategico } from "@/ai/motor-despacho";
import { AiDraftPreview } from "@/components/ai/ai-draft-preview";
import { MOTORS } from "@/lib/ai/motors";
import {
  applyFilaListaToObs,
  parseFilaListaFromObs,
  type FilaLista,
} from "@/lib/fila-listas";

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
  if (c.tem_novo_andamento || c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao)
    return { label: "Novo andamento", className: "bg-amber-500 text-black" };
  return null;
}

function todayBR() {
  return new Date().toLocaleDateString("pt-BR");
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
  const [histDiag, setHistDiag] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [evolutionOk, setEvolutionOk] = useState<boolean | null>(null);

  const [attSaving, setAttSaving] = useState(false);
  const [attOpen, setAttOpen] = useState(false);
  const [attForm, setAttForm] = useState({
    situacao: "EM ANDAMENTO",
    observacao: "",
    proximoRetorno: "",
    filaLista: "normal" as FilaLista,
  });

  const [tribunalMovimentos, setTribunalMovimentos] = useState<any[]>([]);
  const [djenComunicacoes, setDjenComunicacoes] = useState<any[]>([]);
  const [loadingTribunal, setLoadingTribunal] = useState(false);
  const [selectedMotor, setSelectedMotor] = useState<string>("local_only");
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [isGeneratingAIDraft, setIsGeneratingAIDraft] = useState(false);
  const [waScripts, setWaScripts] = useState<
    { id: string; titulo: string; texto: string; quandoUsar?: string }[]
  >([]);

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
    const withPhone = cases.filter((c) => digitsPhone(c.telefone).length >= 8);
    const base = withPhone.length ? withPhone : cases;
    if (!term) return base.slice(0, 80);
    return base
      .filter((c) => {
        const nome = String(c.cliente || "").toLowerCase();
        const proto = String(c.protocolo || "").toLowerCase();
        const tel = digitsPhone(c.telefone);
        return (
          nome.includes(term) ||
          proto.includes(term) ||
          (termDigits.length >= 4 && tel.includes(termDigits))
        );
      })
      .slice(0, 80);
  }, [cases, q]);

  const loadHistory = useCallback(async (c: LegalCase) => {
    setHistLoading(true);
    setHistory([]);
    setHistDiag("");
    try {
      const diag = await diagnoseWhatsAppStorageAction(c.telefone || "");
      if (diag?.hint) setHistDiag(String(diag.hint));

      const res = await fetchWhatsAppHistoryAction(c.telefone || "");
      if (res?.success && Array.isArray(res.messages) && res.messages.length > 0) {
        const mapped: ChatMsg[] = res.messages
          .map((m: any, i: number) => {
            const body = String(
              m.message_text || m.body || m.message || m.text || ""
            ).trim();
            const fromMe =
              m.from_me === true || m.fromMe === true || m.direction === "out";
            return {
              id: String(m.id || m.message_id || i),
              direction: (fromMe ? "out" : "in") as "out" | "in",
              body,
              at: m.timestamp || m.created_at || new Date().toISOString(),
              source: m.source || "db",
            };
          })
          .filter((m) => m.body);
        setHistory(mapped);
        setHistDiag(`Histórico: ${mapped.length} mensagem(ns) no Supabase`);
      } else {
        const key = `lexis_wa_local_${digitsPhone(c.telefone)}`;
        const raw =
          typeof window !== "undefined" ? localStorage.getItem(key) : null;
        if (raw) {
          setHistory(JSON.parse(raw));
        } else {
          const tip =
            diag?.hint ||
            "Sem mensagens no Supabase para este número. Envie 1 mensagem pelo botão Enviar (Evolution) e reabra o contato.";
          setHistory([
            {
              id: "sys-1",
              direction: "system",
              body: tip,
              at: new Date().toISOString(),
            },
          ]);
        }
      }
    } catch (e: any) {
      setHistory([
        {
          id: "sys-err",
          direction: "system",
          body: e?.message || "Não foi possível carregar o histórico remoto.",
          at: new Date().toISOString(),
        },
      ]);
    } finally {
      setHistLoading(false);
    }
  }, []);

  const selectCase = (c: LegalCase) => {
    setSelected(c);
    setDraft("");
    setAiDraft(null);
    setTribunalMovimentos([]);
    setDjenComunicacoes([]);
    setWaScripts([]);
    loadHistory(c);
  };

  const sortedByOverdue = useMemo(() => {
    const withPhone = cases.filter((c) => digitsPhone(c.telefone).length >= 8);
    const base = withPhone.length ? withPhone : cases;
    return [...base].sort((a, b) => {
      const da = typeof a.diasFaltando === "number" ? a.diasFaltando! : 9999;
      const db = typeof b.diasFaltando === "number" ? b.diasFaltando! : 9999;
      if (da !== db) return da - db;
      const score = (s: string) =>
        s === "Vencido" ? 0 : s === "É Hoje" ? 1 : s === "Atenção" ? 2 : 3;
      return score(String(a.status || "")) - score(String(b.status || ""));
    });
  }, [cases]);

  const goAdjacentOverdue = (mode: "mais_vencido" | "menos_vencido") => {
    const list =
      mode === "mais_vencido" ? sortedByOverdue : [...sortedByOverdue].reverse();
    if (!list.length) {
      toast({ title: "Sem casos na carteira", variant: "destructive" });
      return;
    }
    const start = !selected
      ? 0
      : (() => {
          const idx = list.findIndex((c) => c.protocolo === selected.protocolo);
          return idx >= 0 ? (idx + 1) % list.length : 0;
        })();
    const next = list[start];
    selectCase(next);
    toast({
      title:
        mode === "mais_vencido"
          ? "Próximo (mais tempo vencido)"
          : "Próximo (menos tempo vencido)",
      description: `${next.cliente} · ${next.status || "—"}${
        typeof next.diasFaltando === "number" ? ` · ${next.diasFaltando}d` : ""
      }`,
    });
  };

  useEffect(() => {
    if (deepLinkDone || loading || !cases.length) return;
    const proto = (
      searchParams.get("protocolo") ||
      searchParams.get("cnj") ||
      ""
    ).replace(/\D/g, "");
    const cliente = (searchParams.get("cliente") || "").trim().toLowerCase();
    const tel = digitsPhone(
      searchParams.get("tel") || searchParams.get("telefone") || ""
    );
    if (!proto && !cliente && !tel) {
      setDeepLinkDone(true);
      return;
    }
    const found =
      cases.find(
        (c) => proto && String(c.protocolo || "").replace(/\D/g, "") === proto
      ) ||
      cases.find(
        (c) =>
          tel &&
          digitsPhone(c.telefone) &&
          digitsPhone(c.telefone).endsWith(tel.slice(-8))
      ) ||
      cases.find(
        (c) => cliente && String(c.cliente || "").toLowerCase() === cliente
      ) ||
      cases.find(
        (c) =>
          cliente && String(c.cliente || "").toLowerCase().includes(cliente)
      );
    if (found) {
      selectCase(found);
      setQ(found.cliente || found.protocolo || "");
      toast({
        title: "Contato aberto",
        description: `${found.cliente || "Cliente"} · terminal WhatsApp`,
      });
    } else if (cliente || tel) {
      setQ(cliente || tel);
    }
    setDeepLinkDone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases, loading, searchParams, deepLinkDone]);

  const persistLocal = (phone: string, msgs: ChatMsg[]) => {
    try {
      localStorage.setItem(
        `lexis_wa_local_${digitsPhone(phone)}`,
        JSON.stringify(msgs.slice(-80))
      );
    } catch {
      /* ignore */
    }
  };

  const openAttendanceDialog = () => {
    if (!selected) {
      toast({ title: "Selecione um contato", variant: "destructive" });
      return;
    }
    setAttForm({
      situacao: selected.situacao === "ENCERRADO" ? "ENCERRADO" : "EM ANDAMENTO",
      observacao:
        selected.observacao ||
        (draft.trim() ? draft.trim().slice(0, 400) : ""),
      proximoRetorno: "",
      filaLista: parseFilaListaFromObs(selected.observacao),
    });
    setAttOpen(true);
  };

  const registerAttendance = async () => {
    if (!selected || attSaving) return;
    setAttSaving(true);
    try {
      const situacao =
        attForm.situacao === "ENCERRADO" ? "ENCERRADO" : "EM ANDAMENTO";
      let proximo = attForm.proximoRetorno || "";
      if (proximo && /^\d{4}-\d{2}-\d{2}/.test(proximo)) {
        const [y, m, d] = proximo.slice(0, 10).split("-");
        proximo = `${d}/${m}/${y}`;
      }
      const res = await registrarAtendimentoCompletoAction({
        protocolo: selected.protocolo,
        situacao,
        observacao: attForm.observacao || selected.observacao || "",
        proximoPrazo: situacao === "ENCERRADO" ? "" : proximo || selected.proximoPrazo,
        via: "whatsapp-terminal",
        filaLista: attForm.filaLista || "normal",
      });
      if (res.success) {
        const updated = (res as any).case || {
          ...selected,
          situacao,
          ultimoRetorno: (res as any).ultimoRetorno,
          observacao: attForm.observacao,
        };
        setSelected(updated);
        setCases((prev) =>
          prev.map((c) =>
            c.protocolo === selected.protocolo ? { ...c, ...updated } : c
          )
        );
        setAttOpen(false);
        toast({
          title:
            situacao === "ENCERRADO"
              ? "Caso encerrado"
              : "Atendimento registrado",
          description: `${selected.cliente} · ${(res as any).ultimoRetorno || "hoje"} · sincronizado com Tarefas/Processos`,
        });
      } else {
        toast({
          title: "Falha ao registrar",
          description: (res as any).message || "Tente de novo",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.message || "Não foi possível salvar",
        variant: "destructive",
      });
    } finally {
      setAttSaving(false);
    }
  };

  const loadTribunalContext = async (c?: LegalCase | null) => {
    const target = c || selected;
    if (!target?.protocolo) {
      toast({ title: "Selecione um processo", variant: "destructive" });
      return;
    }
    setLoadingTribunal(true);
    setAiDraft(null);
    try {
      const res = await scanSingleCaseAction(target.protocolo, {
        mode: "both",
        fast: false,
      });
      const movimentos = Array.isArray((res as any).movimentos)
        ? (res as any).movimentos.slice(0, 40)
        : [];
      const comunicacoes = Array.isArray((res as any).comunicacoes)
        ? (res as any).comunicacoes
        : [];
      const caseData = (res as any).case || target;

      setTribunalMovimentos(movimentos);
      setDjenComunicacoes(comunicacoes);
      if (caseData?.protocolo) {
        setSelected((prev) => (prev ? { ...prev, ...caseData } : caseData));
      }

      const djenTexts = comunicacoes
        .map((d: any) =>
          plainTextFromDjen(d.texto || d.conteudo || d.inteiroTeor || "")
        )
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
        scripts.map((s, idx) => ({
          id: String(s.id || `script-${idx}`),
          titulo: String(s.titulo || "Sugestão"),
          texto: String(s.texto || "")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .slice(0, 1200),
          quandoUsar: s.quandoUsar ? String(s.quandoUsar) : undefined,
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

      let movs = tribunalMovimentos;
      let djenTexts = djenComunicacoes
        .map((d: any) => plainTextFromDjen(d.texto || d.conteudo || ""))
        .filter(Boolean);

      if (!movs.length && !djenTexts.length) {
        await loadTribunalContext(selected);
        movs = tribunalMovimentos;
        djenTexts = djenComunicacoes
          .map((d: any) => plainTextFromDjen(d.texto || d.conteudo || ""))
          .filter(Boolean);
      }

      const res = await gerarRascunhoEstrategico({
        clienteNome: selected.cliente,
        protocolo: selected.protocolo,
        ultimoRetorno: selected.ultimoRetorno,
        movimentos: movs,
        djenTexts:
          djenTexts.length > 0
            ? djenTexts
            : [selected.djen_ultimo_resumo, selected.evento_resumo]
                .filter(Boolean)
                .map(String),
        eventoTipo: selected.evento_tipo,
        eventoResumo: selected.evento_resumo,
        preferredModel: selectedMotor,
        tem_novo_andamento: selected.tem_novo_andamento,
        datajud_encerrado_tribunal: selected.datajud_encerrado_tribunal,
        indicio_busca_apreensao: selected.indicio_busca_apreensao,
        em_cumprimento_sentenca: selected.em_cumprimento_sentenca,
      } as any);

      const text =
        (res as any)?.rascunho ||
        (res as any)?.texto ||
        (res as any)?.draft ||
        "";
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
      toast({
        title: "Erro IA",
        description: e?.message || "Falha",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAIDraft(false);
    }
  };

  const openWaMe = () => {
    if (!selected?.telefone || !draft.trim()) {
      toast({ title: "Selecione contato e texto", variant: "destructive" });
      return;
    }
    openWhatsAppClient({ phone: selected.telefone, text: draft.trim() });
    void logOutboundWhatsAppAction(selected.telefone, draft.trim());
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
    toast({
      title: "WhatsApp aberto",
      description: "Revise e envie no app do celular/desktop.",
    });
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
        if ((res as any).persisted === false) {
          toast({
            title: "Enviado no WhatsApp, mas NÃO gravou no Supabase",
            description: (res as any).persistError || "Confira SUPABASE_SERVICE_ROLE_KEY e a tabela",
            variant: "destructive",
          });
        } else {
          toast({ title: "Enviado e gravado no histórico" });
        }
        void loadHistory(selected);
      } else {
        setEvolutionOk(false);
        toast({
          title: "Evolution indisponível",
          description: res?.message || "Use Abrir no WhatsApp (wa.me).",
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
    <>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
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
                  Andamentos · motores IA · histórico · Evolution / wa.me
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl gap-1.5 text-[10px] font-bold uppercase"
                title="Próximo caso com mais tempo vencido (prazo mais atrasado)"
                onClick={() => goAdjacentOverdue("mais_vencido")}
              >
                <ArrowDownWideNarrow size={14} />
                <span className="hidden sm:inline">Mais vencido</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl gap-1.5 text-[10px] font-bold uppercase"
                title="Próximo caso com menos tempo vencido (ou ainda no prazo)"
                onClick={() => goAdjacentOverdue("menos_vencido")}
              >
                <ArrowUpNarrowWide size={14} />
                <span className="hidden sm:inline">Menos vencido</span>
              </Button>
              {evolutionOk === true && (
                <Badge className="bg-emerald-600 text-[9px] uppercase">
                  Evolution OK
                </Badge>
              )}
              {evolutionOk === false && (
                <Badge
                  variant="outline"
                  className="text-[9px] uppercase text-amber-600 border-amber-300"
                >
                  Só wa.me
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={loadCases}
                className="h-9 w-9 rounded-xl"
              >
                <RefreshCcw size={16} className={cn(loading && "animate-spin")} />
              </Button>
            </div>
          </header>

          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
            {/* Lista */}
            <aside className="lg:col-span-4 xl:col-span-3 border-r border-border/50 flex flex-col min-h-0 bg-card/40">
              <div className="p-3 border-b border-border/40">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    size={14}
                  />
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
                  {!loading &&
                    contacts.map((c) => {
                      const badge = signalBadge(c);
                      const active = selected?.protocolo === c.protocolo;
                      return (
                        <button
                          key={c.protocolo || c.cliente}
                          type="button"
                          onClick={() => selectCase(c)}
                          className={cn(
                            "w-full text-left rounded-xl px-3 py-2.5 border transition-colors",
                            active
                              ? "border-emerald-500/40 bg-emerald-500/10"
                              : "border-transparent hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <User size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-black uppercase truncate">
                                {caseLabel(c)}
                              </p>
                              <p className="text-[10px] text-muted-foreground tabular-nums truncate">
                                {c.protocolo}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {c.telefone || "Sem telefone"}
                              </p>
                            </div>
                            {badge && (
                              <span
                                className={cn(
                                  "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                                  badge.className
                                )}
                              >
                                {badge.label}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </ScrollArea>
            </aside>

            {/* Chat + ações */}
            <section className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0">
              {!selected ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
                  Selecione um cliente à esquerda (ou abra pelo botão WhatsApp em
                  Tarefas/Processos).
                </div>
              ) : (
                <>
                  <div className="shrink-0 border-b border-border/40 px-4 py-3 flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-black uppercase text-sm truncate">
                        {selected.cliente}
                      </p>
                      <p className="text-[10px] text-muted-foreground tabular-nums truncate">
                        {selected.protocolo} · {selected.telefone || "sem tel."}
                        {selected.ultimoRetorno
                          ? ` · retorno ${selected.ultimoRetorno}`
                          : ""}
                        {histDiag ? ` · ${histDiag}` : ""}
                      </p>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 px-4 py-3">
                    <div className="space-y-2 max-w-3xl mx-auto">
                      {histLoading && (
                        <div className="flex justify-center py-6">
                          <Loader2 className="animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {history.map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            "rounded-2xl px-3 py-2 text-[13px] max-w-[90%] whitespace-pre-wrap",
                            m.direction === "out"
                              ? "ml-auto bg-emerald-600 text-white"
                              : m.direction === "system"
                                ? "mx-auto bg-muted text-muted-foreground text-center text-[11px]"
                                : "mr-auto bg-card border border-border/50"
                          )}
                        >
                          {m.body}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="shrink-0 border-t border-border/50 p-3 space-y-3 bg-card/30 max-h-[55vh] overflow-y-auto">
                    <div className="flex flex-wrap gap-2 items-center">
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 rounded-xl font-semibold text-[11px] gap-1.5 bg-amber-500 hover:bg-amber-600 text-black"
                        onClick={() => loadTribunalContext(selected)}
                        disabled={loadingTribunal}
                      >
                        {loadingTribunal ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <FileSearch size={14} />
                        )}
                        Andamentos
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-xl font-semibold text-[11px] gap-1.5"
                        onClick={openAttendanceDialog}
                        disabled={attSaving}
                      >
                        <UserCheck size={14} />
                        Atendimento
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" size="sm" variant="ghost" className="h-9 rounded-xl text-[11px] gap-1.5">
                            <MoreHorizontal size={16} />
                            Mais
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-60">
                          <DropdownMenuItem
                            disabled={!selected?.telefone || histLoading}
                            onClick={async () => {
                              if (!selected?.telefone) {
                                toast({ title: "Cliente sem telefone", variant: "destructive" });
                                return;
                              }
                              setHistLoading(true);
                              try {
                                const r: any = await importEvolutionHistoryAction(selected.telefone);
                                if (r.success) {
                                  toast({
                                    title: "Histórico importado",
                                    description: `${r.imported || 0} msg deste número` + (r.skippedWrong ? ` · ${r.skippedWrong} de outro número ignoradas` : ""),
                                  });
                                  try {
                                    // recarrega thread
                                    const { fetchWhatsAppHistoryAction } = await import("@/app/actions/whatsapp-actions");
                                    const h = await fetchWhatsAppHistoryAction(selected.telefone);
                                    if (h?.messages) {
                                      const mapped = (h.messages || []).map((m: any, i: number) => {
                                        const body = String(m.message_text || m.body || m.message || m.text || "").trim();
                                        const fromMe = m.from_me === true || m.fromMe === true || m.direction === "out";
                                        return {
                                          id: String(m.id || m.message_id || i),
                                          direction: (fromMe ? "out" : "in") as "out" | "in",
                                          body,
                                          at: m.timestamp || m.created_at || new Date().toISOString(),
                                          source: m.source || "db",
                                        };
                                      }).filter((m: any) => m.body);
                                      setHistory(mapped);
                                    };
                                  } catch { /* ignore */ }
                                } else {
                                  toast({ title: "Importação falhou", description: r.error || "Sem mensagens", variant: "destructive" });
                                }
                              } finally {
                                setHistLoading(false);
                              }
                            }}
                          >
                            Importar Evolution (este número)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!selected?.telefone}
                            className="text-destructive focus:text-destructive"
                            onClick={async () => {
                              if (!selected?.telefone) return;
                              if (!confirm("Apagar do Supabase o histórico deste telefone?")) return;
                              const r: any = await clearWhatsAppHistoryAction(selected.telefone);
                              if (r.success) {
                                toast({ title: "Histórico limpo", description: `${r.deleted ?? 0} removida(s)` });
                                setHistory([]);
                              } else {
                                toast({ title: "Falha ao limpar", description: r.error, variant: "destructive" });
                              }
                            }}
                          >
                            Limpar histórico deste número
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={!selected?.telefone}
                            onClick={async () => {
                              if (!selected?.telefone) return;
                              const r: any = await testSaveWhatsAppMessageAction(selected.telefone);
                              toast({
                                title: r.success ? "Teste OK" : "Teste falhou",
                                description: r.success ? `${r.count} msg` : r.error,
                                variant: r.success ? undefined : "destructive",
                              });
                            }}
                          >
                            Testar gravação Supabase
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-card/50 p-3 space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Sparkles size={12} /> Sugerir resposta · motor IA
                      </p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <Select
                          value={selectedMotor}
                          onValueChange={setSelectedMotor}
                        >
                          <SelectTrigger className="h-9 min-w-[200px] rounded-xl text-[10px] font-bold uppercase">
                            <SelectValue placeholder="Motor" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {MOTORS.map((m) => (
                              <SelectItem
                                key={m.id}
                                value={m.id}
                                className="text-[10px] font-bold uppercase"
                              >
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
                          disabled={isGeneratingAIDraft || loadingTribunal}
                        >
                          {isGeneratingAIDraft ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Sparkles size={14} />
                          )}
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

                    {(tribunalMovimentos.length > 0 ||
                      djenComunicacoes.length > 0 ||
                      loadingTribunal) && (
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2 max-h-44 overflow-y-auto">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          O que aconteceu no processo
                          {loadingTribunal ? " · carregando…" : ""}
                        </p>
                        {tribunalMovimentos.slice(0, 12).map((m: any, i: number) => (
                          <div
                            key={`mv-${i}`}
                            className="text-[11px] leading-snug border-l-2 border-primary/40 pl-2 py-0.5"
                          >
                            <span className="text-[9px] font-bold text-muted-foreground tabular-nums">
                              {m.dataHora || m.data || m.data_hora || "—"}
                            </span>
                            <p className="font-semibold text-foreground/90">
                              {m.nome || m.descricao || m.complemento || "Movimento"}
                            </p>
                            {m.complemento || m.descricao ? (
                              <p className="text-muted-foreground line-clamp-2">
                                {plainTextFromDjen(
                                  String(m.complemento || m.descricao || "")
                                )}
                              </p>
                            ) : null}
                          </div>
                        ))}
                        {djenComunicacoes.slice(0, 5).map((d: any, i: number) => (
                          <div
                            key={`dj-${i}`}
                            className="text-[11px] leading-snug border-l-2 border-blue-500/50 pl-2 py-0.5"
                          >
                            <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                              DJEN · {d.data_disponibilizacao || d.data || "—"}
                            </span>
                            <p className="font-semibold">
                              {d.tipoComunicacao || d.tipoDocumento || "Comunicação"}
                            </p>
                            <p className="text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                              {plainTextFromDjen(
                                String(d.texto || d.conteudo || "")
                              ).slice(0, 500)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {waScripts.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Scripts prontos (tom WhatsApp)
                        </p>
                        <div className="space-y-2 max-h-36 overflow-y-auto">
                          {waScripts.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setDraft(s.texto);
                                toast({
                                  title: "Script aplicado",
                                  description: s.titulo,
                                });
                              }}
                              className="w-full text-left rounded-xl border border-border/50 bg-background/80 p-2.5 hover:border-primary/40 transition-colors"
                            >
                              <p className="text-[10px] font-black uppercase text-primary">
                                {s.titulo}
                              </p>
                              {s.quandoUsar ? (
                                <p className="text-[9px] text-muted-foreground mb-1">
                                  {s.quandoUsar}
                                </p>
                              ) : null}
                              <p className="text-[11px] line-clamp-3 text-foreground/80 whitespace-pre-wrap">
                                {s.texto}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Mensagem para o cliente…"
                      className="min-h-[90px] rounded-xl text-[13px]"
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
                  </div>
                </>
              )}
            </section>
          </div>
        </main>
      </div>

      <Dialog open={attOpen} onOpenChange={setAttOpen}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <UserCheck size={18} className="text-emerald-600" />
              Registrar atendimento
            </DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <p className="text-[11px] font-bold text-muted-foreground">
                {selected.cliente}
                <span className="block tabular-nums text-[10px]">
                  {selected.protocolo}
                </span>
              </p>

              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase">Resultado</Label>
                <Select
                  value={attForm.situacao}
                  onValueChange={(v) => setAttForm({ ...attForm, situacao: v })}
                >
                  <SelectTrigger className="h-11 rounded-xl text-[11px] font-bold uppercase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="EM ANDAMENTO"
                      className="text-[10px] font-bold uppercase"
                    >
                      Manter ativo
                    </SelectItem>
                    <SelectItem
                      value="ENCERRADO"
                      className="text-[10px] font-bold uppercase text-red-600"
                    >
                      Encerrar caso
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {attForm.situacao !== "ENCERRADO" ? (
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase">
                    Próximo retorno
                  </Label>
                  <Input
                    type="date"
                    value={attForm.proximoRetorno}
                    onChange={(e) =>
                      setAttForm({ ...attForm, proximoRetorno: e.target.value })
                    }
                    className="h-11 rounded-xl"
                  />
                </div>
              ) : (
                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                  Ao encerrar, o prazo de retorno é limpo e o caso sai da fila
                  ativa.
                </p>
              )}

              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase">
                  Observações
                </Label>
                <Textarea
                  value={attForm.observacao}
                  onChange={(e) =>
                    setAttForm({ ...attForm, observacao: e.target.value })
                  }
                  placeholder="Resumo do contato, combinados, pendências…"
                  className="min-h-[100px] rounded-xl text-[12px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase">
                  Lista da fila
                </Label>
                <Select
                  value={attForm.filaLista || "normal"}
                  onValueChange={(v) =>
                    setAttForm({ ...attForm, filaLista: v as FilaLista })
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl text-[11px] font-bold uppercase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="normal"
                      className="text-[10px] font-bold uppercase"
                    >
                      Fila normal
                    </SelectItem>
                    <SelectItem
                      value="tratamento"
                      className="text-[10px] font-bold uppercase"
                    >
                      Crítico em tratamento
                    </SelectItem>
                    <SelectItem
                      value="blacklist"
                      className="text-[10px] font-bold uppercase"
                    >
                      Blacklist / problemático
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAttOpen(false)}
              disabled={attSaving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={registerAttendance}
              disabled={attSaving || !selected}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {attSaving ? (
                <Loader2 size={14} className="animate-spin mr-2" />
              ) : null}
              Salvar atendimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
