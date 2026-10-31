import type { VersionManifest, VersionStatus } from '@/validators/schemas';
import { hasEngine } from '@/engines/registry';

/**
 * Statut effectif : le statut déclaré ne peut que se dégrader selon ce que le
 * launcher sait réellement exécuter. Jamais d'escalade vers « playable ».
 */
export function effectiveStatus(v: VersionManifest, engineExists: (id: string) => boolean = hasEngine): VersionStatus {
  if (v.status !== 'playable') return v.status;
  if (!engineExists(v.engineId)) return 'incompatible';
  if (!v.assetIndex || !v.assetIndexSha256) return 'missing-assets';
  return 'playable';
}
