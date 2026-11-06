"use client";

import Link from "next/link";
import {Sidebar} from "@/components/layout/sidebar";
import {AutosOabFreePanel} from "@/components/scanner/autos-oab-free-panel";
import {OabDiscoveryPanel} from "@/components/scanner/oab-discovery-panel";
import {ArrowLeft,FileSearch,ShieldCheck,Settings2,Globe2} from "lucide-react";

export default function ConsultaOabPage(){
 return <div className="flex min-h-screen bg-background text-foreground">
   <Sidebar/>
   <main className="min-w-0 flex-1">
     <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
       <div className="flex flex-wrap items-start justify-between gap-3">
         <div className="flex items-start gap-3">
           <Link href="/processos" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted" aria-label="Voltar para processos">
             <ArrowLeft size={17}/>
           </Link>
           <div>
             <p className="text-xs font-semibold uppercase tracking-widest text-primary">LexisPredict · Tribunal</p>
             <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Consulta OAB</h1>
             <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Consulte processos pelo número CNJ ou encontre números nas listas por OAB dos tribunais. Organize documentos sem extensão obrigatória no Chrome.</p>
           </div>
         </div>
         <Link href="/settings?section=Oab" className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-card px-3 py-2 text-xs font-semibold text-primary hover:bg-muted">
           <Settings2 size={15}/> Personalizar
         </Link>
       </div>
       <div className="grid gap-3 sm:grid-cols-3">
         <div className="rounded-xl border border-border bg-card p-3">
           <div className="flex items-center gap-2 text-sm font-semibold"><FileSearch size={16} className="text-primary"/> Identificar tribunal</div>
           <p className="mt-1 text-xs text-muted-foreground">O CNJ aponta o portal oficial. O tribunal favorito é usado apenas sem CNJ.</p>
         </div>
         <div className="rounded-xl border border-border bg-card p-3">
           <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-primary"/> Certificado protegido</div>
           <p className="mt-1 text-xs text-muted-foreground">A autenticação A1/A3 acontece no site judicial, sem upload de credenciais ao Lexis.</p>
         </div>
         <div className="rounded-xl border border-border bg-card p-3">
           <div className="flex items-center gap-2 text-sm font-semibold"><Globe2 size={16} className="text-primary"/> Organizar documentos</div>
           <p className="mt-1 text-xs text-muted-foreground">Importe PDF/ZIP dos autos para montar um pacote local de peças até a possível contestação.</p>
         </div>
       </div>
       <OabDiscoveryPanel/>
       <AutosOabFreePanel defaultExpanded/>
       <p className="text-xs leading-5 text-muted-foreground">
         O modo gratuito não consulta sigilo nem acessa a sessão autenticada por conta própria. O advogado deve ter autorização nos autos e confirmar o login no tribunal. O LexisPredict não substitui a conferência de documentos, datas ou autoria das peças.
       </p>
     </div>
   </main>
 </div>;
}
