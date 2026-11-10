import { describe, expect, it } from 'vitest';
import { ROUTE_PLAYBOOKS } from '@/lib/agent-improvements/route-playbooks';
import { getHermesOfficeStations } from '@/lib/hermes-office';

describe('Hermes3D Lexis office roster', () => {
  it('builds the stations from the existing LexisPredict route playbooks', () => {
    const stations = getHermesOfficeStations();
    expect(stations).toHaveLength(8);
    expect(new Set(stations.map(station => station.id)).size).toBe(stations.length);

    for (const station of stations) {
      const source = ROUTE_PLAYBOOKS.find(playbook => playbook.id === station.id);
      expect(source).toBeDefined();
      expect(station.title).toBe(source?.title);
      expect(station.specialist).toBe(source?.specialists[0]);
      expect(source?.routes).toContain(station.href);
      expect(station.href.startsWith('/')).toBe(true);
    }
  });

  it('does not invent live or running agent statuses', () => {
    const stations = getHermesOfficeStations();
    for (const station of stations) {
      expect(station).not.toHaveProperty('online');
      expect(station).not.toHaveProperty('running');
      expect(station).not.toHaveProperty('lastActivity');
    }
  });

  it('keeps 3D station coordinates within the visible office floor', () => {
    for (const station of getHermesOfficeStations()) {
      expect(station.x).toBeGreaterThanOrEqual(12);
      expect(station.x).toBeLessThanOrEqual(88);
      expect(station.y).toBeGreaterThanOrEqual(14);
      expect(station.y).toBeLessThanOrEqual(86);
    }
  });
});
