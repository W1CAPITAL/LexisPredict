"use client";

/**
 * F1 — Auditoria: logs de ações, exportações e logins com filtros e export XLSX.
 * Acesso restrito a Administrador/Supervisor/Superadmin.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { checkIfSuperAdmin, checkIfSupervisor } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ShieldCheck,
  FileSearch,
  FileDown,
  RefreshCcw,
  LogIn,
  MousePointerClick,
  Search,
} from "lucide-react";
import {
  fetchAuditoriaCompletaAction,
  exportarAuditoriaXlsxAction,
} from "@/app/actions/auditoria-actions";

interface AuditRow {
  tipo: "acao" | "login";
  created_at: string;
  usuario: string;
  email: string;
  acao: string;
  alvo: string;
  detalhes: unknown;
}

export default function AuditoriaPage() {
  const { profile, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [acoes, setAcoes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [q, setQ] = useState("");
  const [acao, setAcao] = useState("");
  const [tipo, setTipo] = useState<"todos" | "acao" | "login">("todos");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading || !profile) return;
    try {
      setIsAdmin(!!(checkIfSuperAdmin(profile) || checkIfSupervisor(profile)) || profile.cargo === "Administrador");
    } catch {
      setIsAdmin(false);
    }
  }, [authLoading, profile]);

  const carregar = async () => {
    setLoading(true);
    const res = await fetchAuditoriaCompletaAction({ q, acao: acao || undefined, tipo, inicio: inicio || undefined, fim: fim || undefined });
    if (res?.success) {
      setRows(res.rows || []);
      setAcoes(res.acoes || []);
    } else {
      toast({ title: "Erro", description: res?.error || "Falha ao carregar auditoria.", variant: "destructive" });
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportar = async () => {
    setExporting(true);
    const res = await exportarAuditoriaXlsxAction({ q, acao: acao || undefined, tipo, inicio: inicio || undefined, fim: fim || undefined });
    setExporting(false);
    if (!res?.success) {
      toast({ title: "Erro", description: res?.error || "Falha ao exportar.", variant: "destructive" });
      return;
    }
    const a = document.createElement("a");
    a.href = `data:${res.mime};base64,${res.base64}`;
    a.download = res.filename;
    a.click();
    toast({ title: "Exportado", description: `${res.filename} gerado.` });
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Faça login para acessar.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Acesso restrito a Supervisor / Administrador / Superadmin.</p>
      </div>
    );
  }

  const fmt = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("pt-BR");
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <FileSearch className="h-5 w-5 text-primary" /> Auditoria
                </h1>
                <p className="text-xs text-muted-foreground">
                  Ações, exportações e logins da operação — trilha completa de auditoria.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
                  <RefreshCcw className="mr-1.5 h-4 w-4" /> Atualizar
                </Button>
                <Button size="sm" onClick={exportar} disabled={exporting || rows.length === 0}>
                  {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />} Exportar XLSX
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Buscar (usuário / alvo)</Label>
                    <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && carregar()} placeholder="Nome ou processo..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tipo</Label>
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value as any)}
                      className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="todos">Todos</option>
                      <option value="acao">Ações</option>
                      <option value="login">Logins</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ação</Label>
                    <select
                      value={acao}
                      onChange={(e) => setAcao(e.target.value)}
                      className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Todas</option>
                      {acoes.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">De / Até</Label>
                    <div className="flex items-center gap-2">
                      <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                      <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
                    </div>
                  </div>
                </div>
                <Button className="mt-3" size="sm" variant="secondary" onClick={carregar} disabled={loading}>
                  <Search className="mr-1.5 h-4 w-4" /> Aplicar filtros
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  Registros
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <Badge variant="outline" className="ml-auto">{rows.length}</Badge>}
                </CardTitle>
                <CardDescription>Ordem decrescente por data/hora.</CardDescription>
              </CardHeader>
              <CardContent>
                {rows.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nenhum registro para os filtros atuais.</p>
                ) : (
                  <ScrollArea className="h-[520px] pr-2 rounded-xl border border-border/70">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-card">
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 font-black uppercase tracking-widest text-muted-foreground text-[9px]">Data/Hora</th>
                          <th className="px-3 py-2 font-black uppercase tracking-widest text-muted-foreground text-[9px]">Tipo</th>
                          <th className="px-3 py-2 font-black uppercase tracking-widest text-muted-foreground text-[9px]">Usuário</th>
                          <th className="px-3 py-2 font-black uppercase tracking-widest text-muted-foreground text-[9px]">Ação</th>
                          <th className="px-3 py-2 font-black uppercase tracking-widest text-muted-foreground text-[9px]">Alvo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={`${r.created_at}-${i}`} className={cn("border-b border-border/40", i % 2 === 0 && "bg-muted/20")}>
                            <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{fmt(r.created_at)}</td>
                            <td className="px-3 py-1.5">
                              <Badge variant="outline" className={cn("text-[9px]", r.tipo === "login" ? "text-blue-600 dark:text-blue-400 border-blue-500/30" : "text-muted-foreground border-border")}>
                                {r.tipo === "login" ? <LogIn className="h-3 w-3 mr-1 inline" /> : <MousePointerClick className="h-3 w-3 mr-1 inline" />}
                                {r.tipo === "login" ? "Login" : "Ação"}
                              </Badge>
                            </td>
                            <td className="px-3 py-1.5 font-semibold">{r.usuario}</td>
                            <td className="px-3 py-1.5 font-mono text-[10px]">{r.acao}</td>
                            <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[220px]">{r.alvo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
