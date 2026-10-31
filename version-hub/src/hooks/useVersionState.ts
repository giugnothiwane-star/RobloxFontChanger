import { useMemo } from 'react';
import { useCatalog } from '@/stores/catalog';
import { usePrefs } from '@/stores/prefs';
import { effectiveStatus } from '@/services/availability';
import { resolveModSet } from '@/services/modResolver';
import { engineCapabilities } from '@/engines/registry';
import type { VersionManifest } from '@/validators/schemas';

export function useSelectedVersion(): VersionManifest | null {
  const id = usePrefs((s) => s.selectedVersionId);
  const byId = useCatalog((s) => s.versionById);
  return id ? byId.get(id) ?? null : null;
}

const EMPTY: string[] = [];

export function useModState(version: VersionManifest | null) {
  const active = usePrefs((s) => (version ? s.modConfigs[version.id] ?? EMPTY : EMPTY));
  const registry = useCatalog((s) => s.modById);
  return useMemo(() => {
    if (!version) return { active, resolved: null, caps: null };
    const caps = engineCapabilities(version.engineId);
    return { active, caps, resolved: resolveModSet(active, registry, version, caps) };
  }, [active, registry, version]);
}

/** Dernière session dont la version est toujours effectivement jouable. */
export function useResumableSession() {
  const sessions = usePrefs((s) => s.sessions);
  const byId = useCatalog((s) => s.versionById);
  return useMemo(() => {
    for (const s of sessions) {
      if (s.outcome === 'failed') continue;
      const v = byId.get(s.versionId);
      if (v && effectiveStatus(v) === 'playable') return { session: s, version: v };
    }
    return null;
  }, [sessions, byId]);
}
