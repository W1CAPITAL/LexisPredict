import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const migration=readFileSync(
  new URL('../../../supabase/migrations/20261123101500_wa_queue_global_poll_index.sql',import.meta.url),
  'utf8',
);
const route=readFileSync(
  new URL('../../app/api/cron/wa-full-portfolio/route.ts',import.meta.url),
  'utf8',
);

describe('WhatsApp portfolio global queue poll index',()=>{
  it('matches the cron predicate and ordering exactly',()=>{
    expect(route).toMatch(/\.in\('status',\['pending','processing'\]\)/);
    expect(route).toMatch(/\.lt\('attempts',3\)/);
    expect(route).toMatch(/\.order\('id',\{ascending:true\}\)\.limit\(1\)/);

    expect(migration).toMatch(/ON public\.wa_portfolio_scan_queue \(id\)/i);
    expect(migration).toMatch(/INCLUDE \(empresa_id\)/i);
    expect(migration).toMatch(/WHERE attempts < 3[\s\S]*status IN \('pending', 'processing'\)/i);
  });

  it('does not index message, phone or evidence payloads',()=>{
    expect(migration).not.toMatch(/contact_phone|last_error|source_errors|events|findings/i);
  });
});
