"use client";

import React, { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { TermsOfServiceContent } from "@/components/legal/TermsOfServiceContent";
import { useToast } from "@/hooks/use-toast";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { PLAN_IDS, PLAN_LABEL, type PlanId } from "@/lib/planos-pacotes";
import {
  PLANOS_PRECOS,
  formatBRL,
  mensalDoAnual,
  economiaAnual,
} from "@/lib/planos-precos";
import { cn } from "@/lib/utils";
import { createCommercialAccountAction } from "@/app/actions/commercial-signup-actions";
import { provisionMinhaEmpresaAction } from "@/app/actions/tenant-provision-actions";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS = ["Empresa", "Acesso", "Usuário", "Termos", "Plano", "Status"];

const HIGHLIGHTS = [
  "Ambiente separado por empresa",
  "Planos modulares sem migrar dados",
  "Supabase Auth + Vercel",
];

export default function SignupPage() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    empresa: "",
    email: "",
    password: "",
    nome: "",
    plan: "essencial" as PlanId,
  });
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [donePending, setDonePending] = useState(false);
  const lock = useRef(false);
  const { toast } = useToast();
  const logo = PlaceHolderImages.find((i) => i.id === "app-logo");

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const next = () => {
    if (step === 1 && !form.empresa.trim()) {
      toast({ title: "Informe o nome da empresa", variant: "destructive" });
      return;
    }
    if (step === 2 && (!form.email.trim() || form.password.length < 6)) {
      toast({
        title: "Revise os dados de acesso",
        description: "Informe um e-mail válido e senha com pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }
    if (step === 4 && !accepted) {
      toast({ title: "Aceite os termos para continuar", variant: "destructive" });
      return;
    }
    setStep((s) => Math.min(6, Number(s) + 1) as Step);
  };

  const back = () => setStep((s) => Math.max(1, Number(s) - 1) as Step);

  const finish = async () => {
    if (lock.current) return;
    lock.current = true;
    setLoading(true);

    try {
      const cleanEmail = form.email.trim().toLowerCase();
      const nomeEmpresa = form.empresa.trim().toUpperCase();
      const nomeUser = (form.nome.trim() || cleanEmail.split("@")[0]).toUpperCase();
      const acceptedAt = new Date().toISOString();

      const result = await createCommercialAccountAction({
        empresa: nomeEmpresa,
        email: cleanEmail,
        password: form.password,
        nome: nomeUser,
        plan: form.plan,
        termosVersao: "2026-09-21",
        termosAceitosEm: acceptedAt,
      });

      if (!result.ok) {
        const alreadyExists = "code" in result && result.code === "already_exists";

        if (alreadyExists) {
          const { data: existingLogin, error: existingLoginError } =
            await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: form.password,
            });

          if (!existingLoginError && existingLogin.user) {
            const provision = await provisionMinhaEmpresaAction({
              empresa: nomeEmpresa,
              nome: nomeUser,
              plan: form.plan,
            });

            if (!provision.ok) {
              toast({
                title: "Conta encontrada, mas a empresa não pôde ser configurada",
                description: provision.error || "Falha ao preparar o tenant.",
                variant: "destructive",
              });
              return;
            }

            toast({
              title: "Conta existente recuperada",
              description: "Empresa configurada. A ativação do plano permanece pendente de confirmação comercial.",
            });
            window.setTimeout(() => window.location.replace("/"), 350);
            return;
          }
        }

        toast({
          title: alreadyExists ? "Conta já cadastrada" : "Não foi possível concluir",
          description: alreadyExists
            ? "Este e-mail já existe. Use a senha correta ou entre pela tela de login."
            : result.error || "Falha no cadastro.",
          variant: "destructive",
        });
        return;
      }

      setDonePending(true);
      setStep(6);
      toast({
        title: "Cadastro criado",
        description: "A empresa foi criada e a solicitação do plano ficou registrada para ativação comercial.",
      });
    } catch (e: any) {
      toast({
        title: "Não foi possível concluir",
        description: e?.message || "Falha no cadastro.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      lock.current = false;
    }
  };

  const selectedPlan = PLANOS_PRECOS[form.plan];
  const commercialWhatsapp = "https://wa.me/5513991199349?text=" + encodeURIComponent(
    "Olá, quero solicitar a liberação do plano " + PLAN_LABEL[form.plan] + " do LexisPredict para a empresa " + (form.empresa.trim() || "minha empresa") + "."
  );

  return (
    <div className="min-h-screen bg-background p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1500px] overflow-hidden rounded-[30px] border bg-card shadow-2xl lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[.78fr_1.22fr]">
        <aside className="relative hidden overflow-hidden border-r bg-[#07111f] p-10 !text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-cyan-400/15 blur-[120px]" />
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
                <p className="font-black !text-white">LexisPredict</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">Commercial SaaS</p>
              </div>
            </div>

            <div className="mt-16">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                Nova empresa
              </span>
              <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-[-0.04em] !text-white">
                Configure seu ambiente em poucos passos.
              </h1>
              <p className="mt-5 text-sm leading-relaxed !text-slate-200">
                Crie a conta, identifique a empresa e escolha o pacote que melhor encaixa na operação.
              </p>

              <div className="mt-9 space-y-3">
                {HIGHLIGHTS.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/10">
                      <Check className="h-4 w-4 text-emerald-300" />
                    </div>
                    <span className="text-sm font-medium !text-white">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative border-t border-white/10 pt-6 text-[10px] font-bold uppercase tracking-[0.16em] !text-slate-300">
            Tenant isolado · ativação controlada · dados preservados
          </div>
        </aside>

        <main className="flex items-center justify-center p-4 sm:p-7 lg:p-10 xl:p-14">
          <div className="w-full max-w-3xl">
            <div className="mb-7 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border bg-card">
                  {logo ? (
                    <Image src={logo.imageUrl} alt="LexisPredict" width={34} height={34} className="object-contain" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-black">LexisPredict</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Commercial SaaS</p>
                </div>
              </div>
            </div>

            <div className="mb-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    Etapa {step} de 6
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                    {step === 6 ? "Cadastro recebido" : STEPS[step - 1]}
                  </h2>
                </div>
                <Link href="/login" className="text-xs font-bold text-muted-foreground hover:text-primary">
                  Já tenho conta
                </Link>
              </div>

              <div className="mt-5 grid grid-cols-6 gap-1.5">
                {STEPS.map((label, i) => {
                  const n = (i + 1) as Step;
                  const active = step === n;
                  const complete = step > n;
                  return (
                    <div key={label} className="min-w-0">
                      <div
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          complete || active ? "bg-primary" : "bg-muted"
                        )}
                      />
                      <p
                        className={cn(
                          "mt-1 hidden truncate text-center text-[8px] font-bold uppercase tracking-wide sm:block",
                          active ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] border bg-card p-5 shadow-sm sm:p-7">
              {step === 1 && (
                <div className="animate-in fade-in space-y-5">
                  <div>
                    <h3 className="text-lg font-black">Identifique a empresa</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Este nome será usado no tenant e no ambiente da equipe.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="empresa">Nome da empresa</Label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="empresa"
                        className="h-12 rounded-xl pl-11"
                        value={form.empresa}
                        onChange={(e) => set("empresa", e.target.value)}
                        placeholder="Ex.: Silva & Associados"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="animate-in fade-in space-y-5">
                  <div>
                    <h3 className="text-lg font-black">Crie o acesso principal</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Este usuário será a referência inicial da empresa. O e-mail informado será usado para autenticação.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">E-mail</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          className="h-12 rounded-xl pl-11"
                          type="email"
                          value={form.email}
                          onChange={(e) => set("email", e.target.value)}
                          placeholder="admin@empresa.com.br"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3">
                      <p className="text-xs font-bold text-sky-800 dark:text-sky-200">Confira o e-mail com atenção</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Use um endereço ao qual você tenha acesso. Ele será seu login no LexisPredict. Depois do cadastro, confira também a caixa de entrada, spam e lixo eletrônico para eventuais mensagens de autenticação ou ativação.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          className="h-12 rounded-xl pl-11"
                          type="password"
                          value={form.password}
                          onChange={(e) => set("password", e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="animate-in fade-in space-y-5">
                  <div>
                    <h3 className="text-lg font-black">Nome do responsável</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Opcional. Se ficar vazio, o sistema usa a parte inicial do e-mail.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        className="h-12 rounded-xl pl-11"
                        value={form.nome}
                        onChange={(e) => set("nome", e.target.value)}
                        placeholder="Nome e sobrenome"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="animate-in fade-in space-y-5">
                  <div>
                    <h3 className="text-lg font-black">Termos e responsabilidade</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Confirme a leitura antes de criar o tenant comercial.
                    </p>
                  </div>

                  <label
                    htmlFor="terms"
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-muted/15 p-4"
                  >
                    <Checkbox
                      checked={accepted}
                      onCheckedChange={(v) => setAccepted(!!v)}
                      id="terms"
                      className="mt-0.5"
                    />
                    <span className="text-sm leading-relaxed">
                      Li e aceito os Termos de Uso, Política de Privacidade e consentimentos descritos, inclusive regras de tratamento de dados, IA, ativação de plano e modo convidado.
                    </span>
                  </label>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-auto">
                        Ler Termos de Uso
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Termos de Uso</DialogTitle>
                        <DialogDescription>LexisPredict Commercial</DialogDescription>
                      </DialogHeader>
                      <TermsOfServiceContent />
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {step === 5 && (
                <div className="animate-in fade-in space-y-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-lg font-black">Escolha o plano inicial</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        O tenant é o mesmo; os módulos liberados mudam conforme o plano.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/8 px-3 py-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      <CreditCard className="h-3.5 w-3.5" />
                      Anual com desconto
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {PLAN_IDS.map((id) => {
                      const plano = PLANOS_PRECOS[id];
                      const selected = form.plan === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => set("plan", id)}
                          aria-pressed={selected}
                          className={cn(
                            "relative overflow-hidden rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border bg-background/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-black">{PLAN_LABEL[id]}</p>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{plano.tagline}</p>
                            </div>
                            {selected ? (
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="h-4 w-4" />
                              </span>
                            ) : plano.selo ? (
                              <span className="rounded-full bg-primary/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-primary">
                                {plano.selo}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-4 flex items-end gap-1">
                            <span className="text-2xl font-black">{formatBRL(plano.valorMensal)}</span>
                            <span className="pb-1 text-[10px] text-muted-foreground">/mês</span>
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Anual: {formatBRL(plano.valorAnual)} · {formatBRL(mensalDoAnual(id))}/mês equivalente
                          </p>
                          <p className="mt-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            Economia anual de {formatBRL(economiaAnual(id))}
                          </p>

                          <div className="mt-4 space-y-2 border-t pt-3">
                            {plano.beneficios.slice(0, 3).map((beneficio) => (
                              <div key={beneficio} className="flex items-start gap-2 text-xs">
                                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                <span>{beneficio}</span>
                              </div>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Selecionado</p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black">{PLAN_LABEL[form.plan]}</p>
                        <p className="text-xs text-muted-foreground">{selectedPlan.tagline}</p>
                      </div>
                      <p className="text-lg font-black">
                        {formatBRL(selectedPlan.valorMensal)}
                        <span className="text-[10px] font-normal text-muted-foreground">/mês</span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-black">Solicitação comercial controlada</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Ao criar a empresa, o plano escolhido fica registrado como pendente. O acesso operacional é liberado somente após confirmação comercial ou ativação pelo Superadmin.
                        </p>
                      </div>
                      <Button asChild className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700">
                        <a href={commercialWhatsapp} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Falar com o comercial
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {step === 6 && donePending && (
                <div className="animate-in zoom-in-95 py-5 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
                    <ShieldCheck className="h-8 w-8 text-emerald-600" />
                  </div>
                  <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
                    Cadastro concluído
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight">Cadastro concluído</h2>
                  <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                    Sua conta foi criada para o plano <strong className="text-foreground">{PLAN_LABEL[form.plan]}</strong>.
                    O e-mail <strong className="text-foreground">{form.email}</strong> será usado no login.
                  </p>
                  <div className="mx-auto mt-4 max-w-lg rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 text-left">
                    <p className="text-sm font-black text-sky-800 dark:text-sky-200">Confira seu e-mail</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Verifique a caixa de entrada, spam e lixo eletrônico para mensagens de autenticação. O acesso operacional só é liberado após a ativação comercial do plano.
                    </p>
                  </div>
                  <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                    <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
                      <a href={commercialWhatsapp} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Solicitar liberação do plano
                      </a>
                    </Button>
                    <Button asChild variant="outline">
                    <Link href="/login">
                      Ir para login
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                    </Button>
                  </div>
                </div>
              )}

              {step < 6 && (
                <div className="mt-7 flex items-center justify-between gap-3 border-t pt-5">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={step === 1 || loading}
                    onClick={back}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>

                  {step < 5 ? (
                    <Button type="button" onClick={next}>
                      Continuar
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="button" onClick={() => void finish()} disabled={loading}>
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Criar empresa
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
