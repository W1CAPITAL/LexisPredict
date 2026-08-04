/**
 * Navegador interno — abre links no app (iframe), mesmo padrão da Automação Judicial.
 */
"use client";

import React, { useCallback, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Globe,
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
  AlertCircle,
  Home,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SHORTCUTS: { label: string; url: string }[] = [
  { label: "WolfCRM", url: "https://wolfcrm.com.br/auth" },
  { label: "WolfCRM (home)", url: "https://wolfcrm.com.br/" },
  {
    label: "Portal Custas TJSP",
    url: "https://portaldecustas.tjsp.jus.br/portaltjsp/pages/custas/new",
  },
  {
    label: "eproc SP",
    url: "https://eproc-consulta.tjsp.jus.br/consulta_1g/externo_controlador.php?acao=tjsp@consulta_unificada_publica/consultar",
  },
  {
    label: "e-SAJ TJSP",
    url: "https://esaj.tjsp.jus.br/cpopg/open.do",
  },
];

function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export default function NavegadorInternoPage() {
  const [urlInput, setUrlInput] = useState("https://wolfcrm.com.br/auth");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("Navegador");
  const [expanded, setExpanded] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  const openInApp = useCallback((url: string, label?: string) => {
    const final = normalizeUrl(url);
    if (!final) return;
    setEmbedUrl(final);
    setUrlInput(final);
    setTitle(label || final.replace(/^https?:\/\//, "").slice(0, 48));
    setExpanded(true);
    setIframeKey((k) => k + 1);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-4 md:p-6 gap-4 overflow-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            Navegador no app
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Abre sites no iframe interno. Se bloquear (X-Frame-Options), use Nova aba.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">URL</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") openInApp(urlInput);
              }}
              placeholder="https://wolfcrm.com.br/auth"
              className="font-mono h-11 flex-1"
            />
            <Button className="h-11 font-bold gap-2 shrink-0" onClick={() => openInApp(urlInput)}>
              <Lock size={16} />
              Abrir no app
            </Button>
            <Button
              variant="outline"
              className="h-11 shrink-0"
              onClick={() => {
                const u = normalizeUrl(urlInput);
                if (u) window.open(u, "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink size={16} />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {SHORTCUTS.map((s) => (
            <Button
              key={s.url}
              type="button"
              variant="secondary"
              size="sm"
              className="text-[10px] font-bold uppercase"
              onClick={() => openInApp(s.url, s.label)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        {embedUrl ? (
          <div className="rounded-xl border-2 border-primary/30 overflow-hidden bg-white flex-1 min-h-[60vh]">
            <div className="h-11 flex items-center justify-between px-2 bg-muted/70 border-b gap-2">
              <span className="text-[10px] font-bold truncate px-2 flex items-center gap-1">
                <Home size={12} />
                {title}
              </span>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIframeKey((k) => k + 1)}>
                  <RefreshCw size={14} />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setExpanded((v) => !v)}>
                  {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => window.open(embedUrl, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink size={14} />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEmbedUrl(null)}>
                  <X size={14} />
                </Button>
              </div>
            </div>
            {expanded && (
              <iframe
                key={iframeKey}
                src={embedUrl}
                title={title}
                className="w-full border-0 bg-white"
                style={{ height: "min(75vh, 800px)", minHeight: 480 }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-top-navigation-by-user-activation"
                referrerPolicy="no-referrer-when-downgrade"
                allow="clipboard-read; clipboard-write"
              />
            )}
            <p className={cn("text-[10px] text-muted-foreground p-2 border-t flex gap-1 items-start")}>
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              Tela branca = site bloqueia iframe. Use nova aba. Login fica no domínio do site, não no Lexis.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Digite uma URL ou atalho (WolfCRM) e clique em <strong>Abrir no app</strong>.
          </div>
        )}
      </main>
    </div>
  );
}
