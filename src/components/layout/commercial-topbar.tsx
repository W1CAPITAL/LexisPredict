"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Crown, LogOut, Search, Settings, UserCircle2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/use-plano";
import { PLAN_LABEL } from "@/lib/planos-pacotes";
import { NotificationCenter } from "@/components/system/notification-center";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CommercialTopbar() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { plan } = usePlano();
  const [query, setQuery] = useState("");
  const [companyName, setCompanyName] = useState("Empresa LexisPredict");
  const [cosmeticRole,setCosmeticRole]=useState('');
  const [cosmeticName,setCosmeticName]=useState('');
  const [cosmeticAvatar,setCosmeticAvatar]=useState('');
  useEffect(()=>{
    const update=(evt:Event)=>{
      const d=(evt as CustomEvent<{name?:string;role?:string;avatar?:string}>).detail||{};
      setCosmeticName(d.name||'');setCosmeticRole(d.role||'');setCosmeticAvatar(d.avatar||'');
    };
    window.addEventListener('lexis-profile-appearance',update);
    return()=>window.removeEventListener('lexis-profile-appearance',update);
  },[]);

  useEffect(() => {
    let cancelled = false;
    const empresaId = String(profile?.empresa_id || "").trim();
    if (!empresaId || !supabase) {
      setCompanyName("Empresa LexisPredict");
      return;
    }

    void (async () => {
      try {
        const result = await supabase
          .from("empresas")
          .select("nome")
          .eq("id", empresaId)
          .maybeSingle();

        const data = result?.data as { nome?: string | null } | null;
        if (!cancelled && data?.nome) {
          setCompanyName(String(data.nome));
        }
      } catch {
        // Mantém o nome padrão se a empresa não puder ser carregada.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.empresa_id]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/cases?q=${encodeURIComponent(q)}`);
  };

  const initials = String(cosmeticName || profile?.nome || profile?.email || "LP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <header
      data-lexis-commercial-topbar
      className="fixed right-0 top-0 z-30 hidden h-16 items-center border-b border-[#C5BAC1] bg-white/95 px-5 backdrop-blur-xl md:flex"
    >
      <form onSubmit={submit} className="relative w-[min(34vw,560px)] min-w-[300px]">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#60555C]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar processos, clientes, publicações ou tarefas..."
          className="h-10 w-full rounded-xl border border-[#8F858B] bg-[#F4F3F5] pl-11 pr-4 text-sm font-medium text-[#21151A] outline-none transition focus:border-[#6D1734] focus:bg-white focus:ring-4 focus:ring-[#6D1734]/10"
        />
      </form>

      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-10 min-w-[240px] items-center gap-3 rounded-xl border border-[#8F858B] bg-white px-4 text-left shadow-[0_2px_8px_rgba(16,36,71,.03)] transition hover:border-[#8F858B] hover:bg-[#F4F3F5]"
              title="Empresa atual"
              aria-label="Abrir seletor de empresa"
            >
              <Building2 className="h-4 w-4 shrink-0 text-[#453039]" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#21151A]">
                {companyName}
              </span>
              <ChevronDown className="h-4 w-4 text-[#60555C]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 rounded-xl">
            <DropdownMenuLabel className="text-xs text-[#60555C]">Empresa ativa</DropdownMenuLabel>
            <DropdownMenuItem className="gap-2 font-semibold" disabled>
              <Check className="h-4 w-4 text-emerald-600" />
              <span className="truncate">{companyName}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2"
              onClick={() => router.push("/settings?section=Conta")}
            >
              <Settings className="h-4 w-4" />
              Configurações da empresa
            </DropdownMenuItem>
            <div className="px-2 py-1.5 text-[11px] leading-4 text-[#60555C]">
              No momento há uma única empresa vinculada a este acesso.
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex h-10 items-center gap-2 rounded-xl border border-[#8F858B] bg-[#EDE9ED] px-4 text-[#6D1734]">
          <Crown className="h-4 w-4" />
          <div className="leading-none">
            <p className="text-xs font-black">Plano {PLAN_LABEL[plan]}</p>
            <p className="mt-1 text-[8px] font-black uppercase tracking-[.16em] text-[#60555C]">
              ambiente ativo
            </p>
          </div>
        </div>

        <NotificationCenter />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-[170px] items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-[#EDE9ED]"
              aria-label="Abrir menu do perfil"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6D1734] text-sm font-black text-white">
                {cosmeticAvatar?<img src={cosmeticAvatar} alt="Foto do perfil" className="h-full w-full rounded-full object-cover"/>:initials || "LP"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-[#21151A]">{cosmeticName || profile?.nome || "Usuário"}</p>
                <p className="truncate text-[11px] font-medium text-[#60555C]">{cosmeticRole || profile?.cargo || "Equipe jurídica"}</p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#60555C]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl">
            <DropdownMenuLabel>
              <p className="truncate text-sm font-bold text-[#21151A]">{profile?.nome || "Usuário"}</p>
              <p className="truncate text-[11px] font-normal text-[#60555C]">{profile?.email || ""}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2" onClick={() => router.push("/settings?section=Conta")}>
              <UserCircle2 className="h-4 w-4" />
              Perfil e conta
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={() => router.push("/settings")}>
              <Settings className="h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-red-600 focus:text-red-600"
              onClick={() => void signOut()}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
