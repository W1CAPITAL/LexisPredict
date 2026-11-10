import Link from 'next/link';
import { ExternalLink, FileSearch, ShieldAlert, ShieldCheck } from 'lucide-react';
import { OFFICIAL_JUDICIAL_SERVICES } from '@/lib/official-judicial-services';

/** Referências oficiais, separando API pública de serviço autenticado com ciência processual. */
export function OfficialJudicialServices() {
  const { djen, domicilio } = OFFICIAL_JUDICIAL_SERVICES;
  return <section id="judiciario-oficial" aria-label="Fontes judiciais oficiais" className="grid gap-4 md:grid-cols-2">
    <article className="rounded-2xl border border-[#aa728a]/35 bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-center gap-2 text-base font-bold"><FileSearch size={19} className="text-primary" /> DJEN oficial · Comunica PJe</div>
      <p className="mt-2 text-sm text-muted-foreground">Consulta pública às comunicações e publicações pelo número CNJ ou filtros disponíveis. A API do CNJ está integrada ao LexisPredict e pode impor limites de acesso.</p>
      <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-foreground"><ShieldCheck size={14} className="text-primary" /> API pública para leitura — sem credencial OAB obrigatória</p>
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <Link className="font-bold text-primary underline" href="/consulta-oab#djen-oficial">Pesquisar DJEN no LexisPredict</Link>
        <a className="inline-flex items-center gap-1 font-bold text-primary underline" href={djen.swagger} target="_blank" rel="noopener noreferrer">Swagger oficial <ExternalLink size={12}/></a>
        <a className="inline-flex items-center gap-1 font-bold text-primary underline" href={djen.portal} target="_blank" rel="noopener noreferrer">Comunica PJe <ExternalLink size={12}/></a>
      </div>
    </article>
    <article className="rounded-2xl border border-[#aa728a]/35 bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-center gap-2 text-base font-bold"><ShieldAlert size={19} className="text-amber-600 dark:text-amber-300"/> Domicílio Judicial Eletrônico</div>
      <p className="mt-2 text-sm text-muted-foreground">Comunicações destinadas à instituição ou a representados. API própria, com credenciais institucionais e representação autorizada — diferente da API pública DJEN.</p>
      <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-foreground"><strong>Atenção jurídica:</strong> consultar o inteiro teor pode registrar ciência e produzir efeitos sobre prazos. O LexisPredict não abre comunicações nem registra ciência automaticamente. Conexão institucional não configurada neste módulo.</p>
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <a className="inline-flex items-center gap-1 font-bold text-primary underline" href={domicilio.portal} target="_blank" rel="noopener noreferrer">Entrar no portal oficial <ExternalLink size={12}/></a>
        <a className="inline-flex items-center gap-1 font-bold text-primary underline" href={domicilio.documentation} target="_blank" rel="noopener noreferrer">Documentação PDPJ <ExternalLink size={12}/></a>
      </div>
    </article>
  </section>;
}
