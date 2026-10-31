import { AssetIndexSchema, type AssetIndex, type ModManifest, type VersionManifest } from '@/validators/schemas';
import type { EngineConfiguration, GameEngineAdapter } from '@/engines/types';
import { LaunchError, toLaunchError } from './errors';
import { effectiveStatus } from './availability';
import { resolveModSet, type EngineCapabilities } from './modResolver';
import { composeEffects } from './effects';
import { hasSubtleCrypto, sha256Hex } from '@/utils/hash';

export type LaunchStepId = 'config' | 'availability' | 'engine' | 'browser' | 'index' | 'assets' | 'mods' | 'init' | 'apply' | 'start';

export const LAUNCH_STEPS: { id: LaunchStepId; label: string; weight: number }[] = [
  { id: 'config', label: 'Chargement de la configuration', weight: 1 },
  { id: 'availability', label: 'Vérification de la disponibilité', weight: 1 },
  { id: 'engine', label: 'Vérification du moteur', weight: 1 },
  { id: 'browser', label: 'Compatibilité du navigateur', weight: 1 },
  { id: 'index', label: "Index d'intégrité des ressources", weight: 2 },
  { id: 'assets', label: 'Téléchargement et vérification des ressources', weight: 50 },
  { id: 'mods', label: 'Validation des mods', weight: 2 },
  { id: 'init', label: 'Initialisation du moteur', weight: 30 },
  { id: 'apply', label: 'Application de la configuration', weight: 1 },
  { id: 'start', label: 'Lancement', weight: 1 },
];
const TOTAL = LAUNCH_STEPS.reduce((s, x) => s + x.weight, 0);

export interface LaunchProgress {
  step: LaunchStepId;
  label: string;
  /** 0–1 ; n'atteint 1 qu'après start() effectif. */
  ratio: number;
  detail?: string;
}

export interface LaunchRequest {
  version: VersionManifest;
  mods: readonly string[];
  registry: ReadonlyMap<string, ModManifest>;
  createEngine: (engineId: string) => GameEngineAdapter | null;
  capabilities: (engineId: string) => EngineCapabilities | null;
  container: HTMLElement;
  config: Omit<EngineConfiguration, 'effects'>;
  baseUrl: string;
  signal: AbortSignal;
  onProgress: (p: LaunchProgress) => void;
  fetchImpl?: typeof fetch;
  deviceMemoryGb?: number | null;
}

export interface LaunchResult {
  engine: GameEngineAdapter;
  index: AssetIndex;
  appliedMods: string[];
  config: EngineConfiguration;
}

/** Seuil indicatif sous lequel un lancement est refusé (navigator.deviceMemory, arrondi par le navigateur). */
export const MIN_DEVICE_MEMORY_GB = 1;

export function checkBrowser(): string[] {
  const missing: string[] = [];
  if (typeof fetch !== 'function') missing.push('fetch');
  if (!hasSubtleCrypto()) missing.push('WebCrypto (HTTPS ou localhost requis)');
  if (typeof AbortController !== 'function') missing.push('AbortController');
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    if (typeof c.getContext !== 'function') missing.push('Canvas');
  }
  return missing;
}

export async function launch(req: LaunchRequest): Promise<LaunchResult> {
  const { version, signal, onProgress } = req;
  const doFetch = req.fetchImpl ?? fetch;
  let acc = 0;
  const begin = (id: LaunchStepId, detail?: string) => {
    signal.throwIfAborted();
    const s = LAUNCH_STEPS.find((x) => x.id === id);
    if (!s) return;
    onProgress({ step: id, label: s.label, ratio: acc / TOTAL, detail });
  };
  const end = (id: LaunchStepId) => {
    acc += LAUNCH_STEPS.find((x) => x.id === id)?.weight ?? 0;
  };
  let engine: GameEngineAdapter | null = null;

  try {
    begin('config');
    if (!req.container.isConnected) throw new LaunchError('engine-crash', "Conteneur d'affichage absent.");
    end('config');

    begin('availability');
    const status = effectiveStatus(version);
    if (status !== 'playable') {
      const code = status === 'incompatible' ? 'engine-incompatible' : status === 'missing-assets' ? 'asset-missing' : 'version-unavailable';
      throw new LaunchError(code, `« ${version.title} » n'est pas lançable (statut : ${status}).`, version.incompatibilities);
    }
    end('availability');

    begin('engine');
    engine = req.createEngine(version.engineId);
    if (!engine) throw new LaunchError('engine-incompatible', `Aucun adaptateur pour le moteur « ${version.engineId} ».`);
    if (engine.engineVersion !== version.engineVersion) {
      throw new LaunchError('engine-incompatible', `Moteur ${engine.engineVersion} installé, ${version.engineVersion} requis.`);
    }
    end('engine');

    begin('browser');
    const missing = checkBrowser();
    if (missing.length) throw new LaunchError('browser-unsupported', 'Fonctionnalités navigateur manquantes.', missing);
    if (req.deviceMemoryGb != null && req.deviceMemoryGb < MIN_DEVICE_MEMORY_GB) {
      throw new LaunchError('memory-low', `Mémoire annoncée : ${req.deviceMemoryGb} Go (minimum ${MIN_DEVICE_MEMORY_GB} Go).`);
    }
    end('browser');

    begin('index');
    if (!version.assetIndex || !version.assetIndexSha256) throw new LaunchError('asset-missing', 'Aucun index de ressources signé.');
    let res: Response;
    try {
      res = await doFetch(`${req.baseUrl}${version.assetIndex}`, { signal, cache: 'no-cache', credentials: 'same-origin' });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new LaunchError('network', "Index de ressources inaccessible.");
    }
    if (res.status === 404) throw new LaunchError('asset-missing', "Index de ressources introuvable : la build n'est pas déployée.");
    if (!res.ok) throw new LaunchError('network', `Index : HTTP ${res.status}.`);
    const text = await res.text();
    if ((await sha256Hex(text)) !== version.assetIndexSha256) throw new LaunchError('asset-corrupt', "L'index de ressources ne correspond pas à la signature du catalogue.");
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new LaunchError('asset-corrupt', 'Index de ressources illisible.');
    }
    const parsed = AssetIndexSchema.safeParse(parsedJson);
    if (!parsed.success) throw new LaunchError('asset-corrupt', 'Index de ressources mal formé.', parsed.error.issues.map((i) => i.message));
    const index = parsed.data;
    if (index.engineId !== version.engineId || index.engineVersion !== version.engineVersion) {
      throw new LaunchError('engine-incompatible', `Index destiné à ${index.engineId} ${index.engineVersion}.`);
    }
    if (!index.files.some((f) => f.path === index.entry)) throw new LaunchError('asset-missing', `Point d'entrée ${index.entry} absent de l'index.`);
    end('index');

    begin('assets', `0 / ${index.files.length}`);
    const assetWeight = LAUNCH_STEPS.find((s) => s.id === 'assets')?.weight ?? 0;
    await engine.loadAssets(
      index,
      (p) => onProgress({ step: 'assets', label: 'Téléchargement et vérification des ressources', ratio: (acc + (assetWeight * p.done) / Math.max(1, p.total)) / TOTAL, detail: `${p.done} / ${p.total}` }),
      signal,
    );
    end('assets');

    begin('mods');
    const resolved = resolveModSet(req.mods, req.registry, version, req.capabilities(version.engineId));
    if (!resolved.ok) throw new LaunchError('mod-incompatible', 'La configuration de mods est invalide.', resolved.issues.map((i) => i.message));
    const effects = composeEffects(resolved.order, req.registry);
    end('mods');

    begin('init');
    await engine.initialize(req.container, index, signal);
    end('init');

    begin('apply');
    const config: EngineConfiguration = { ...req.config, effects };
    engine.applyConfiguration(config);
    engine.resize(req.container.clientWidth, req.container.clientHeight);
    end('apply');

    begin('start');
    engine.start();
    end('start');
    onProgress({ step: 'start', label: 'Partie lancée', ratio: 1 });
    return { engine, index, appliedMods: resolved.order, config };
  } catch (e) {
    engine?.dispose();
    throw toLaunchError(e);
  }
}
