"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { PlanosEmpresaPanel } from "@/components/settings/planos-empresa-panel";
import { Crown, Scale } from "lucide-react";

export default function PlanosPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-5 pb-4 pt-6 sm:px-8">
          <div>
            <p className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-[.14em] text-[#1f6fff]">
              <Crown size={14} /> Planos
            </p>
            <h1 className="text-[28px] font-black leading-none tracking-[-.04em] text-[#102447] sm:text-[32px]">
              Planos e assinatura
            </h1>
            <p className="mt-2 text-sm font-medium text-[#617693]">
              Escolha o plano ideal para a sua operação jurídica. Mais produtividade, controle e resultados.
            </p>
          </div>
          <button
            type="button"
            className="hidden h-10 items-center gap-2 rounded-xl border border-[#dce5f1] bg-white px-4 text-sm font-bold text-[#1f5fd0] md:flex"
          >
            <Scale className="h-4 w-4" />
            Comparar planos
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 sm:px-8">
          <PlanosEmpresaPanel />
        </div>
      </main>
    </div>
  );
}
