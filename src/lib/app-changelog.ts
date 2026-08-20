/**
 * Histórico de atualizações do LexisPredict (fonte única).
 * Exibido de forma discreta abaixo do atalho do Scanner no menu lateral.
 * Ao publicar um lote, acrescente um item no topo de APP_CHANGELOG.
 */
export type ChangelogItem = {
  /** Semver do produto (não confundir com build do scanner) */
  version: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Título curto legível */
  title: string;
  /** Detalhes do que entrou / mudou */
  details: string[];
  /** Opcional: tags internas */
  tags?: string[];
};

/** Versão atual embutida na UI */
export const APP_VERSION = '1.13.2';

export const APP_CHANGELOG: ChangelogItem[] = [
  {
    version: '1.13.2',
    date: '2026-08-20',
    title: 'Parados por fase + changelog 9.54 no banner',
    details: [
      'Processos parados: filtro multi Sem contestação / Sem sentença / Sem réplica e export XLSX/CSV da lista filtrada.',
      'Banner “Nova versão” (build 9.54.x) lista o lote recente via /api/version.',
      'WhatsApp: wake Evolution só no envio; antiban e próximo caso por vencimento.',
      'Vercel: Node 24.x, eslint no lugar de next lint, região gru1.',
    ],
    tags: ['parados', 'whatsapp', 'infra'],
  },

  {
    version: '1.13.1',
    date: '2026-08-20',
    title: 'Fix build Next 16.3 (webpack + sem eslint config)',
    details: [
      'Removida chave eslint do next.config (inválida no Next 16).',
      'Build produção: next build --webpack (mantém cache filesystem).',
      'turbopack: {} no config; engines node 20.x.',
    ],
    tags: ['infra', 'build'],
  },

  {
    version: '1.13.0',
    date: '2026-08-20',
    title: 'Next.js 16.3.1 + TypeScript 7.0.2',
    details: [
      'next e eslint-config-next em 16.3.1 (menor RAM no dev, builds mais rápidos).',
      'TypeScript ~7.0.2 (compilador nativo, typecheck bem mais rápido).',
      'tsconfig: target ES2024, exclude services/, moduleDetection force.',
      'engines.node >= 20.9 — ver docs/UPGRADE_NEXT16_TS7.md.',
    ],
    tags: ['infra', 'next16', 'typescript7'],
  },

  {
    version: '1.10.1',
    date: '2026-08-20',
    title: 'Parados = processo sem movimento + ainda cabe ato',
    details: [
      'Critério de parado: DataJud/DJEN/evento (rito), não só silêncio do cliente.',
      'Só lista se aindaDaParaAgirNoProcesso (exclui baixa definitiva sem residual).',
      'Oportunidades processuais: impulso, cumprimento, custas, JG, BA, recurso.',
      'Score prioriza providência no processo; contato é secundário.',
    ],
    tags: ['parados', 'ops'],
  },

  {
    version: '1.10.0',
    date: '2026-08-20',
    title: 'Build estável (client directives + types)',
    details: [
      'use client no topo de Tarefas e WhatsApp.',
      'canScan propagado no SidebarNavBody.',
      'Export Processos: disabled sem atributo duplicado.',
      'Imports ai/dev sem extensão .ts (TS6).',
      'Declarações CSS e Blob/Uint8Array para typecheck.',
    ],
    tags: ['build', 'typescript'],
  },

  {
    version: '1.9.0',
    date: '2026-08-20',
    title: 'Parados na linha + visualização nas abas',
    details: [
      'Badge Parado XXd em Processos (60/90/180d).',
      'Fila de contato e WhatsApp: bloqueio de cópia no modo visualização.',
      'Processos parados: auditar top 15 em lote (respeita canScan).',
      'Export CSV de parados desabilitado para visualizador.',
    ],
    tags: ['ops', 'visualização', 'parados'],
  },

  {
    version: '1.8.0',
    date: '2026-08-20',
    title: 'Modo visualização + TypeScript 6',
    details: [
      'Perfil Visualizador: vê carteira da empresa, cadastra e edita.',
      'Bloqueio de cópia, exportação (CSV/XLSX/PDF) e scanner tribunal.',
      'Faixa de aviso permanente no topo quando o modo está ativo.',
      'Toolchain alinhada a TypeScript 6 (devDependency).',
      'Este painel de notas de versão (discreto, sob o scanner).',
    ],
    tags: ['segurança', 'ops', 'toolchain'],
  },
  {
    version: '1.7.0',
    date: '2026-08-19',
    title: 'Processos parados na operação',
    details: [
      'Aba Processos parados: tribunal sem movimento ≥60d, score de ação.',
      'Separação sem_scan vs parado confirmado (DataJud/DJEN/evento).',
      'Filtro Parados na fila de contato e bloco no dossiê/report.',
      'Marcar tratado (sessão) e scripts por faixa de dias.',
    ],
    tags: ['carteira', 'fila'],
  },
  {
    version: '1.6.2',
    date: '2026-08-18',
    title: 'Build e exportação estáveis',
    details: [
      'Correção use server em export-actions (build Vercel).',
      'Export CSV + XLSX dossiê com fallback SheetJS.',
      'Typecheck: cargo no perfil, setCases, ultimoRetorno, predatoria.',
    ],
    tags: ['build'],
  },
  {
    version: '1.6.0',
    date: '2026-08-17',
    title: 'Carteira, dono do caso e radar',
    details: [
      'Transferência de responsável (app + service role).',
      'Proteção created_by no banco (sem roubo por scan/edição).',
      'Radar NUMOPEDE e flags na fila / ranking.',
      'Redistribuição controlada de ativos entre operadores.',
    ],
    tags: ['carteira', 'compliance'],
  },
  {
    version: '1.5.0',
    date: '2026-08-15',
    title: 'WhatsApp terminal e Omni IA',
    details: [
      'Terminal WhatsApp: andamentos, rascunho, envio Evolution.',
      'Cascata Omni de motores de IA (fallback sem travar a tela).',
      'Importação de histórico com limpeza e deduplicação.',
      'Aviso de mensagem duplicada antes do envio.',
    ],
    tags: ['whatsapp', 'ia'],
  },
  {
    version: '1.4.0',
    date: '2026-08-10',
    title: 'Scanner híbrido e telemetria unificada',
    details: [
      'Auditoria DataJud ∪ DJEN com flags idempotentes.',
      'getSinalCapa, linguagem simples e scripts por evento.',
      'Dashboard: procedentes/improcedentes, BA, prazos.',
      'Dossiê operacional com períodos e top críticos.',
    ],
    tags: ['scanner', 'telemetria'],
  },
  {
    version: '1.3.0',
    date: '2026-07-31',
    title: 'Agenda, BI e UI operacional',
    details: [
      'Agenda da semana com feriados por UF (calendário TJ).',
      'Painel BI/compliance no dashboard e report.',
      'Ajustes de microcopy (menos “cara de IA”).',
      'Navegação e preferências de menu por perfil.',
    ],
    tags: ['ui', 'agenda'],
  },
  {
    version: '1.2.0',
    date: '2026-07-20',
    title: 'Base multi-tenant e gabinete',
    details: [
      'Gestão processual multi-empresa (Supabase).',
      'Fila de contato, equipe, documentos e veredito.',
      'Importação CSV e operações de volume.',
    ],
    tags: ['core'],
  },
];

export function formatChangelogDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  } catch {
    return iso;
  }
}

export function getLatestChangelog(): ChangelogItem {
  return APP_CHANGELOG[0] ?? {
    version: APP_VERSION,
    date: new Date().toISOString().slice(0, 10),
    title: 'LexisPredict',
    details: [],
  };
}
