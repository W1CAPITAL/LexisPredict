'use client';

import * as React from 'react';
import { FileSearch, Loader2, ExternalLink } from 'lucide-react';
import { djenBuscaProcesso, type DjenItemRaw } from '@/lib/djen-client';
import { OFFICIAL_JUDICIAL_SERVICES } from '@/lib/official-judicial-services';
import { Button } from '@/components/ui/button';

const fmtDate = (value: unknown): string => String(value || '').slice(0, 10) || 'Data não informada';

/** Busca oficial por CNJ — sem login, scraping, certificado ou abertura do Domicílio. */
export function DjenOfficialSearch({ initialCnj = '' }: { initialCnj?: string }) {
  const [cnj, setCnj] = React.useState(initialCnj);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [items, setItems] = React.useState<DjenItemRaw[] | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => abortRef.current?.abort(), []);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const digits = cnj.replace(/\D/g, '');
    if (digits.length !== 20) {
      setError('Informe um número CNJ válido com 20 dígitos.');
      setItems(null);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError('');setItems(null);setBusy(true);
    try {
      const result = await djenBuscaProcesso({ protocolo: cnj, signal: controller.signal, itensPorPagina: 30 });
      if (!result.ok) throw new Error(result.error || 'Consulta DJEN indisponível.');
      if (!controller.signal.aborted) setItems(result.items.slice(0, 30));
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Falha na consulta oficial.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <section id="djen-oficial" aria-label="Consulta DJEN oficial por número CNJ" className="rounded-2xl border border-[#a16a82]/30 bg-card p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-bold"><FileSearch className="text-primary" size={19}/> DJEN oficial · Consulta por processo</h2>
      <span className="rounded-full border border-border bg-muted px-2 py-1 text-[11px] font-semibold text-foreground">API pública do CNJ</span>
    </div>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Use o CNJ do processo para pesquisar comunicações públicas. A inscrição OAB não é senha de acesso à API, e ausência de resultados não comprova ausência de publicações.</p>
    <form onSubmit={search} className="mt-3 flex flex-wrap gap-2">
      <label className="min-w-[210px] flex-1 text-xs font-semibold">Número CNJ
        <input className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground" value={cnj} onChange={e=>setCnj(e.target.value.slice(0,30))} placeholder="0000000-00.0000.0.00.0000" aria-label="Número CNJ"/>
      </label>
      <Button type="submit" disabled={busy} className="self-end gap-2">{busy?<Loader2 size={15} className="animate-spin"/>:<FileSearch size={15}/>} Consultar DJEN</Button>
    </form>
    {error && <p role="alert" className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-foreground">{error}</p>}
    {items && <div className="mt-3 space-y-2" aria-live="polite">
      <p className="text-xs font-semibold text-muted-foreground">{items.length ? items.length + ' publicação(ões) encontrada(s) nesta consulta.' : 'Nenhuma publicação retornada para os filtros desta consulta.'}</p>
      {items.map((item,i)=><article className="rounded-xl border border-border bg-muted/30 p-3 text-xs" key={String(item.id||item.hash||i)}>
        <p className="font-bold">{String(item.numeroProcesso||item.numero_processo||cnj)} · {String(item.siglaTribunal||'DJEN')}</p>
        <p className="mt-1 text-muted-foreground">{fmtDate(item.data_disponibilizacao)} · {String(item.texto||'Teor não fornecido').slice(0,300)}</p>
      </article>)}
    </div>}
    <a href={OFFICIAL_JUDICIAL_SERVICES.djen.swagger} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary underline">Documentação oficial da API <ExternalLink size={12}/></a>
  </section>;
}
