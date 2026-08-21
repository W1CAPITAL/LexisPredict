"use client";

import { Inbox, FilterX, Upload, RefreshCcw, Target } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

type FilaEmptyProps = {
  variant: "no-cases" | "filter" | "meta-done" | "error";
  onClearFilters?: () => void;
  onImport?: () => void;
  onReload?: () => void;
  onShowAll?: () => void;
};

const COPY = {
  "no-cases": {
    icon: Inbox,
    title: "Fila vazia",
    description: "Nenhum processo na carteira desta sessão. Importe uma planilha ou aguarde o scanner.",
    actionLabel: "Importar CSV",
  },
  filter: {
    icon: FilterX,
    title: "Nada com estes filtros",
    description: "A combinação atual de filtros não retornou casos. Limpe os filtros ou amplie a meta do dia.",
    actionLabel: "Limpar filtros",
  },
  "meta-done": {
    icon: Target,
    title: "Meta do dia concluída",
    description: "Você atendeu a meta. Veja o backlog ou aumente a meta para continuar.",
    actionLabel: "Ver backlog",
  },
  error: {
    icon: RefreshCcw,
    title: "Não foi possível carregar",
    description: "Falha ao buscar a fila. Verifique a conexão e tente de novo.",
    actionLabel: "Tentar novamente",
  },
} as const;

export function FilaEmpty({ variant, onClearFilters, onImport, onReload, onShowAll }: FilaEmptyProps) {
  const c = COPY[variant];
  const onAction =
    variant === "no-cases"
      ? onImport
      : variant === "filter"
        ? onClearFilters
        : variant === "meta-done"
          ? onShowAll
          : onReload;

  return (
    <EmptyState
      icon={c.icon}
      title={c.title}
      description={c.description}
      actionLabel={c.actionLabel}
      onAction={onAction}
      className="my-6 rounded-2xl border-dashed"
    />
  );
}
