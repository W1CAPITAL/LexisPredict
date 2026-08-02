/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * Centro de Alertas removido (v12) — redireciona para o Dashboard.
 * Motivo: excesso de falsos positivos de BA e ruído operacional.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NotificationsPageRemoved() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      Centro de Alertas desativado. Redirecionando…
    </div>
  );
}
