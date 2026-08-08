"use client";

/**
 * Wizard de onboarding guiado (1ª configuração da assessoria).
 * Inspirado em fluxos de produto maduros — 5 passos objetivos.
 */

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  Upload,
  Kanban,
  Users,
  ScanLine,
} from "lucide-react";

const STEPS = [
  {
    id: 1,
    title: "Painel e Fila",
    desc: "Abra o Painel e a Fila de contato. Entenda vencidos, andamentos e o que exige ação hoje.",
    href: "/",
    href2: "/tarefas",
    icon: LayoutDashboard,
  },
  {
    id: 2,
    title: "Carteira",
    desc: "Importe a planilha ou cadastre processos. Sem carteira, scanner e CRM não têm o que operar.",
    href: "/import",
    href2: "/cases",
    icon: Upload,
  },
  {
    id: 3,
    title: "CRM Assessoria",
    desc: "Seed de serviços, um fornecedor (banca) e um negócio teste no funil. Marque uma parcela como paga.",
    href: "/crm",
    href2: "/crm/funil",
    icon: Kanban,
  },
  {
    id: 4,
    title: "Equipe",
    desc: "Provisionar operadores com cargo certo: Operador não vê consolidado financeiro; Supervisor vê a empresa.",
    href: "/team",
    icon: Users,
  },
  {
    id: 5,
    title: "Scanner (opcional)",
    desc: "Só depois da carteira estável. Claude no scanner apenas com toggle ligado. DataJud/DJEN são triagem, não PJe.",
    href: "/cases",
    icon: ScanLine,
  },
];

const STORAGE_KEY = "lexis_setup_wizard_v1";

export function SetupWizard({ className }: { className?: string }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const markDone = (id: number) => {
    const next = Array.from(new Set([...done, id]));
    setDone(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const current = STEPS[step];
  const progress = Math.round((done.length / STEPS.length) * 100);

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Wizard de implantação
          </p>
          <h2 className="text-lg font-black tracking-tight text-foreground">Primeiros passos</h2>
        </div>
        <p className="text-sm font-black tabular-nums text-primary">{progress}%</p>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden mb-5">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              "h-8 min-w-[2rem] px-2 rounded-lg text-[10px] font-black border transition-colors",
              i === step
                ? "bg-primary text-primary-foreground border-primary"
                : done.includes(s.id)
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : "bg-background text-muted-foreground border-border"
            )}
          >
            {done.includes(s.id) ? "✓" : s.id}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <current.icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">{current.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{current.desc}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={current.href}>Abrir {current.title.split(" ")[0]}</Link>
        </Button>
        {current.href2 && (
          <Button asChild size="sm" variant="outline">
            <Link href={current.href2}>Atalho 2</Link>
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            markDone(current.id);
            if (step < STEPS.length - 1) setStep(step + 1);
          }}
        >
          <CheckCircle2 className="h-4 w-4 mr-1" /> Concluí este passo
        </Button>
      </div>

      <div className="flex justify-between mt-6">
        <Button
          variant="ghost"
          size="sm"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={step >= STEPS.length - 1}
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
        >
          Próximo <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
