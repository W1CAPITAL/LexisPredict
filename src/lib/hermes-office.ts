/**
 * Hermes3D-inspired LexisPredict virtual office.
 *
 * This is a read-only visualization of EXISTING Lexis playbooks, not an
 * agent runtime. Only a real authenticated backend can report live status.
 */
import { ROUTE_PLAYBOOKS } from '@/lib/agent-improvements/route-playbooks';

const FLOOR_PLAN = [
  { id: 'processos', x: 20, y: 22, color: '#c19cab', glyph: '01' },
  { id: 'provas', x: 44, y: 20, color: '#d8b98f', glyph: '02' },
  { id: 'operacao', x: 70, y: 23, color: '#93b4ca', glyph: '03' },
  { id: 'comunicacoes', x: 20, y: 48, color: '#cca3bc', glyph: '04' },
  { id: 'relatorios', x: 70, y: 49, color: '#a0c7be', glyph: '05' },
  { id: 'agentes', x: 21, y: 73, color: '#dca4b3', glyph: '06' },
  { id: 'crm', x: 47, y: 76, color: '#bdb3d3', glyph: '07' },
  { id: 'gestao', x: 76, y: 77, color: '#d3c4a7', glyph: '08' },
] as const;

export type HermesOfficeStation = {
  id: string;
  title: string;
  description: string;
  specialist: string;
  href: string;
  requiresReview: boolean;
  color: string;
  glyph: string;
  x: number;
  y: number;
};

export function getHermesOfficeStations(): HermesOfficeStation[] {
  return FLOOR_PLAN.flatMap((room) => {
    const playbook = ROUTE_PLAYBOOKS.find((entry) => entry.id === room.id);
    if (!playbook || !playbook.specialists.length || !playbook.routes.length) return [];
    return [{
      ...room,
      title: playbook.title,
      description: playbook.description,
      specialist: playbook.specialists[0],
      href: playbook.routes[0],
      requiresReview: playbook.requiresReview,
    }];
  });
}
