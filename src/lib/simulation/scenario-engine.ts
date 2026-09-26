export type SimulationFactor = {
  name: string;
  min: number;
  likely: number;
  max: number;
  weight?: number;
};

export type SimulationOption = {
  id: string;
  label: string;
  baseScore?: number;
  factors: SimulationFactor[];
};

export type SimulationInput = {
  seed?: string | number;
  iterations?: number;
  options: SimulationOption[];
};

export type SimulationOptionResult = {
  id: string;
  label: string;
  mean: number;
  p10: number;
  p50: number;
  p90: number;
  topRate: number;
};

export type SimulationResult = {
  seed: number;
  iterations: number;
  options: SimulationOptionResult[];
};

function hashSeed(value: string | number | undefined): number {
  const raw = String(value ?? 'lexispredict');
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function triangular(rng: () => number, min: number, mode: number, max: number): number {
  if (!(min <= mode && mode <= max) || min === max) return min;
  const u = rng();
  const c = (mode - min) / (max - min);
  if (u < c) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * p)));
  return sorted[idx];
}

function finite(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function simulateScenarios(input: SimulationInput): SimulationResult {
  const options = (input.options || []).slice(0, 12).map((option, index) => {
    if (!option?.id || !option?.label) throw new Error(`Opção ${index + 1} sem id/label.`);
    const factors = (option.factors || []).slice(0, 24).map((factor, factorIndex) => {
      const min = finite(factor.min);
      const likely = finite(factor.likely);
      const max = finite(factor.max);
      if (!(min <= likely && likely <= max)) {
        throw new Error(`Fator "${factor.name || factorIndex + 1}" deve respeitar min <= likely <= max.`);
      }
      return {
        name: String(factor.name || `fator-${factorIndex + 1}`),
        min,
        likely,
        max,
        weight: finite(factor.weight, 1),
      };
    });
    return {
      id: String(option.id).slice(0, 80),
      label: String(option.label).slice(0, 160),
      baseScore: finite(option.baseScore),
      factors,
    };
  });

  if (options.length < 2) throw new Error('O simulador precisa de pelo menos duas opções.');

  const iterations = Math.max(100, Math.min(20_000, Math.floor(finite(input.iterations, 5_000))));
  const seed = hashSeed(input.seed);
  const rng = mulberry32(seed);
  const scores = new Map<string, number[]>(options.map((o) => [o.id, []]));
  const wins = new Map<string, number>(options.map((o) => [o.id, 0]));

  for (let i = 0; i < iterations; i += 1) {
    let topId = options[0].id;
    let topScore = -Infinity;

    for (const option of options) {
      let score = option.baseScore;
      for (const factor of option.factors) {
        score += triangular(rng, factor.min, factor.likely, factor.max) * factor.weight;
      }
      scores.get(option.id)!.push(score);
      if (score > topScore) {
        topScore = score;
        topId = option.id;
      }
    }
    wins.set(topId, (wins.get(topId) || 0) + 1);
  }

  return {
    seed,
    iterations,
    options: options.map((option) => {
      const arr = scores.get(option.id)!.sort((a,b) => a - b);
      const mean = arr.reduce((sum, value) => sum + value, 0) / arr.length;
      return {
        id: option.id,
        label: option.label,
        mean,
        p10: percentile(arr, 0.10),
        p50: percentile(arr, 0.50),
        p90: percentile(arr, 0.90),
        topRate: (wins.get(option.id) || 0) / iterations,
      };
    }),
  };
}
