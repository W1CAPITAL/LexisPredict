import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Hermes retorno nas três áreas operacionais', () => {
  it('oferece revisão por processo em /cases, /tarefas e /processos', () => {
    const cases = source('src/app/cases/page.tsx');
    const tasks = source('src/app/tarefas/page.tsx');
    const processes = source('src/components/processos/processos-command-center.tsx');
    for (const screen of [cases, tasks, processes]) {
      expect(screen).toContain('HermesReturnReviewButton');
      expect(screen).toContain('db_id');
    }
    expect(cases).toContain('<HermesReturnReviewButton compact processId={Number((c as any).db_id || c.id)} />');
  });
  it('mantém rascunho manual, fontes e fila — sem enviar WhatsApp na revisão', () => {
    const component = source('src/components/hermes/hermes-return-review-button.tsx');
    const queue = source('src/components/hermes/hermes-priority-queue.tsx');
    const service = source('src/lib/hermes-return-service.ts');
    expect(component).toContain('message_draft');
    expect(component).toContain('suggested_next_return');
    expect(component).toContain('highlights');
    expect(queue).toContain('priorityScore');
    expect(service).toContain("fetchDataJud(");
    expect(service).toContain("fetchDjenComunicacoes(");
    expect(service).not.toContain('sendWhatsApp');
  });
});
