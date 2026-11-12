"use client";

import { SwarmRouteLoading } from "@/components/layout/swarm-route-loading";

/**
 * Transição suave entre rotas — evita sensação de reload bruto.
 * O template remonta em cada navegação, repetindo a animação Swarm em todas as abas.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="lexis-route-enter min-h-0 flex-1 flex flex-col">
      <SwarmRouteLoading />
      {children}
    </div>
  );
}
