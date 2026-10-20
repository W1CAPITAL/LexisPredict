"use client";

import {useEffect,useTransition} from "react";
import {useRouter} from "next/navigation";

/** Consultas /report são agregadas no Supabase em tempo real. O Next Router
 * também precisa revalidar seus Server Components enquanto a aba está aberta.
 */
export function ReportSync(){
 const router=useRouter();
 const [pending,startTransition]=useTransition();
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==="visible")startTransition(()=>router.refresh());};
  const onFocus=()=>refresh();
  const onCarteira=()=>refresh();
  const interval=window.setInterval(refresh,30_000);
  window.addEventListener("focus",onFocus);
  window.addEventListener("lexis-carteira-updated",onCarteira);
  return()=>{
   window.clearInterval(interval);
   window.removeEventListener("focus",onFocus);
   window.removeEventListener("lexis-carteira-updated",onCarteira);
  };
 },[router]);
 return <button type="button" disabled={pending}
  onClick={()=>startTransition(()=>router.refresh())}
  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
  aria-busy={pending}>
  {pending?"Atualizando…":"Atualizar dados"}
 </button>;
}
