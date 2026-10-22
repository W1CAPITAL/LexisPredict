"use client";

import {useTransition} from "react";
import {useRouter} from "next/navigation";

/** A consulta de relatórios só é atualizada por solicitação explícita.
 * Atualizações programadas a cada 30s desmontavam os componentes,
 * reiniciavam o modelo e descartavam respostas não concluídas.
 */
export function ReportSync(){
 const router=useRouter();
 const [pending,startTransition]=useTransition();
 return <button type="button" disabled={pending}
  onClick={()=>startTransition(()=>router.refresh())}
  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
  aria-busy={pending}>
  {pending?"Atualizando…":"Atualizar dados"}
 </button>;
}
