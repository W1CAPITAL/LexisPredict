import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {getHermesAgentDestination} from '@/lib/hermes-agent-route';
const source=(path:string)=>readFileSync(path,'utf8');

describe('Hermes agents reflect real events, not perpetual fake activity',()=>{
  const station={id:'processos',x:20,y:22} as const;
  it('shows idle as idle in the absence of a recent event',()=>{
    const route=getHermesAgentDestination(station,[],false,new Date('2026-11-10T15:00:00Z'));
    expect(route.status).toBe('idle');
    expect(route.isLive).toBe(false);
  });
  it('links working actions to source events and meeting replay to conference table',()=>{
    const event={id:7,sector:'processos',kind:'judicial_scan',status:'working' as const,
      title:'Consultando DJEN',detail:'Fonte judicial',recorded_at:'2026-11-10T14:59:00Z',processo_id:34};
    const route=getHermesAgentDestination(station,[event],false,new Date('2026-11-10T15:00:00Z'));
    expect(route.status).toBe('working');
    expect(route.isLive).toBe(true);
    expect(route.target.x).not.toBe(station.x);
    const meeting=getHermesAgentDestination(station,[event],true,new Date('2026-11-10T15:00:00Z'));
    expect(meeting.status).toBe('meeting-replay');
    expect(meeting.target).toMatchObject({x:50,y:48});
  });
  it('does not describe old unresolved tasks as ongoing',()=>{
    const event={id:8,sector:'processos',kind:'judicial_scan',status:'working' as const,
      title:'Consultando',detail:null,recorded_at:'2026-11-10T12:00:00Z',processo_id:34};
    expect(getHermesAgentDestination(station,[event],false,new Date('2026-11-10T15:00:00Z')).isLive).toBe(false);
  });
});

describe('Hermes audit trail and AI transparency',()=>{
  it('records real scanning and meetings via tenant-safe postgres triggers',()=>{
    const sql=source('supabase/migrations/20261110170000_hermes_activity_log.sql');
    expect(sql).toContain('hermes_office_events');
    expect(sql).toContain('hermes_return_reviews');
    expect(sql).toContain('hermes_office_daily');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('meeting_attempts');
    expect(sql).toContain("meeting_status = 'unavailable'");
    expect(sql).toContain("interval '2 minutes'");
  });
  it('fetches recent logs from the authenticated office handler without adding Vercel functions',()=>{
    const service=source('src/lib/hermes-company-service.ts');
    const route=source('src/app/api/cron/hermes-returns/route.ts');
    expect(service).toContain('getHermesOfficeEvents');
    expect(route).toContain('getHermesOfficeEvents');
    expect(route).toContain('canReviewOffice(ctx)');
    expect(route).toContain('runHermesDueReviewBatch(1)');
  });
  it('explains the model failure reason, allows bounded retries and does not claim IA success after fallback',()=>{
    const service=source('src/lib/hermes-company-service.ts');
    expect(service).toContain('meeting_error_code');
    expect(service).toContain('classifyHermesModelFailure');
    expect(service).toContain('max_tokens:');
    const panel=source('src/components/hermes/hermes-company-panel.tsx');
    expect(panel).toContain('Tentar reunião novamente');
    expect(panel).toContain('meeting_error_code');
  });
  it('has moving separate robot actors, real activity log, and no local LLM or WebGL',()=>{
    const page=source('src/app/hermes-3d/page.tsx');
    expect(page).toContain('HermesRoamingRobots');
    expect(page).toContain('HermesActivityLog');
    expect(page).toContain('Reproduzir reunião');
    const css=source('src/app/hermes-3d/hermes-office.css');
    expect(css).toContain('h3d-agent-route');
    expect(css).toContain('prefers-reduced-motion');
    expect(page).not.toMatch(/WebGLRenderer|requestAnimationFrame/);
  });
  it('displays Hermes and Projetos in normal admin sidebar under any plan',()=>{
    const vertical=source('src/components/layout/sidebar-vertical.tsx');
    const dock=source('src/components/layout/sidebar-dock.tsx');
    const plans=source('src/lib/planos-pacotes.ts');
    expect(vertical).toContain('admin: true');
    expect(dock).toContain('isAdmin');
    expect(plans).toContain('"/hermes-3d"');
    expect(plans).toContain('"/projetos"');
  });
});
