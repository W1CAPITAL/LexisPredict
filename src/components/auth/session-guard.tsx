"use client";

/**
 * Redireciona para /login se não houver sessão em rota privada.
 * Complementa o middleware (defesa em profundidade no client).
 */
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

const PUBLIC = ["/login", "/signup", "/termos"];

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname() || "/";
  const router = useRouter();

  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      router.replace("/login?reason=session");
    }
  }, [user, loading, isPublic, router, pathname]);

  return <>{children}</>;
}
