/**
 * SNIPPET — colar/adaptar dentro de handleSearch (modo CNJ) em page.tsx do Veredito.
 * Não substitui o arquivo inteiro (evita apagar UI).
 */

/*
import { resolveVereditoByCnj } from '@/lib/veredito-sources';
import { DataJudDisclaimer } from '@/components/ui/datajud-disclaimer';

// Dentro do modo CNJ, após validar cnj:

const sources = await resolveVereditoByCnj(cnj);

if (!sources.success) {
  setApiError({
    engine: 'datajud+djen',
    message: sources.message || 'CNJ não localizado no DataJud nem no DJEN.',
  });
  toast({
    title: 'Sem movimentos',
    description: sources.datajudError || sources.djenError || sources.message,
    variant: 'destructive',
  });
  setLoading(false);
  return;
}

// Segue com IA se quiser, mas SEMPRE anexa timeline segura:
const data = await executarVereditoAI({ cnj, preferredModel: model }).catch(() => null);

setResult({
  ...(data || { success: true, message: sources.message }),
  dataJudRaw: sources.dataJudRaw || data?.dataJudRaw,
  movimentos: sources.movimentos,
  comunicacoes: sources.comunicacoes,
  fonteMovimentos: sources.fonte,
  avisoFontes: sources.message,
});

if (sources.fonte === 'djen') {
  toast({
    title: 'Fallback DJEN',
    description: 'DataJud sem movimentos — exibindo publicações do diário oficial.',
  });
} else {
  toast({ title: 'Auditoria 3D', description: sources.message });
}

// Na UI da timeline, mapear sources.movimentos (campo fonte: datajud | djen).
// Renderizar <DataJudDisclaimer compact /> acima do formulário.
*/
