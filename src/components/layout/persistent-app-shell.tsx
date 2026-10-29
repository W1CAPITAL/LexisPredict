"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { PersistentSidebarContext } from "@/components/layout/persistent-sidebar-context";

const STANDALONE_PREFIXES = [
  "/login",
  "/signup",
  "/setup-empresa",
  "/setup-planilha",
  "/primeiro-acesso",
  "/modo-seguranca",
  "/desktop",
  "/efferd-demo",
  "/vitrine-fx",
  "/world-lab",
  "/mapa-codigo",
  "/termos/renovacao-assinatura",
];

function shouldShowPersistentShell(pathname: string) {
  return !STANDALONE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

/**
 * Um único shell para o gabinete inteiro. Como este componente vive no root
 * layout, a sidebar não desmonta ao trocar de página; páginas antigas podem
 * manter <Sidebar /> no código sem criar uma segunda instância.
 */
export function PersistentAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  if (!shouldShowPersistentShell(pathname)) return <>{children}</>;

  return (
    <PersistentSidebarContext.Provider value={true}>
      <div data-lexis-app-shell className="flex min-h-dvh w-full bg-background text-foreground">
        <Sidebar persistentRoot />
        <div data-lexis-route-content className="relative min-w-0 flex-1">
          {children}
        </div>
      </div>
    </PersistentSidebarContext.Provider>
  );
}
