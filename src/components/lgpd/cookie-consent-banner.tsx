'use client';

/**
 * Banner LGPD mínimo (inspirado no padrão osano/cookieconsent).
 * Não embute tracking de terceiros. Persistência local.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const KEY = 'lexis_lgpd_consent_v1';

type Consent = { necessary: true; analytics: boolean; at: string };

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const save = (analytics: boolean) => {
    const c: Consent = { necessary: true, analytics, at: new Date().toISOString() };
    try {
      localStorage.setItem(KEY, JSON.stringify(c));
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card shadow-lg px-4 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <p className="text-[12px] leading-snug text-foreground/90 flex-1">
          Usamos cookies essenciais para autenticação e preferências. Analytics opcional
          (sem venda de dados). Consulte a política de privacidade do escritório.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button type="button" size="sm" variant="outline" onClick={() => save(false)}>
            Só essenciais
          </Button>
          <Button type="button" size="sm" onClick={() => save(true)}>
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  );
}
