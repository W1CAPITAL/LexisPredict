
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Lock, Mail, Copyright, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useAuth } from '@/components/auth/auth-provider';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const logoAsset = PlaceHolderImages.find(img => img.id === 'app-logo');

  // Válvula de Segurança de Redirecionamento Autoritativo
  useEffect(() => {
    let safetyTimeout: NodeJS.Timeout;

    if (!authLoading && user && profile) {
      // Tentativa 1: Redirecionamento suave via Next Router
      router.replace('/');
      router.refresh();

      // Tentativa 2: Hard Refresh caso o router trave por cache ou descompasso de deploy
      safetyTimeout = setTimeout(() => {
        if (window.location.pathname.includes('/login')) {
          console.log("[Auth] Válvula de Segurança: Forçando recarregamento total para Mission Control...");
          window.location.assign('/');
        }
      }, 2500);
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
        // Rito de Sincronia Imediata: Gravar cookie lexis_user_email NA HORA do submit sucesso
        // Isso assegura que o Middleware reconheça a sessão na primeira requisição após o login
        const emailVal = (data.user.email || loginEmail).toLowerCase().trim();
        if (emailVal) {
          const isProd = window.location.protocol === 'https:';
          document.cookie = `lexis_user_email=${emailVal}; path=/; max-age=31536000; samesite=lax${isProd ? '; secure' : ''}`;
        }
        // O useEffect acima tratará o redirecionamento quando o user/profile estiverem prontos
      }
    } catch (error) {
      toast({ title: "Falha de Rede", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  if (!authLoading && user && profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f2f2] space-y-8 font-sans p-6 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-black text-white border-2 border-black flex items-center justify-center shadow-[12px_12px_0px_#00D1FF]">
          <ShieldCheck size={40} className="text-[#00D1FF]" />
        </div>
        <div className="space-y-4">
          <h1 className="text-2xl font-black uppercase tracking-tighter">Gabinete Aberto</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Redirecionando para Mission Control...</p>
        </div>
        <Loader2 className="animate-spin text-black" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f2f2] p-6 font-sans text-black relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none select-none overflow-hidden">
        <div className="text-[25rem] font-black absolute -top-40 -left-20">LEXIS</div>
        <div className="text-[25rem] font-black absolute -bottom-40 -right-20">PREDICT</div>
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-6">
          <div className="icon-3d-block black w-20 h-20 mx-auto border-2 border-black shadow-[12px_12px_0px_#00D1FF] flex items-center justify-center p-3">
            {logoAsset && (
              <Image src={logoAsset.imageUrl} alt="Logo" width={64} height={64} className="invert" />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black uppercase tracking-tighter">LexisPredict Elite</h1>
            <p className="text-[11px] font-black uppercase tracking-[0.4em] opacity-60">W1 Capital • Advanced Legal Ops</p>
          </div>
        </div>

        <Card className="bg-white border-2 border-black shadow-none rounded-none overflow-hidden">
          <CardHeader className="bg-[#f8f9fb] border-b-2 border-black py-6 text-center">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em]">Autenticação de Gabinete</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">E-mail Corporativo</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 w-4 h-4" />
                  <Input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="pl-10 border-2 border-black h-12 text-black font-black uppercase text-xs rounded-none focus-visible:ring-black" 
                    required 
                    placeholder="USUARIO@W1CAPITAL.COM"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Senha de Segurança</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 w-4 h-4" />
                  <Input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="pl-10 border-2 border-black h-12 text-black font-black uppercase text-xs rounded-none focus-visible:ring-black" 
                    required 
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <Button type="submit" disabled={isSubmitting || authLoading} className="w-full h-14 bg-black text-white border-2 border-black font-black uppercase text-[11px] tracking-widest hover:bg-white hover:text-black transition-all shadow-[8px_8px_0px_#00D1FF] hover:shadow-none rounded-none">
                {isSubmitting ? "Sincronizando..." : "Acessar Sistema"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-[#f8f9fb] border-t-2 border-black p-6">
             <Link href="/signup" className="text-[9px] font-black text-black/60 hover:text-black uppercase text-center w-full tracking-widest">
                Solicitar Nova Instância SaaS
             </Link>
          </CardFooter>
        </Card>

        <footer className="text-center space-y-4 opacity-60">
           <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
              <Copyright size={10} /> 2026 W1 Capital.
           </div>
           <p className="text-[8px] font-black uppercase tracking-[0.3em]">Relatório Consolidado • FUNDADOR DAVI ALVES FIGUEREDO</p>
        </footer>
      </div>
    </div>
  );
}
