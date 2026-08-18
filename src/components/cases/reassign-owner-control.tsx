"use client";

/**
 * Controle para alterar created_by (dono da carteira) em qualquer tela de edição.
 */
import React, { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listAssignableUsersAction, type AssignableUser } from "@/app/actions/team-list-actions";
import { reassignCaseOwnerAction } from "@/app/actions/case-save-actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCog } from "lucide-react";

type Props = {
  protocolo: string;
  currentOwnerAuthId?: string | null;
  /** Se false, não renderiza (operador comum). */
  canAssign: boolean;
  onAssigned?: (newOwnerAuthId: string) => void;
  className?: string;
};

export function ReassignOwnerControl({
  protocolo,
  currentOwnerAuthId,
  canAssign,
  onAssigned,
  className,
}: Props) {
  const { toast } = useToast();
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [value, setValue] = useState<string>(currentOwnerAuthId || "");
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    setValue(currentOwnerAuthId || "");
  }, [currentOwnerAuthId, protocolo]);

  useEffect(() => {
    if (!canAssign) return;
    let cancelled = false;
    (async () => {
      setLoadingUsers(true);
      try {
        const list = await listAssignableUsersAction();
        if (!cancelled) setUsers(list || []);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAssign]);

  if (!canAssign) return null;

  const dirty = value && value !== String(currentOwnerAuthId || "");

  const save = async () => {
    if (!value || !protocolo) return;
    setLoading(true);
    try {
      const res = await reassignCaseOwnerAction({
        protocolo,
        novoOwnerAuthId: value,
      });
      if (res.success) {
        toast({ title: "Dono atualizado", description: res.message });
        onAssigned?.(value);
      } else {
        toast({
          title: "Não transferiu",
          description: res.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const currentName =
    users.find((u) => u.auth_user_id === currentOwnerAuthId)?.nome ||
    (currentOwnerAuthId ? currentOwnerAuthId.slice(0, 8) + "…" : "Sem dono");

  return (
    <div className={className || "rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2"}>
      <div className="flex items-center gap-2">
        <UserCog className="h-4 w-4 text-primary" />
        <Label className="text-[10px] font-black uppercase tracking-wide">
          Dono da carteira (created_by)
        </Label>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Atual: <strong>{currentName}</strong>. Trocar move o processo para a carteira do operador.
      </p>
      <Select value={value || undefined} onValueChange={setValue} disabled={loadingUsers || loading}>
        <SelectTrigger className="h-10">
          <SelectValue placeholder={loadingUsers ? "Carregando equipe…" : "Escolher responsável"} />
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => (
            <SelectItem key={u.auth_user_id} value={u.auth_user_id}>
              {u.nome}
              {u.cargo ? ` · ${u.cargo}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        className="w-full h-9 font-bold"
        disabled={!dirty || loading || !value}
        onClick={save}
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Salvando…
          </>
        ) : (
          "Aplicar troca de dono"
        )}
      </Button>
    </div>
  );
}
