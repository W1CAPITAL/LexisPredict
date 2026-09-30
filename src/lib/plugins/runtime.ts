import { planAgentTeam } from '@/lib/agents/studio';
import { searchScreenContext } from '@/lib/context/screenpipe';
import { getComfyHistory, getComfyStatus, queueComfyMedia } from '@/lib/media/comfyui';
import { firecrawlScrape, firecrawlSearch } from '@/lib/research/firecrawl';
import { simulateScenarios } from '@/lib/simulation/scenario-engine';
import { generateWorldChunk, simulateWorld } from '@/lib/simulation/world-engine';
import { findPluginManifest, listPluginStatuses } from './registry';
import type { PluginExecutionContext, PluginExecutionResult } from './types';

function fail(pluginId: string, action: string, error: string): PluginExecutionResult {
  return { ok: false, pluginId, action, error };
}

export async function executePlugin(
  pluginId: string,
  action: string,
  input: any,
  context: PluginExecutionContext
): Promise<PluginExecutionResult> {
  const manifest = findPluginManifest(pluginId);
  if (!manifest) return fail(pluginId, action, 'Plugin não registrado.');
  if (!manifest.actions.includes(action)) return fail(pluginId, action, 'Ação não permitida por este plugin.');

  const status = listPluginStatuses().find((item) => item.manifest.id === pluginId);
  if (!status?.enabled) return fail(pluginId, action, status?.reason || 'Plugin indisponível.');

  try {
    if (pluginId === 'research-firecrawl') {
      if (action === 'search') {
        const result = await firecrawlSearch(String(input?.query || ''), Number(input?.limit || 5));
        return result.ok
          ? { ok: true, pluginId, action, data: result }
          : fail(pluginId, action, result.error || 'Falha na pesquisa.');
      }
      if (action === 'scrape') {
        const result = await firecrawlScrape(String(input?.url || ''));
        return result.ok
          ? { ok: true, pluginId, action, data: result }
          : fail(pluginId, action, result.error || 'Falha no scrape.');
      }
    }

    if (pluginId === 'media-comfy') {
      if (action === 'status') {
        return { ok: true, pluginId, action, data: await getComfyStatus() };
      }
      if (action === 'history') {
        const result = await getComfyHistory(String(input?.promptId || ''));
        return result.ok
          ? { ok: true, pluginId, action, data: result.data }
          : fail(pluginId, action, result.error || 'Histórico indisponível.');
      }
      if (action === 'generate-image' || action === 'generate-video') {
        const result = await queueComfyMedia({
          kind: action === 'generate-video' ? 'video' : 'image',
          prompt: String(input?.prompt || ''),
          negativePrompt: String(input?.negativePrompt || ''),
          width: Number(input?.width),
          height: Number(input?.height),
          frames: Number(input?.frames),
          seed: Number.isFinite(Number(input?.seed)) ? Number(input.seed) : undefined,
        });
        return result.ok
          ? { ok: true, pluginId, action, data: result }
          : fail(pluginId, action, result.error || 'Geração não enfileirada.');
      }
    }

    if (pluginId === 'scenario-simulator' && action === 'run') {
      return {
        ok: true,
        pluginId,
        action,
        data: simulateScenarios({
          seed: input?.seed,
          iterations: input?.iterations,
          options: Array.isArray(input?.options) ? input.options : [],
        }),
      };
    }

    if (pluginId === 'world-sandbox') {
      if (action === 'chunk') {
        return {
          ok: true,
          pluginId,
          action,
          data: generateWorldChunk(
            input?.seed,
            Number(input?.chunkX || 0),
            Number(input?.chunkZ || 0),
            Number(input?.size || 16),
            Array.isArray(input?.edits) ? input.edits : []
          ),
        };
      }
      if (action === 'simulate') {
        return {
          ok: true,
          pluginId,
          action,
          data: simulateWorld({
            seed: input?.seed,
            ticks: input?.ticks,
            agents: input?.agents,
            goals: Array.isArray(input?.goals) ? input.goals : undefined,
            edits: Array.isArray(input?.edits) ? input.edits : undefined,
          }),
        };
      }
    }

    if (pluginId === 'screen-context' && action === 'search') {
      const result = await searchScreenContext({
        query: String(input?.query || ''),
        limit: Number(input?.limit || 10),
        contentType:
          input?.contentType === 'audio' || input?.contentType === 'ocr'
            ? input.contentType
            : 'all',
        startTime: input?.startTime ? String(input.startTime) : undefined,
      });
      return result.ok
        ? { ok: true, pluginId, action, data: result }
        : fail(pluginId, action, result.error || 'Screenpipe indisponível.');
    }

    if (pluginId === 'agent-studio' && action === 'plan-team') {
      return { ok: true, pluginId, action, data: planAgentTeam(String(input?.goal || '')) };
    }

    if (action === 'status') {
      return {
        ok: true,
        pluginId,
        action,
        data: {
          configured: status.configured,
          enabled: status.enabled,
          runtime: manifest.runtime,
          permissions: manifest.permissions,
          empresaScoped: Boolean(context.empresaId),
        },
      };
    }

    return fail(pluginId, action, 'Ação registrada, mas ainda sem executor.');
  } catch (error: any) {
    return fail(pluginId, action, error?.message || 'Falha de execução do plugin.');
  }
}
