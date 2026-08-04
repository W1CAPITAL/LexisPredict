'use server';

import {
  AI_ENGINES_CATALOG,
  resolveOfficialKeysPresent,
  type AiEngineDef,
} from '@/lib/ai-engines-catalog';

export async function getNeuralNucleusStatusAction() {
  const keys = resolveOfficialKeysPresent();
  const engines = AI_ENGINES_CATALOG.map((e) => ({
    ...e,
    configured:
      e.kind === 'lexis' ||
      e.kind === 'puter' ||
      (e.kind === 'official' && !!keys[e.id]),
  }));
  return {
    success: true,
    engines,
    keys,
    generatedAt: new Date().toISOString(),
  };
}

/** Catálogo serializável para cliente (sem process.env) */
export async function listAiEnginesAction(surface?: AiEngineDef['surfaces'][number]) {
  const list = surface
    ? AI_ENGINES_CATALOG.filter((e) => e.surfaces.includes(surface))
    : AI_ENGINES_CATALOG;
  return { success: true, engines: list };
}
