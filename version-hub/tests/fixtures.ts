import { createHash } from 'node:crypto';
import type { ModManifest, VersionManifest } from '@/validators/schemas';
import { canonical } from '@/utils/hash';

export const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');

export function makeVersion(p: Partial<VersionManifest> = {}): VersionManifest {
  return {
    id: 'v-test',
    title: 'Test',
    kind: 'original-prototype',
    year: 2020,
    releaseDate: null,
    dateConfidence: 'unknown',
    city: 'Ville',
    description: 'desc',
    engineId: 'subway-lab',
    engineVersion: '1.0.0',
    assets: [],
    assetIndex: 'engines/subway-lab/integrity.json',
    assetIndexSha256: 'a'.repeat(64),
    supportedMods: [],
    compatibility: { mobile: true, desktop: true, touch: true, keyboard: true },
    status: 'playable',
    recommendedGraphics: 'auto',
    incompatibilities: [],
    thumbnail: { kind: 'gradient', from: '#000000', to: '#ffffff', label: 'T' },
    screenshots: [],
    manifestVersion: 1,
    updatedAt: '2026-01-01',
    ...p,
  };
}

export function makeMod(p: Partial<ModManifest> = {}): ModManifest {
  const base: ModManifest = {
    id: 'mod-a',
    name: 'Mod A',
    version: '1.0.0',
    category: 'graphics',
    description: 'd',
    author: 'x',
    license: 'MIT',
    compatibility: [{ engineId: 'subway-lab', range: '^1.0.0' }],
    dependencies: [],
    conflicts: [],
    assets: [],
    permissions: ['render.filter'],
    effects: [{ type: 'cssFilter', contrast: 1.2 }],
    experimental: false,
    checksum: '',
    ...p,
  };
  return { ...base, checksum: p.checksum ?? sha(canonical(base.effects)) };
}
