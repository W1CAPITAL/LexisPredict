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
  UsersRound,
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
  importEvolutionHistoryBulkAction,
  listEvolutionChatsAction,
  fetchEvolutionChatByJidAction,
} from "@/app/actions/whatsapp-actions";
import { clearWhatsAppHistoryAction } from "@/app/actions/whatsapp-history-actions";
import { saveOneCaseAction } from "@/app/actions/case-save-actions";
import { suggestScripts } from "@/lib/script-processual/suggest";
import { plainTextFromDjen } from "@/lib/djen";
import { buildUnifiedTimeline } from "@/lib/timeline-normalize";
import { processarCaso, type LegalCase } from "@/lib/case-logic";
import { openWhatsAppClient } from "@/lib/whatsapp-links";
import { gerarRascunhoEstrategico } from "@/ai/motor-despacho";
import { AiDraftPreview } from "@/components/ai/ai-draft-preview";
import { MOTORS, loadPreferredMotor, resolveMotorId } from "@/lib/ai/motors";
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

function normalizeMovList(movs: any): any[] {
  if (!Array.isArray(movs)) return [];
  return movs.slice(0, 80).map((m: any) => ({
    ...m,
    dataHora: m?.dataHora || m?.data || m?.dataMovimento || null,
    nome: m?.nome || m?.nomeMovimento || m?.descricao || "Movimentação",
    complemento: m?.complemento || m?.observacao || "",
  }));
}


/** Telefone do caso com aliases comuns do banco/CSV */
function casePhone(c?: { telefone?: string | null; phone?: string | null; celular?: string | null; whatsapp?: string | null } | null) {
  if (!c) return "";
  const raw =
    c.telefone ||
    (c as any).phone ||
    (c as any).celular ||
    (c as any).whatsapp ||
    (c as any).TEL ||
    (c as any).telefone_cliente ||
    "";
  return String(raw || "").trim();
}

function casePhoneDigits(c?: any) {
  return digitsPhone(casePhone(c));
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
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  /** Ordenação só da lista lateral — não troca o contato aberto */
  const [listSortMode, setListSortMode] = useState<"default" | "mais_vencido" | "menos_vencido">("default");
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
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
  const [selectedMotor, setSelectedMotor] = useState<string>("omni");
  const [listSource, setListSource] = useState<"carteira" | "evolution">("carteira");
  const [evoChats, setEvoChats] = useState<
    { jid: string; name: string; isGroup: boolean; lastMessage?: string }[]
  >([]);
  const [evoLoading, setEvoLoading] = useState(false);
  const [evoOnlyGroups, setEvoOnlyGroups] = useState(true);
  const [selectedEvoJid, setSelectedEvoJid] = useState<string | null>(null);
  const [selectedEvoName, setSelectedEvoName] = useState<string>("");

  useEffect(() => {
    try {
      const m = resolveMotorId(loadPreferredMotor());
      // Respeita o motor salvo (não força tudo para omni)
      if (m) setSelectedMotor(m);
    } catch { /* ignore */ }
  }, []);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [isGeneratingAIDraft, setIsGeneratingAIDraft] = useState(false);
  const [waScripts, setWaScripts] = useState<
    { id: string; titulo: string; texto: string; quandoUsar?: string }[]
  >([]);

  /** Histórico do tribunal adaptado ao terminal: DataJud + DJEN unificados, cronológico */
  const historicoTribunal = useMemo(
    () => buildUnifiedTimeline(tribunalMovimentos, djenComunicacoes).slice(0, 20),
    [tribunalMovimentos, djenComunicacoes]
  );

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRepoCases();
      const list = Array.isArray(data) ? data : [];
      // Mesma base da aba Processos: processarCaso para status/prazo/flags
      setCases(
        list.map((c: any) => {
          try {
            return processarCaso({ ...c }) as LegalCase;
          } catch {
            return c as LegalCase;
          }
        })
      );
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
    // Sempre considera a carteira inteira (com e sem telefone) — senão a busca some nomes
    let base = [...cases];
    // Com busca: prioriza match de nome/protocolo/tel em TODOS
    if (term) {
      base = base.filter((c) => {
        const nome = String(c.cliente || "").toLowerCase();
        const proto = String(c.protocolo || "").toLowerCase();
        const tel = casePhoneDigits(c);
        const nomeNorm = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const termNorm = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return (
          nome.includes(term) ||
          nomeNorm.includes(termNorm) ||
          proto.includes(term) ||
          proto.replace(/\D/g, "").includes(termDigits) ||
          (termDigits.length >= 3 && tel.includes(termDigits))
        );
      });
    } else {
      // Sem busca: mostra com telefone primeiro, depois sem (até 120)
      base.sort((a, b) => {
        const pa = casePhoneDigits(a).length >= 8 ? 0 : 1;
        const pb = casePhoneDigits(b).length >= 8 ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return String(a.cliente || "").localeCompare(String(b.cliente || ""), "pt-BR");
      });
    }
    if (listSortMode !== "default") {
      const sorted = [...base].sort((a, b) => {
        const da = typeof a.diasFaltando === "number" ? a.diasFaltando! : 9999;
        const db = typeof b.diasFaltando === "number" ? b.diasFaltando! : 9999;
        if (da !== db) return da - db;
        const score = (s: string) =>
          s === "Vencido" ? 0 : s === "É Hoje" ? 1 : s === "Atenção" ? 2 : 3;
        return score(String(a.status || "")) - score(String(b.status || ""));
      });
      base = listSortMode === "mais_vencido" ? sorted : [...sorted].reverse();
    }
    return base.slice(0, 500);
  }, [cases, q, listSortMode]);

  const loadHistory = useCallback(async (c: LegalCase) => {
    setHistLoading(true);
    setHistDiag("");
    try {
      const diag = await diagnoseWhatsAppStorageAction(casePhone(c) || "");
      if (diag?.hint) setHistDiag(String(diag.hint));

      const res = await fetchWhatsAppHistoryAction(casePhone(c) || "");
      const junkSys = (body: string) =>
        /deve aparecer no hist[oó]rico/i.test(body) ||
        /^OK\s*[—\-–]/.test(body.trim()) ||
        body.trim() === "OK";

      const fromDb: ChatMsg[] = (
        res?.success && Array.isArray(res.messages) ? res.messages : []
      )
        .map((m: any, i: number) => {
          const body = String(
            m.message_text || m.body || m.message || m.text || ""
          ).trim();
          const fromMe =
            m.from_me === true || m.fromMe === true || m.direction === "out";
          return {
            id: String(m.id || m.message_id || `db-${i}`),
            direction: (fromMe ? "out" : "in") as "out" | "in",
            body,
            at: m.timestamp || m.created_at || new Date().toISOString(),
            source: m.source || "db",
          };
        })
        .filter((m) => m.body && !junkSys(m.body));

      // Histórico local (navegador) — não descarta ao recarregar
      let fromLocal: ChatMsg[] = [];
      try {
        const key = `lexis_wa_local_${casePhoneDigits(c) || String(c.protocolo || "").replace(/\D/g, "")}`;
        const raw =
          typeof window !== "undefined" ? localStorage.getItem(key) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            fromLocal = parsed.filter(
              (m: any) => m && m.body && m.direction !== "system"
            );
          }
        }
      } catch {
        /* ignore */
      }

      // Merge por id + (body+at) para não perder antigas nem duplicar
      const seen = new Set<string>();
      const merged: ChatMsg[] = [];
      for (const m of [...fromDb, ...fromLocal]) {
        const k = `${m.id}|${m.body}|${String(m.at).slice(0, 16)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(m);
      }
      merged.sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
      );

      if (merged.length > 0) {
        setHistory(merged);
        setHistDiag(
          `Histórico: ${fromDb.length} no Supabase` +
            (fromLocal.length ? ` · ${fromLocal.length} local` : "") +
            ` · ${merged.length} total`
        );
      } else {
        const tip =
          diag?.hint ||
          "Sem mensagens neste número. Importe da Evolution ou envie uma mensagem.";
        setHistory([
          {
            id: "sys-1",
            direction: "system",
            body: tip,
            at: new Date().toISOString(),
          },
        ]);
        setHistDiag(tip);
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

  const loadEvolutionChats = useCallback(async (onlyGroups?: boolean) => {
    setEvoLoading(true);
    try {
      const res = await listEvolutionChatsAction({
        onlyGroups: onlyGroups ?? evoOnlyGroups,
        limit: 300,
      });
      if (!res.success) {
        toast({ title: "Evolution — chats", description: res.error || "Falha", variant: "destructive" });
        setEvoChats([]);
        return;
      }
      setEvoChats(res.chats || []);
      toast({ title: "Chats Evolution", description: `${(res.chats || []).length} conversa(s)` });
    } catch (e: any) {
      toast({ title: "Erro chats", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setEvoLoading(false);
    }
  }, [evoOnlyGroups, toast]);

  const selectEvolutionChat = async (chat: { jid: string; name: string; isGroup: boolean }) => {
    setSelected(null);
    setSelectedEvoJid(chat.jid);
    setSelectedEvoName(chat.name || chat.jid);
    setDraft("");
    setAiDraft(null);
    setTribunalMovimentos([]);
    setDjenComunicacoes([]);
    setWaScripts([]);
    setHistLoading(true);
    try {
      const res = await fetchEvolutionChatByJidAction(chat.jid);
      if (res.success) setHistory(res.messages || []);
      else {
        setHistory([]);
        toast({ title: "Histórico", description: res.error || "Sem mensagens", variant: "destructive" });
      }
    } finally {
      setHistLoading(false);
    }
  };

  const selectCase = (c: LegalCase) => {
    setSelectedEvoJid(null);
    setSelectedEvoName("");
    setSelected(c);
    setPhoneDraft(casePhone(c) || "");
    setDraft("");
    setAiDraft(null);
    // NÃO consulta tribunal ao abrir contato — só chat WhatsApp (envio livre)
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

  /** Só reordena a coluna de contatos — mantém o chat aberto */
  const setOverdueListSort = (mode: "mais_vencido" | "menos_vencido") => {
    setListSortMode((prev) => (prev === mode ? "default" : mode));
    toast({
      title:
        mode === "mais_vencido"
          ? "Lista: mais tempo vencido primeiro"
          : "Lista: menos tempo vencido primeiro",
      description: "O contato aberto não muda — só a ordem da lateral.",
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

  const savePhoneForSelected = async () => {
    if (!selected?.protocolo) return;
    const digits = digitsPhone(phoneDraft);
    if (digits.length < 10) {
      toast({
        title: "Telefone inválido",
        description: "Informe DDD + número (10 ou 11 dígitos).",
        variant: "destructive",
      });
      return;
    }
    setPhoneSaving(true);
    try {
      const updated = {
        ...selected,
        telefone: phoneDraft.trim(),
      } as LegalCase;
      const res = await saveOneCaseAction(updated);
      if (!(res as any)?.success) {
        toast({
          title: "Não salvou",
          description: (res as any)?.message || "Erro ao gravar telefone",
          variant: "destructive",
        });
        return;
      }
      const saved = ((res as any).case || updated) as LegalCase;
      setSelected(saved);
      setPhoneDraft(casePhone(saved) || phoneDraft.trim());
      setCases((prev) =>
        prev.map((x) =>
          x.protocolo === saved.protocolo ? { ...x, telefone: saved.telefone } : x
        )
      );
      toast({ title: "Telefone atualizado", description: casePhone(saved) });
      void loadHistory(saved);
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha", variant: "destructive" });
    } finally {
      setPhoneSaving(false);
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

  /** Scripts locais a partir do caso (sem scan) — rápido como em Tarefas */
  const buildScriptsFromCase = useCallback((caseData: LegalCase, movimentos: any[] = [], comunicacoes: any[] = []) => {
    const djenTexts = comunicacoes
      .map((d: any) => plainTextFromDjen(d.texto || d.conteudo || d.inteiroTeor || ""))
      .filter(Boolean);
    const scripts = suggestScripts({
      clienteNome: caseData.cliente,
      protocolo: caseData.protocolo,
      ultimoRetorno: caseData.ultimoRetorno,
      eventoTipo: (caseData as any).evento_tipo,
      eventoResumo: (caseData as any).evento_resumo,
      datajud_ultimo_nome: (caseData as any).datajud_ultimo_nome,
      djenTexts: djenTexts.length
        ? djenTexts
        : [(caseData as any).djen_ultimo_resumo, (caseData as any).evento_resumo].filter(Boolean).map(String),
      movimentos,
      tem_novo_andamento: !!(caseData as any).tem_novo_andamento,
      datajud_encerrado_tribunal: !!(caseData as any).datajud_encerrado_tribunal,
      indicio_busca_apreensao: !!(caseData as any).indicio_busca_apreensao,
      em_cumprimento_sentenca: !!(caseData as any).em_cumprimento_sentenca,
    } as any);
    return scripts.map((s, idx) => ({
      id: String((s as any).id || `script-${idx}`),
      titulo: String(s.titulo || "Sugestão"),
      texto: String(s.texto || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1200),
      quandoUsar: s.quandoUsar ? String(s.quandoUsar) : undefined,
    }));
  }, []);

  const loadTribunalContext = async (
    c?: LegalCase | null,
    opts?: { scan?: boolean; fast?: boolean; silent?: boolean }
  ): Promise<{
    caseData: LegalCase;
    movimentos: any[];
    comunicacoes: any[];
    scripts: { id: string; titulo: string; texto: string; quandoUsar?: string }[];
  } | null> => {
    const target = c || selected;
    if (!target?.protocolo) {
      if (!opts?.silent) {
        toast({ title: "Selecione um processo", variant: "destructive" });
      }
      return null;
    }
    setLoadingTribunal(true);
    try {
      let movimentos: any[] = tribunalMovimentos;
      let comunicacoes: any[] = djenComunicacoes;
      let caseData: LegalCase = target;

      // Mesma lógica da aba Processos → "Sugerir resposta"
      // DataJud + DJEN, fast: false (não aborta cedo)
      if (opts?.scan) {
        const res: any = await scanSingleCaseAction(target.protocolo, {
          mode: "both",
          fast: opts.fast === true,
        } as any);
        movimentos = normalizeMovList(res?.movimentos);
        comunicacoes = Array.isArray(res?.comunicacoes) ? res.comunicacoes : [];
        caseData = { ...target, ...(res?.case || {}) };
        try {
          caseData = processarCaso({ ...caseData }) as LegalCase;
        } catch {
          /* mantém caseData */
        }
        setTribunalMovimentos(movimentos);
        setDjenComunicacoes(comunicacoes);
        if (caseData?.protocolo) {
          setSelected((prev) => (prev ? { ...prev, ...caseData } : caseData));
          setCases((prev) =>
            prev.map((x) =>
              x.protocolo === caseData.protocolo ? { ...x, ...caseData } : x
            )
          );
        }
      } else if (!movimentos.length && !comunicacoes.length) {
        // Sem scan: monta scripts com o que já está no cadastro
        movimentos = [];
        comunicacoes = [];
      }

      const scripts = buildScriptsFromCase(caseData, movimentos, comunicacoes);
      setWaScripts(scripts);

      if (opts?.scan) {
        toast({
          title: scripts.length
            ? `${scripts.length} script(s) prontos`
            : "Auditoria unificada",
          description:
            movimentos.length || comunicacoes.length
              ? `${movimentos.length} mov. DataJud · ${comunicacoes.length} DJEN`
              : "Sem movimentos — timeout, 403 ou CNJ ausente no índice. Tente de novo.",
          variant:
            movimentos.length || comunicacoes.length ? "default" : "destructive",
        });
      }
      return { caseData, movimentos, comunicacoes, scripts };
    } catch (e: any) {
      // Fallback igual Processos: scripts com dados do caso
      const scripts = buildScriptsFromCase(target, [], []);
      setWaScripts(scripts);
      if (!opts?.silent) {
        toast({
          title: "Falha na auditoria unificada",
          description: e?.message || "Erro ao consultar DataJud/DJEN — scripts com cadastro",
          variant: "destructive",
        });
      }
      return { caseData: target, movimentos: [], comunicacoes: [], scripts };
    } finally {
      setLoadingTribunal(false);
    }
  };

  const handleGenerateAIDraft = async () => {
    if (!selected || isGeneratingAIDraft) return;
    setIsGeneratingAIDraft(true);
    setAiDraft(null);
    try {
      // 1) Scripts locais IMEDIATOS (igual Tarefas) — não espera scan
      const localScripts =
        waScripts.length > 0
          ? waScripts
          : buildScriptsFromCase(selected, tribunalMovimentos, djenComunicacoes);
      if (localScripts.length && !waScripts.length) setWaScripts(localScripts);

      if (selectedMotor === "local_only") {
        const text = localScripts[0]?.texto || "";
        if (text) {
          setAiDraft(text);
          setDraft(text);
          toast({ title: "Script Lexis", description: "Pronto (sem API)" });
        } else {
          toast({ title: "Sem script", description: "Cadastro sem contexto suficiente", variant: "destructive" });
        }
        return;
      }

      // 2) Motor externo — cascata omni pode levar 60–90s (várias APIs em série)
      const prefRaw = String(selectedMotor || "omni").toLowerCase();
      const preferredModel =
        prefRaw === "local_only" || prefRaw === "local" || prefRaw === "lexis" || prefRaw === "scripts"
          ? "local_only"
          : prefRaw.includes("claude") || prefRaw.includes("anthropic")
            ? "claude"
            : prefRaw.includes("groq")
              ? "groq"
              : prefRaw.includes("xai") || prefRaw.includes("grok")
                ? "xai"
                : prefRaw.includes("nvidia") || prefRaw.includes("nim") || prefRaw.includes("inkling")
                  ? "nvidia"
                  : prefRaw.includes("minimax")
                    ? "minimax"
                    : prefRaw === "auto" || prefRaw === "omni" || prefRaw === "cascade"
                      ? "omni"
                      : prefRaw;

      const iaTimeoutMs = preferredModel === "omni" ? 120000 : 90000;

      const res = await Promise.race([
        gerarRascunhoEstrategico({
          clienteNome: selected.cliente,
          protocolo: selected.protocolo,
          ultimoRetorno: selected.ultimoRetorno,
          movimentos: tribunalMovimentos,
          djenTexts: [
            ...djenComunicacoes.map((d: any) => plainTextFromDjen(d.texto || d.conteudo || "")).filter(Boolean),
            selected.djen_ultimo_resumo,
            selected.evento_resumo,
          ]
            .filter(Boolean)
            .map(String),
          eventoTipo: selected.evento_tipo,
          eventoResumo: selected.evento_resumo,
          preferredModel,
          canal: "whatsapp",
          empresaId: (selected as any).empresa_id,
          tem_novo_andamento: selected.tem_novo_andamento,
          datajud_encerrado_tribunal: selected.datajud_encerrado_tribunal,
          indicio_busca_apreensao: selected.indicio_busca_apreensao,
          em_cumprimento_sentenca: selected.em_cumprimento_sentenca,
        } as any),
        new Promise((_, rej) =>
          setTimeout(
            () =>
              rej(
                new Error(
                  `IA demorou demais (${Math.round(iaTimeoutMs / 1000)}s). Use Motor Lexis (script) ou tente um motor direto (xAI/Claude), não só cascata.`
                )
              ),
            iaTimeoutMs
          )
        ),
      ]);

      const text =
        (res as any)?.rascunho ||
        (res as any)?.texto ||
        (res as any)?.draft ||
        "";
      if (text) {
        setAiDraft(String(text));
        setDraft(String(text));
        toast({
          title: (res as any)?.sucesso === false ? "Script / fallback" : "Rascunho IA",
          description: String((res as any)?.engineUtilizada || (res as any)?.engine || preferredModel),
        });
      } else {
        // Fallback para script local se IA vazia
        if (localScripts[0]?.texto) {
          setAiDraft(localScripts[0].texto);
          setDraft(localScripts[0].texto);
          toast({ title: "Fallback Lexis", description: "IA sem texto — script local" });
        } else {
          toast({
            title: "Sem rascunho",
            description: (res as any)?.message || "Motor não retornou texto",
            variant: "destructive",
          });
        }
      }
    } catch (e: any) {
      // Em erro, ainda oferece script local
      const fallback =
        waScripts[0]?.texto ||
        (selected ? buildScriptsFromCase(selected)[0]?.texto : "");
      if (fallback) {
        setAiDraft(fallback);
        setDraft(fallback);
        toast({
          title: "IA indisponível — script local",
          description: e?.message || "Timeout/erro",
        });
      } else {
        toast({
          title: "Erro IA",
          description: e?.message || "Falha",
          variant: "destructive",
        });
      }
    } finally {
      setIsGeneratingAIDraft(false);
    }
  };


  /** Normaliza texto para detectar reenvio idêntico */
  const normMsg = (s: string) =>
    String(s || "")
      .trim()
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n");

  const duplicateOutbound = useMemo(() => {
    const body = normMsg(draft);
    if (!body || body.length < 8) return null;
    const outs = history.filter((h) => h.direction === "out" && normMsg(h.body) === body);
    if (!outs.length) return null;
    const last = outs[outs.length - 1];
    return {
      count: outs.length,
      at: last.at,
      source: last.source || "histórico",
    };
  }, [draft, history]);

  const confirmIfDuplicate = () => {
    if (!duplicateOutbound) return true;
    const when = duplicateOutbound.at
      ? new Date(duplicateOutbound.at).toLocaleString("pt-BR")
      : "antes";
    return window.confirm(
      `Esta mensagem já foi enviada ${duplicateOutbound.count} vez(es) para este contato (última: ${when}, via ${duplicateOutbound.source}).\n\nO texto está idêntico — deseja enviar de novo mesmo assim?`
    );
  };

  const openWaMe = () => {
    if (!selected || casePhoneDigits(selected).length < 8 || !draft.trim()) {
      toast({ title: "Selecione contato com telefone e texto", description: "Cadastre o telefone em Processos se estiver faltando.", variant: "destructive" });
      return;
    }
    if (!confirmIfDuplicate()) {
      toast({ title: "Envio cancelado", description: "Mensagem idêntica à já enviada." });
      return;
    }
    openWhatsAppClient({ phone: casePhone(selected), text: draft.trim() });
    void logOutboundWhatsAppAction(casePhone(selected), draft.trim());
    const msg: ChatMsg = {
      id: `local-${Date.now()}`,
      direction: "out",
      body: draft.trim(),
      at: new Date().toISOString(),
      source: "wa.me",
    };
    const next = [...history.filter((h) => h.direction !== "system"), msg];
    setHistory(next);
    persistLocal(casePhone(selected) || selected.protocolo, next);
    toast({
      title: "WhatsApp aberto",
      description: "Revise e envie no app do celular/desktop.",
    });
  };

  const sendViaEvolution = async () => {
    const evoTarget = selectedEvoJid;
    const caseTarget =
      selected && casePhoneDigits(selected).length >= 8 ? casePhone(selected) : "";
    const to = evoTarget || caseTarget;
    if (!to || !draft.trim()) {
      toast({
        title: "Destino",
        description: evoTarget
          ? "Mensagem vazia"
          : "Selecione um processo com telefone ou um chat Evolution",
        variant: "destructive",
      });
      return;
    }
    if (sending) return;
    if (!confirmIfDuplicate()) {
      toast({ title: "Envio cancelado", description: "Mensagem idêntica à já enviada." });
      return;
    }
    setSending(true);
    try {
      const res = await Promise.race([
        sendWhatsAppAction(to, draft.trim()),
        new Promise<{ success: false; message: string }>((resolve) =>
          setTimeout(
            () =>
              resolve({
                success: false,
                message:
                  "Tempo esgotado (90s). Confira Evolution Manager (estado open) e EVOLUTION_INSTANCE=Lexis.",
              }),
            90000
          )
        ),
      ]);
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
        if (selected) {
          persistLocal(casePhone(selected) || selected.protocolo, next);
          void loadHistory(selected);
        }
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
        description: e?.message || String(e),
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
                title="Ordenar lista: mais tempo vencido primeiro (não troca o chat)"
                onClick={() => setOverdueListSort("mais_vencido")}
                data-active={listSortMode === "mais_vencido" || undefined}
              >
                <ArrowDownWideNarrow size={14} />
                <span className="hidden sm:inline">Mais vencido</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl gap-1.5 text-[10px] font-bold uppercase"
                title="Ordenar lista: menos tempo vencido primeiro (não troca o chat)"
                onClick={() => setOverdueListSort("menos_vencido")}
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
              
                <div className="px-3 pt-2 space-y-2">
                  <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/50">
                    <button type="button" onClick={() => setListSource("carteira")}
                      className={cn("flex-1 text-[9px] font-black uppercase py-1.5 rounded-lg", listSource === "carteira" ? "bg-background shadow" : "text-muted-foreground")}>
                      Processos
                    </button>
                    <button type="button" onClick={() => { setListSource("evolution"); void loadEvolutionChats(evoOnlyGroups); }}
                      className={cn("flex-1 text-[9px] font-black uppercase py-1.5 rounded-lg", listSource === "evolution" ? "bg-background shadow" : "text-muted-foreground")}>
                      WA / Grupos
                    </button>
                  </div>
                  {listSource === "evolution" && (
                    <div className="flex items-center gap-2 pb-1">
                      <button type="button" className="text-[9px] font-bold uppercase text-muted-foreground"
                        onClick={() => { setEvoOnlyGroups((v) => { const n = !v; void loadEvolutionChats(n); return n; }); }}>
                        {evoOnlyGroups ? "Só grupos" : "Todos os chats"}
                      </button>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-[9px] font-black uppercase ml-auto"
                        disabled={evoLoading} onClick={() => void loadEvolutionChats(evoOnlyGroups)}>
                        {evoLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                        Atualizar
                      </Button>
                    </div>
                  )}
                </div>
<ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {loading && (
                    <div className="flex justify-center py-10 text-muted-foreground">
                      <Loader2 className="animate-spin" />
                    </div>
                  )}
                  {!loading &&
                    {listSource === "evolution"
                      ? evoChats
                          .filter((ch) => {
                            const qq = (typeof q === "string" ? q : "").trim().toLowerCase();
                            if (!qq) return true;
                            return (
                              ch.name.toLowerCase().includes(qq) ||
                              ch.jid.toLowerCase().includes(qq) ||
                              (ch.lastMessage || "").toLowerCase().includes(qq)
                            );
                          })
                          .map((ch) => (
                            <button
                              key={ch.jid}
                              type="button"
                              onClick={() => void selectEvolutionChat(ch)}
                              className={cn(
                                "w-full text-left rounded-xl px-3 py-2.5 border transition-colors",
                                selectedEvoJid === ch.jid
                                  ? "border-emerald-500/40 bg-emerald-500/10"
                                  : "border-transparent hover:bg-muted/50"
                              )}
                            >
                              <div className="flex items-start gap-2">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                  {ch.isGroup ? <UsersRound size={14} /> : <User size={14} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[12px] font-black uppercase truncate">{ch.name}</p>
                                  <p className="text-[9px] text-muted-foreground truncate">
                                    {ch.isGroup ? "Grupo" : "Contato"} · {ch.jid.slice(0, 32)}
                                  </p>
                                  {ch.lastMessage ? (
                                    <p className="text-[10px] text-muted-foreground truncate">{ch.lastMessage}</p>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          ))
                      : contacts.map((c) => {
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
                      }
                </div>

                </div>
              </ScrollArea>
            </aside>

            {/* Chat + ações */}
            <section className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0">
              {!selected && !selectedEvoJid ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
                  Selecione um cliente (Processos) ou um chat/grupo (WA / Grupos) à esquerda.
                </div>
              ) : (
                <>
                  <div className="shrink-0 border-b border-border/40 px-4 py-3 flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-black uppercase text-sm truncate">
                        {selected ? selected.cliente : selectedEvoName}
                      </p>
                      <p className="text-[10px] text-muted-foreground tabular-nums truncate">
                        {selected ? `${selected.protocolo} · ${casePhone(selected) || "sem telefone"}` : (selectedEvoJid || "")}
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
                        onClick={() => loadTribunalContext(selected, { scan: true })}
                        disabled={loadingTribunal || !selected?.protocolo}
                        title="Consulta DataJud+DJEN só quando você clicar — não roda ao abrir o contato"
                      >
                        {loadingTribunal ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <FileSearch size={14} />
                        )}
                        Andamentos + scripts
                      </Button>

                    {selected && (
                      <div
                        className={cn(
                          "rounded-xl border px-3 py-2.5 space-y-2",
                          casePhoneDigits(selected).length < 8
                            ? "border-amber-500/40 bg-amber-500/10"
                            : "border-border/50 bg-muted/20"
                        )}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {casePhoneDigits(selected).length < 8
                            ? "Telefone ausente ou inválido — cadastre para Evolution / envio"
                            : "Telefone do contato"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            value={phoneDraft}
                            onChange={(e) => setPhoneDraft(e.target.value)}
                            placeholder="(11) 9XXXX-XXXX"
                            className="h-9 max-w-[200px] rounded-lg text-sm font-mono"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-9 rounded-lg text-[11px] font-semibold"
                            disabled={phoneSaving}
                            onClick={() => void savePhoneForSelected()}
                          >
                            {phoneSaving ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              "Salvar telefone"
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

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
                            disabled={!selected || casePhoneDigits(selected).length < 8 || histLoading}
                            onClick={async () => {
                              if (!selected?.telefone) {
                                toast({ title: "Cliente sem telefone", variant: "destructive" });
                                return;
                              }
                              setHistLoading(true);
                              try {
                                const r: any = await importEvolutionHistoryAction(casePhone(selected));
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
                            disabled={bulkImporting}
                            onClick={async () => {
                              if (bulkImporting) return;
                              if (!confirm("Importar histórico Evolution de até 80 números da carteira?\n\nNúmeros sem chat ou sem mensagens recentes serão ignorados rápido para poupar tempo.")) return;
                              setBulkImporting(true);
                              try {
                                const r: any = await importEvolutionHistoryBulkAction({
                                  maxContacts: 80,
                                  perContactTimeoutMs: 10000,
                                });
                                toast({
                                  title: r.success ? "Importação em lote" : "Lote falhou",
                                  description: r.message || r.error || `${r.imported || 0} msgs`,
                                  variant: r.success ? undefined : "destructive",
                                });
                                if (selected) void loadHistory(selected);
                              } catch (e: any) {
                                toast({ title: "Erro no lote", description: e?.message, variant: "destructive" });
                              } finally {
                                setBulkImporting(false);
                              }
                            }}
                          >
                            {bulkImporting ? "Carregando carteira…" : "Carregar tudo (Evolution)"}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            disabled={!selected || casePhoneDigits(selected).length < 8}
                            className="text-destructive focus:text-destructive"
                            onClick={async () => {
                              if (!selected?.telefone) return;
                              if (!confirm("Apagar do Supabase o histórico deste telefone?")) return;
                              const r: any = await clearWhatsAppHistoryAction(casePhone(selected));
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
                            disabled={!selected || casePhoneDigits(selected).length < 8}
                            onClick={async () => {
                              if (!selected?.telefone) return;
                              const r: any = await testSaveWhatsAppMessageAction(casePhone(selected));
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
                          disabled={isGeneratingAIDraft || !selected}
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

                    {(historicoTribunal.length > 0 || loadingTribunal) && (
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2 max-h-56 overflow-y-auto">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          Histórico do tribunal · DataJud + DJEN (manual)
                          {loadingTribunal ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : null}
                        </p>
                        {historicoTribunal.map((it, i) => (
                          <div
                            key={`t-${i}`}
                            className={cn(
                              "text-[11px] leading-snug border-l-2 pl-2 py-0.5",
                              it.type === "djen"
                                ? "border-blue-500/50"
                                : "border-primary/40"
                            )}
                          >
                            <span className="text-[9px] font-bold text-muted-foreground tabular-nums uppercase flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "px-1 rounded text-[8px] font-black",
                                  it.type === "djen"
                                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                    : "bg-primary/10 text-primary"
                                )}
                              >
                                {it.type === "djen" ? "DJEN" : "DataJud"}
                              </span>
                              {it.date.getTime() > 0
                                ? it.date.toLocaleDateString("pt-BR")
                                : "—"}
                            </span>
                            <p className="font-semibold text-foreground/90">
                              {it.title}
                            </p>
                            {it.subtitle ? (
                              <p className="text-muted-foreground whitespace-pre-wrap text-[11px] leading-relaxed max-h-40 overflow-y-auto">
                                {plainTextFromDjen(String(it.subtitle)).slice(0, 2500)}
                              </p>
                            ) : null}
                          </div>
                        ))}
                        {!historicoTribunal.length && loadingTribunal && (
                          <p className="text-[10px] text-muted-foreground">
                            Consultando DataJud + DJEN…
                          </p>
                        )}
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


                    {duplicateOutbound ? (
                      <div
                        role="alert"
                        className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900 dark:text-amber-100"
                      >
                        <p className="font-black uppercase tracking-wide text-[10px] mb-0.5">
                          Mensagem duplicada
                        </p>
                        <p>
                          Este texto já foi enviado{" "}
                          <strong>{duplicateOutbound.count}</strong> vez
                          {duplicateOutbound.count > 1 ? "es" : ""} para este contato
                          {duplicateOutbound.at
                            ? ` (última em ${new Date(duplicateOutbound.at).toLocaleString("pt-BR")})`
                            : ""}
                          . Altere a mensagem ou confirme no envio se for intencional.
                        </p>
                      </div>
                    ) : null}

                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Mensagem para o cliente…"
                      className={
                        duplicateOutbound
                          ? "min-h-[90px] rounded-xl text-[13px] border-amber-500/50 ring-1 ring-amber-500/30"
                          : "min-h-[90px] rounded-xl text-[13px]"
                      }
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
                        disabled={sending || !draft.trim() || !selected || casePhoneDigits(selected).length < 8}
                      >
                        {sending ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Send size={14} />
                        )}
                        {duplicateOutbound ? "Enviar mesmo assim" : "Enviar (Evolution)"}
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
