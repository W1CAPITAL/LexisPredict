import React from 'react';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VisualReportPdf } from './visual-report-pdf';
import { buildTeamVisualReport, buildSupervisionVisualReport, buildPersonalVisualReport } from '@/lib/report/report-adapters';
import type { EquipeMembro, EquipeRelatorio } from '@/components/report/team-report';
import type { SupervisaoSnapshot } from '@/app/actions/supervisao-actions';
import type { AnalisesPessoaisPdfData } from './analises-internas-pdf';

const person = (i: number): EquipeMembro => ({
  userId: 'pessoa-' + i, nome: ['Ana Carolina Silva', 'Bernardo Lima', 'Catarina Mendes', 'Daniel Souza', 'Elisa Costa', 'Fábio Alves', 'Gabriela Dias'][i % 7], cargo: 'Operador',
  carteira: { total: i * 3, ativos: i, encerrados: i * 2 }, atendimentos: { processos: i, eventos: i * 2 }, edicoes: { processos: i, eventos: i }, encerramentos: { processos: i, eventos: i },
  atividades: { registros: i * 4, contato: i, contatosDeclarados: i, internas: i, processos: i, categorias: [], recentes: [], registrosTotal: i * 10, processosTotal: i, contatosMarcadosTotal: i, semReferenciaTotal: 0 },
  trabalho: { registros: i, processos: i, entregas: 0, verificacoesLote: 0, categorias: [], entregasRecentes: [] },
});
const team: EquipeRelatorio = { periodo: 'mes', inicio: '2026-10-01', fim: '2026-10-31', pessoas: Array.from({ length: 7 }, (_, i) => person(i + 1)) };
const overview = { total: 84, ativos: 28, encerrados: 56, vencidos: 0, novidades: 3, atendidos: 28, eventos: 56, semRetorno30: 2, meritoPendente: null, procedentes: 5, improcedentes: 7, parciais: 4, semMerito: null };
const personal: AnalisesPessoaisPdfData = {
  empresa: 'Empresa Horizonte', nome: 'Ana Carolina Silva', geradoEm: '2026-10-31T12:00:00Z', filtros: { busca: '', categoria: '' }, paginas: { analises: 1, atividades: 1, acoes: 1 },
  totais: { analises: 18, atividades: 3, acoes: 1, documentais: 9 },
  analises: Array.from({ length: 8 }, (_, i) => ({ id: String(i), protocolo_ref: null, categoria: 'auditoria_documental', descricao: 'Conferência documental registrada, com fonte e próxima etapa. '.repeat(i % 3 * 5 + 1), origem: 'Documento anexado ao registro', data_atividade: '2026-10-30', nivel_conferencia: 'documental' })),
  atividades: [{ id: 't', titulo: 'Conferir documentação recebida', categoria: 'outro', descricao: 'Atividade manual.', data_realizacao: '2026-10-30', protocolo_ref: null }],
  acoes: [{ id: 'o', action: 'edicao', created_at: '2026-10-31T12:00:00Z', protocolo_ref: null }],
};

describe('PDF visual nativo', () => {
  it('renderiza empresa, equipe variável e todos os modos com navegação real', async () => {
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const supervision = {
      empresaNome: 'Empresa Aurora', geradoEm: '2026-10-31T12:00:00Z', periodoLabel: 'Mês atual', total: 84, ativos: 28, encerrados: 56, vencidos: 0, novidades: 3, semRetorno: 2, atendidosSemana: 28,
      analisesInternas: { tarefasConcluidasPeriodo: 45, tarefasPorPessoa: [{ nome: 'Ana Carolina Silva', total: 10, periodo: 4 }], processosAnalisados: 2, auditoriaDocumental: 3, triagemReplicaProvas: 1, dossiesIndividuais: 1, investigacoesExternas: 0, projetos: 0 },
      porUsuario: [], operadores: team.pessoas.map(p => ({ nome: p.nome, total: p.carteira.total, ativos: p.carteira.ativos, encerrados: p.carteira.encerrados, vencidos: 0, novidades: 0, atendidosSemana: p.atendimentos.processos })),
      timelineSemanal: [{ label: '01/10', atendidos: 3 }, { label: '08/10', atendidos: 8 }, { label: '15/10', atendidos: 17 }],
      porEscritorio: [{ label: 'Escritório Aurora', value: 84 }], porTribunal: [{ label: 'Tribunal cadastrado', value: 84 }], porStatus: [{ label: 'Ativos', value: 28 }, { label: 'Encerrados', value: 56 }],
    } as unknown as SupervisaoSnapshot;
    const reports = {
      equipe: buildTeamVisualReport({ data: team, overview, scope: 'Empresa inteira', company: 'Empresa Aurora', trend: [{ ymd: '2026-10-01', atendimentos: 0, encerramentos: 0 }], daily: [{ userId: 'pessoa-1', nome: 'Ana Carolina Silva', ymd: '2026-10-01', processos: 1, eventos: 2, encerramentos: 0 }] }),
      analises: buildPersonalVisualReport(personal), supervisao: buildSupervisionVisualReport(supervision, 'Supervisor da empresa'),
      vazio: buildTeamVisualReport({ data: { ...team, pessoas: [] }, overview: { ...overview, total: null, ativos: null, encerrados: null }, scope: 'Minha carteira', company: 'Empresa sem dados' }),
      extenso: buildTeamVisualReport({ data: { ...team, pessoas: Array.from({ length: 31 }, (_, i) => ({ ...person(i), nome: `Pessoa ${i + 1} com nome e sobrenomes extensos para conferir o encaixe automático nos cartões e tabelas` })) }, overview, scope: 'Empresa inteira', company: 'Empresa com razão social extensa para conferência de tipografia, identificação e adaptação do relatório gerencial' }),
    };
    for (const [name, report] of Object.entries(reports)) {
      const element = React.createElement(VisualReportPdf, { report });
      const buffer = await renderToBuffer(element as unknown as React.ReactElement<import('@react-pdf/renderer').DocumentProps>);
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
      expect(buffer.length).toBeGreaterThan(3000);
      const boxes = [...buffer.toString('latin1').matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
      expect(boxes.length).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(Number(box[1])).toBeGreaterThan(840);
        expect(Number(box[2])).toBeGreaterThan(594);
      }
      if (process.env.REPORT_VISUAL_QA_DIR) {
        await mkdir(process.env.REPORT_VISUAL_QA_DIR, { recursive: true });
        await writeFile(join(process.env.REPORT_VISUAL_QA_DIR, name + '.pdf'), buffer);
      }
    }
  }, 120000);
});
