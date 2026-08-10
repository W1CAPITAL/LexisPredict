"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import type { LegalCase } from "@/lib/case-logic";
import { traduzirCaso } from "@/lib/traduzir-andamento";
import { contarPrazo, PRAZOS_COMUNS } from "@/lib/prazo-cpc-engine";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  ExternalLink,
  Gavel,
  MessageCircle,
  X,
  Calculator,
  AlertTriangle,
} from "lucide-react";

/**
 * Painel lateral de detalhe do processo (padrão event-calendar / detail-panel).
 * Inclui linguagem simples + calculadora de prazo gratuita embutida.
 */
export function CaseDetailPanel({
  caseData,
  eventLabel,
  eventDate,
  onClose,
  className,
}: {
  caseData: LegalCase | null;
  eventLabel?: string;
  eventDate?: Date | string | null;
  onClose?: () => void;
  className?: string;
}) {
  const leigo = useMemo(
    () => (caseData ? traduzirCaso(caseData) : null),
    [caseData]
  );

  const [prazoPreset, setPrazoPreset] = useState(PRAZOS_COMUNS[0].id);
  const [dataBase, setDataBase] = useState(() => {
    if (eventDate) {
      const d = eventDate instanceof Date ? eventDate : new Date(eventDate);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    }
    return new Date().toISOString().slice(0, 10);
  });

  const contagem = useMemo(() => {
    const preset = PRAZOS_COMUNS.find((p) => p.id === prazoPreset) || PRAZOS_COMUNS[0];
    return contarPrazo({
      dataBase,
      dias: preset.dias,
      modo: preset.modo,
      tribunal: caseData?.tribunal,
      suspenderRecesso: true,
      excluirDiaComeco: true,
    });
  }, [dataBase, prazoPreset, caseData?.tribunal]);

  if (!caseData) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          Selecione um processo ou evento para ver o detalhe.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            {eventLabel && (
              <Badge variant="outline" className="text-[10px] mb-1">
                {eventLabel}
              </Badge>
            )}
            <p className="text-sm font-semibold truncate">{caseData.cliente}</p>
            <p className="text-[11px] font-mono text-muted-foreground truncate">
              {caseData.protocolo}
            </p>
          </div>
          {onClose && (
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="px-4 py-3 space-y-3 text-xs">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-[10px] text-muted-foreground font-medium">
              Em linguagem simples
            </p>
            <p className="text-sm font-medium mt-0.5">
              {leigo?.tituloLeigo || "Atualização no processo"}
            </p>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              {leigo?.detalheLeigo}
            </p>
          </div>

          <div className="space-y-2">
            <Row
              icon={<Gavel className="size-3.5" />}
              label="Tribunal / status"
              value={`${caseData.tribunal || "—"} · ${caseData.status || "—"}`}
            />
            {caseData.escritorio && (
              <Row
                icon={<AlertTriangle className="size-3.5" />}
                label="Unidade"
                value={String(caseData.escritorio)}
              />
            )}
          </div>

          {/* Calculadora de prazo gratuita */}
          <div className="rounded-xl border border-border/60 bg-background p-3 space-y-2">
            <p className="text-[11px] font-semibold flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5" />
              Calcular prazo (CPC · grátis · offline)
            </p>
            <label className="block text-[10px] text-muted-foreground">
              Data-base (intimação / publicação)
              <Input
                type="date"
                value={dataBase}
                onChange={(e) => setDataBase(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Tipo de prazo
              <select
                className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={prazoPreset}
                onChange={(e) => setPrazoPreset(e.target.value)}
              >
                {PRAZOS_COMUNS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            {contagem.ok && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Vencimento</p>
                <p className="text-lg font-semibold tabular-nums text-primary">
                  {contagem.vencimentoLabel}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                  Início da contagem: {contagem.inicioContagem}
                  {contagem.recessoAtingido ? " · passou por recesso" : ""}
                  {contagem.uf ? ` · UF ${contagem.uf}` : ""}
                </p>
              </div>
            )}
            <p className="text-[9px] text-muted-foreground leading-snug">
              {contagem.observacao}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button asChild size="sm" className="w-full">
              <Link
                href={`/cases?search=${encodeURIComponent(caseData.protocolo || "")}`}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Abrir processo
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/tarefas">
                <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                Fila de contato
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
