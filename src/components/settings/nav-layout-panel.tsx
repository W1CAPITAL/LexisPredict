'use client';

import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function NavLayoutPanel() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const read = () => { try { setCompact(localStorage.getItem('lexis-sidebar-compact-v2') === '1'); } catch {} };
    read();
    window.addEventListener('lexis-nav-display', read);
    return () => window.removeEventListener('lexis-nav-display', read);
  }, []);
  return <section className="rounded-xl border bg-card p-5 space-y-4">
    <h3 className="font-semibold">Menu lateral</h3>
    <div className="flex items-center justify-between gap-4">
      <div><Label htmlFor="compact-nav">Recolher menu no computador</Label><p className="mt-1 text-sm text-muted-foreground">Mostra os ícones e libera espaço para os processos.</p></div>
      <Switch id="compact-nav" checked={compact} onCheckedChange={value => {
        setCompact(value);
        try { localStorage.setItem('lexis-sidebar-compact-v2', value ? '1' : '0'); } catch {}
        window.dispatchEvent(new CustomEvent('lexis-nav-display', { detail: { compact: value } }));
      }}/>
    </div>
    <p className="text-sm text-muted-foreground">No celular, o botão Menu abre a lista completa com os nomes. Use a busca para encontrar qualquer tela disponível no seu plano.</p>
  </section>;
}
