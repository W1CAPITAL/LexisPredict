"use client";

/**
 * Agentes CRM — visual CompAI + e-mail + enriquecimento (todo o Lexis usa o dock global também).
 */
import React, { useEffect, useState } from "react";
import { CrmShell } from "@/components/crm/crm-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  listAgentCatalogAction,
  runCrmAgentAction,
  listAgentTasksAction,
  agentScheduleRecheckAction,
  agentListOutstandingAction,
  agentDraftEmailAction,
  agentSendEmailAction,
  agentBrasilApiCnpjAction,
} from "@/app/actions/crm-agent-actions";
import { Bot, Loader2, Play, CalendarClock, Mail, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrmAgentId } from "@/lib/crm-agent/types";

export default function CrmAgentesPage() {
  const [catalog, setCatalog] = useState<Record<string, { nome: string; descricao: string; tools: string[] }>>({});
  const [agentId, setAgentId] = useState<CrmAgentId>("silencio-comercial");
  const [prompt, setPrompt] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState("");
  const [logs, setLogs] = useState<{ tool: string; summary: string }[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [counts, setCounts] = useState({ atrasados: 0, silencio: 0 });
  const [emailTo, setEmailTo] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [cnpj, setCnpj] = useState("");

  useEffect(() => {
    listAgentCatalogAction().then((r) => setCatalog(r.catalog || {}));
    listAgentTasksAction().then((r) => setTasks(r.tasks || []));
    agentListOutstandingAction().then((r) =>
      setCounts({ atrasados: (r.atrasados || []).length, silencio: (r.silencio || []).length })
    );
  }, []);

  const run = async () => {
    setRunning(true);
    setOut("");
    try {
      const res = await runCrmAgentAction({
        agent_id: agentId,
        prompt: prompt || undefined,
        protocolo: protocolo || undefined,
      });
      setOut(res.content || res.error || "");
      setLogs(res.logs || []);
    } finally {
      setRunning(false);
    }
  };

  const schedule = async () => {
    await agentScheduleRecheckAction({
      agent_id: agentId,
      subject_type: "empresa",
      subject_id: "carteira",
      days: 7,
      note: prompt || "recheck semanal",
    });
    const t = await listAgentTasksAction();
    setTasks(t.tasks || []);
  };

  const draftMail = async () => {
    setRunning(true);
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
      } else setOut(res.error || "");
    } finally {
      setRunning(false);
    }
  };

  const sendMail = async (send: boolean) => {
    setRunning(true);
    try {
      const res = await agentSendEmailAction({
        to: emailTo,
        subject: mailSubject || "Atualização do seu processo",
        body: mailBody || out,
        send,
      });
      if (res.mailto && !send) window.open(res.mailto, "_blank");
      setOut(res.success ? res.message || res.mode || "OK" : res.error || "Erro");
    } finally {
      setRunning(false);
    }
  };

  const enrich = async () => {
    setRunning(true);
    try {
      const res = await agentBrasilApiCnpjAction(cnpj);
      setOut(res.success ? JSON.stringify(res.observed, null, 2) : res.error || "");
    } finally {
      setRunning(false);
    }
  };

  return (
    <CrmShell
      title="Agentes CRM"
      subtitle="CompAI-style: skills, fila, e-mail, CNPJ — e o botão Agentes em todo o app"
    >
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <div className="compai-card">
          <div className="compai-card-title">A receber / atraso</div>
          <div className="compai-kpi">{counts.atrasados}</div>
        </div>
        <div className="compai-card">
          <div className="compai-card-title">Silêncio &gt;14d</div>
          <div className="compai-kpi">{counts.silencio}</div>
        </div>
        <div className="compai-card">
          <div className="compai-card-title">Tarefas na fila</div>
          <div className="compai-kpi">{tasks.length}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="compai-card space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
            <Bot className="h-4 w-4 text-primary" /> Rodar agente
          </div>
          <select
            className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value as CrmAgentId)}
          >
            {Object.entries(catalog).map(([id, meta]) => (
              <option key={id} value={id}>
                {meta.nome} — {meta.descricao}
              </option>
            ))}
          </select>
          <Input placeholder="CNJ (opcional)" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} />
          <Textarea
            placeholder="Pedido ao agente (ex.: priorize quem está há mais tempo sem retorno)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void run()} disabled={running} className="font-black uppercase text-[10px] tracking-widest">
              {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Executar
            </Button>
            <Button variant="outline" onClick={() => void schedule()} disabled={running} className="font-black uppercase text-[10px] tracking-widest">
              <CalendarClock className="h-4 w-4 mr-2" /> Recheck 7d
            </Button>
          </div>
          {logs.length > 0 && (
            <ul className="text-[11px] text-muted-foreground space-y-1 border-t border-border pt-2">
              {logs.map((l, i) => (
                <li key={i}>
                  <span className="font-mono text-foreground/80">{l.tool}</span> — {l.summary}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <div className="compai-card space-y-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
              <Mail className="h-4 w-4" /> E-mail ao cliente
            </div>
            <p className="text-xs text-muted-foreground">
              Rascunho via IA. Envio: mailto (sempre) ou Resend se <code className="text-[10px]">RESEND_API_KEY</code> no Vercel.
            </p>
            <Input placeholder="cliente@email.com" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
            <Input placeholder="Assunto" value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} />
            <Textarea value={mailBody} onChange={(e) => setMailBody(e.target.value)} className="min-h-[80px]" placeholder="Corpo do e-mail" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void draftMail()} disabled={running}>
                Gerar rascunho
              </Button>
              <Button size="sm" variant="outline" onClick={() => void sendMail(false)} disabled={running}>
                Abrir mailto
              </Button>
              <Button size="sm" onClick={() => void sendMail(true)} disabled={running}>
                Enviar (Resend)
              </Button>
            </div>
          </div>

          <div className="compai-card space-y-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
              <Building2 className="h-4 w-4" /> Enriquecer CNPJ (BrasilAPI)
            </div>
            <p className="text-xs text-muted-foreground">
              Alternativa gratuita a LinkedIn/RapidAPI para PJ. LinkedIn: cole URL nas notas do operador.
            </p>
            <div className="flex gap-2">
              <Input placeholder="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
              <Button onClick={() => void enrich()} disabled={running}>
                Buscar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {out ? (
        <div className="compai-card mt-6">
          <div className="compai-card-title">Saída do agente</div>
          <pre className="text-xs whitespace-pre-wrap break-words font-sans leading-relaxed">{out}</pre>
        </div>
      ) : null}

      <div className="compai-card mt-6">
        <div className="compai-card-title">Fila de rechecks</div>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa. Rode sql/crm-agent-queue.sql se a tabela não existir.</p>
        ) : (
          <ul className="text-xs space-y-1">
            {tasks.slice(0, 20).map((t) => (
              <li key={t.id} className="flex justify-between gap-2 border-b border-border/50 py-1">
                <span>
                  {t.agent_id} · {t.subject_type}/{t.subject_id}
                </span>
                <span className="text-muted-foreground">{t.status} · {t.due_at?.slice?.(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CrmShell>
  );
}
