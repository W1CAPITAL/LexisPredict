"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CrmShell } from "@/components/crm/crm-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listTarefasAction,
  upsertTarefaAction,
  toggleTarefaAction,
} from "@/app/actions/crm-pipeline-actions";
import type { CrmTask } from "@/lib/crm-types";
import { Loader2, Plus, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CrmAtividadesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [due, setDue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listTarefasAction({ openOnly: false });
    setRows(res.rows || []);
    if ((res as any).needMigration) {
      toast({
        title: "Migration pendente",
        description: "Rode sql/crm_v2_migration.sql no Supabase (crm_tarefas).",
      });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!titulo.trim()) return;
    const res = await upsertTarefaAction({ titulo: titulo.trim(), due_at: due || null, feito: false });
    if (!res.success) {
      toast({ title: "Erro", description: res.error, variant: "destructive" });
      return;
    }
    setTitulo("");
    setDue("");
    load();
  };

  return (
    <CrmShell title="Tarefas CRM" subtitle="Follow-ups observados (Twenty Task-like)">
      <div className="max-w-xl space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input className="flex-1 min-w-[160px]" placeholder="Nova tarefa" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <Input className="w-[150px]" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
          <Button variant="outline" onClick={load}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ul className="space-y-2">
            {rows.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <Checkbox
                  checked={!!t.feito}
                  onCheckedChange={async (c) => {
                    await toggleTarefaAction(t.id, !!c);
                    load();
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${t.feito ? "line-through text-muted-foreground" : ""}`}>
                    {t.titulo}
                  </p>
                  {t.due_at ? (
                    <p className="text-[10px] text-muted-foreground">Prazo: {t.due_at}</p>
                  ) : null}
                </div>
              </li>
            ))}
            {!rows.length ? <p className="text-xs text-muted-foreground">Nenhuma tarefa.</p> : null}
          </ul>
        )}
      </div>
    </CrmShell>
  );
}
