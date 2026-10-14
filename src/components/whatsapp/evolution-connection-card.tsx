"use client";
import {ExternalLink,MessageCircle,ShieldAlert} from 'lucide-react';
import {Badge} from '@/components/ui/badge';
export function EvolutionConnectionCard(){
 return <section className="mx-3 mt-2 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:mx-4">
  <div className="flex flex-wrap justify-between gap-3">
   <div className="flex gap-2"><MessageCircle className="h-5 w-5 text-emerald-600 shrink-0"/>
    <div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">WhatsApp · Atendimento manual</strong><Badge variant="outline">DISPONÍVEL</Badge></div>
     <p className="mt-1 text-xs text-muted-foreground">Selecione o cliente e use “Abrir no WhatsApp”. Revise e envie a mensagem no aplicativo.</p>
    </div></div>
   <a className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted" href="https://web.whatsapp.com/" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4"/> WhatsApp Web</a>
  </div>
  <div role="status" className="mt-3 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
   <ShieldAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-200"/>
   <div className="text-xs leading-relaxed"><strong>Automação indisponível — nenhum provedor conectado.</strong>
    <p className="mt-1 text-muted-foreground">WA.Auto e Evolution não serão consultados. Nenhum QR Code será gerado. O histórico armazenado no Supabase permanece disponível.</p>
    <p className="mt-1 text-muted-foreground">Para reativar envios automáticos é necessário configurar e validar uma integração diferente, como a WhatsApp Business Cloud API oficial da Meta. Ela exige número comercial, token e modelos aprovados; não usa QR de pareamento.</p>
   </div>
  </div>
 </section>;
}
