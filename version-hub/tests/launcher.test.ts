import { launch, type LaunchProgress, type LaunchRequest } from '@/services/launcher';
import { LaunchError } from '@/services/errors';
import { verifyAssets } from '@/engines/assetLoader';
import type { GameEngineAdapter } from '@/engines/types';
import type { AssetIndex, ModManifest } from '@/validators/schemas';
import { makeMod, makeVersion, sha } from './fixtures';

const FILE = 'hello engine';
const index: AssetIndex = { engineId: 'subway-lab', engineVersion: '1.0.0', entry: 'index.html', files: [{ path: 'index.html', sha256: sha(FILE), size: FILE.length }] };
const indexText = JSON.stringify(index);

function fakeEngine(over: Partial<GameEngineAdapter> = {}) {
  const calls: string[] = [];
  const e: GameEngineAdapter = {
    engineId: 'subway-lab',
    engineVersion: '1.0.0',
    grants: ['render.filter', 'render.overlay'],
    hasAudio: false,
    loadAssets: async (_i, p) => { calls.push('loadAssets'); p({ done: 1, total: 1, bytes: 1 }); },
    initialize: async () => { calls.push('initialize'); },
    applyConfiguration: () => { calls.push('apply'); },
    start: () => { calls.push('start'); },
    pause: async () => true,
    resume: async () => true,
    resize: () => { calls.push('resize'); },
    dispose: () => { calls.push('dispose'); },
    ...over,
  };
  return { e, calls };
}

function req(p: Partial<LaunchRequest> & { engine?: GameEngineAdapter | null; indexBody?: string; indexStatus?: number } = {}): LaunchRequest & { progress: LaunchProgress[] } {
  const progress: LaunchProgress[] = [];
  const container = document.createElement('div');
  document.body.appendChild(container);
  const body = p.indexBody ?? indexText;
  const engine = p.engine === undefined ? fakeEngine().e : p.engine;
  return {
    version: makeVersion({ assetIndexSha256: sha(body) }),
    mods: [],
    registry: new Map(),
    createEngine: () => engine,
    capabilities: () => ({ engineId: 'subway-lab', engineVersion: '1.0.0', grants: ['render.filter', 'render.overlay'] }),
    container,
    config: { renderScale: 1, volume: 1, touchControls: true },
    baseUrl: './',
    signal: new AbortController().signal,
    onProgress: (x) => progress.push(x),
    fetchImpl: (async () => new Response(body, { status: p.indexStatus ?? 200 })) as typeof fetch,
    progress,
    ...p,
  };
}

const code = async (pr: Promise<unknown>) => {
  try {
    await pr;
    return 'resolved';
  } catch (e) {
    return (e as LaunchError).code;
  }
};

describe('moteur de lancement', () => {
  it("exécute toutes les étapes dans l'ordre et n'atteint 100 % qu'à la fin", async () => {
    const { e, calls } = fakeEngine();
    const r = req({ engine: e });
    const res = await launch(r);
    expect(calls).toEqual(['loadAssets', 'initialize', 'apply', 'resize', 'start']);
    const ratios = r.progress.map((p) => p.ratio);
    expect(ratios.every((x, i) => i === 0 || x >= (ratios[i - 1] ?? 0))).toBe(true);
    expect(ratios.slice(0, -1).every((x) => x < 1)).toBe(true);
    expect(ratios.at(-1)).toBe(1);
    expect(res.appliedMods).toEqual([]);
  });

  it('refuse une version indisponible sans créer de moteur', async () => {
    const factory = vi.fn();
    const r = { ...req(), version: makeVersion({ status: 'unavailable' }), createEngine: factory };
    expect(await code(launch(r))).toBe('version-unavailable');
    expect(factory).not.toHaveBeenCalled();
  });

  it('statut jouable déclaré mais moteur absent → incompatible', async () => {
    const r = { ...req(), version: makeVersion({ engineId: 'unity-android-native', assetIndexSha256: 'a'.repeat(64) }) };
    expect(await code(launch(r))).toBe('engine-incompatible');
  });

  it("version de moteur différente → incompatible", async () => {
    expect(await code(launch(req({ engine: fakeEngine({ engineVersion: '2.0.0' }).e })))).toBe('engine-incompatible');
  });

  it('index absent (404) → ressource manquante', async () => {
    expect(await code(launch(req({ indexStatus: 404 })))).toBe('asset-missing');
  });

  it('index altéré → ressource corrompue, moteur libéré', async () => {
    const { e, calls } = fakeEngine();
    const r = req({ engine: e });
    r.version = makeVersion({ assetIndexSha256: sha('autre chose') });
    expect(await code(launch(r))).toBe('asset-corrupt');
    expect(calls).toContain('dispose');
  });

  it('index mal formé → corrompu', async () => {
    expect(await code(launch(req({ indexBody: '{"x":1}' })))).toBe('asset-corrupt');
    expect(await code(launch(req({ indexBody: 'pas du json' })))).toBe('asset-corrupt');
  });

  it('erreur réseau', async () => {
    const r = req();
    r.fetchImpl = (async () => { throw new TypeError('offline'); }) as typeof fetch;
    expect(await code(launch(r))).toBe('network');
  });

  it('mod incompatible → refus avant initialisation', async () => {
    const { e, calls } = fakeEngine();
    const r = req({ engine: e, mods: ['ghost'] });
    expect(await code(launch(r))).toBe('mod-incompatible');
    expect(calls).not.toContain('initialize');
  });

  it('applique les mods valides', async () => {
    const m = makeMod({ id: 'mod-a' });
    const r = req({ mods: ['mod-a'], registry: new Map<string, ModManifest>([[m.id, m]]) });
    r.version = { ...r.version, supportedMods: ['mod-a'] };
    const res = await launch(r);
    expect(res.config.effects.filter).toBe('contrast(1.2)');
  });

  it('mémoire insuffisante', async () => {
    expect(await code(launch(req({ deviceMemoryGb: 0.5 })))).toBe('memory-low');
  });

  it('chargement interrompu', async () => {
    const ctrl = new AbortController();
    const { e } = fakeEngine({ loadAssets: async () => { ctrl.abort(); ctrl.signal.throwIfAborted(); } });
    expect(await code(launch(req({ engine: e, signal: ctrl.signal })))).toBe('aborted');
  });

  it('échec du moteur (timeout) propagé', async () => {
    const { e } = fakeEngine({ initialize: async () => { throw new LaunchError('engine-timeout', 'x'); } });
    expect(await code(launch(req({ engine: e })))).toBe('engine-timeout');
  });
});

describe('vérification des ressources', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('valide un fichier conforme et rejette un fichier corrompu ou absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(FILE)));
    const p: number[] = [];
    await verifyAssets('./', index, (x) => p.push(x.done), new AbortController().signal);
    expect(p).toEqual([1]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('hello enginE')));
    await expect(verifyAssets('./', index, () => {}, new AbortController().signal)).rejects.toMatchObject({ code: 'asset-corrupt' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    await expect(verifyAssets('./', index, () => {}, new AbortController().signal)).rejects.toMatchObject({ code: 'asset-missing' });
  });
});
