import {describe,expect,it} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
const text=(p:string)=>readFileSync(p,'utf8');
describe('Hermes routes consolidate to existing serverless function',()=>{
  it('preserves public endpoints with rewrites, not additional serverless route files',()=>{
    const config=text('next.config.ts');
    expect(config).toContain('source: "/api/hermes-office"');
    expect(config).toContain('destination: "/api/cron/hermes-returns?hermesRoute=office"');
    expect(config).toContain('source: "/api/cron/hermes-office-meeting"');
    expect(config).toContain('destination: "/api/cron/hermes-returns?hermesRoute=meeting"');
    expect(existsSync('src/app/api/hermes-office/route.ts')).toBe(false);
    expect(existsSync('src/app/api/cron/hermes-office-meeting/route.ts')).toBe(false);
  });
  it('handles both supervisor and cron routes with correct roles and confidentiality',()=>{
    const source=text('src/app/api/cron/hermes-returns/route.ts');
    expect(source).toContain('getUserContext');
    expect(source).toContain('runHermesCompanyMeeting');
    expect(source).toContain('buildHermesOfficeIntelligence');
    expect(source).toContain("get('hermesRoute')");
    expect(source).toContain("mode === 'office'");
    expect(source).toContain("mode === 'meeting'");
    expect(source).toContain('authorized(request)');
    expect(source).toContain('runHermesDueReviewBatch(1)');
    expect(source).toContain("ctx?.isSupervisor");
    expect(source).toContain('headers: {');
    expect(source).not.toContain('sendWhatsApp');
  });
});
