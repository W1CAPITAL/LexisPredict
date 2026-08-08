"use client";

/**
 * Integrações bancárias — mapa e prontidão (sem Open Finance em produção nesta fase).
 * Transparência: o que é viável no free tier vs o que exige contrato/API paga.
 */

import React from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Wallet, Shield } from "lucide-react";

const ITEMS = [
  {
    nome: "PIX (comprovante manual)",
    status: "Disponível via fluxo operacional",
    nivel: "agora",
    detalhe:
      "Operador anexa/registra pagamento no CRM (status pago). Sem API bancária. Zero custo.",
  },
  {
    nome: "Extrato CSV do banco",
    status: "Roadmap curto",
    nivel: "proximo",
    detalhe:
      "Importar CSV de extrato e conciliar com crm_receber (matching por valor/data/CPF). Sem Open Finance.",
  },
  {
    nome: "Open Finance / iniciador de pagamento",
    status: "Não implementado",
    nivel: "futuro",
    detalhe:
      "Exige certificações, parceiro (Belvo, Pluggy, banco) e custo mensal. Não cabe no free tier de forma séria.",
  },
  {
    nome: "Boleto registrado (API)",
    status: "Não implementado",
    nivel: "futuro",
    detalhe: "Depende de convênio com banco ou gateway (Asaas, Gerencianet). Custo por boleto.",
  },
  {
    nome: "Webhooks de pagamento (gateway)",
    status: "Roadmap",
    nivel: "proximo",
    detalhe:
      "Quando houver gateway, marcar parcela paga automaticamente via webhook Server Action.",
  },
];

export default function IntegracoesPage() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/crm">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-black flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> Integrações bancárias
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mapa honesto: o que o Lexis faz hoje e o que exige parceiro/custo
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <Shield className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              Não conectamos login de banco do cliente no app. Evita risco regulatório e de segurança
              enquanto o produto foca em assessoria + tribunal + CRM.
            </p>
          </div>

          <ul className="space-y-3">
            {ITEMS.map((it) => (
              <li key={it.nome} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-foreground flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    {it.nome}
                  </p>
                  <Badge
                    variant={
                      it.nivel === "agora"
                        ? "default"
                        : it.nivel === "proximo"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {it.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{it.detalhe}</p>
              </li>
            ))}
          </ul>

          <Button asChild variant="outline">
            <Link href="/crm/financeiro">Ir ao financeiro do CRM</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
