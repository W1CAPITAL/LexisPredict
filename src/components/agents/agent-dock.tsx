"use client";

/**
 * Agentes Lexis — painel de alto contraste (texto sempre legível).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Mail, X, Building2, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import {
  listAgentCatalogAction,
  runCrmAgentAction,
  agentDraftEmailAction,
  agentSendEmailAction,
  agentBrasilApiCnpjAction,
} from "@/app/actions/crm-agent-actions";
import type { CrmAgentId } from "@/lib/crm-agent/types";
import type { AgentMeta } from "@/lib/crm-agent/skills";
import { cn } from "@/lib/utils";

const PANEL =
  "fixed bottom-20 right-4 z-[90] w-[min(420px,calc(100vw-1.5rem))] max-h-[min(85vh,720px)] overflow-y-auto rounded-2xl border border-zinc-600 bg-zinc-950 text-zinc-50 shadow-2xl";

const INPUT =
  "w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50";

const LABEL = "text-[10px] font-bold uppercase tracking-widest text-zinc-400";

export function AgentDock() {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<Record<string, AgentMeta>>({});
  const [agentId, setAgentId] = useState<CrmAgentId>("livre");
  const [prompt, setPrompt] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [out, setOut] = useState("");
  const [logs, setLogs] = useState<{ tool: string; summary: string; ok?: boolean }[]>([]);
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [showAllAgents, setShowAllAgents] = useState(false);
  const [useIa, setUseIa] = useState(false);
  const [preferredEngine, setPreferredEngine] = useState("auto");
  const [copied, setCopied] = useState(false);
  const outRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listAgentCatalogAction().then((r) => setCatalog((r.catalog || {}) as any));
  }, [open]);

  useEffect(() => {
    if (out && outRef.current) {
      outRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [out]);

  const meta = useMemo(() => catalog[agentId], [catalog, agentId]);

  const run = async () => {
    setBusy(true);
    setOut("");
    setLogs([]);
    setStep("Lendo carteira…");
    try {
      const res = await runCrmAgentAction({
        agent_id: agentId,
        prompt: prompt || undefined,
        protocolo: protocolo || undefined,
        cnpj: cnpj || undefined,
        useIa,
        preferredEngine,
      });
      const text = String(res.content || res.error || "Sem saída do servidor.").trim();
      setOut(text || "Resposta vazia — tente de novo ou desmarque IA.");
      setLogs((res.logs || []) as any);
      setStep(res.success ? "Concluído" : "Falhou");
    } catch (e: any) {
      setOut(e?.message || "Erro inesperado");
      setStep("Erro");
    } finally {
      setBusy(false);
    }
  };

  const copyOut = async () => {
    if (!out) return;
    try {
      await navigator.clipboard.writeText(out);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const draftMail = async () => {
    setBusy(true);
    setStep("Rascunho…");
    try {
      const res = await agentDraftEmailAction({
        to: emailTo,
        protocolo,
        contexto: prompt || out,
      });
      if (res.success) {
        setMailSubject(res.subject || "");
        setMailBody(res.body || "");
        setOut(res.body || "");
        setStep("Rascunho pronto");
      } else {
        setOut(res.error || "Falha no rascunho");
        setStep("Erro");
      }
    } finally {
      setBusy(false);
    }
  };

  const sendMail = async (send: boolean) => {
    setBusy(true);
    try {
      const res = await agentSendEmailAction({
        to: emailTo,
        subject: mailSubject || "Atualização",
        body: mailBody || out,
        send,
      });
      if (res.mailto && !send) window.open(res.mailto, "_blank");
      setOut(res.success ? res.message || res.mode || "OK" : res.error || "Erro");
      setStep(res.success ? "E-mail" : "Erro e-mail");
    } finally {
      setBusy(false);
    }
  };

  const enrichCnpj = async () => {
    setBusy(true);
    setStep("BrasilAPI…");
    try {
      const res = await agentBrasilApiCnpjAction(cnpj);
      setOut(res.success ? JSON.stringify(res.observed, null, 2) : res.error || "Sem dados");
      setStep(res.success ? "CNPJ ok" : "Falha CNPJ");
    } finally {
      setBusy(false);
    }
  };

  if (typeof window !== "undefined" && window.location.pathname.startsWith("/login")) {
    return null;
  }

  return (
    <div className="lexis-agent-dock pointer-events-none fixed inset-0 z-[80]">
      {open && (
        <div className={cn(PANEL, "pointer-events-auto flex flex-col")}>
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-zinc-700 bg-zinc-950 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-white">Agentes Lexis</p>
              <p className="text-[11px] text-zinc-400">Resposta com dados da carteira · IA opcional</p>
            </div>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 p-4">
            {/* Agent picker */}
            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowAllAgents((v) => !v)}
              >
                <span className={LABEL}>Agente</span>
                {showAllAgents ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
              </button>
              <p className="mt-1 text-sm font-semibold text-emerald-400">
                {meta?.nome || agentId}
              </p>
              {meta?.faz ? (
                <p className="mt-0.5 text-xs leading-snug text-zinc-300">{meta.faz}</p>
              ) : null}
              {showAllAgents && (
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-1">
                  {Object.entries(catalog).map(([id, m]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setAgentId(id as CrmAgentId);
                        setShowAllAgents(false);
                      }}
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left text-xs",
                        id === agentId
                          ? "bg-emerald-600/30 text-emerald-200"
                          : "text-zinc-200 hover:bg-zinc-800"
                      )}
                    >
                      <span className="font-semibold">{m.nome}</span>
                      <span className="mt-0.5 block text-[10px] text-zinc-400 line-clamp-1">{m.descricao}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Prompt */}
            <div className="space-y-1">
              <label className={LABEL}>Pedido (obrigatório para pergunta)</label>
              <textarea
                className={cn(INPUT, "min-h-[72px] resize-y")}
                placeholder="Ex.: qual cliente está há mais tempo vencido?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className={LABEL}>CNJ (opcional)</label>
              <input
                className={INPUT}
                placeholder="0000000-00.0000.0.00.0000"
                value={protocolo}
                onChange={(e) => setProtocolo(e.target.value)}
              />
            </div>

            {/* IA */}
            <div className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-900/80 p-3">
              <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-100">
                <input
                  type="checkbox"
                  checked={useIa}
                  onChange={(e) => setUseIa(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-500"
                />
                <span>
                  Enriquecer com IA
                  <span className="mt-0.5 block text-[11px] text-zinc-400">
                    Padrão = só dados reais (recomendado para vencidos / ranking)
                  </span>
                </span>
              </label>
              {useIa ? (
                <select
                  className={INPUT}
                  value={preferredEngine}
                  onChange={(e) => setPreferredEngine(e.target.value)}
                >
                  <option value="auto">Auto (MiniMax → Claude → Grok)</option>
                  <option value="minimax">MiniMax</option>
                  <option value="claude">Claude</option>
                  <option value="xai">xAI Grok</option>
                  <option value="groq">Groq</option>
                  <option value="omni">OmniRoute</option>
                </select>
              ) : null}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void run()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold uppercase tracking-wide text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {step || "Executando…"}
                </>
              ) : (
                "Executar agente"
              )}
            </button>

            {step && !busy ? (
              <p className="text-xs text-zinc-400">Status: {step}</p>
            ) : null}

            {/* Logs */}
            {logs.length > 0 ? (
              <ul className="space-y-0.5 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-[11px] text-zinc-300">
                {logs.map((l, i) => (
                  <li key={i}>
                    <span className={l.ok === false ? "text-amber-400" : "text-emerald-400"}>•</span>{" "}
                    {l.tool} · {l.summary}
                  </li>
                ))}
              </ul>
            ) : null}

            {/* RESPOSTA — sempre legível, no topo visual após run */}
            <div ref={outRef} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className={LABEL}>Resposta</span>
                {out ? (
                  <button
                    type="button"
                    onClick={() => void copyOut()}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase text-zinc-400 hover:text-white"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                ) : null}
              </div>
              <div
                className="min-h-[120px] max-h-[320px] overflow-y-auto rounded-xl border p-3 text-[13px] leading-relaxed whitespace-pre-wrap break-words shadow-inner"
                style={{
                  backgroundColor: out ? "#09090b" : "#18181b",
                  color: out ? "#fafafa" : "#a1a1aa",
                  borderColor: out ? "#059669" : "#3f3f46",
                  WebkitTextFillColor: out ? "#fafafa" : "#a1a1aa",
                  opacity: 1,
                }}
              >
                {out || "A resposta aparece aqui após executar."}
              </div>
            </div>

            {/* E-mail */}
            <div className="space-y-2 border-t border-zinc-700 pt-3">
              <div className={cn(LABEL, "flex items-center gap-1")}>
                <Mail className="h-3.5 w-3.5" /> E-mail cliente
              </div>
              <input
                className={INPUT}
                placeholder="cliente@email.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="h-8 rounded-lg border border-zinc-600 px-2 text-[10px] font-bold uppercase text-zinc-200 hover:bg-zinc-800" disabled={busy} onClick={() => void draftMail()}>
                  Rascunho
                </button>
                <button type="button" className="h-8 rounded-lg border border-zinc-600 px-2 text-[10px] font-bold uppercase text-zinc-200 hover:bg-zinc-800" disabled={busy} onClick={() => void sendMail(false)}>
                  Mailto
                </button>
                <button type="button" className="h-8 rounded-lg border border-emerald-700 px-2 text-[10px] font-bold uppercase text-emerald-400 hover:bg-emerald-950" disabled={busy} onClick={() => void sendMail(true)}>
                  Resend
                </button>
              </div>
            </div>

            {/* CNPJ */}
            <div className="space-y-2 border-t border-zinc-700 pt-3">
              <div className={cn(LABEL, "flex items-center gap-1")}>
                <Building2 className="h-3.5 w-3.5" /> CNPJ · BrasilAPI
              </div>
              <div className="flex gap-2">
                <input
                  className={cn(INPUT, "flex-1")}
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                />
                <button type="button" className="h-10 shrink-0 rounded-lg border border-zinc-600 px-3 text-[10px] font-bold uppercase text-zinc-200" disabled={busy} onClick={() => void enrichCnpj()}>
                  Buscar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className="pointer-events-auto fixed bottom-4 right-4 z-[91] flex h-12 items-center gap-2 rounded-full border border-zinc-600 bg-zinc-950 px-4 text-sm font-bold text-white shadow-xl hover:bg-zinc-900"
        onClick={() => setOpen((v) => !v)}
      >
        <Bot className="h-4 w-4 text-emerald-400" />
        {open ? "Fechar" : "Agentes"}
      </button>
    </div>
  );
}
