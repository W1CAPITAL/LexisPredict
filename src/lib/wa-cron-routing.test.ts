import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: null } })),
  deliver: vi.fn(async () => ({ ok: true, processed: false })),
  queueMovement: vi.fn(async () => ({ queued: true, reason: 'prepared' })),
  queueOverdue: vi.fn(async () => ({ queued: false, reason: 'nothing_due' })),
  queueChecked: vi.fn(async () => ({ queued: false, reason: 'nothing_due' })),
  database: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/lib/wa-movement-campaign', () => ({ deliverNextMovement: mocks.deliver, queueNextMovementForTenant: mocks.queueMovement }));
vi.mock('@/lib/wa-portfolio-outreach', () => ({ queueOverdueContact: mocks.queueOverdue, queueCheckedPortfolioContact: mocks.queueChecked }));
vi.mock('@/lib/server-db', () => ({ getSupabaseAdmin: mocks.database }));
vi.mock('@/lib/wa-daily-return-service', () => ({ processNextDueReturn: vi.fn() }));

import { middleware } from '../../middleware';
import { GET as movement } from '@/app/api/cron/wa-movement/route';
import { GET as daily } from '@/app/api/cron/wa-daily-return/route';

describe('WhatsApp cron authentication boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query={
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn(async()=>({data:[{empresa_id:'test-company',owner_auth_id:null}],error:null})),
      maybeSingle: vi.fn(async()=>({data:{send_anytime:false},error:null})),
    };
    mocks.database.mockResolvedValue({from:vi.fn(()=>query)});
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key');
    vi.stubEnv('WA_MOVEMENT_CRON_SECRET', 'test-private-movement-cron-secret');
    vi.stubEnv('WA_DAILY_CRON_SECRET', 'test-private-daily-cron-secret');
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(['/api/cron/wa-movement', '/api/cron/wa-daily-return'])(
    'allows %s to reach its secret-authenticated handler without browser cookies',
    async (path) => {
      const response = await middleware(new NextRequest(`https://test.invalid${path}`));
      expect(response.headers.get('x-middleware-next')).toBe('1');
      expect(mocks.getUser).not.toHaveBeenCalled();
    },
  );

  it.each(['/api/cron/other', '/api/cron/wa-movement/extra', '/api/cron/wa-daily-return/extra'])(
    'keeps browser authentication on %s', async (path) => {
      const response = await middleware(new NextRequest(`https://test.invalid${path}`));
      expect(response.status).toBe(401);
      expect(mocks.getUser).toHaveBeenCalledOnce();
    },
  );

  it.each([movement, daily])('rejects missing and invalid cron secrets before any work', async (handler) => {
    for (const authorization of ['', 'Bearer wrong-secret']) {
      const response = await handler(new Request('https://test.invalid', { headers: { authorization } }));
      expect(response.status).toBe(401);
    }
    expect(mocks.queueMovement).not.toHaveBeenCalled();
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it('processes a queue only with the valid movement secret', async () => {
    const response = await movement(new Request('https://test.invalid', {
      headers: { authorization: 'Bearer test-private-movement-cron-secret' },
    }));
    expect(response.status).toBe(200);
    expect(mocks.queueMovement).toHaveBeenCalledOnce();
  });
});
