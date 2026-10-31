import type { AssetIndex, ModPermission } from '@/validators/schemas';
import type { ComposedEffects } from '@/services/effects';

export interface EngineConfiguration {
  renderScale: number;
  effects: ComposedEffects;
  volume: number;
  touchControls: boolean;
}

export interface AssetProgress {
  done: number;
  total: number;
  bytes: number;
}

export interface GameEngineAdapter {
  readonly engineId: string;
  readonly engineVersion: string;
  readonly grants: readonly ModPermission[];
  readonly hasAudio: boolean;
  /** Vérifie (et met en cache navigateur) les ressources de l'index ; rejette au premier écart. */
  loadAssets(index: AssetIndex, onProgress: (p: AssetProgress) => void, signal: AbortSignal): Promise<void>;
  /** Monte le moteur dans le conteneur et attend son signal de disponibilité réel. */
  initialize(container: HTMLElement, index: AssetIndex, signal: AbortSignal): Promise<void>;
  applyConfiguration(config: EngineConfiguration): void;
  start(): void;
  pause(): Promise<boolean>;
  resume(): Promise<boolean>;
  resize(width: number, height: number): void;
  dispose(): void;
}

export type EngineFactory = (baseUrl: string) => GameEngineAdapter;
