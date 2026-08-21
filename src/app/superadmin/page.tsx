"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { SuperadminControlPanel } from "@/components/superadmin/superadmin-control-panel";
import { useAuth } from "@/components/auth/auth-provider";
import { checkIfSuperAdmin } from "@/lib/supabase";
import { Loader2, Shield } from "lucide-react";

export default function SuperadminPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const ok = checkIfSuperAdmin(profile);

  useEffect(() => {
    if (!loading && profile && !ok) {
      router.replace("/");
    }
  }, [loading, profile, ok, router]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest">Verificando…</span>
      </div>
    );
  }

  if (!ok) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Shield className="text-muted-foreground" size={28} />
        <h1 className="text-sm font-black uppercase tracking-widest">Acesso negado</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Esta área é exclusiva do Superadmin. Perfis Administrador não liberam nem bloqueiam planos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          <SuperadminControlPanel />
        </div>
      </main>
    </div>
  );
}
