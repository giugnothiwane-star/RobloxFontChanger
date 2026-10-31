import { checkModStandalone, planActivation, planDeactivation, resolveModSet, type EngineCapabilities } from '@/services/modResolver';
import { composeEffects } from '@/services/effects';
import type { ModManifest } from '@/validators/schemas';
import { makeMod, makeVersion } from './fixtures';

const caps: EngineCapabilities = { engineId: 'subway-lab', engineVersion: '1.0.0', grants: ['render.filter', 'render.overlay'] };
const mods = [
  makeMod({ id: 'base', name: 'Base', permissions: ['render.overlay'], effects: [{ type: 'overlay', pattern: 'scanlines', opacity: 0.2 }] }),
  makeMod({ id: 'pack', name: 'Pack', dependencies: [{ id: 'base', range: '^1.0.0' }] }),
  makeMod({ id: 'pack-v2', name: 'Pack v2', dependencies: [{ id: 'base', range: '^2.0.0' }] }),
  makeMod({ id: 'gray', name: 'Gray', effects: [{ type: 'cssFilter', grayscale: 1 }], conflicts: [{ id: 'tint', reason: 'saturation' }] }),
  makeMod({ id: 'tint', name: 'Tint', effects: [{ type: 'cssFilter', hueRotate: 10 }], conflicts: [{ id: 'gray', reason: 'saturation' }] }),
  makeMod({ id: 'audio', name: 'Audio', permissions: ['audio.volume'], effects: [{ type: 'audio', volume: 0 }] }),
  makeMod({ id: 'sneaky', name: 'Sneaky', permissions: [], effects: [{ type: 'cssFilter', contrast: 1.1 }] }),
  makeMod({ id: 'unity', name: 'Unity only', compatibility: [{ engineId: 'unity-android-native', range: '*' }] }),
  makeMod({ id: 'future', name: 'Future', compatibility: [{ engineId: 'subway-lab', range: '^2.0.0' }] }),
  makeMod({ id: 'cyc-a', name: 'A', dependencies: [{ id: 'cyc-b', range: '*' }] }),
  makeMod({ id: 'cyc-b', name: 'B', dependencies: [{ id: 'cyc-a', range: '*' }] }),
  makeMod({ id: 'withasset', name: 'Asset', assets: [{ path: 'x.png', sha256: 'b'.repeat(64), required: true }] }),
];
const registry = new Map<string, ModManifest>(mods.map((m) => [m.id, m]));
const version = makeVersion({ supportedMods: mods.map((m) => m.id) });
const codes = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code);

describe('gestion des mods', () => {
  it('accepte un ensemble valide et ordonne les dépendances en premier', () => {
    const r = resolveModSet(['pack', 'base'], registry, version, caps);
    expect(r.ok).toBe(true);
    expect(r.order).toEqual(['base', 'pack']);
  });
  it('mod inconnu', () => expect(codes(resolveModSet(['ghost'], registry, version, caps))).toEqual(['unknown-mod']));
  it('mod non déclaré par la version', () => {
    expect(codes({ issues: checkModStandalone('base', registry, makeVersion(), caps) })).toContain('not-supported-by-version');
  });
  it('dépendance manquante et version de dépendance', () => {
    expect(codes(resolveModSet(['pack'], registry, version, caps))).toEqual(['missing-dependency']);
    expect(codes(resolveModSet(['pack-v2', 'base'], registry, version, caps))).toEqual(['dependency-version']);
  });
  it('conflit signalé une seule fois avec la raison', () => {
    const r = resolveModSet(['gray', 'tint'], registry, version, caps);
    expect(codes(r)).toEqual(['conflict']);
    expect(r.issues[0]?.message).toMatch(/saturation/);
  });
  it('permissions : non déclarée, et refusée par le moteur', () => {
    expect(codes(resolveModSet(['sneaky'], registry, version, caps))).toEqual(['permission-undeclared']);
    expect(codes(resolveModSet(['audio'], registry, version, caps))).toEqual(['permission-denied']);
    expect(codes(resolveModSet(['base'], registry, version, null))).toEqual(['permission-denied']);
  });
  it('moteur ou version de moteur incompatible', () => {
    expect(codes(resolveModSet(['unity'], registry, version, caps))).toEqual(['engine-incompatible']);
    expect(codes(resolveModSet(['future'], registry, version, caps))).toEqual(['engine-incompatible']);
  });
  it('ressources requises non fournies', () => expect(codes(resolveModSet(['withasset'], registry, version, caps))).toEqual(['assets-missing']));
  it('détecte les dépendances circulaires sans boucle infinie', () => {
    const r = resolveModSet(['cyc-a', 'cyc-b'], registry, version, caps);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => /circulaire/.test(i.message))).toBe(true);
  });
  it('planActivation ajoute les dépendances, refuse les conflits', () => {
    const p = planActivation('pack', [], registry, version, caps);
    expect(p).toEqual({ ok: true, next: ['base', 'pack'], added: ['base'] });
    const c = planActivation('tint', ['gray'], registry, version, caps);
    expect(c.ok).toBe(false);
  });
  it('planDeactivation retire les dépendants', () => {
    expect(planDeactivation('base', ['base', 'pack', 'gray'], registry)).toEqual({ next: ['gray'], removed: ['pack'] });
  });
  it('compose les effets déclaratifs', () => {
    const e = composeEffects(['base', 'gray', 'tint', 'audio'], registry);
    expect(e.filter).toBe('hue-rotate(10deg) grayscale(1)');
    expect(e.overlays).toEqual([{ pattern: 'scanlines', opacity: 0.2 }]);
    expect(e.volume).toBe(0);
    expect(composeEffects([], registry).filter).toBe('');
  });
});
