import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const sql=readFileSync(
  new URL('../../../supabase/migrations/20261122002000_office_agent_queue_ledger_hardening.sql',import.meta.url),
  'utf8',
);

describe('office agent queue ledger hardening',()=>{
  it('requires provider evidence before accepted',()=>{
    expect(sql).toContain("p_status='accepted'");
    expect(sql).toContain('length(v_provider_message_id)<4');
    expect(sql).toMatch(/accepted_receipt_check[\s\S]*NOT VALID/i);
  });

  it('reconciles exact retries without granting a second send',()=>{
    expect(sql).toContain("'reason','duplicate_request'");
    expect(sql).toContain("'reservation_id',v_existing.id");
    expect(sql).toContain("'ok',false");
    expect(sql).toContain("'has_provider_receipt'");
  });

  it('rejects reuse of the inbound id with different content',()=>{
    expect(sql).toContain("'reason','duplicate_request_conflict'");
    expect(sql).toContain('v_existing.processo_id <> p_processo_id');
    expect(sql).toContain('v_existing.reply_excerpt <> p_reply');
  });

  it('keeps tenant and OAuth boundaries in both RPCs',()=>{
    expect(sql.match(/OAuth MCP tokens cannot mutate legal records/g)).toHaveLength(2);
    expect(sql).toContain('e.empresa_id=v_company');
    expect(sql).toContain('e.empresa_id=public.get_user_empresa_id()');
    expect(sql).toContain("SET search_path TO 'pg_catalog', 'public', 'pg_temp'");
  });
});
