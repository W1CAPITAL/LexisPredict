"use client";

/**
 * Cadastro multi-etapas — sem token (exceto atalho interno).
 * Fluxo: empresa → email/senha → nome (opc) → termos → plano → aguarda liberação Superadmin.
 */

import React, { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import {
  Building2,
  Mail,
  Lock,
  User,
  ChevronRight,
  ChevronLeft,
  Loader2,
  ShieldCheck,
  CreditCard,
  Sparkles,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export default function SignupPage() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    empresa: "",
    email: "",
    password: "",
    nome: "",
    plan: "essencial" as PlanId,
    authCode: "",
  });
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [donePending, setDonePending] = useState(false);
  const lock = useRef(false);
  const router = useRouter();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find((i) => i.id === "app-logo");

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const next = () => {
    if (step === 1 && !form.empresa.trim()) {
      toast({ title: "Informe o nome da empresa", variant: "destructive" });
      return;
    }
    if (step === 2) {
      if (!form.email.trim() || form.password.length < 6) {
        toast({ title: "E-mail e senha (mín. 6) obrigatórios", variant: "destructive" });
        return;
      }
    }
    if (step === 4 && !accepted) {
      toast({ title: "Aceite os termos para continuar", variant: "destructive" });
      return;
    }
    setStep((s) => (Math.min(6, Number(s) + 1) as Step));
  };

  const back = () => setStep((s) => (Math.max(1, Number(s) - 1) as Step));

  const finish = async () => {
    if (lock.current) return;
    lock.current = true;
    setLoading(true);
    try {
      const cleanEmail = form.email.trim().toLowerCase();
      const nomeEmpresa = form.empresa.trim().toUpperCase();
      const nomeUser = (form.nome.trim() || cleanEmail.split("@")[0]).toUpperCase();

      // token só se quiser provisionar sem fila de pagamento (opcional interno)
      const INTERNAL = "Azadsd5a96d5.6as5sa2d652as+94s9";
      const skipPay = form.authCode.trim() === INTERNAL;

      let { data: existingEmpresa } = await supabase
        .from("empresas")
        .select("id")
        .eq("nome", nomeEmpresa)
        .maybeSingle();

      let empresaId: string;
      if (existingEmpresa?.id) {
        empresaId = existingEmpresa.id;
      } else {
        const insertPayload: Record<string, unknown> = {
          nome: nomeEmpresa,
          plano: form.plan,
          plano_bloqueado: skipPay ? false : true,
        };
        const { data: neo, error } = await supabase
          .from("empresas")
          .insert(insertPayload)
          .select("id")
          .single();
        if (error) {
          // fallback se colunas de plano não existirem
          const { data: neo2, error: e2 } = await supabase
            .from("empresas")
            .insert({ nome: nomeEmpresa })
            .select("id")
            .single();
          if (e2) throw e2;
          empresaId = neo2.id;
        } else {
          empresaId = neo.id;
        }
      }

      if (!skipPay && existingEmpresa?.id) {
        await supabase
          .from("empresas")
          .update({ plano: form.plan, plano_bloqueado: true })
          .eq("id", empresaId);
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: form.password,
        options: { data: { full_name: nomeUser } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Falha ao criar usuário");

      const { error: profileError } = await supabase.from("usuarios").insert({
        auth_user_id: authData.user.id,
        empresa_id: empresaId,
        nome: nomeUser,
        email: cleanEmail,
        cargo: "Administrador",
      });
      if (profileError) throw profileError;

      if (skipPay) {
        toast({ title: "Conta ativada", description: "Provisionamento interno OK." });
        router.push("/");
        router.refresh();
      } else {
        setDonePending(true);
        setStep(6);
        toast({
          title: "Cadastro recebido",
          description: "Aguarde o Superadmin confirmar o pagamento do plano.",
        });
      }
    } catch (e: any) {
      toast({
        title: "Erro no cadastro",
        description: e?.message || "Falha",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      lock.current = false;
    }
  };

  const stepsLabel = ["Empresa", "Acesso", "Usuário", "Termos", "Plano", "Status"];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-6 space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl overflow-hidden border border-white/20 shadow-lg bg-white/80">
            {logo ? (
              <Image src={logo.imageUrl} alt="Lexis" width={56} height={56} className="object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/logo.png" alt="LexisPredict" className="h-full w-full object-contain p-1" />
            )}
          </div>
          <h1 className="text-lg font-black tracking-tight">Criar conta LexisPredict</h1>
          <p className="text-[11px] text-muted-foreground">Sem token · plano liberado pelo Superadmin após pagamento</p>
        </div>

        {/* progress */}
        <div className="flex gap-1 mb-6">
          {stepsLabel.map((lab, i) => {
            const n = (i + 1) as Step;
            return (
              <div key={lab} className="flex-1 space-y-1">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-500",
                    step >= n ? "bg-primary" : "bg-muted"
                  )}
                />
                <p className={cn("text-[8px] font-bold text-center uppercase tracking-wide", step === n ? "text-primary" : "text-muted-foreground")}>
                  {lab}
                </p>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-white/15 bg-background/70 backdrop-blur-xl shadow-2xl p-6 space-y-4 transition-all duration-300">
          {step === 1 && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <Label className="text-[10px] font-black uppercase">Nome da empresa</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10 h-11"
                  value={form.empresa}
                  onChange={(e) => set("empresa", e.target.value)}
                  placeholder="Ex.: W1 Capital Assessoria"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <Label className="text-[10px] font-black uppercase">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10 h-11" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <Label className="text-[10px] font-black uppercase">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10 h-11" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <Label className="text-[10px] font-black uppercase">Nome do usuário (opcional)</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10 h-11" value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Se vazio, usa o e-mail" />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(!!v)} id="terms" />
                <label htmlFor="terms" className="text-sm leading-snug">
                  Li e aceito os{" "}
                  <Dialog>
                    <DialogTrigger asChild>
                      <button type="button" className="text-primary font-bold underline">
                        Termos de Uso
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Termos de Uso</DialogTitle>
                        <DialogDescription>LexisPredict</DialogDescription>
                      </DialogHeader>
                      <TermsOfServiceContent />
                    </DialogContent>
                  </Dialog>
                </label>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <CreditCard size={14} /> Escolha o plano. O acesso só libera após o Superadmin confirmar o pagamento.
              </p>
              <div className="grid gap-2">
                {PLAN_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => set("plan", id)}
                    className={cn(
                      "text-left rounded-xl border p-3 transition-all duration-300 hover:scale-[1.01]",
                      form.plan === id ? "border-primary bg-primary/10 shadow-md" : "border-border hover:bg-muted/40"
                    )}
                  >
                    <p className="text-sm font-black">{PLAN_LABEL[id] || id}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{id}</p>
                  </button>
                ))}
              </div>
              <details className="text-[10px] text-muted-foreground">
                <summary className="cursor-pointer font-bold">Token interno (só equipe Lexis)</summary>
                <Input
                  className="mt-2 h-9"
                  placeholder="Opcional — pula fila de pagamento"
                  value={form.authCode}
                  onChange={(e) => set("authCode", e.target.value)}
                />
              </details>
            </div>
          )}

          {step === 6 && donePending && (
            <div className="text-center space-y-3 py-4 animate-in zoom-in-95 duration-500">
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center">
                <ShieldCheck className="text-primary h-7 w-7" />
              </div>
              <h2 className="font-black text-base">Aguardando liberação</h2>
              <p className="text-sm text-muted-foreground">
                Conta criada. O Superadmin precisa autenticar o pagamento do plano{" "}
                <strong>{PLAN_LABEL[form.plan] || form.plan}</strong> no painel do app.
              </p>
              <Button variant="outline" asChild>
                <Link href="/login">Ir para login</Link>
              </Button>
            </div>
          )}

          {step < 6 && (
            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="ghost" disabled={step === 1 || loading} onClick={back} className="gap-1">
                <ChevronLeft size={16} /> Voltar
              </Button>
              {step < 5 ? (
                <Button type="button" onClick={next} className="gap-1">
                  Continuar <ChevronRight size={16} />
                </Button>
              ) : (
                <Button type="button" onClick={() => void finish()} disabled={loading} className="gap-1">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  Concluir cadastro
                </Button>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary font-bold">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
