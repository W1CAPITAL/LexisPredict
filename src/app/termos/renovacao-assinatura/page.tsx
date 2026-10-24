import Link from "next/link";
import {ArrowLeft, FileText, ShieldCheck} from "lucide-react";
import {SubscriptionRenewalTermsContent} from "@/components/legal/SubscriptionRenewalTermsContent";

export const metadata = {title:"Termo de renovação de assinatura | LexisPredict"};

export default function TermoRenovacaoAssinaturaPage(){
  return (
    <main className="min-h-screen bg-[#f5f7fc] px-4 py-10 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/planos" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-violet-400"><ArrowLeft className="h-4 w-4"/>Voltar aos planos</Link>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-violet-800"><ShieldCheck className="h-4 w-4"/>Condições transparentes</span>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/30 sm:p-9">
          <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-5">
            <span className="rounded-2xl bg-violet-100 p-3 text-violet-700"><FileText className="h-6 w-6"/></span>
            <div><p className="text-lg font-black text-slate-950">LexisPredict</p><p className="text-xs text-slate-500">Planos e assinatura</p></div>
          </div>
          <SubscriptionRenewalTermsContent/>
        </div>
      </div>
    </main>
  );
}
