import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCatalog, validateEntries, verifyModChecksums, CatalogError } from '@/services/catalog';
import { VersionManifestSchema } from '@/validators/schemas';
import { makeMod, makeVersion } from './fixtures';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('catalogue', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('écarte les entrées invalides et les doublons sans rejeter le reste', () => {
    const r = validateEntries([makeVersion(), { id: 'broken' }, makeVersion(), null], VersionManifestSchema, 'versions');
    expect(r.valid).toHaveLength(1);
    expect(r.rejected.map((x) => x.index)).toEqual([1, 2, 3]);
    expect(r.rejected[1]?.errors).toEqual(['Identifiant en double.']);
    expect(r.rejected[2]?.id).toBeNull();
  });

  it('détecte un mod altéré par sa somme de contrôle', async () => {
    const good = makeMod();
    const tampered = { ...makeMod({ id: 'mod-b' }), effects: [{ type: 'cssFilter' as const, contrast: 1.9 }] };
    const r = await verifyModChecksums([good, tampered]);
    expect(r.valid.map((m) => m.id)).toEqual(['mod-a']);
    expect(r.rejected[0]?.errors[0]).toMatch(/altéré/);
  });

  it('charge un catalogue via fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('versions.json') ? json({ schemaVersion: 1, versions: [makeVersion()] }) : json({ schemaVersion: 1, mods: [makeMod()] }))));
    const c = await loadCatalog('./');
    expect(c.versions).toHaveLength(1);
    expect(c.mods).toHaveLength(1);
    expect(c.rejected).toEqual([]);
  });

  it('signale une enveloppe invalide, une erreur HTTP et une panne réseau', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ nope: true })));
    await expect(loadCatalog('./')).rejects.toBeInstanceOf(CatalogError);
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 503)));
    await expect(loadCatalog('./')).rejects.toThrow(/HTTP 503/);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    await expect(loadCatalog('./')).rejects.toThrow(/Réseau indisponible/);
  });

  const pub = resolve(__dirname, '../public/manifests/mods.json');
  it.runIf(existsSync(pub))('les sommes signées au build correspondent au calcul navigateur', async () => {
    const m = JSON.parse(readFileSync(pub, 'utf8'));
    const r = await verifyModChecksums(m.mods);
    expect(r.rejected).toEqual([]);
  });
});
