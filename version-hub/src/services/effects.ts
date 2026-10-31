import type { ModManifest } from '@/validators/schemas';

export interface ComposedEffects {
  filter: string;
  overlays: { pattern: 'scanlines' | 'vignette' | 'letterbox'; opacity: number }[];
  volume: number | null;
  engineParams: Record<string, boolean | number | string>;
}

/**
 * Compose les effets déclaratifs dans l'ordre résolu. Les filtres CSS sont
 * multiplicatifs, la rotation de teinte additive ; les bornes du schéma garantissent
 * qu'aucune valeur ne sort des plages raisonnables.
 */
export function composeEffects(order: readonly string[], registry: ReadonlyMap<string, ModManifest>): ComposedEffects {
  let brightness = 1, contrast = 1, saturate = 1, hue = 0, gray = 0;
  const overlays: ComposedEffects['overlays'] = [];
  let volume: number | null = null;
  const engineParams: ComposedEffects['engineParams'] = {};
  for (const id of order) {
    for (const e of registry.get(id)?.effects ?? []) {
      switch (e.type) {
        case 'cssFilter':
          brightness *= e.brightness ?? 1;
          contrast *= e.contrast ?? 1;
          saturate *= e.saturate ?? 1;
          hue += e.hueRotate ?? 0;
          gray = Math.max(gray, e.grayscale ?? 0);
          break;
        case 'overlay':
          if (!overlays.some((o) => o.pattern === e.pattern)) overlays.push({ pattern: e.pattern, opacity: e.opacity });
          break;
        case 'audio':
          volume = volume === null ? e.volume : Math.min(volume, e.volume);
          break;
        case 'engineParam':
          engineParams[e.key] = e.value;
          break;
      }
    }
  }
  const parts: string[] = [];
  const r = (n: number) => Math.round(n * 1000) / 1000;
  if (brightness !== 1) parts.push(`brightness(${r(brightness)})`);
  if (contrast !== 1) parts.push(`contrast(${r(contrast)})`);
  if (saturate !== 1) parts.push(`saturate(${r(saturate)})`);
  if (hue !== 0) parts.push(`hue-rotate(${r(hue)}deg)`);
  if (gray > 0) parts.push(`grayscale(${r(gray)})`);
  return { filter: parts.join(' '), overlays, volume, engineParams };
}
