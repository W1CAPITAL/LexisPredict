"use client";

import type { ReactNode } from "react";

type Props = {
  cases?: any[];
  authUserId?: string | null;
  empresaId?: string | null;
  visaoEmpresa?: boolean;
  canRodarEmpresa?: boolean;
  onDone?: () => void;
};

/**
 * Scanner de encerramento permanentemente inativo até ativação explícita.
 * Não importa server actions, não executa DataJud/DJEN e não cria chamadas de rede.
 */
export function EncerrarScannerPanel(_props: Props): ReactNode {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Scanner de encerramento
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Autoencerramento OFF · nenhuma ação automática será executada.
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted px-2 py-1 text-[9px] font-black uppercase text-muted-foreground">
          OFF
        </span>
      </div>
    </div>
  );
}
