import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const migration=readFileSync(
  new URL('../../../supabase/migrations/20261122220500_wa_manual_send_idempotency.sql',import.meta.url),
  'utf8',
);
const queue=readFileSync(new URL('../whatsapp-local.ts',import.meta.url),'utf8');
const action=readFileSync(new URL('../../app/actions/whatsapp-actions.ts',import.meta.url),'utf8');
const page=readFileSync(new URL('../../app/whatsapp/page.tsx',import.meta.url),'utf8');

describe('manual WA.Auto send idempotency',()=>{
  it('scopes the unique request key by tenant and operator',()=>{
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS client_request_id uuid');
    expect(migration).toMatch(/UNIQUE INDEX[\s\S]*empresa_id, created_by, client_request_id/i);
    expect(migration).toContain('WHERE client_request_id IS NOT NULL');
  });

  it('reconciles an exact retry and rejects conflicting payloads',()=>{
    expect(queue).toContain("error?.code==='23505'");
    expect(queue).toContain(".eq('empresa_id',ctx.empresa_id)");
    expect(queue).toContain(".eq('created_by',ctx.auth_id).eq('client_request_id',clientRequestId)");
    expect(queue).toContain('prior.to_phone!==n||prior.body!==body');
    expect(queue).toContain('idempotent:true');
  });

  it('carries the browser request key through the server action',()=>{
    expect(action).toContain('sendWhatsAppAction(to: string, message: string, requestId?: string)');
    expect(action).toContain('enqueueLocalMessage(recipient,text,requestId)');
  });

  it('reuses the same key after the client timeout but clears it after success',()=>{
    expect(page).toContain('pendingRequest?.to===to&&pendingRequest.body===outboundBody');
    expect(page).toContain('sendWhatsAppAction(to, outboundBody,requestId)');
    expect(page).toContain('retryUsesSameRequest:true');
    expect(page).toContain('sendRequestRef.current=null');
  });
});
