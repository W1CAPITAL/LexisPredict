/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
"use client";

import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Copyright, KeyRound, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TermsOfServiceContent } from '@/components/legal/TermsOfServiceContent';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    empresa: '',
    authCode: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const signupLock = useRef(false);
  const logoAsset = PlaceHolderImages.find(img => img.id === 'app-logo');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms) {
      toast({ 
        title: "Ação Requerida", 
        description: "Você precisa aceitar os Termos de Uso para prosseguir.", 
        variant: "destructive" 
      });
      return;
    }

    if (signupLock.current) return;
    signupLock.current = true;
    setLoading(true);

    const provisionCode = 'Azadsd5a96d5.6as5sa2d652as+94s9';
    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanAuthCode = formData.authCode.trim();

    if (cleanAuthCode !== provisionCode) {
      toast({ 
        title: "Autorização Negada", 
        description: "O TOKEN DE GABINETE inserido é inválido.", 
        variant: "destructive" 
      });
      setLoading(false);
      signupLock.current = false;
      return;
    }

    try {
      // 1. Gerenciamento de Empresa
      const nomeEmpresa = formData.empresa.trim().toUpperCase();
      let { data: existingEmpresa } = await supabase
        .from('empresas')
        .select('id')
        .eq('nome', nomeEmpresa)
        .maybeSingle();

      let createdEmpresaId;
      if (existingEmpresa) {
        createdEmpresaId = existingEmpresa.id;
      } else {
        const { data: newEmpresa, error: insertEmpresaError } = await supabase
          .from('empresas')
          .insert({ nome: nomeEmpresa })
          .select()
          .single();
        if (insertEmpresaError) throw insertEmpresaError;
        createdEmpresaId = newEmpresa.id;
      }

      // 2. Cadastro Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: formData.password,
        options: { data: { full_name: formData.nome.trim() } }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Falha ao provisionar usuário no Auth.");

      // 3. Criação de Perfil
      const profilePayload = {
        auth_user_id: authData.user.id,
        empresa_id: createdEmpresaId,
        nome: formData.nome.trim().toUpperCase(),
        email: cleanEmail,
        cargo: 'Administrador'
      };

      const { error: profileError } = await supabase.from('usuarios').insert(profilePayload);
      if (profileError) throw profileError;
      
      toast({ 
        title: "Instância Ativada", 
        description: `Ambiente provisionado com sucesso para ${cleanEmail}.`,
      });

      router.push('/');
      router.refresh();

    } catch (error: any) {
      toast({ 
        title: "Erro de Provisionamento", 
        description: error.message || "Falha na comunicação com o servidor.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
      signupLock.current = false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6 font-sans text-black">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="icon-3d-wrapper w-fit mx-auto">
            <div className="icon-3d-block black w-16 h-16 rounded-none border-2 border-black shadow-[10px_10px_0px_#000] overflow-hidden flex items-center justify-center p-2">
              {logoAsset && (
                <Image 
                  src={logoAsset.imageUrl} 
                  alt="Lexis Predict" 
                  width={48} 
                  height={48} 
                  data-ai-hint={logoAsset.imageHint}
                  className="object-contain invert"
                />
              )}
            </div>
          </div>
          <div className="group cursor-default">
            <h1 className="text-2xl font-black text-black uppercase tracking-tighter">Provisionamento SaaS</h1>
            <p className="text-[10px] font-black text-black uppercase tracking-[0.3em] opacity-60">W1 Capital Cloud CRM</p>
          </div>
        </div>

        <Card className="bg-white border-black shadow-none rounded-none overflow-hidden border-2">
          <CardHeader className="bg-white border-b border-black py-4">
            <CardTitle className="text-[10px] font-black uppercase text-black text-center tracking-widest">Nova Instância Elite</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-black">Token de Gabinete</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-4 h-4" />
                  <Input 
                    placeholder="TOKEN OBRIGATÓRIO..."
                    value={formData.authCode} 
                    onChange={(e) => setFormData({...formData, authCode: e.target.value})} 
                    className="pl-10 border-black border-2 h-11 text-black font-black uppercase text-xs bg-white rounded-none focus-visible:ring-black placeholder:text-black/20" 
                    required 
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-black">Nome do Gestor</Label>
                <Input 
                  value={formData.nome} 
                  onChange={(e) => setFormData({...formData, nome: e.target.value})} 
                  className="border-black border-2 h-11 text-black font-black uppercase text-xs bg-white rounded-none focus-visible:ring-black" 
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-black">Empresa / Escritório</Label>
                <Input 
                  value={formData.empresa} 
                  onChange={(e) => setFormData({...formData, empresa: e.target.value})} 
                  className="border-black border-2 h-11 text-black font-black uppercase text-xs bg-white rounded-none focus-visible:ring-black" 
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-black">E-mail Corporativo</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-4 h-4" />
                  <Input 
                    type="email"
                    value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                    className="pl-10 border-black border-2 h-11 text-black font-black uppercase text-xs bg-white rounded-none focus-visible:ring-black" 
                    required 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-black">Senha de Segurança</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-4 h-4" />
                  <Input 
                    type="password" 
                    value={formData.password} 
                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                    className="pl-10 border-black border-2 h-11 text-black font-black uppercase text-xs bg-white rounded-none focus-visible:ring-black" 
                    required 
                  />
                </div>
              </div>

              <div className="flex items-start space-x-3 pt-4">
                <Checkbox 
                  id="terms" 
                  checked={acceptedTerms} 
                  onCheckedChange={(val) => setAcceptedTerms(!!val)}
                  className="mt-1 border-black border-2 rounded-none data-[state=checked]:bg-black"
                />
                <div className="grid gap-1.5 leading-none">
                  <label htmlFor="terms" className="text-[10px] font-black uppercase cursor-pointer">
                    Li e aceito os Termos de Uso e Licença
                  </label>
                  <Dialog>
                    <DialogTrigger asChild>
                      <button type="button" className="text-[9px] font-black uppercase text-primary underline text-left">Ver Termos de Uso</button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[700px] rounded-none border-2 border-black shadow-[12px_12px_0px_#000]">
                      <DialogHeader>
                        <DialogTitle className="font-black uppercase flex items-center gap-2">
                           <ShieldCheck size={20} className="text-primary" /> Acordo de Licenciamento
                        </DialogTitle>
                      </DialogHeader>
                      <TermsOfServiceContent />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-11 bg-white text-black border-2 border-black font-black uppercase text-[10px] hover:bg-black hover:text-white transition-all rounded-none mt-4 shadow-[4px_4px_0px_#000] hover:shadow-none">
                {loading ? "Processando..." : "Finalizar e Ativar Instância"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-white border-t border-black p-4">
             <Link href="/login" className="text-[9px] font-black text-black hover:bg-black hover:text-white px-2 py-2 transition-all uppercase text-center w-full rounded-none border-2 border-transparent hover:border-black">
                Já possui acesso? Voltar ao Login
             </Link>
          </CardFooter>
        </Card>

        <footer className="text-center space-y-2 opacity-60">
           <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-black">
              <Copyright size={9} /> 2026 W1 Capital. Todos os direitos reservados.
           </div>
           <p className="text-[8px] text-black font-black uppercase tracking-tighter">Relatório Consolidado • FUNDADOR DAVI ALVES FIGUEREDO</p>
        </footer>
      </div>
    </div>
  );
}
