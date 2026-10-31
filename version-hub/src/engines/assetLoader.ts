import type { AssetIndex } from '@/validators/schemas';
import type { AssetProgress } from './types';
import { LaunchError } from '@/services/errors';
import { sha256Hex } from '@/utils/hash';

const CONCURRENCY = 6;

/**
 * Télécharge et vérifie chaque fichier (SHA-256). Les réponses restent dans le
 * cache HTTP, donc l'iframe du moteur les réutilise sans double transfert réseau.
 */
export async function verifyAssets(baseUrl: string, index: AssetIndex, onProgress: (p: AssetProgress) => void, signal: AbortSignal): Promise<void> {
  const total = index.files.length;
  let done = 0;
  let bytes = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < total) {
      const file = index.files[cursor++];
      if (!file) return;
      signal.throwIfAborted();
      let res: Response;
      try {
        res = await fetch(`${baseUrl}${file.path}`, { signal, credentials: 'same-origin' });
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e;
        throw new LaunchError('network', `Impossible de récupérer ${file.path}.`);
      }
      if (res.status === 404) throw new LaunchError('asset-missing', `Ressource absente : ${file.path}.`);
      if (!res.ok) throw new LaunchError('network', `${file.path} : HTTP ${res.status}.`);
      const buf = await res.arrayBuffer();
      if (buf.byteLength !== file.size || (await sha256Hex(buf)) !== file.sha256) {
        throw new LaunchError('asset-corrupt', `Intégrité invalide : ${file.path}.`, [`attendu ${file.sha256.slice(0, 12)}… (${file.size} o)`]);
      }
      bytes += buf.byteLength;
      done++;
      onProgress({ done, total, bytes });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
}
