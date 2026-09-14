'use client';

import { useState } from 'react';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { retryAtendimentoMirrorAction } from '@/app/actions/case-save-actions';

export function AtendimentoSyncRetry({ protocolos }: { protocolos: string[] }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return <ToastAction altText="Tentar sincronizar os atendimentos já salvos com a planilha" disabled={busy} onClick={async () => {
    setBusy(true);
    let failed = 0;
    for (const protocolo of new Set(protocolos)) {
      try { if (!(await retryAtendimentoMirrorAction(protocolo)).success) failed++; }
      catch { failed++; }
    }
    setBusy(false);
    toast({ title: failed ? 'Planilha ainda pendente' : 'Planilha atualizada', description: failed ? `${failed} atendimento(s) continuam salvos no app, aguardando confirmação da planilha.` : 'Os atendimentos foram sincronizados.', variant: failed ? 'destructive' : undefined });
  }}>{busy ? 'Sincronizando…' : 'Tentar planilha'}</ToastAction>;
}
