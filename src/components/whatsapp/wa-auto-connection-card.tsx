"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, LogOut, QrCode, RefreshCcw, Smartphone, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from '@/hooks/use-admin';
import { resolveWaAutoPermissions } from '@/lib/wa-auto-permissions';
import {
  waAutoConnectAction,
  waAutoConnectionAction,
  waAutoLogoutAction,
  waAutoPairAction,
} from "@/app/actions/whatsapp-actions";

type ConnectionState = {
  status?: string;
  qr?: string | null;
  pairingCode?: string | null;
  account?: { name?: string; phone?: string } | null;
  message?: string | null;
  hasStoredAuth?: boolean;
  reconnectAttempts?: number;
};

export function WaAutoConnectionCard() {
  const { toast } = useToast();
  const { profile } = useAdmin();
  const { canManage: canManageSession } = resolveWaAutoPermissions(profile as any);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await waAutoConnectionAction();
      if (!res.success) {
        setConnection({ status: 'offline', message: res.error || 'Serviço WA.Auto indisponível' });
        if (!silent) {
          toast({
            title: "WA.Auto indisponível",
            description: res.error || "Não foi possível consultar a conexão.",
            variant: "destructive",
          });
        }
        return;
      }
      setConnection((res.connection || {}) as ConnectionState);
    } catch (error: any) {
      setConnection({ status: 'offline', message: error?.message || 'Falha de comunicação com WA.Auto' });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
    // Avoid 12 remote requests/minute while WhatsApp/Render is cold or offline.
    // The user can always trigger a refresh manually.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const connect = async () => {
    setBusy(true);
    try {
      const res = await waAutoConnectAction();
      if (!res.success) {
        toast({ title: "Falha ao conectar", description: res.error, variant: "destructive" });
        return;
      }
      setConnection((res.connection || {}) as ConnectionState);
      window.setTimeout(() => void refresh(true), 1500);
    } catch (error: any) {
      toast({ title: "Falha ao conectar", description: error?.message || "O serviço não respondeu.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const pair = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast({ title: "Telefone inválido", description: "Informe DDD + número.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await waAutoPairAction(digits);
      if (!res.success) {
        toast({ title: "Falha ao parear", description: res.error, variant: "destructive" });
        return;
      }
      setConnection((res.connection || {}) as ConnectionState);
      window.setTimeout(() => void refresh(true), 1500);
    } catch (error: any) {
      toast({ title: "Falha ao parear", description: error?.message || "O serviço não respondeu.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      const res = await waAutoLogoutAction();
      if (!res.success) {
        toast({ title: "Falha ao desconectar", description: res.error, variant: "destructive" });
        return;
      }
      setConnection((res.connection || {}) as ConnectionState);
    } catch (error: any) {
      toast({ title: "Falha ao desconectar", description: error?.message || "O serviço não respondeu.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const status = String(connection?.status || "disconnected").toLowerCase();
  const ready = status === "ready";

  return (
    <section className="mx-3 mt-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:mx-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {ready ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-amber-600" />}
            <h2 className="font-black text-sm">WA.Auto integrado</h2>
            <Badge variant={ready ? "default" : "outline"} className="text-[9px] uppercase">
              {ready ? "Conectado" : status}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {ready
              ? `${connection?.account?.name || "WhatsApp"} · ${connection?.account?.phone || "sessão ativa"}`
              : connection?.message || "Conecte o WhatsApp diretamente pelo LexisPredict."}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => void refresh()} disabled={loading || busy}>
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {!ready && canManageSession && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,300px)_1fr]">
          <div className="space-y-3">
            <Button className="w-full" onClick={connect} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
              Gerar QR no Lexis
            </Button>

            <div className="flex gap-2">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="DDD + número"
                className="h-10"
              />
              <Button type="button" variant="outline" onClick={pair} disabled={busy}>
                <Smartphone className="mr-2 h-4 w-4" />
                Parear
              </Button>
            </div>

            {connection?.pairingCode ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Código de pareamento</p>
                <p className="mt-1 font-mono text-xl font-black tracking-[.18em]">{connection.pairingCode}</p>
              </div>
            ) : null}
          </div>

          {connection?.qr ? (
            <div className="flex items-center justify-center rounded-2xl border bg-white p-3">
              <img
                src={connection.qr}
                alt="QR Code do WA.Auto"
                className="h-auto w-full max-w-[260px]"
              />
            </div>
          ) : (
            <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">
              Toque em “Gerar QR no Lexis”. O QR aparecerá aqui; não é necessário abrir o domínio do WA.Auto.
            </div>
          )}
        </div>
      )}

      {!canManageSession && (
        <p className="mt-3 text-xs text-muted-foreground">
          O status da conexão pode ser consultado aqui. Somente Supervisor, Administrador ou Superadmin
          pode conectar, parear ou desconectar uma sessão.
        </p>
      )}
      {ready && canManageSession ? (
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={logout} disabled={busy}>
            <LogOut className="mr-2 h-4 w-4" />
            Desconectar sessão
          </Button>
        </div>
      ) : null}
    </section>
  );
}
