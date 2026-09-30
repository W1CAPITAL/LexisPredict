"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  LayoutPanelTop,
  Loader2,
  PanelLeft,
  PanelLeftClose,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { usePlano } from "@/hooks/use-plano";
import { saveNavLayout, type NavLayoutMode } from "@/lib/nav-layout";
import { completeCommercialFirstRunAction } from "@/app/actions/commercial-first-run-actions";
import { useToast } from "@/hooks/use-toast";

export default function PrimeiroAcessoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    navLayout: savedLayout,
    sidebarCompact: savedCompact,
    serverLoaded,
    onboardingCompleted,
  } = usePlano();

  const [layout, setLayout] = useState<NavLayoutMode>("dock");
  const [compact, setCompact] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!serverLoaded) return;
    setLayout(savedLayout === "vertical" ? "vertical" : "dock");
    setCompact(!!savedCompact);
  }, [serverLoaded, savedLayout, savedCompact]);

  useEffect(() => {
    if (serverLoaded && onboardingCompleted) {
      router.replace("/");
    }
  }, [serverLoaded, onboardingCompleted, router]);

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await completeCommercialFirstRunAction({
        navLayout: layout,
        sidebarCompact: layout === "vertical" ? compact : false,
      });

      if (!result.ok) {
        toast({
          title: "Não foi possível salvar",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      saveNavLayout(result.navLayout);
      try {
        localStorage.setItem(
          "lexis-sidebar-compact-v2",
          result.sidebarCompact ? "1" : "0"
        );
        window.dispatchEvent(
          new CustomEvent("lexis-nav-display", {
            detail: { compact: result.sidebarCompact },
          })
        );
      } catch {}

      toast({
        title: "Ambiente configurado",
        description: "Suas preferências iniciais foram salvas.",
      });

      window.setTimeout(() => window.location.replace("/"), 250);
    } finally {
      setBusy(false);
    }
  };

  if (!serverLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[30px] border bg-card shadow-2xl">
          <div className="border-b bg-gradient-to-r from-primary/10 via-violet-500/5 to-cyan-500/10 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  Primeiro acesso após ativação
                </p>
                <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                  Personalize o LexisPredict antes de começar
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Esta etapa aparece depois que o plano é liberado por pagamento ou token.
                  Você poderá alterar estas preferências novamente em Configurações.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                Navegação principal
              </p>
              <h2 className="mt-1 text-lg font-black">Como você prefere acessar os módulos?</h2>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setLayout("dock");
                  setCompact(false);
                }}
                className={cn(
                  "relative overflow-hidden rounded-[22px] border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg",
                  layout === "dock"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "bg-background/50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
                    <LayoutPanelTop className="h-5 w-5" />
                  </div>
                  {layout === "dock" ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-4 text-base font-black">Horizontal</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Barra superior com atalhos principais. Aproveita melhor a largura da tela.
                </p>
                <div className="mt-5 rounded-xl border bg-card p-3">
                  <div className="flex h-8 items-center gap-2 rounded-lg bg-muted/50 px-2">
                    <span className="h-4 w-4 rounded bg-primary/70" />
                    <span className="h-2 w-16 rounded bg-muted-foreground/25" />
                    <span className="h-2 w-12 rounded bg-muted-foreground/20" />
                    <span className="h-2 w-14 rounded bg-muted-foreground/20" />
                  </div>
                  <div className="mt-2 h-20 rounded-lg bg-muted/20" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLayout("vertical")}
                className={cn(
                  "relative overflow-hidden rounded-[22px] border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg",
                  layout === "vertical"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "bg-background/50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
                    <PanelLeft className="h-5 w-5" />
                  </div>
                  {layout === "vertical" ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-4 text-base font-black">Vertical</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Sidebar lateral com grupos de módulos e busca. Melhor para navegação intensa.
                </p>
                <div className="mt-5 flex rounded-xl border bg-card p-3">
                  <div className="w-14 rounded-lg bg-muted/50 p-2">
                    <div className="h-4 w-4 rounded bg-primary/70" />
                    <div className="mt-3 space-y-2">
                      <div className="h-2 rounded bg-muted-foreground/20" />
                      <div className="h-2 rounded bg-muted-foreground/20" />
                      <div className="h-2 rounded bg-muted-foreground/20" />
                    </div>
                  </div>
                  <div className="ml-2 h-24 flex-1 rounded-lg bg-muted/20" />
                </div>
              </button>
            </div>

            {layout === "vertical" ? (
              <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border bg-muted/15 p-4">
                <div className="flex items-start gap-3">
                  <PanelLeftClose className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-bold">Iniciar com sidebar compacta</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Mostra principalmente ícones e libera mais espaço para processos e relatórios.
                    </p>
                  </div>
                </div>
                <Switch checked={compact} onCheckedChange={setCompact} />
              </div>
            ) : null}

            <div className="mt-7 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                Seu plano já está ativo.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Ao concluir, o sistema abre o dashboard com os módulos liberados pelo seu plano.
              </p>
            </div>

            <div className="mt-7 flex justify-end">
              <Button
                type="button"
                className="h-11 min-w-44 font-bold"
                disabled={busy}
                onClick={() => void finish()}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Concluir configuração
                {!busy ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
