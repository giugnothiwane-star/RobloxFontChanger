import type { AssetIndex } from '@/validators/schemas';
import type { EngineConfiguration, GameEngineAdapter } from './types';
import { verifyAssets } from './assetLoader';
import { LaunchError } from '@/services/errors';

const READY_TIMEOUT_MS = 15_000;
const COMMAND_TIMEOUT_MS = 2_000;

interface LabMessage {
  source: 'subway-lab';
  protocol: number;
  type: string;
  ok?: boolean;
}

const isLabMessage = (d: unknown): d is LabMessage =>
  !!d && typeof d === 'object' && (d as LabMessage).source === 'subway-lab' && typeof (d as LabMessage).type === 'string';

/**
 * Adaptateur du prototype « subway-lab » (Canvas 2D, même origine).
 * L'iframe garde son propre contexte JS ; on ne communique que par postMessage
 * filtré sur l'origine et la fenêtre source.
 */
export class SubwayLabAdapter implements GameEngineAdapter {
  readonly engineId = 'subway-lab';
  readonly engineVersion = '1.0.0';
  readonly grants = ['render.filter', 'render.overlay'] as const;
  readonly hasAudio = false;

  private frame: HTMLIFrameElement | null = null;
  private host: HTMLElement | null = null;
  private listeners = new Set<(m: LabMessage) => void>();
  private config: EngineConfiguration | null = null;
  private size = { w: 0, h: 0 };
  private readonly onMessage = (ev: MessageEvent) => {
    if (!this.frame || ev.source !== this.frame.contentWindow || ev.origin !== window.location.origin) return;
    if (!isLabMessage(ev.data)) return;
    for (const l of [...this.listeners]) l(ev.data);
  };

  constructor(private readonly baseUrl: string) {}

  loadAssets(index: AssetIndex, onProgress: Parameters<GameEngineAdapter['loadAssets']>[1], signal: AbortSignal) {
    return verifyAssets(this.base(), index, onProgress, signal);
  }

  private base() {
    return `${this.baseUrl}engines/subway-lab/`;
  }

  private waitFor(type: string, timeoutMs: number, signal?: AbortSignal): Promise<LabMessage> {
    return new Promise((resolve, reject) => {
      const done = () => {
        clearTimeout(timer);
        this.listeners.delete(listener);
        signal?.removeEventListener('abort', onAbort);
      };
      const listener = (m: LabMessage) => {
        if (m.type === type) {
          done();
          resolve(m);
        }
      };
      const onAbort = () => {
        done();
        reject(new DOMException('Annulé', 'AbortError'));
      };
      const timer = setTimeout(() => {
        done();
        reject(new LaunchError('engine-timeout', `Aucune réponse « ${type} » du moteur après ${Math.round(timeoutMs / 1000)} s.`));
      }, timeoutMs);
      this.listeners.add(listener);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  async initialize(container: HTMLElement, index: AssetIndex, signal: AbortSignal): Promise<void> {
    this.dispose();
    window.addEventListener('message', this.onMessage);
    const frame = document.createElement('iframe');
    frame.title = 'Subway Lab Infinite';
    frame.className = 'svh-engine-frame';
    // allow-same-origin requis pour localStorage du moteur ; contenu interne au dépôt, vérifié par SHA-256.
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
    frame.setAttribute('allow', 'fullscreen; gamepad');
    frame.referrerPolicy = 'no-referrer';
    frame.style.visibility = 'hidden';
    this.frame = frame;
    this.host = container;
    const ready = this.waitFor('ready', READY_TIMEOUT_MS, signal);
    frame.src = `${this.base()}${index.entry}`;
    container.appendChild(frame);
    try {
      await ready;
    } catch (e) {
      this.dispose();
      throw e;
    }
  }

  applyConfiguration(config: EngineConfiguration): void {
    this.config = config;
    this.layout();
  }

  start(): void {
    if (!this.frame) throw new LaunchError('engine-crash', 'Moteur non initialisé.');
    this.frame.style.visibility = 'visible';
    this.frame.focus();
  }

  private async command(type: 'pause' | 'resume', reply: string): Promise<boolean> {
    const win = this.frame?.contentWindow;
    if (!win) return false;
    const answer = this.waitFor(reply, COMMAND_TIMEOUT_MS);
    win.postMessage({ target: 'subway-lab', type }, window.location.origin);
    try {
      return Boolean((await answer).ok);
    } catch {
      return false;
    }
  }

  pause() {
    return this.command('pause', 'paused');
  }

  async resume() {
    const ok = await this.command('resume', 'resumed');
    this.frame?.focus();
    return ok;
  }

  resize(width: number, height: number): void {
    this.size = { w: Math.max(1, Math.floor(width)), h: Math.max(1, Math.floor(height)) };
    this.layout();
  }

  /**
   * Résolution réduite : l'iframe est dimensionnée à scale × taille puis agrandie
   * par transform, le moteur rend donc réellement moins de pixels.
   */
  private layout() {
    const f = this.frame;
    if (!f) return;
    const scale = this.config?.renderScale ?? 1;
    const w = this.size.w || this.host?.clientWidth || 1;
    const h = this.size.h || this.host?.clientHeight || 1;
    f.style.width = `${Math.round(w * scale)}px`;
    f.style.height = `${Math.round(h * scale)}px`;
    f.style.transform = scale === 1 ? 'none' : `scale(${1 / scale})`;
    f.style.transformOrigin = '0 0';
    f.style.filter = this.config?.effects.filter || 'none';
  }

  dispose(): void {
    window.removeEventListener('message', this.onMessage);
    this.listeners.clear();
    if (this.frame) {
      // about:blank avant retrait : libère immédiatement canvas et boucles rAF du moteur.
      this.frame.src = 'about:blank';
      this.frame.remove();
    }
    this.frame = null;
    this.host = null;
  }
}
