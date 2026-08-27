"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Mail, X, Building2, ChevronDown, ChevronUp } from "lucide-react";
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

export function AgentDock() {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<Record<string, AgentMeta>>({});
  const [agentId, setAgentId] = useState<CrmAgentId>("followup-operacional");
  const [prompt, setPrompt] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [out, setOut] = useState("");
  const [logs, setLogs] = useState<{ tool: string; summary: string }[]>([]);
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [showAllAgents, setShowAllAgents] = useState(true);

  useEffect(() => {
    if (!open) return;
    listAgentCatalogAction().then((r) => setCatalog((r.catalog || {}) as any));
  }, [open]);

  const meta = useMemo(() => catalog[agentId], [catalog, agentId]);

  const run = async () => {
    setBusy(true);
    setOut("");
    setLogs([]);
    setStep("Lendo carteira / tools…");
    try {
      const res = await runCrmAgentAction({
        agent_id: agentId,
        prompt: prompt || undefined,
        protocolo: protocolo || undefined,
        cnpj: cnpj || undefined,
      });
      setOut(res.content || res.error || "Sem saída");
      setLogs(res.logs || []);
      setStep(res.success ? "Concluído" : "Falhou");
    } catch (e: any) {
      setOut(e?.message || "Erro inesperado");
      setStep("Erro");
    } finally {
      setBusy(false);
    }
  };

  const draftMail = async () => {
    setBusy(true);
    setStep("Montando rascunho…");
    try {
      const res = await agentDraftEmailAction({
        to: emailTo,
        protocolo,
        contexto: prompt || out,
      });
      if (res.success) {
        setMailSubject(res.subject);
        setMailBody(res.body);
        setOut(res.body);
        setStep("Rascunho pronto");
      } else {
        setOut(res.error || "Falha");
        setStep("Erro rascunho");
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
    <div className="lexis-agent-dock">
      {open && (
        <div className="lexis-agent-panel space-y-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest text-[hsl(158,45%,55%)]">
                <Bot className="h-4 w-4" />
                Agentes Lexis
              </div>
              <p className="text-[11px] text-[hsl(0,0%,65%)] mt-1 leading-snug">
                Cada agente tem função clara. Vários respondem na hora (sem depender da IA).
              </p>
            </div>
            <button type="button" className="p-1 rounded-md hover:bg-white/5" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[hsl(0,0%,60%)]"
            onClick={() => setShowAllAgents((v) => !v)}
          >
            Escolher agente
            {showAllAgents ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showAllAgents && (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
              {Object.entries(catalog).map(([id, m]) => (
                <button
                  key={id}
                  type="button"
                  className={cn("lexis-agent-card", agentId === id && "active")}
                  onClick={() => setAgentId(id as CrmAgentId)}
                >
                  <div className="name">{m.nome}</div>
                  <div className="desc">{m.descricao}</div>
                  <div className="does">Faz: {m.faz}</div>
                </button>
              ))}
            </div>
          )}

          {meta && (
            <div className="rounded-md border border-[hsl(0,0%,18%)] bg-[hsl(0,0%,11%)] p-2 text-[11px] space-y-1">
              <div>
                <span className="text-[hsl(158,45%,55%)] font-bold">O que faz: </span>
                {meta.faz}
              </div>
              <div>
                <span className="text-[hsl(0,0%,70%)] font-bold">Precisa: </span>
                {meta.precisa}
              </div>
              {meta.deterministic ? (
                <div className="text-[hsl(158,40%,50%)]">Resposta rápida (tools, sem esperar IA).</div>
              ) : (
                <div className="text-[hsl(0,0%,55%)]">Pode usar IA (timeout 25s + fallback).</div>
              )}
            </div>
          )}

          <input
            className="w-full h-9 rounded-md border border-[hsl(0,0%,20%)] bg-[hsl(0,0%,8%)] px-2 text-xs text-[hsl(0,0%,95%)]"
            placeholder="CNJ (se o agente precisar)"
            value={protocolo}
            onChange={(e) => setProtocolo(e.target.value)}
          />
          <textarea
            className="w-full min-h-[64px] rounded-md border border-[hsl(0,0%,20%)] bg-[hsl(0,0%,8%)] px-2 py-1.5 text-xs text-[hsl(0,0%,95%)]"
            placeholder="Pedido / filtro / contexto…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => void run()}
            className="w-full h-10 rounded-md bg-[hsl(164,100%,21%)] text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {busy ? step || "Executando…" : "Executar agente"}
          </button>
          {step && !busy ? (
            <p className="text-[10px] text-[hsl(0,0%,55%)]">Status: {step}</p>
          ) : null}

          {logs.length > 0 && (
            <ul className="text-[10px] text-[hsl(0,0%,55%)] space-y-0.5 border-t border-[hsl(0,0%,18%)] pt-2">
              {logs.map((l, i) => (
                <li key={i}>
                  <span className="text-[hsl(158,40%,55%)] font-mono">{l.tool}</span> · {l.summary}
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-[hsl(0,0%,18%)] pt-2 space-y-2">
            <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[hsl(0,0%,60%)]">
              <Mail className="h-3.5 w-3.5" /> E-mail cliente
            </div>
            <input
              className="w-full h-8 rounded-md border border-[hsl(0,0%,20%)] bg-[hsl(0,0%,8%)] px-2 text-xs"
              placeholder="cliente@email.com"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="h-8 px-2 rounded border border-[hsl(0,0%,22%)] text-[10px] font-bold uppercase" disabled={busy} onClick={() => void draftMail()}>
                Rascunho
              </button>
              <button type="button" className="h-8 px-2 rounded border border-[hsl(0,0%,22%)] text-[10px] font-bold uppercase" disabled={busy} onClick={() => void sendMail(false)}>
                Mailto
              </button>
              <button type="button" className="h-8 px-2 rounded border border-[hsl(158,40%,35%)] text-[10px] font-bold uppercase text-[hsl(158,45%,55%)]" disabled={busy} onClick={() => void sendMail(true)}>
                Resend
              </button>
            </div>
            <p className="text-[10px] text-[hsl(0,0%,50%)]">
              RESEND_FROM = e-mail (ex: Lexis &lt;onboarding@resend.dev&gt;), nunca URL do site.
            </p>
          </div>

          <div className="border-t border-[hsl(0,0%,18%)] pt-2 space-y-2">
            <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[hsl(0,0%,60%)]">
              <Building2 className="h-3.5 w-3.5" /> CNPJ · BrasilAPI
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 h-8 rounded-md border border-[hsl(0,0%,20%)] bg-[hsl(0,0%,8%)] px-2 text-xs"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
              />
              <button type="button" className="h-8 px-2 border border-[hsl(0,0%,22%)] rounded text-[10px] font-bold uppercase" disabled={busy} onClick={() => void enrichCnpj()}>
                Buscar
              </button>
            </div>
          </div>

          {out ? (
            <pre className="text-[11px] whitespace-pre-wrap break-words rounded-md bg-[hsl(0,0%,7%)] p-2 max-h-48 overflow-auto border border-[hsl(0,0%,18%)] text-[hsl(0,0%,90%)]">
              {out}
            </pre>
          ) : null}
        </div>
      )}

      <button type="button" className="lexis-agent-fab" onClick={() => setOpen((v) => !v)}>
        <Bot className="h-4 w-4" />
        {open ? "Fechar" : "Agentes"}
      </button>
    </div>
  );
}
