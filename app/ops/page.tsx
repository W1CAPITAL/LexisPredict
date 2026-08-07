"use client";

/**
 * Operações de dados (Lexis) — Superadmin
 * Rota: /ops
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { checkIfSuperAdmin } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  RefreshCcw,
  ShieldAlert,
  Database,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  opsListTables,
  opsListRows,
  opsDeleteRow,
  opsUpsertRow,
} from "@/app/actions/ops-admin-actions";

export default function OpsPage() {
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const isSuper = checkIfSuperAdmin(profile);

  const [tables, setTables] = useState<string[]>([]);
  const [table, setTable] = useState<"processos" | "usuarios" | "empresas" | "advogados_banca" | string>("processos");
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);
  const [editJson, setEditJson] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTables = useCallback(async () => {
    const res = await opsListTables();
    if (res.success) {
      setTables(res.tables);
      if (res.tables.length && !res.tables.includes(table as any)) setTable(res.tables[0] as any);
    } else {
      toast({ title: "Acesso negado", description: res.error, variant: "destructive" });
    }
  }, [table, toast]);

  const loadRows = useCallback(async () => {
    if (!table) return;
    setLoading(true);
    try {
      const res = await opsListRows(String(table), 100, search);
      if (res.success) setRows(res.data || []);
      else {
        setRows([]);
        toast({ title: "Erro ao listar", description: res.error, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }, [table, search, toast]);

  useEffect(() => {
    if (!authLoading && isSuper) loadTables();
  }, [authLoading, isSuper, loadTables]);

  useEffect(() => {
    if (!authLoading && isSuper && table) loadRows();
  }, [authLoading, isSuper, table, loadRows]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await opsDeleteRow(table as any, deleteId);
      if (res.success) {
        toast({ title: "Registro removido" });
        setDeleteId(null);
        await loadRows();
      } else {
        toast({ title: "Falha ao apagar", description: res.error, variant: "destructive" });
      }
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (row: any) => {
    setEditRow(row);
    setEditJson(JSON.stringify(row, null, 2));
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const parsed = JSON.parse(editJson);
      const res = await opsUpsertRow(table as any, parsed);
      if (res.success) {
        toast({ title: "Registro salvo" });
        setEditRow(null);
        await loadRows();
      } else {
        toast({ title: "Falha ao salvar", description: res.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "JSON inválido", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!isSuper) {
    return (
      <div className="flex h-screen bg-transparent font-sans">
        <Sidebar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <ShieldAlert className="text-red-600" size={40} />
          <p className="font-black uppercase text-sm tracking-widest">Acesso restrito a Superadmin</p>
          <Button asChild variant="outline">
            <Link href="/settings">Voltar</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-transparent font-sans text-foreground overflow-hidden relative z-10">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden glass-panel">
        <header className="h-auto border-b border-border/50 bg-card/60 backdrop-blur-xl flex items-center justify-between p-4 sm:px-8 shrink-0 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="rounded-xl">
              <Link href="/settings">
                <ArrowLeft size={18} />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Database size={16} className="text-primary" />
              <h1 className="text-sm font-black uppercase tracking-widest">Operações de dados</h1>
            </div>
          </div>
        </header>

        <div className="px-4 sm:px-8 py-3 border-b border-border/40 flex items-center gap-2 flex-wrap">
          <select
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className="h-10 px-3 rounded-xl border-2 border-border bg-background text-[10px] font-black uppercase"
          >
            {tables.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-48 sm:w-64 rounded-xl text-xs"
          />
          <Button variant="ghost" size="icon" onClick={loadRows} disabled={loading} className="h-10 w-10 rounded-xl">
            <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin text-primary")} />
          </Button>
          <Badge variant="outline" className="font-black uppercase text-[9px]">
            {rows.length} reg.
          </Badge>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-8 space-y-2">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-16 font-bold uppercase tracking-widest">
              Nenhum registro
            </p>
          ) : (
            rows.map((row) => {
              const id = String(row.id ?? row.protocolo_ref ?? "");
              const title =
                row.protocolo_ref ||
                row.protocolo ||
                row.email ||
                row.nome ||
                row.cliente ||
                id ||
                "—";
              const sub = row.cliente || row.nome || row.email || row.empresa_id || row.status || "";
              return (
                <div
                  key={id || JSON.stringify(row).slice(0, 40)}
                  className="flex items-center justify-between gap-3 p-3 sm:p-4 border-2 border-border bg-card/40 rounded-xl hover:border-primary/40 transition-colors"
                >
                  <button type="button" onClick={() => openEdit(row)} className="flex-1 text-left min-w-0">
                    <p className="font-black text-sm truncate">{String(title)}</p>
                    {sub ? (
                      <p className="text-[10px] text-muted-foreground font-bold uppercase truncate mt-0.5">
                        {String(sub)}
                      </p>
                    ) : null}
                    <p className="text-[9px] text-muted-foreground/60 font-mono mt-1 truncate">
                      id: {id || "sem id"}
                    </p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => openEdit(row)}>
                      <Save size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-50"
                      disabled={!id}
                      onClick={() => setDeleteId(id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="rounded-xl border-2 border-black max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-sm tracking-widest">
              Confirmar exclusão
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover <span className="font-mono font-bold">{deleteId}</span> de{" "}
            <span className="font-black">{table}</span>?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-xl">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="rounded-xl font-black uppercase text-[10px]">
              {deleting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Apagar de vez
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="rounded-xl border-2 border-black max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-sm tracking-widest">
              Editar · {table}
            </DialogTitle>
          </DialogHeader>
          <textarea
            value={editJson}
            onChange={(e) => setEditJson(e.target.value)}
            className="w-full min-h-[280px] flex-1 font-mono text-[11px] p-3 border-2 border-border rounded-lg bg-background"
            spellCheck={false}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditRow(null)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={saving} className="rounded-xl font-black uppercase text-[10px] bg-black text-white">
              {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
