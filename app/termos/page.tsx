import React from 'react';
import { TermsOfServiceContent } from '@/components/legal/TermsOfServiceContent';
import { Sidebar } from '@/components/layout/sidebar';
import { ShieldCheck, Copyright } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="flex h-screen bg-background font-sans text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-border/50 bg-card/60 backdrop-blur-xl flex items-center justify-between px-10 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-black text-white rounded-lg shadow-lg">
              <ShieldCheck size={20} className="text-primary" />
            </div>
            <h1 className="font-black text-xl text-foreground uppercase tracking-tight">Termos de Uso e Licença</h1>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10 max-w-4xl mx-auto w-full">
          <div className="bg-white dark:bg-card p-12 rounded-2xl border border-border/50 shadow-sm mb-20">
            <TermsOfServiceContent />
          </div>
        </div>

        <footer className="h-10 border-t border-border/50 bg-card/60 flex items-center justify-center gap-6 text-[10px] text-muted-foreground/60 font-black uppercase tracking-[0.2em] shrink-0">
          <div className="flex items-center gap-2"><Copyright size={10} /> 2026 W1 Capital.</div>
          <span>Acordo de Licença Master • LexisPredict</span>
        </footer>
      </main>
    </div>
  );
}
