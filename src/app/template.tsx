"use client";

/**
 * Transição suave entre rotas — evita sensação de reload bruto.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="lexis-route-enter min-h-0 flex-1 flex flex-col">
      {children}
    </div>
  );
}
