export type LaunchErrorCode =
  | 'version-unavailable'
  | 'engine-incompatible'
  | 'browser-unsupported'
  | 'asset-missing'
  | 'asset-corrupt'
  | 'mod-incompatible'
  | 'memory-low'
  | 'network'
  | 'aborted'
  | 'engine-timeout'
  | 'engine-crash';

export type RecoveryAction = 'retry' | 'choose-version' | 'disable-mods' | 'lower-graphics' | 'update-browser' | 'back';

const COPY: Record<LaunchErrorCode, { title: string; recovery: RecoveryAction[] }> = {
  'version-unavailable': { title: 'Version non lançable', recovery: ['choose-version'] },
  'engine-incompatible': { title: 'Moteur incompatible', recovery: ['choose-version'] },
  'browser-unsupported': { title: 'Navigateur non compatible', recovery: ['update-browser', 'back'] },
  'asset-missing': { title: 'Ressource manquante', recovery: ['retry', 'choose-version'] },
  'asset-corrupt': { title: 'Ressource corrompue', recovery: ['retry', 'back'] },
  'mod-incompatible': { title: 'Mod incompatible', recovery: ['disable-mods', 'back'] },
  'memory-low': { title: 'Mémoire insuffisante', recovery: ['lower-graphics', 'retry'] },
  network: { title: 'Erreur réseau', recovery: ['retry', 'back'] },
  aborted: { title: 'Chargement interrompu', recovery: ['retry', 'back'] },
  'engine-timeout': { title: 'Le moteur ne répond pas', recovery: ['retry', 'back'] },
  'engine-crash': { title: 'Erreur du moteur', recovery: ['retry', 'back'] },
};

export class LaunchError extends Error {
  readonly title: string;
  readonly recovery: RecoveryAction[];
  constructor(readonly code: LaunchErrorCode, message: string, readonly details: string[] = []) {
    super(message);
    this.name = 'LaunchError';
    this.title = COPY[code].title;
    this.recovery = COPY[code].recovery;
  }
}

export function toLaunchError(e: unknown): LaunchError {
  if (e instanceof LaunchError) return e;
  if (e instanceof DOMException && e.name === 'AbortError') return new LaunchError('aborted', 'Le chargement a été annulé.');
  if (e instanceof RangeError || (e instanceof DOMException && e.name === 'QuotaExceededError')) {
    return new LaunchError('memory-low', 'Le navigateur a manqué de mémoire pendant le chargement.');
  }
  return new LaunchError('engine-crash', e instanceof Error ? e.message : String(e));
}
