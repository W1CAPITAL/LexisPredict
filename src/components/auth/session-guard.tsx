"use client";

/**
 * Se a sessão morrer, não deixa a UI “travada” no cache:
 * mostra bloqueio claro + botão para entrar de novo.
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

  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      // soft redirect; overlay cobre se a navegação atrasar
      router.replace("/login?reason=session");
    }
  }, [user, loading, isPublic, router, pathname]);

  if (isPublic) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Validando sessão…
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground p-6">
        <h1 className="text-lg font-black uppercase tracking-tight">Sessão encerrada</h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          {sessionError ||
            "O login expirou ou foi interrompido. Entre de novo para continuar — o cache local não substitui a sessão."}
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
            onClick={() => {
              signOut();
              router.replace("/login");
            }}
          >
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
