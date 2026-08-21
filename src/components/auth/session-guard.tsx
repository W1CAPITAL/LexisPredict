"use client";

/**
 * Não bloqueia a UI inteira em "Validando sessão…".
 * Só redireciona se realmente não houver user após o boot.
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const PUBLIC = ["/login", "/signup", "/termos"];

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, sessionError, refreshSession, signOut } = useAuth();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [waited, setWaited] = useState(false);

  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Depois de 2s sem user, permite tela de sessão encerrada (evita flash no boot)
  useEffect(() => {
    if (!loading && !user && !isPublic) {
      const t = window.setTimeout(() => setWaited(true), 400);
      return () => window.clearTimeout(t);
    }
    setWaited(false);
  }, [loading, user, isPublic]);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic && waited) {
      router.replace("/login?reason=session");
    }
  }, [user, loading, isPublic, router, pathname, waited]);

  if (isPublic) return <>{children}</>;

  // Boot curto: mostra o app (sidebar etc.) mesmo com loading — não congela
  if (loading && !user) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin opacity-60" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Abrindo…</span>
      </div>
    );
  }

  if (!user && waited) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground p-6">
        <h1 className="text-lg font-black uppercase tracking-tight">Sessão encerrada</h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          {sessionError || "Entre de novo para continuar."}
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            className="font-black uppercase text-[10px] tracking-widest"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              const ok = await refreshSession();
              setRetrying(false);
              if (!ok) router.replace("/login?reason=expired");
            }}
          >
            {retrying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Tentar recuperar
          </Button>
          <Button
            variant="outline"
            className="font-black uppercase text-[10px] tracking-widest"
            onClick={() => signOut()}
          >
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  // user existe OU ainda no boot com user já setado → libera filhos (fila, sidebar)
  return <>{children}</>;
}
