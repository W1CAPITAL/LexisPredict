export type WorldBiome =
  | 'ocean'
  | 'beach'
  | 'plains'
  | 'forest'
  | 'desert'
  | 'swamp'
  | 'mountain'
  | 'snow';

export type WorldResource = 'wood' | 'stone' | 'coal' | 'iron' | 'food' | 'water' | null;

export type WorldTile = {
  x: number;
  z: number;
  height: number;
  biome: WorldBiome;
  resource: WorldResource;
  walkable: boolean;
  marker?: string | null;
};

export type WorldEdit = {
  x: number;
  z: number;
  biome?: WorldBiome;
  resource?: WorldResource;
  walkable?: boolean;
  height?: number;
  marker?: string | null;
};

export type WorldChunk = {
  seed: number;
  chunkX: number;
  chunkZ: number;
  size: number;
  tiles: WorldTile[];
};

export type WorldAgentGoal = 'explore' | 'gather' | 'build';

export type WorldAgent = {
  id: string;
  x: number;
  z: number;
  goal: WorldAgentGoal;
  energy: number;
  inventory: Record<'wood' | 'stone' | 'coal' | 'iron' | 'food' | 'water', number>;
  structures: number;
  distance: number;
};

export type WorldSimulationInput = {
  seed?: string | number;
  ticks?: number;
  agents?: number;
  goals?: WorldAgentGoal[];
  edits?: WorldEdit[];
};

export type WorldSimulationResult = {
  seed: number;
  ticks: number;
  agents: WorldAgent[];
  totals: {
    gathered: number;
    structures: number;
    distance: number;
  };
  samples: Array<{
    tick: number;
    agents: Array<Pick<WorldAgent, 'id' | 'x' | 'z' | 'goal' | 'structures'>>;
  }>;
};

function seedHash(value: string | number | undefined): number {
  const raw = String(value ?? 'lexis-world');
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hash2(seed: number, x: number, z: number, salt = 0): number {
  let h = seed ^ Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(z | 0, 0x119de1f3) ^ salt;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

function unit(seed: number, x: number, z: number, salt = 0): number {
  return hash2(seed, x, z, salt) / 0xffffffff;
}

function smoothNoise(seed: number, x: number, z: number, scale: number, salt: number): number {
  const fx = x / scale;
  const fz = z / scale;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = fx - x0;
  const tz = fz - z0;
  const fade = (t: number) => t * t * (3 - 2 * t);
  const sx = fade(tx);
  const sz = fade(tz);
  const a = unit(seed, x0, z0, salt);
  const b = unit(seed, x0 + 1, z0, salt);
  const c = unit(seed, x0, z0 + 1, salt);
  const d = unit(seed, x0 + 1, z0 + 1, salt);
  const ab = a + (b - a) * sx;
  const cd = c + (d - c) * sx;
  return ab + (cd - ab) * sz;
}

function fractal(seed: number, x: number, z: number, salt = 0): number {
  return (
    smoothNoise(seed, x, z, 96, salt) * 0.52 +
    smoothNoise(seed, x, z, 38, salt + 11) * 0.28 +
    smoothNoise(seed, x, z, 14, salt + 29) * 0.14 +
    smoothNoise(seed, x, z, 5, salt + 47) * 0.06
  );
}

function classifyBiome(height: number, temperature: number, moisture: number): WorldBiome {
  if (height < 0.29) return 'ocean';
  if (height < 0.34) return 'beach';
  if (height > 0.79 && temperature < 0.55) return 'snow';
  if (height > 0.72) return 'mountain';
  if (temperature > 0.67 && moisture < 0.38) return 'desert';
  if (moisture > 0.72 && height < 0.52) return 'swamp';
  if (moisture > 0.54) return 'forest';
  return 'plains';
}

function pickResource(seed: number, x: number, z: number, biome: WorldBiome, height: number): WorldResource {
  const r = unit(seed, x, z, 911);
  const rare = unit(seed, x, z, 1337);
  if (biome === 'ocean' || biome === 'swamp') return r > 0.72 ? 'water' : null;
  if (biome === 'forest') {
    if (r > 0.52) return 'wood';
    if (r < 0.07) return 'food';
  }
  if (biome === 'plains' && r < 0.10) return 'food';
  if (biome === 'mountain' || height > 0.66) {
    if (rare > 0.965) return 'iron';
    if (rare > 0.90) return 'coal';
    if (r > 0.56) return 'stone';
  }
  if (biome === 'snow' && r > 0.82) return 'stone';
  if (biome === 'desert' && rare > 0.985) return 'iron';
  return null;
}

export function getWorldTile(seedInput: string | number | undefined, x: number, z: number): WorldTile {
  const seed = seedHash(seedInput);
  const height = fractal(seed, x, z, 101);
  const temperature = fractal(seed, x, z, 303);
  const moisture = fractal(seed, x, z, 707);
  const biome = classifyBiome(height, temperature, moisture);
  return {
    x,
    z,
    height,
    biome,
    resource: pickResource(seed, x, z, biome, height),
    walkable: biome !== 'ocean',
  };
}

export function generateWorldChunk(
  seedInput: string | number | undefined,
  chunkX: number,
  chunkZ: number,
  size = 16,
  edits: WorldEdit[] = []
): WorldChunk {
  const safeSize = Math.max(4, Math.min(32, Math.floor(size || 16)));
  const seed = seedHash(seedInput);
  const tiles: WorldTile[] = [];
  const startX = Math.floor(chunkX) * safeSize;
  const startZ = Math.floor(chunkZ) * safeSize;

  for (let dz = 0; dz < safeSize; dz += 1) {
    for (let dx = 0; dx < safeSize; dx += 1) {
      tiles.push(getWorldTile(seed, startX + dx, startZ + dz));
    }
  }

  const editMap = new Map(edits.map((edit) => [edit.x + ':' + edit.z, edit]));
  const merged = tiles.map((tile) => {
    const edit = editMap.get(tile.x + ':' + tile.z);
    if (!edit) return tile;
    return {
      ...tile,
      ...(edit.biome ? { biome: edit.biome } : {}),
      ...(edit.resource !== undefined ? { resource: edit.resource } : {}),
      ...(typeof edit.walkable === 'boolean' ? { walkable: edit.walkable } : {}),
      ...(Number.isFinite(edit.height) ? { height: Number(edit.height) } : {}),
      ...(edit.marker !== undefined ? { marker: edit.marker } : {}),
    };
  });

  return {
    seed,
    chunkX: Math.floor(chunkX),
    chunkZ: Math.floor(chunkZ),
    size: safeSize,
    tiles: merged,
  };
}

function emptyInventory(): WorldAgent['inventory'] {
  return { wood: 0, stone: 0, coal: 0, iron: 0, food: 0, water: 0 };
}

function goalScore(agent: WorldAgent, tile: WorldTile): number {
  let score = tile.walkable ? 0.5 : -10;
  if (agent.goal === 'explore') {
    score += tile.height * 0.2;
    score += tile.biome === 'mountain' || tile.biome === 'forest' ? 0.15 : 0;
  }
  if (agent.goal === 'gather') {
    score += tile.resource ? 1.5 : 0;
    if (tile.resource === 'food' && agent.energy < 55) score += 1;
  }
  if (agent.goal === 'build') {
    score += tile.biome === 'plains' || tile.biome === 'forest' ? 0.8 : 0;
    score += tile.resource === 'wood' || tile.resource === 'stone' ? 0.7 : 0;
  }
  return score;
}

function deterministicChoice(seed: number, tick: number, agent: WorldAgent, candidates: WorldTile[]): WorldTile {
  const ranked = candidates
    .map((tile) => ({
      tile,
      score:
        goalScore(agent, tile) +
        unit(seed, tile.x + tick * 17, tile.z - tick * 13, hash2(seed, tick, agent.id.length, 19)) * 0.24,
    }))
    .sort((a, b) => b.score - a.score);
  return ranked[0].tile;
}

function maybeGather(agent: WorldAgent, tile: WorldTile, seed: number, tick: number) {
  const resource = tile.resource;
  if (!resource) return;
  const chance = unit(seed, tile.x + tick, tile.z - tick, agent.id.length * 31);
  if (chance < 0.58) {
    agent.inventory[resource] += 1;
    if (resource === 'food') agent.energy = Math.min(100, agent.energy + 8);
  }
}

function maybeBuild(agent: WorldAgent, seed: number, tick: number) {
  if (agent.goal !== 'build') return;
  const material = agent.inventory.wood + agent.inventory.stone;
  if (material < 4) return;
  if (unit(seed, agent.x + tick, agent.z, 5150) < 0.16) {
    if (agent.inventory.wood >= 2) agent.inventory.wood -= 2;
    else agent.inventory.stone -= 2;
    agent.structures += 1;
  }
}

export function simulateWorld(input: WorldSimulationInput): WorldSimulationResult {
  const seed = seedHash(input.seed);
  const ticks = Math.max(1, Math.min(1000, Math.floor(Number(input.ticks) || 100)));
  const count = Math.max(1, Math.min(64, Math.floor(Number(input.agents) || 6)));
  const goals = input.goals?.length ? input.goals : (['explore', 'gather', 'build'] as WorldAgentGoal[]);

  const editMap = new Map((input.edits || []).map((edit) => [edit.x + ':' + edit.z, edit]));
  const tileAt = (x: number, z: number): WorldTile => {
    const tile = getWorldTile(seed, x, z);
    const edit = editMap.get(x + ':' + z);
    if (!edit) return tile;
    return {
      ...tile,
      ...(edit.biome ? { biome: edit.biome } : {}),
      ...(edit.resource !== undefined ? { resource: edit.resource } : {}),
      ...(typeof edit.walkable === 'boolean' ? { walkable: edit.walkable } : {}),
      ...(Number.isFinite(edit.height) ? { height: Number(edit.height) } : {}),
      ...(edit.marker !== undefined ? { marker: edit.marker } : {}),
    };
  };

  const agents: WorldAgent[] = Array.from({ length: count }, (_, i) => {
    const angle = (i / Math.max(1, count)) * Math.PI * 2;
    return {
      id: `agent-${i + 1}`,
      x: Math.round(Math.cos(angle) * 3),
      z: Math.round(Math.sin(angle) * 3),
      goal: goals[i % goals.length],
      energy: 100,
      inventory: emptyInventory(),
      structures: 0,
      distance: 0,
    };
  });

  const samples: WorldSimulationResult['samples'] = [];

  for (let tick = 0; tick < ticks; tick += 1) {
    for (const agent of agents) {
      const dirs = [
        [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
      ];
      const candidates = dirs.map(([dx, dz]) => tileAt(agent.x + dx, agent.z + dz));
      const next = deterministicChoice(seed, tick, agent, candidates);
      const moved = next.x !== agent.x || next.z !== agent.z;
      if (moved) {
        agent.x = next.x;
        agent.z = next.z;
        agent.distance += 1;
        agent.energy = Math.max(0, agent.energy - 0.35);
      }

      maybeGather(agent, next, seed, tick);
      maybeBuild(agent, seed, tick);

      if (agent.energy < 20 && agent.inventory.food > 0) {
        agent.inventory.food -= 1;
        agent.energy = Math.min(100, agent.energy + 35);
      }
    }

    if (tick === 0 || tick === ticks - 1 || tick % Math.max(1, Math.floor(ticks / 10)) === 0) {
      samples.push({
        tick,
        agents: agents.map(({ id, x, z, goal, structures }) => ({ id, x, z, goal, structures })),
      });
    }
  }

  const gathered = agents.reduce(
    (sum, agent) => sum + Object.values(agent.inventory).reduce((a, b) => a + b, 0),
    0
  );

  return {
    seed,
    ticks,
    agents,
    totals: {
      gathered,
      structures: agents.reduce((sum, agent) => sum + agent.structures, 0),
      distance: agents.reduce((sum, agent) => sum + agent.distance, 0),
    },
    samples,
  };
}
