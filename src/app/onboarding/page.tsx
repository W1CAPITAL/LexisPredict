
"use client";

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { Play, ArrowLeft, ShieldCheck, Copyright } from 'lucide-react';
import Link from 'next/link';

export default function OnboardingVideoPage() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="flex h-screen bg-[#f3f2f2] font-sans text-black">
      <Sidebar />
      <main className="flex-1 overflow-auto p-4 lg:p-8 flex flex-col">
        <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" className="h-11 px-4 border-2 border-black rounded-none font-black uppercase text-[10px] hover:bg-black hover:text-white transition-all">
                  <ArrowLeft size={16} className="mr-2" /> Gabinete
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Mestre em LexisPredict</h1>
                <p className="text-[10px] font-black uppercase text-black/40 tracking-widest mt-1">Formação Estratégica de Operador Elite</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 border-2 border-black bg-white shadow-[4px_4px_0px_#00D1FF]">
               <ShieldCheck size={16} className="text-primary" />
               <span className="text-[9px] font-black uppercase tracking-widest">Protocolo Ashley@25472053</span>
            </div>
          </div>

          <div className="bg-black border-4 border-black shadow-[20px_20px_0px_rgba(0,0,0,0.05)] aspect-video relative flex-1 min-h-[400px]">
            {isPlaying ? (
              <video 
                controls 
                autoPlay 
                className="w-full h-full object-contain"
                src="/Onboarding_LexisPredict.mp4"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-black/80 via-black/90 to-black">
                <div className="text-white text-center mb-12 space-y-4 px-6 animate-in fade-in zoom-in duration-700">
                  <div className="w-20 h-20 bg-primary/10 border-2 border-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Play size={32} className="text-primary ml-1" />
                  </div>
                  <h2 className="text-4xl lg:text-6xl font-black uppercase tracking-tighter leading-none">Treinamento de<br />Operação de Elite</h2>
                  <p className="text-sm font-black uppercase tracking-[0.4em] text-white/40">Duração: 6 Minutos • Imersão Total</p>
                </div>
                <Button 
                  onClick={() => setIsPlaying(true)}
                  className="h-20 px-12 bg-white text-black hover:bg-primary hover:text-black transition-all rounded-none font-black uppercase tracking-widest text-sm shadow-[8px_8px_0px_#00D1FF] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                >
                  Iniciar Onboarding
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 pb-20">
            <FeatureCard number="01" title="Visão de Radar" desc="Aprenda a interpretar o Dashboard e o índice de risco em segundos." />
            <FeatureCard number="02" title="Triagem Neural" desc="Domine a Auditoria 3D e a geração automatizada de documentos." />
            <FeatureCard number="03" title="Fluxo de Caixa" desc="Entenda como bater metas de atendimento via Terminal WhatsApp." />
          </div>
        </div>

        <footer className="h-10 border-t border-black/5 bg-transparent flex items-center justify-center gap-6 text-[10px] text-black/40 font-black uppercase tracking-[0.3em] mt-auto">
          <div className="flex items-center gap-2"><Copyright size={10} /> 2026 W1 Capital.</div>
          <span>Gabinete Elite • Authority System</span>
        </footer>
      </main>
    </div>
  );
}

function FeatureCard({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="bg-white border-2 border-black p-6 shadow-[6px_6px_0px_#000]">
      <p className="text-primary font-black text-2xl mb-2">{number}</p>
      <h3 className="font-black uppercase text-xs mb-2">{title}</h3>
      <p className="text-[10px] font-bold text-black/60 uppercase leading-relaxed">{desc}</p>
    </div>
  );
}
