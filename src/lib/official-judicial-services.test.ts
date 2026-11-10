import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OFFICIAL_JUDICIAL_SERVICES } from '@/lib/official-judicial-services';
import { normalizeRecurringTaskTitle } from '@/lib/crm-task-recurrence';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Integrações judiciais oficiais em OAB', () => {
  it('separa consulta pública DJEN de acesso institucional ao Domicílio', () => {
    expect(OFFICIAL_JUDICIAL_SERVICES.djen.api).toBe('https://comunicaapi.pje.jus.br/api/v1/comunicacao');
    expect(OFFICIAL_JUDICIAL_SERVICES.djen.swagger).toBe('https://comunicaapi.pje.jus.br/swagger/index.html');
    expect(OFFICIAL_JUDICIAL_SERVICES.domicilio.documentation).toContain('docs.pdpj.jus.br');
    expect(OFFICIAL_JUDICIAL_SERVICES.domicilio.requiresInstitutionalCredentials).toBe(true);
    expect(OFFICIAL_JUDICIAL_SERVICES.domicilio.mayRegisterReceipt).toBe(true);
  });
  it('oferece consulta DJEN por CNJ sem acessar inteiro teor do Domicílio', () => {
    expect(source('src/app/consulta-oab/page.tsx')).toContain('DjenOfficialSearch');
    expect(source('src/app/integracoes/page.tsx')).toContain('OfficialJudicialServices');
    expect(source('src/components/settings/oab-personalization-panel.tsx')).toContain('OFFICIAL_JUDICIAL_SERVICES');
    const djen=source('src/components/integracoes/djen-official-search.tsx');
    expect(djen).toContain('djenBuscaProcesso');
    expect(djen).not.toContain('domicilio-eletronico.pdpj.jus.br/api');
  });
});

describe('Repetições operacionais sem perda de contagem', () => {
  it('normaliza somente títulos de tarefas, não clientes ou protocolos distintos', () => {
    expect(normalizeRecurringTaskTitle('  Retorno   ao   Cliente ')).toBe('retorno ao cliente');
    expect(normalizeRecurringTaskTitle('RETORNO AO CLIENTE')).toBe('retorno ao cliente');
    expect(normalizeRecurringTaskTitle('  ')).toBe('');
  });
  it('preserva total acumulado e limite de empresa na consolidação', () => {
    const sql = source('supabase/migrations/20261110150000_crm_task_recurring_counter.sql');
    expect(sql).toContain('ocorrencias_total');
    expect(sql).toContain('p_empresa_id');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('security invoker');
    expect(source('src/app/actions/crm-pipeline-actions.ts')).toContain("rpc('crm_consolidate_recurring_task'");
  });
  it('não limpa flags recentes, reconhecimentos ou avisos originais', () => {
    const sql = source('supabase/migrations/20261110151000_compact_stale_persisted_alerts.sql');
    expect(sql).toContain("event_type = 'persisted'");
    expect(sql).toContain("interval '90 days'");
    expect(sql).not.toContain("event_type = 'raised'");
    expect(sql).not.toContain("truncate");
  });
});
