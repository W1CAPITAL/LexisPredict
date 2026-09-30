"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  Database,
  Loader2,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/auth-provider";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { PLAN_IDS, PLAN_LABEL, type PlanId } from "@/lib/planos-pacotes";
import { PLANOS_PRECOS, formatBRL } from "@/lib/planos-precos";
import { provisionMinhaEmpresaAction } from "@/app/actions/tenant-provision-actions";
import { cn } from "@/lib/utils";

export default function SetupEmpresaPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const logo = PlaceHolderImages.find((i) => i.id === "app-logo");

  const [empresa, setEmpresa] = useState("");
  const [nome, setNome] = useState("");
  const [plan, setPlan] = useState<PlanId>("essencial");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEmpresa((prev) => prev || String(user.user_metadata?.empresa_nome || ""));
    setNome((prev) => prev || String(user.user_metadata?.full_name || ""));
    const requested = String(user.user_metadata?.plano_solicitado || "").toLowerCase();
    if (PLAN_IDS.includes(requested as PlanId)) setPlan(requested as PlanId);
  }, [user]);

  const email = user?.email || "";
  const selected = useMemo(() => PLANOS_PRECOS[plan], [plan]);

  const provision = async () => {
    if (!empresa.trim() || busy) {
      if (!empresa.trim()) {
        toast({ title: "Informe o nome da empresa", variant: "destructive" });
      }
      return;
    }

    setBusy(true);
    try {
      const result = await provisionMinhaEmpresaAction({
        empresa: empresa.trim(),
        nome: nome.trim(),
        plan,
      });

      if (!result.ok) {
        toast({
          title: "Não foi possível criar o ambiente",
          description: result.error || "Falha ao provisionar a empresa.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: result.alreadyReady ? "Ambiente já configurado" : "Empresa criada",
        description: result.alreadyReady
          ? "Seu tenant já existe. Abrindo o LexisPredict."
          : "O acesso Essencial foi preparado e a solicitação do plano foi registrada.",
      });

      window.setTimeout(() => {
        window.location.replace("/");
      }, 400);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    router.replace("/login?reason=session");
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1400px] overflow-hidden rounded-[30px] border bg-card shadow-2xl lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[.78fr_1.22fr]">
        <aside className="relative hidden overflow-hidden border-r bg-[#07111f] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-cyan-400/15 blur-[110px]" />
          <div className="absolute -bottom-32 right-0 h-[26rem] w-[26rem] rounded-full bg-violet-500/20 blur-[130px]" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                {logo ? (
                  <Image src={logo.imageUrl} alt="LexisPredict" width={36} height={36} className="object-contain" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-cyan-300" />
                )}
              </div>
              <div>
                <p className="font-black">LexisPredict</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">Primeiro acesso</p>
              </div>
            </div>

            <div className="mt-16">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                <Database className="h-3.5 w-3.5" />
                Supabase vazio detectado
              </span>
              <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-[-0.04em]">
                Crie a primeira empresa sem sair do app.
              </h1>
              <p className="mt-5 text-sm leading-relaxed text-white/55">
                Nenhuma linha precisa ser inserida manualmente. O LexisPredict cria o tenant, vincula seu usuário e registra a solicitação de plano.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  "Empresa criada como tenant independente",
                  "Seu usuário vira Administrador da empresa",
                  "Essencial fica disponível enquanto o plano é ativado",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/10">
                      <Check className="h-4 w-4 text-emerald-300" />
                    </div>
                    <p className="text-sm font-medium text-white/80">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative border-t border-white/10 pt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
            Configuração idempotente · sem duplicar tenant
          </div>
        </aside>

        <main className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
          <div className="w-full max-w-2xl">
            <div className="mb-7">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Configuração inicial
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight">Preparar empresa</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Confirme os dados abaixo. O processo não recria tabelas e não apaga nada do Supabase.
              </p>
            </div>

            <div className="rounded-[24px] border bg-card p-5 shadow-sm sm:p-7">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="setup-company">Empresa</Label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="setup-company"
                      className="h-12 rounded-xl pl-11"
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                      placeholder="Nome da empresa"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-user">Responsável</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="setup-user"
                      className="h-12 rounded-xl pl-11"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome do administrador"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Conta autenticada</Label>
                  <div className="flex h-12 items-center rounded-xl border bg-muted/20 px-4 text-sm font-medium text-muted-foreground">
                    {email}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Label>Plano desejado</Label>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {PLAN_IDS.map((id) => {
                    const p = PLANOS_PRECOS[id];
                    const active = id === plan;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPlan(id)}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition",
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "hover:border-primary/30 hover:bg-muted/20"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black">{PLAN_LABEL[id]}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{p.tagline}</p>
                          </div>
                          {active ? (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-4 w-4" />
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-lg font-black">
                          {formatBRL(p.valorMensal)}
                          <span className="text-[10px] font-normal text-muted-foreground">/mês</span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border bg-muted/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Como funciona</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  A empresa nasce no <strong className="text-foreground">Essencial</strong> sem bloqueio. O plano <strong className="text-foreground">{PLAN_LABEL[plan]}</strong> fica registrado como solicitação para ativação comercial.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Valor de referência: {formatBRL(selected.valorMensal)}/mês.
                </p>
              </div>

              <Button
                className="mt-6 h-12 w-full rounded-xl font-bold"
                disabled={busy || !empresa.trim()}
                onClick={() => void provision()}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Criar ambiente da empresa
                {!busy ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
