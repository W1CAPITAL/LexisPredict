"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  TestTube2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useAuth } from "@/components/auth/auth-provider";
import { getTenantBrand } from "@/lib/tenant-brand";
import Link from "next/link";
import { enableGuestMode } from "@/lib/guest-mode";
import { safetyLoginAction } from "@/app/actions/safety-mode-actions";
import { isQuotaOrBillingError } from "@/lib/hybrid/safety-mode";

const brand = getTenantBrand();

const HIGHLIGHTS = [
  "Carteira processual, prazos e equipe em um só painel",
  "DataJud, DJEN, automações e inteligência operacional",
  "CRM, cobrança e gestão financeira por plano",
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const logoAsset = PlaceHolderImages.find((img) => img.id === "app-logo");

  useEffect(() => {
    let safetyTimeout: NodeJS.Timeout;

    if (!authLoading && user) {
      router.replace("/");
      router.refresh();
      safetyTimeout = setTimeout(() => {
        if (window.location.pathname.includes("/login") && user && profile) {
          router.replace("/");
        }
      }, 1500);
    }

    return () => clearTimeout(safetyTimeout);
  }, [user, profile, authLoading, router]);

  const enterGuest = async () => {
    try {
      if (supabase) await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* sessão residual é limpa pelo modo convidado */
    }
    enableGuestMode();
    toast({
      title: "Modo convidado ativado",
      description: "Você pode testar o app. Alterações ficam somente neste navegador e não são salvas no Supabase.",
    });
    window.location.replace("/");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const loginEmail = email.trim().toLowerCase();
    const trySafety = async (reason: string) => {
      const candidates = Array.from(new Set([
        loginEmail,
        loginEmail.includes("@") ? loginEmail.split("@")[0] : "",
      ].filter(Boolean)));
      let lastError = "";
      for (const candidate of candidates) {
        const safety = await safetyLoginAction(candidate, password);
        if (safety.ok) {
          toast({
            title: "Modo de contingência",
            description: "Supabase indisponível. A carteira será aberta pela planilha com sessão temporária protegida.",
          });
          window.location.replace("/modo-seguranca");
          return true;
        }
        lastError = safety.error || lastError;
      }
      if (reason) {
        toast({
          title: "Contingência indisponível",
          description: lastError || "Não foi possível validar a sessão de contingência.",
          variant: "destructive",
        });
      }
      setIsSubmitting(false);
      return false;
    };

    try {
      if (!supabase) {
        await trySafety("Supabase não configurado");
        return;
      }

      const authPromise = supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      const timed = await Promise.race([
        authPromise,
        new Promise<{ data: any; error: any }>((resolve) =>
          setTimeout(
            () =>
              resolve({
                data: { user: null, session: null },
                error: { message: "timeout quota" },
              }),
            4500
          )
        ),
      ]);

      const { data, error: authError } = timed;

      if (authError) {
        const msg = String((authError as any)?.message || authError);
        if (isQuotaOrBillingError(msg) || /fetch|network|timeout|521|402|429/i.test(msg)) {
          await trySafety(msg);
          return;
        }
        toast({
          title: "Não foi possível entrar",
          description: "E-mail ou senha inválidos.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (data.user && data.session) {
        const emailVal = (data.user.email || loginEmail).toLowerCase().trim();
        if (emailVal) {
          const isProd = window.location.protocol === "https:";
          document.cookie =
            "lexis_user_email=" +
            emailVal +
            "; path=/; max-age=31536000; samesite=lax" +
            (isProd ? "; secure" : "");
        }
        window.location.replace("/");
      }
    } catch {
      await trySafety("Falha de rede");
    }
  };

  if (!authLoading && user) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl flex-col items-center justify-center text-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border bg-card shadow-xl">
            {logoAsset ? (
              <Image src={logoAsset.imageUrl} alt="LexisPredict" width={58} height={58} className="object-contain" />
            ) : (
              <ShieldCheck className="h-8 w-8 text-sky-600" />
            )}
          </div>
          <h1 className="mt-6 text-2xl font-black tracking-tight">Acesso confirmado</h1>
          <p className="mt-2 text-sm text-slate-500">Preparando o ambiente da sua empresa…</p>
          <Loader2 className="mt-6 h-6 w-6 animate-spin text-sky-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1500px] overflow-hidden rounded-[30px] border bg-card shadow-2xl lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden overflow-hidden border-r bg-[#07111f] p-10 !text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-400/15 blur-[120px]" />
          <div className="absolute -bottom-28 right-0 h-[28rem] w-[28rem] rounded-full bg-violet-500/20 blur-[140px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,.08),transparent_35%)]" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur">
                {logoAsset ? (
                  <Image src={logoAsset.imageUrl} alt="LexisPredict" width={36} height={36} className="object-contain" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-cyan-300" />
                )}
              </div>
              <div>
                <p className="font-black tracking-tight !text-white">{brand.name || "LexisPredict"}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Commercial SaaS</p>
              </div>
            </div>

            <div className="mt-16 max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                Legal operations platform
              </span>
              <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-[-0.04em] !text-white xl:text-6xl">
                Operação jurídica com dados, automação e controle em tempo real.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/60">
                Um ambiente multiempresa para acompanhar carteira, prazos, tribunais, CRM, equipe e performance sem fragmentar a operação.
              </p>
            </div>

            <div className="mt-10 grid gap-3">
              {HIGHLIGHTS.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  </div>
                  <p className="text-sm font-medium text-white/80">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-12 flex items-center justify-between border-t border-white/10 pt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
            <span>Supabase · Vercel · Multi-tenant</span>
            <span>LexisPredict © 2026</span>
          </div>
        </section>

        <main className="relative flex items-center justify-center bg-white p-5 text-slate-950 sm:p-8 lg:p-12">
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />
          <div className="relative w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border bg-card shadow-sm">
                  {logoAsset ? (
                    <Image src={logoAsset.imageUrl} alt="LexisPredict" width={36} height={36} className="object-contain" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-sky-600" />
                  )}
                </div>
                <div>
                  <p className="font-black">{brand.name || "LexisPredict"}</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Commercial SaaS</p>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-sky-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                Acesso seguro
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Entrar no LexisPredict</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Use as credenciais da sua empresa para abrir o ambiente e as permissões do seu plano.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold">E-mail</Label>
                <div className="group relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-sky-600" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl border-slate-200 bg-white pl-11 text-slate-950 placeholder:text-slate-400"
                    required
                    placeholder="voce@empresa.com.br"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold">Senha</Label>
                <div className="group relative">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-sky-600" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-xl border-slate-200 bg-white pl-11 text-slate-950 placeholder:text-slate-400"
                    required
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || authLoading}
                className="h-12 w-full rounded-xl bg-slate-950 font-bold text-white hover:bg-slate-800"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Autenticando…
                  </>
                ) : (
                  <>
                    Entrar no ambiente
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="relative my-1 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">ou</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => void enterGuest()}
                className="h-12 w-full rounded-xl border-sky-200 bg-sky-50 font-bold text-sky-800 hover:bg-sky-100 hover:text-sky-900"
              >
                <TestTube2 className="mr-2 h-4 w-4" />
                Entrar como convidado
              </Button>
              <p className="text-center text-[11px] leading-relaxed text-slate-500">
                Modo demonstração: navegação completa e dados temporários somente no cache deste navegador. Nada é gravado no Supabase.
              </p>
            </form>

            <div className="mt-6 rounded-2xl border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                <div>
                  <p className="text-sm font-bold">Primeira empresa?</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Crie o tenant, escolha o plano e conclua a ativação comercial pelo fluxo de cadastro.
                  </p>
                  <Link href="/signup" className="mt-3 inline-flex items-center text-xs font-bold text-sky-600 hover:underline">
                    Criar conta empresarial
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            <p className="mt-8 text-center text-[10px] leading-relaxed text-slate-500">
              Ao entrar, você acessa apenas os dados e módulos vinculados à sua empresa.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
