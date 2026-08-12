"use client";

/**
 * Pipeline comercial — Kanban (inspirado Twenty Opportunity board)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/crm-shell";
import { CrmKanban } from "@/components/crm/crm-kanban";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  listNegociosAction,
  listServicosAction,
  listFornecedoresAction,
  upsertNegocioAction,
} from "@/app/actions/crm-actions";
import {
  moveNegocioStageAction,
  listAtividadesAction,
  addAtividadeAction,
} from "@/app/actions/crm-pipeline-actions";
import type { CrmNegocio, CrmServico, CrmFornecedor, CrmActivity } from "@/lib/crm-types";
import { CRM_FUNIL_STATUS, CRM_FUNIL_LABELS } from "@/lib/crm-types";
import { groupByStage } from "@/lib/crm-pipeline";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, RefreshCcw, MessageSquare } from "lucide-react";

const empty = {
  cliente_nome: "",
  cliente_doc: "",
  cliente_telefone: "",
  cliente_email: "",
  servico_id: "",
  servico_nome: "",
  status: "lead",
  valor_total: "",
  valor_entrada: "",
  protocolo_cnj: "",
  fornecedor_id: "",
  custo_terceiro: "",
  origem: "",
  observacao: "",
  num_parcelas: "1",
  gerar_parcela: true,
};

export default function CrmFunilPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CrmNegocio[]>([]);
  const [servicos, setServicos] = useState<CrmServico[]>([]);
  const [fornecedores, setFornecedores] = useState<CrmFornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CrmNegocio | null>(null);
  const [acts, setActs] = useState<CrmActivity[]>([]);
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [n, s, f] = await Promise.all([
        listNegociosAction(),
        listServicosAction({ ativosOnly: true }),
        listFornecedoresAction({ ativosOnly: true }),
      ]);
      if (n.success) setRows((n as any).rows || (n as any).data || []);
      // support both shapes
      const nRows = (n as any).rows ?? (n as any).data ?? [];
      if (Array.isArray(nRows)) setRows(nRows);
      const sRows = (s as any).rows ?? [];
      const fRows = (f as any).rows ?? [];
      setServicos(Array.isArray(sRows) ? sRows : []);
      setFornecedores(Array.isArray(fRows) ? fRows : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        r.cliente_nome?.toLowerCase().includes(t) ||
        r.protocolo_cnj?.toLowerCase().includes(t) ||
        r.servico_nome?.toLowerCase().includes(t)
    );
  }, [rows, q]);

  const byStatus = useMemo(() => groupByStage(filtered), [filtered]);

  const onMove = async (id: string, status: string) => {
    setBusyId(id);
    const res = await moveNegocioStageAction(id, status);
    setBusyId(null);
    if (!res.success) {
      // fallback status update legado
      const { updateNegocioStatusAction } = await import("@/app/actions/crm-actions");
      const r2 = await updateNegocioStatusAction(id, status);
      if (!r2.success) {
        toast({ title: "Erro ao mover", description: res.error || r2.error, variant: "destructive" });
        return;
      }
    }
    setRows((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
    toast({ title: "Estágio atualizado", description: CRM_FUNIL_LABELS[status as keyof typeof CRM_FUNIL_LABELS] || status });
  };

  const openDetail = async (n: CrmNegocio) => {
    setSelected(n);
    setNote("");
    const res = await listAtividadesAction(n.id);
    setActs(res.rows || []);
  };

  const saveNote = async () => {
    if (!selected || !note.trim()) return;
    const res = await addAtividadeAction({
      negocio_id: selected.id,
      tipo: "nota",
      titulo: "Nota",
      corpo: note.trim(),
    });
    if (!res.success) {
      toast({
        title: "Não gravou atividade",
        description: res.error || "Rode o SQL crm_atividades no Supabase",
        variant: "destructive",
      });
      return;
    }
    setNote("");
    const list = await listAtividadesAction(selected.id);
    setActs(list.rows || []);
    toast({ title: "Atividade registrada" });
  };

  const saveNegocio = async () => {
    if (!form.cliente_nome.trim()) {
      toast({ title: "Informe o cliente", variant: "destructive" });
      return;
    }
    setSaving(true);
    const serv = servicos.find((s) => s.id === form.servico_id);
    const res = await upsertNegocioAction({
      cliente_nome: form.cliente_nome.trim(),
      cliente_doc: form.cliente_doc || null,
      cliente_telefone: form.cliente_telefone || null,
      cliente_email: form.cliente_email || null,
      servico_id: form.servico_id || null,
      servico_nome: serv?.nome || form.servico_nome || null,
      status: form.status,
      valor_total: Number(form.valor_total) || 0,
      valor_entrada: form.valor_entrada ? Number(form.valor_entrada) : null,
      protocolo_cnj: form.protocolo_cnj || null,
      fornecedor_id: form.fornecedor_id || null,
      custo_terceiro: form.custo_terceiro ? Number(form.custo_terceiro) : null,
      origem: form.origem || null,
      observacao: form.observacao || null,
      gerar_parcela: form.gerar_parcela,
      num_parcelas: Number(form.num_parcelas) || 1,
    } as any);
    setSaving(false);
    if (!res.success) {
      toast({ title: "Erro", description: (res as any).error, variant: "destructive" });
      return;
    }
    setOpen(false);
    setForm(empty);
    toast({ title: "Negócio criado" });
    load();
  };

  return (
    <CrmShell
      title="Pipeline"
      subtitle="Kanban comercial · stages Lead → Concluído (estilo Twenty)"
      actions={
        <>
          <Input
            className="h-9 w-[160px] sm:w-[200px]"
            placeholder="Buscar cliente / CNJ"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button variant="outline" size="sm" className="h-9" onClick={load}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            className="h-9"
            onClick={() => {
              setForm(empty);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Negócio
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando pipeline…
        </div>
      ) : (
        <CrmKanban byStatus={byStatus} onMove={onMove} onSelect={openDetail} busyId={busyId} />
      )}

      {/* Novo negócio */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo negócio</DialogTitle>
            <DialogDescription>Preencha só o que você sabe — nada inventado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Cliente *</Label>
              <Input value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Telefone</Label>
                <Input value={form.cliente_telefone} onChange={(e) => setForm({ ...form, cliente_telefone: e.target.value })} />
              </div>
              <div>
                <Label>Doc</Label>
                <Input value={form.cliente_doc} onChange={(e) => setForm({ ...form, cliente_doc: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={form.cliente_email} onChange={(e) => setForm({ ...form, cliente_email: e.target.value })} />
            </div>
            <div>
              <Label>Serviço</Label>
              <Select
                value={form.servico_id || "none"}
                onValueChange={(v) => setForm({ ...form, servico_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {servicos.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valor total</Label>
                <Input type="number" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_FUNIL_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CRM_FUNIL_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>CNJ (opcional)</Label>
              <Input value={form.protocolo_cnj} onChange={(e) => setForm({ ...form, protocolo_cnj: e.target.value })} />
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveNegocio} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe + timeline */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.cliente_nome}</DialogTitle>
            <DialogDescription>
              {selected?.servico_nome || "Negócio"} ·{" "}
              <Badge variant="secondary">{selected ? CRM_FUNIL_LABELS[selected.status as keyof typeof CRM_FUNIL_LABELS] || selected.status : ""}</Badge>
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3">
              <p className="text-sm font-black tabular-nums">
                {Number(selected.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              {selected.protocolo_cnj ? (
                <p className="text-xs text-muted-foreground font-mono">{selected.protocolo_cnj}</p>
              ) : null}
              <div className="space-y-1">
                <Label className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Nova nota (fato observado)
                </Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ex: Cliente pediu retorno sexta" />
                <Button size="sm" onClick={saveNote} disabled={!note.trim()}>
                  Registrar
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Timeline</p>
                {acts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem atividades (ou tabela crm_atividades ausente).</p>
                ) : (
                  acts.map((a) => (
                    <div key={a.id} className="rounded-md border border-border p-2 text-xs">
                      <p className="font-bold">{a.titulo}</p>
                      {a.corpo ? <p className="text-muted-foreground mt-0.5">{a.corpo}</p> : null}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {a.tipo} · {a.created_at ? new Date(a.created_at).toLocaleString("pt-BR") : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </CrmShell>
  );
}
