"use client";

/**
 * Sidebar vertical LexisPredict (estilo painel colapsável).
 * Usado quando Configurações → Layout do menu = Vertical.
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ListTodo,
  Briefcase,
  FolderOpen,
  MessagesSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
  Crown,
  Bot,
  Scale,
  Upload,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { useAdmin } from "@/hooks/use-admin";
import { useDataJudScanStore } from "@/store/use-datajud-scan-store";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Item = { label: string; href: string; icon: LucideIcon };

const PRIMARY: Item[] = [
  { label: "Painel", href: "/", icon: LayoutDashboard },
  { label: "Chat equipe", href: "/mensagens", icon: MessagesSquare },
  { label: "Fila", href: "/tarefas", icon: ListTodo },
  { label: "Meus processos", href: "/cases", icon: Briefcase },
  { label: "Empresa", href: "/processos", icon: FolderOpen },
  { label: "Importar", href: "/import", icon: Upload },
  { label: "Procedentes", href: "/cumprimentos-procedentes", icon: Scale },
  { label: "Assistente", href: "/chat", icon: Bot },
  { label: "Prêmios", href: "/premios", icon: Crown },
  { label: "Encerrados", href: "/encerrados-revisao", icon: ShieldAlert },
  { label: "Config", href: "/settings", icon: Settings },
];

export function SidebarVertical() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { canScan } = useAdmin();
  const { status, toggleMinimize } = useDataJudScanStore();
  const [open, setOpen] = useState(true);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(false);
  }, [pathname]);

  const nome = String(profile?.nome || "Operador").trim();

  const body = (
    <div className="flex flex-col h-full min-h-0 bg-card/60 backdrop-blur-xl border-r border-border/50">
      <div className="flex items-center gap-2 p-3 border-b border-border/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Lexis" className="h-9 w-9 rounded-xl object-contain bg-white/90 p-0.5" />
        {open && (
          <div className="min-w-0">
            <p className="text-[13px] font-black truncate">LexisPredict</p>
            <p className="text-[10px] text-muted-foreground truncate">Gabinete</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => canScan && toggleMinimize()}
        className={cn(
          "mx-2 mt-3 flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all",
          "bg-gradient-to-r from-rose-500/20 via-amber-400/20 to-violet-500/20 border border-white/10",
          "hover:scale-[1.01]"
        )}
        title="DataJud + DJEN"
      >
        <Zap className={cn("h-4 w-4 text-amber-500", status === "running" && "animate-pulse")} />
        {open && <span className="text-[11px] font-black">DataJud + DJEN</span>}
      </button>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 mt-2">
        {PRIMARY.map((it) => {
          const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                active
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {open && <span className="truncate">{it.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border/40 space-y-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
            <AvatarFallback className="text-[10px] font-bold">
              {nome
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {open && (
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold truncate" title={nome}>
                {nome}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{profile?.cargo || "Operador"}</p>
            </div>
          )}
          <ThemeToggle />
        </div>
        <button
          type="button"
          className="flex items-center gap-2 w-full rounded-lg px-2 py-2 text-[12px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={async () => {
            await signOut();
            router.push("/login");
          }}
        >
          <LogOut className="h-4 w-4" />
          {open && "Sair"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <motion.aside
        className="hidden md:flex flex-col shrink-0 h-screen sticky top-0 z-40 overflow-hidden"
        animate={{ width: open ? 260 : 72 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
        <div className="h-full relative">
          {body}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="absolute top-3 -right-3 h-6 w-6 rounded-full border bg-background shadow flex items-center justify-center text-[10px] z-10"
            title={open ? "Recolher" : "Expandir"}
          >
            {open ? "‹" : "›"}
          </button>
        </div>
      </motion.aside>

      <div className="md:hidden fixed top-3 left-3 z-[100]">
        <button
          type="button"
          className="h-11 w-11 rounded-xl border bg-background/90 backdrop-blur shadow flex items-center justify-center"
          onClick={() => setMobile(true)}
        >
          <Menu size={20} />
        </button>
      </div>
      {mobile && (
        <div className="md:hidden fixed inset-0 z-[110] bg-background/80 backdrop-blur-sm">
          <div className="absolute left-0 top-0 bottom-0 w-[min(280px,90vw)] bg-card shadow-2xl">
            <button type="button" className="absolute right-3 top-3" onClick={() => setMobile(false)}>
              <X />
            </button>
            <div className="h-full pt-2">{body}</div>
          </div>
        </div>
      )}
    </>
  );
}
