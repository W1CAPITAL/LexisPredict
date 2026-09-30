"use client";

import Link from "next/link";
import {
  Activity,
  Database,
  Fingerprint,
  Gauge,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { usePlano } from "@/hooks/use-plano";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { checkIfSuperAdmin } from "@/lib/supabase";

function Row({
  icon: Icon,
  title,
  description,
  value,
  tone = "blue",
}: {
  icon: any;
  title: string;
  description: string;
  value: string;
  tone?: "blue" | "green" | "amber";
}) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "amber"
        ? "bg-amber-50 text-amber-600"
        : "bg-blue-50 text-blue-600";

  return (
    <div className="flex items-start gap-4 border-b border-[#edf1f6] px-5 py-4 last:border-b-0">
      <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + toneClass}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black text-[#18365f]">{title}</p>
          <Badge variant="outline" className="rounded-full border-[#dbe5f1] bg-white text-[9px] text-[#55708f]">
            aplicado
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[#6d7f9b]">{description}</p>
      </div>
      <p className="max-w-[220px] text-right text-xs font-bold text-[#28486f]">{value}</p>
    </div>
  );
}

export function SecurityLimitsPanel() {
  const { profile } = useAuth();
  const { plan } = usePlano();
  const isSuperadmin = profile ? checkIfSuperAdmin(profile) : false;
  const cargo = profile?.cargo || "Operador";

  const personalScope =
    cargo === "Supervisor" || cargo === "Superadmin"
      ? "Empresa inteira"
      : "Somente carteira própria";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-[#dfe7f2] bg-white">
        <div className="border-b border-[#e8edf5] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-black text-[#102447]">Segurança e limites</h2>
              <p className="text-xs text-[#6d7f9b]">
                Controles que já são aplicados pelo backend, não apenas opções visuais.
              </p>
            </div>
          </div>
        </div>

        <Row
          icon={Fingerprint}
          title="Identidade"
          description="A sessão comercial usa Supabase Auth e não cria tenant a partir de cache, planilha ou modo de segurança."
          value="Supabase Auth"
          tone="green"
        />
        <Row
          icon={Database}
          title="Isolamento por empresa"
          description="Consultas operacionais usam empresa_id e políticas RLS/escopo server-side."
          value="Tenant isolado"
          tone="green"
        />
        <Row
          icon={Users}
          title="Escopo do cargo"
          description="O perfil logado determina o alcance de processos, supervisão e ações administrativas."
          value={cargo + " · " + personalScope}
        />
        <Row
          icon={LockKeyhole}
          title="Service role"
          description="A chave privilegiada permanece no servidor; operações do navegador usam sessão autenticada."
          value="Não exposta no client"
          tone="green"
        />
        <Row
          icon={Gauge}
          title="Proteção de abuso"
          description="Cadastro comercial e validações sensíveis usam controles de taxa e auditoria persistente."
          value="Rate limit ativo"
          tone="amber"
        />
        <Row
          icon={Activity}
          title="Plano e acesso"
          description="Módulos visíveis dependem do plano da empresa e das permissões do usuário."
          value={"Plano " + String(plan).toUpperCase()}
        />
      </section>

      <section className="rounded-2xl border border-[#dfe7f2] bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-[#102447]">Auditoria defensiva</p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#6d7f9b]">
              Verifica configuração, isolamento, OCR e riscos de exposição sem executar pentest ou exploit.
            </p>
          </div>
          {isSuperadmin ? (
            <Button asChild className="rounded-xl bg-[#1f6fff] text-white hover:bg-[#145de0]">
              <Link href="/security">Abrir segurança</Link>
            </Button>
          ) : (
            <Badge variant="outline" className="w-fit rounded-full border-[#dbe5f1] bg-[#f7f9fc] text-[#607590]">
              disponível ao Superadmin
            </Badge>
          )}
        </div>
      </section>
    </div>
  );
}
