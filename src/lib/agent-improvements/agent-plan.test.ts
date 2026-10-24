import {describe,it,expect} from 'vitest';
import {planAgentTeam,compactAgentGuidance} from '@/lib/agents/studio';

describe('agent-studio specialized roles',()=>{
  it('routes report/PDF tasks to QA and PDF-specialist',()=>{
    const r=planAgentTeam('Corrigir exportar PDF no /report/completo com desempenho ruim');
    expect(r.roles.map(x=>x.id)).toContain('pdf-auditor');
    expect(r.roles.map(x=>x.id)).toContain('performance');
    expect(r.routeRecommendations?.some(x=>x.route==='/report/completo')).toBe(true);
  });
  it('routes authorized API inspection to a bounded safety-reviewed role',()=>{
    const p=planAgentTeam('Inventariar HAR da nossa API /integracoes');
    expect(p.roles.map(x=>x.id)).toContain('api-auditor');
    expect(p.roles.map(x=>x.id)).toContain('security');
    expect(p.gates.join(' ')).toMatch(/sem replay de sessões/);
  });
  it('provides short and non-executable agent guidance for the chat',()=>{
    const s=compactAgentGuidance('Auditoria de desempenho do /report com PDF');
    expect(s).toContain('NÃO EXECUÇÃO');
    expect(s).toContain('PDF');
    expect(s.length).toBeLessThanOrEqual(720);
    expect(compactAgentGuidance('Oi')).toBe('');
  });
  it('requires consent and human review for WhatsApp messages',()=>{
    const p=planAgentTeam('Criar mensagens WhatsApp para um cliente');
    expect(p.roles.map(x=>x.id)).toContain('customer-comms');
    expect(p.roles.map(x=>x.id)).toContain('legal-compliance');
    expect(p.gates.join(' ')).toMatch(/autorização/);
  });
});
