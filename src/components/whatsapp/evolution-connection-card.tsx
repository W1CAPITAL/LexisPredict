"use client";
import {MessageCircle,ShieldAlert} from "lucide-react";
import {Badge} from "@/components/ui/badge";

/** WhatsApp pane: never promise a QR code without an active compatible backend. */
export function EvolutionConnectionCard(){
  return <section aria-label="WhatsApp no CRM" className="mx-3 mt-2 rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:mx-4">
    <div className="flex flex-wrap items-center gap-2">
      <MessageCircle className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true"/>
      <strong className="text-sm">WhatsApp · Conversas do CRM</strong>
      <Badge variant="outline">HISTÓRICO DISPONÍVEL</Badge>
    </div>
    <p className="mt-1 text-xs text-muted-foreground">
      Pesquise qualquer cliente, consulte os registros já salvos e prepare o atendimento sem sair do LexisPredict.
    </p>
    <div role="status" className="mt-2 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/>
      <p><strong>Envio direto ainda indisponível.</strong> Não existe sessão WhatsApp conectada neste ambiente.
      WA.Auto e Evolution não funcionam e o procedimento de instalação local foi retirado.
      Nenhuma mensagem será marcada como enviada sem confirmação.</p>
    </div>
  </section>;
}
