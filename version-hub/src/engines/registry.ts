import type { EngineFactory, GameEngineAdapter } from './types';
import type { EngineCapabilities } from '@/services/modResolver';
import { SubwayLabAdapter } from './subwayLabAdapter';

/**
 * Seuls les moteurs réellement implémentés figurent ici. « unity-android-native »
 * et « webgl-generic » sont absents volontairement : aucune build n'est fournie.
 */
const FACTORIES: Record<string, EngineFactory> = {
  'subway-lab': (base) => new SubwayLabAdapter(base),
};

const CAPS: Record<string, EngineCapabilities> = {
  'subway-lab': { engineId: 'subway-lab', engineVersion: '1.0.0', grants: ['render.filter', 'render.overlay'] },
};

export const hasEngine = (engineId: string) => Object.hasOwn(FACTORIES, engineId);
export const engineCapabilities = (engineId: string): EngineCapabilities | null => CAPS[engineId] ?? null;
export function createEngine(engineId: string, baseUrl: string): GameEngineAdapter | null {
  const f = FACTORIES[engineId];
  return f ? f(baseUrl) : null;
}
