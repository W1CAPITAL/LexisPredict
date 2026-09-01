"use client";

/**
 * Setup Planilha — conectar Apps Script + escolher provider (local | sheets | supabase)
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadProviderConfig,
  saveProviderConfig,
  resetDataProviderCache,
  getDataProvider,
  type ProviderKind,
} from "@/lib/data-provider";

export default function SetupPlanilhaPage() {
  const [kind, setKind] = useState<ProviderKind>("supabase");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [token, setToken] = useState("w1-fase1-2026");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const cfg = loadProviderConfig();
    setKind(cfg.kind);
    setWebhookUrl(cfg.sheets.webhookUrl || "");
    setToken(cfg.sheets.token || "w1-fase1-2026");
  }, []);

  function persist(nextKind?: ProviderKind) {
    saveProviderConfig({
      kind: nextKind || kind,
      sheets: { webhookUrl, token },
      deviceId: loadProviderConfig().deviceId,
    });
    resetDataProviderCache();
    setStatus("Configuração salva");
  }

  async function onPing() {
    setBusy(true);
    setStatus("Testando webhook…");
    persist("sheets");
    resetDataProviderCache();
    const dp = getDataProvider("sheets");
    const r = await dp.sync.ping();
    setStatus(r.ok ? "Webhook OK — Apps Script respondeu" : `Falha: ${r.error || "erro"}`);
    setBusy(false);
  }

  async function onLogin() {
    setBusy(true);
    persist("sheets");
    resetDataProviderCache();
    const dp = getDataProvider("sheets");
    const r = await dp.auth.login(login, password);
    setStatus(
      r.ok
        ? `Login OK — ${r.user?.nome} (${r.user?.role})`
        : `Login falhou: ${r.error || "erro"}`,
    );
    setBusy(false);
  }

  async function onPull() {
    setBusy(true);
    setStatus("Sincronizando (pull)…");
    const dp = getDataProvider("sheets");
    const r = await dp.sync.pull();
    setStatus(
      r.ok
        ? `Pull OK — ${r.processes?.length || 0} processos, ${r.leads?.length || 0} leads`
        : `Pull falhou: ${r.error || "erro"}`,
    );
    setBusy(false);
  }

  async function onPush() {
    setBusy(true);
    setStatus("Enviando fila local (push)…");
    const dp = getDataProvider("sheets");
    const r = await dp.sync.push([]);
    setStatus(
      r.ok
        ? `Push OK — ${r.applied || 0} aplicados`
        : `Push falhou: ${r.error || "erro"}`,
    );
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-xl mx-auto space-y-6">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Lexis Unified · Fase 1–3
        </p>
        <h1 className="text-2xl font-black tracking-tight">Setup Planilha / Provider</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Banco local + Google Sheets via Apps Script. Supabase continua opcional (modo legado).
        </p>
      </div>

      <section className="rounded-2xl border border-border/60 p-4 space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider">Modo de dados</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["supabase", "Supabase (atual)"],
              ["local", "Só local (offline)"],
              ["sheets", "Local + Sheets"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                persist(k);
              }}
              className={
                "h-9 px-3 rounded-xl text-[10px] font-black uppercase " +
                (kind === k
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 p-4 space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider">Apps Script (/exec)</h2>
        <input
          className="w-full h-10 rounded-xl border border-border/60 bg-card px-3 text-sm"
          placeholder="https://script.google.com/macros/s/.../exec"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
        />
        <input
          className="w-full h-10 rounded-xl border border-border/60 bg-card px-3 text-sm"
          placeholder="Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => persist()}
            className="h-9 px-4 rounded-xl border text-[10px] font-black uppercase"
          >
            Salvar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onPing}
            className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase"
          >
            Testar webhook
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 p-4 space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider">Login via planilha</h2>
        <input
          className="w-full h-10 rounded-xl border border-border/60 bg-card px-3 text-sm"
          placeholder="Login"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
        <input
          type="password"
          className="w-full h-10 rounded-xl border border-border/60 bg-card px-3 text-sm"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onLogin}
            className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase"
          >
            Entrar (Sheets)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onPull}
            className="h-9 px-4 rounded-xl border text-[10px] font-black uppercase"
          >
            Pull
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onPush}
            className="h-9 px-4 rounded-xl border text-[10px] font-black uppercase"
          >
            Push fila
          </button>
        </div>
      </section>

      {status ? (
        <p className="text-sm rounded-xl bg-muted/50 px-4 py-3">{status}</p>
      ) : null}

      <p className="text-xs text-muted-foreground leading-relaxed">
        1) Cole <code>apps-script/LEXIS-UNIFIED-API.gs</code> na planilha · 2) Menu Léxis → Garantir
        abas · 3) Criar usuário · 4) Implantar /exec · 5) Cole a URL aqui.
        O modo <strong>Supabase</strong> não é removido — só deixa de ser obrigatório.
      </p>

      <Link href="/cases" className="text-sm underline text-muted-foreground">
        ← Voltar à carteira
      </Link>
    </div>
  );
}
