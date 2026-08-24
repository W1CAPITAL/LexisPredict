"use client";

import Link from "next/link";
import { useCrmStore } from "@/store/crm-store";
import { PageHeader, Card, Badge } from "@/components/ui";
import { money, relative } from "@/lib/format";
import { STAGE_COLOR, STAGE_LABEL } from "@/lib/types";
import { useMemo } from "react";

export default function HomePage() {
  const { companies, people, deals, notes } = useCrmStore();

  const pipeline = useMemo(() => deals.filter((d) => d.stage !== "lost" && d.stage !== "won").reduce((s, d) => s + d.amount, 0), [deals]);
  const won = useMemo(() => deals.filter((d) => d.stage === "won").reduce((s, d) => s + d.amount, 0), [deals]);
  const recentNotes = useMemo(() => [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6), [notes]);

  return (
    <div>
      <PageHeader title="Início" subtitle="Visão rápida do pipeline e atividade recente" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Empresas", value: companies.length, href: "/companies" },
          { label: "Clientes", value: people.length, href: "/people" },
          { label: "Pipeline aberto", value: money(pipeline), href: "/deals" },
          { label: "Ganhos", value: money(won), href: "/deals" },
        ].map((k) => (
          <Link key={k.label} href={k.href}>
            <Card className="p-4 hover:border-accent/40 transition-colors">
              <p className="text-[11px] uppercase tracking-wider text-ink-400">{k.label}</p>
              <p className="text-2xl font-semibold mt-1 tabular-nums">{k.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Oportunidades ativas</h2>
          <ul className="space-y-2">
            {deals
              .filter((d) => d.stage !== "won" && d.stage !== "lost")
              .slice(0, 6)
              .map((d) => {
                const co = companies.find((c) => c.id === d.companyId);
                return (
                  <li key={d.id} className="flex items-center gap-3 text-sm">
                    <Badge className={STAGE_COLOR[d.stage]}>{STAGE_LABEL[d.stage]}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{d.name}</p>
                      <p className="text-xs text-ink-400 truncate">{co?.name}</p>
                    </div>
                    <span className="tabular-nums text-ink-600">{money(d.amount)}</span>
                  </li>
                );
              })}
          </ul>
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Timeline recente</h2>
          <ul className="space-y-3">
            {recentNotes.map((n) => {
              const co = companies.find((c) => c.id === n.companyId);
              return (
                <li key={n.id} className="text-sm border-l-2 border-accent/30 pl-3">
                  <p className="text-ink-800">{n.body}</p>
                  <p className="text-[11px] text-ink-400 mt-1">
                    {co?.name || "—"} · {n.author} · {relative(n.createdAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
