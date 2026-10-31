import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ModManifestSchema, VersionManifestSchema, safeRelativePath, ModEffectSchema } from '@/validators/schemas';
import { makeMod, makeVersion } from './fixtures';

describe('validation des manifestes', () => {
  it('accepte un manifeste de version complet', () => {
    expect(VersionManifestSchema.safeParse(makeVersion()).success).toBe(true);
  });
  it('refuse statut inconnu, année hors bornes, identifiant invalide', () => {
    expect(VersionManifestSchema.safeParse({ ...makeVersion(), status: 'ready' }).success).toBe(false);
    expect(VersionManifestSchema.safeParse({ ...makeVersion(), year: 1999 }).success).toBe(false);
    expect(VersionManifestSchema.safeParse({ ...makeVersion(), id: 'Bad ID' }).success).toBe(false);
  });
  it('refuse un champ manquant', () => {
    const { title: _t, ...rest } = makeVersion();
    expect(VersionManifestSchema.safeParse(rest).success).toBe(false);
  });
  it.each(['https://evil.example/x.js', 'javascript:alert(1)', 'data:text/html,x', '/etc/passwd', '../secret', 'a/../../b', 'a b.js', 'x?y=1'])(
    'refuse le chemin dangereux %s',
    (p) => expect(safeRelativePath.safeParse(p).success).toBe(false),
  );
  it('accepte un chemin relatif propre', () => {
    expect(safeRelativePath.safeParse('engines/subway-lab/src/main.js').success).toBe(true);
  });
  it('refuse des effets hors bornes ou avec des clés inconnues (pas de code arbitraire)', () => {
    expect(ModEffectSchema.safeParse({ type: 'cssFilter', contrast: 50 }).success).toBe(false);
    expect(ModEffectSchema.safeParse({ type: 'cssFilter', contrast: 1, script: 'alert(1)' }).success).toBe(false);
    expect(ModEffectSchema.safeParse({ type: 'script', code: 'x' }).success).toBe(false);
  });
  it('accepte un mod valide et refuse un mod sans effet', () => {
    expect(ModManifestSchema.safeParse(makeMod()).success).toBe(true);
    expect(ModManifestSchema.safeParse({ ...makeMod(), effects: [] }).success).toBe(false);
  });

  const pub = resolve(__dirname, '../public/manifests');
  it.runIf(existsSync(pub))('les manifestes générés du dépôt sont tous valides', () => {
    const v = JSON.parse(readFileSync(resolve(pub, 'versions.json'), 'utf8'));
    const m = JSON.parse(readFileSync(resolve(pub, 'mods.json'), 'utf8'));
    for (const x of v.versions) expect(VersionManifestSchema.safeParse(x).error?.issues ?? []).toEqual([]);
    for (const x of m.mods) expect(ModManifestSchema.safeParse(x).error?.issues ?? []).toEqual([]);
  });
});
