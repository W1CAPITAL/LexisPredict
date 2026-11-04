import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Dashboard "retornos para hoje" does not mislead about tasks', () => {
  it('loads the full company due date from server rather than using the small dashboard sample', () => {
    const page=readFileSync('src/app/page.tsx','utf8');
    expect(page).toContain("field: 'proximo-retorno'");
    expect(page).toContain("setRetornosHoje");
    expect(page).toContain('hoje={retornosHoje?.count ?? null}');
    expect(page).not.toContain('hoje={metrics.countHoje}');
  });
  it('labels it as scheduled returns and links directly to the matching queue', () => {
    const c=readFileSync('src/components/dashboard/dashboard-visual-overview.tsx','utf8');
    expect(c).toContain('label: "Retornos para hoje"');
    expect(c).toContain('href: "/tarefas?filtro=hoje"');
    expect(c).not.toContain('label: "Programados para hoje"');
    expect(c).not.toContain('detail: "No lote carregado"');
  });
  it('opens the É hoje filter through a deep link and loads these due cases from the same source', () => {
    const tasks=readFileSync('src/app/tarefas/page.tsx','utf8');
    expect(tasks).toContain('q.get("filtro")==="hoje"');
    expect(tasks).toContain("field: 'proximo-retorno'");
    expect(tasks).toContain('todayDueCases');
  });
});
