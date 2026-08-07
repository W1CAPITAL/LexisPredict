"use client";

/**
 * ErrorBoundary global — se qualquer subárvore lançar erro de renderização,
 * mostra uma tela de recuperação em vez de deixar a interface "sumir"
 * (padrão: botões/UI desaparecem até F5).
 * @copyright 2026 W1 Capital / LexisPredict
 */

import React from "react";

export class LexisErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[lexis-boundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-background text-foreground">
          <p className="text-3xl font-black uppercase tracking-tight">Ops, algo travou.</p>
          <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">
            Um componente falhou ao renderizar. Recarregue a página para continuar.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest hover:opacity-90 transition-opacity"
          >
            Recarregar agora
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
