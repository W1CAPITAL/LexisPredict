/**
 * @fileOverview Componente de Instalação Móvel v110.0
 * Gerencia o prompt de instalação PWA ou fornece instruções para iOS/Android.
 * Otimizado com cleanup de listeners e detecção inteligente de plataforma.
 */
"use client";

import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    // Detecção de Plataforma
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Cleanup: Evita vazamento de memória e listeners duplicados
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (isInstalled) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start h-12 gap-3 text-sidebar-foreground/60 hover:text-primary hover:bg-sidebar-accent transition-all rounded-lg px-3">
          <Smartphone size={16} />
          <span className="text-[11px] font-black uppercase tracking-tight">Usar no Celular</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
            <Smartphone className="text-primary" /> LexisPredict Mobile
          </DialogTitle>
          <DialogDescription className="font-bold text-[10px] uppercase">
            Tenha o seu gabinete jurídico na palma da mão.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {deferredPrompt ? (
            <div className="space-y-4">
              <p className="text-sm font-medium leading-relaxed">
                Seu dispositivo é compatível com a instalação direta. Clique no botão abaixo para adicionar à tela inicial.
              </p>
              <Button onClick={handleInstallClick} className="w-full h-14 bg-black text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl">
                <Download size={18} className="mr-2 text-primary" /> Instalar Aplicativo
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {(platform === 'ios' || platform === 'other') && (
                <div className="p-4 bg-secondary/20 rounded-xl border border-border/10 space-y-2">
                  <p className="text-[11px] font-black uppercase text-primary flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">1</span> iOS (Safari)
                  </p>
                  <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
                    Toque no ícone de <span className="text-foreground font-bold">Compartilhar</span> (quadrado com seta) na barra inferior e selecione <span className="text-foreground font-bold">"Adicionar à Tela de Início"</span>.
                  </p>
                </div>
              )}
              
              {(platform === 'android' || platform === 'other') && (
                <div className="p-4 bg-secondary/20 rounded-xl border border-border/10 space-y-2">
                  <p className="text-[11px] font-black uppercase text-primary flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">2</span> Android (Chrome)
                  </p>
                  <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
                    Toque no menu <span className="text-foreground font-bold">⋮ (três pontos)</span> no canto superior e escolha <span className="text-foreground font-bold">"Instalar Aplicativo"</span> ou "Adicionar à Tela Inicial".
                  </p>
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-3 text-[10px] font-medium text-muted-foreground bg-slate-50 p-4 rounded-lg border border-slate-100">
            <Info size={14} className="shrink-0 text-primary" />
            <span>Uma vez instalado, o sistema removerá as barras do navegador para uma experiência de aplicativo nativo.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
