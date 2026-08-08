"use client";

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 *
 * Login LexisPredict Elite v3
 * - Logo oficial do app (public/logo.png)
 * - Visual moderno com gradiente, vidro e animação suave (light/dark)
 * - Mesma lógica de autenticação: signInWithPassword + cookie lexis_user_email
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Mail, Copyright, Loader2, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useAuth } from '@/components/auth/auth-provider';
import { getTenantBrand } from '@/lib/tenant-brand';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const brand = getTenantBrand();

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const logoAsset = PlaceHolderImages.find(img => img.id === 'app-logo');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Válvula de Segurança de Redirecionamento Autoritativo
  useEffect(() => {
    let safetyTimeout: NodeJS.Timeout;

    if (!authLoading && user && profile) {
      router.replace('/');
      router.refresh();
      // Uma única tentativa suave — evita loop assign('/') ↔ /login
      safetyTimeout = setTimeout(() => {
        if (window.location.pathname.includes('/login') && user && profile) {
          router.replace('/');
        }
      }, 1500);
    }

    return () => clearTimeout(safetyTimeout);
  }, [user, profile, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const loginEmail = email.trim().toLowerCase();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password
      });

      if (authError) {
        toast({ title: "Erro de Acesso", description: "Credenciais inválidas.", variant: "destructive" });
        setIsSubmitting(false);
      } else if (data.user) {
        const emailVal = (data.user.email || loginEmail).toLowerCase().trim();
        if (emailVal) {
          const isProd = window.location.protocol === 'https:';
          document.cookie = `lexis_user_email=${emailVal}; path=/; max-age=31536000; samesite=lax${isProd ? '; secure' : ''}`;
        }
      }
    } catch (error) {
      toast({ title: "Falha de Rede", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  if (!authLoading && user && profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-[#0b1220] to-slate-950 space-y-8 font-sans p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none select-none">
          <div className="text-[20rem] font-black absolute -top-40 -left-20 text-white/10">LEXIS</div>
          <div className="text-[20rem] font-black absolute -bottom-40 -right-20 text-white/10">PREDICT</div>
        </div>
        <div className="w-20 h-20 bg-white text-black border-2 border-white flex items-center justify-center shadow-[12px_12px_0px_#00D1FF] rounded-2xl animate-in zoom-in-95 duration-700">
          {logoAsset ? (
            <Image src={logoAsset.imageUrl} alt="Logo" width={56} height={56} className="rounded-xl" />
          ) : (
            <ShieldCheck size={40} className="text-primary" />
          )}
        </div>
        <div className="space-y-4">
          <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Gabinete Aberto</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Redirecionando para Mission Control...</p>
        </div>
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#080c16] p-6 font-sans relative overflow-hidden text-foreground">
      {/* Fundo decorativo */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-24 w-[30rem] h-[30rem] rounded-full bg-primary/20 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-40 -right-24 w-[34rem] h-[34rem] rounded-full bg-cyan-500/15 blur-[130px]" />
        <div className="text-[24rem] font-black absolute -top-48 -left-24 text-foreground/[0.03] leading-none">LEXIS</div>
        <div className="text-[24rem] font-black absolute -bottom-48 -right-24 text-foreground/[0.03] leading-none">PREDICT</div>
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-700">
          <div className="w-24 h-24 mx-auto rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl shadow-[12px_12px_0px_hsl(var(--primary))] flex items-center justify-center p-3 overflow-hidden">
            {logoAsset ? (
              <Image src={logoAsset.imageUrl} alt="Logo LexisPredict" width={72} height={72} className="object-contain" priority />
            ) : (
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center">
                <ShieldCheck size={26} />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase tracking-tighter">
              {brand.name || "LexisPredict"} <span className="text-primary">Elite</span>
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">
              W1 Capital • Advanced Legal Ops
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="bg-secondary/50 dark:bg-card/60 border-b border-border/50 py-5 px-6 text-center flex items-center justify-center gap-2">
            <Sparkles size={14} className="text-primary" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Autenticação de Gabinete</p>
          </div>
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">E-mail Corporativo</Label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-12 rounded-xl border-border/80 bg-background/60 font-semibold uppercase text-xs tracking-wide focus-visible:ring-primary/40 transition-shadow"
                  required
                  placeholder="USUARIO@W1CAPITAL.COM"
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Senha de Segurança</Label>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-12 rounded-xl border-border/80 bg-background/60 font-semibold text-xs tracking-widest focus-visible:ring-primary/40 transition-shadow"
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>
            <Button type="submit" disabled={isSubmitting || authLoading} variant="liquid" className="w-full h-14 rounded-xl font-black uppercase text-[11px] tracking-widest group">
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} /> Sincronizando...
                </>
              ) : (
                <>
                  Acessar Sistema
                  <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
            <p className="text-center text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">
              Relatório Consolidado • W1 Capital Assessoria Financeira
            </p>
          </form>
          <div className="bg-secondary/40 dark:bg-card/50 border-t border-border/50 p-5">
            <Link href="/signup" className={cn("text-[9px] font-black text-muted-foreground hover:text-primary uppercase text-center w-full tracking-widest block transition-colors")}>
              Solicitar Nova Instância SaaS
            </Link>
          </div>
        </div>

        <footer className="text-center space-y-3 opacity-70">
          <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            <Copyright size={10} /> 2026 W1 Capital.
          </div>
          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
            Fundador Davi Alves Figueredo
          </p>
        </footer>
      </div>
    </div>
  );
}
