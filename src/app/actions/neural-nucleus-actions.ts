'use server';

import {
  AI_ENGINES_CATALOG,
  resolveOfficialKeysPresent,
  type AiEngineDef,
} from '@/lib/ai-engines-catalog';

export async function getNeuralNucleusStatusAction() {
  const keys = resolveOfficialKeysPresent();
  const engines = AI_ENGINES_CATALOG.map((e: AiEngineDef) => ({
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
    preferredDefault: 'claude',
    generatedAt: new Date().toISOString(),
  };
}

export async function listAiEnginesAction(surface?: 'ba' | 'scan' | 'chat' | 'veredito' | 'all') {
  const list = surface
    ? AI_ENGINES_CATALOG.filter((e: AiEngineDef) => ((e.surfaces || ["all"]) as string[]).includes(surface))
    : AI_ENGINES_CATALOG;
  return { success: true, engines: list };
}
