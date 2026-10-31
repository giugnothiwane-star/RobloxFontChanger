import type { GraphicsProfile } from '@/validators/schemas';

export type ConcreteProfile = Exclude<GraphicsProfile, 'auto'>;

export const RENDER_SCALE: Record<ConcreteProfile, number> = { low: 0.6, medium: 0.8, high: 1 };

export interface DeviceHints {
  cores: number | null;
  memoryGb: number | null;
  pixels: number | null;
  saveData: boolean;
}

export function readDeviceHints(): DeviceHints {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }) : null;
  const pixels = typeof window !== 'undefined' ? Math.round(window.screen.width * window.screen.height * (window.devicePixelRatio || 1) ** 2) : null;
  return {
    cores: nav?.hardwareConcurrency ?? null,
    memoryGb: nav?.deviceMemory ?? null,
    pixels,
    saveData: Boolean(nav?.connection?.saveData),
  };
}

/**
 * Heuristique AUTO : indices matériels exposés par le navigateur (souvent arrondis
 * ou absents). Ce n'est pas un benchmark ; l'utilisateur peut toujours forcer un profil.
 */
export function resolveAutoProfile(h: DeviceHints): ConcreteProfile {
  if (h.saveData) return 'low';
  let score = 0;
  if (h.cores !== null) score += h.cores >= 8 ? 2 : h.cores >= 4 ? 1 : 0;
  else score += 1;
  if (h.memoryGb !== null) score += h.memoryGb >= 6 ? 2 : h.memoryGb >= 3 ? 1 : 0;
  else score += 1;
  // Écrans très denses : coût de remplissage élevé sur GPU mobile.
  if (h.pixels !== null && h.pixels > 3_500_000) score -= 1;
  return score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
}

export function concreteProfile(p: GraphicsProfile, hints: DeviceHints = readDeviceHints()): ConcreteProfile {
  return p === 'auto' ? resolveAutoProfile(hints) : p;
}
