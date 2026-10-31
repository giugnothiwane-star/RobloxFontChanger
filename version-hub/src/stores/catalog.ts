import { create } from 'zustand';
import type { ModManifest, VersionManifest } from '@/validators/schemas';
import { loadCatalog, type RejectedEntry } from '@/services/catalog';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface CatalogState {
  status: Status;
  error: string | null;
  versions: VersionManifest[];
  mods: ModManifest[];
  versionById: Map<string, VersionManifest>;
  modById: Map<string, ModManifest>;
  rejected: RejectedEntry[];
  load: (force?: boolean) => Promise<void>;
}

let inflight: Promise<void> | null = null;

export const useCatalog = create<CatalogState>()((set, get) => ({
  status: 'idle',
  error: null,
  versions: [],
  mods: [],
  versionById: new Map(),
  modById: new Map(),
  rejected: [],
  load: (force = false) => {
    if (!force && (get().status === 'ready' || inflight)) return inflight ?? Promise.resolve();
    set({ status: 'loading', error: null });
    inflight = loadCatalog(import.meta.env.BASE_URL)
      .then((c) =>
        set({
          status: 'ready',
          versions: c.versions,
          mods: c.mods,
          rejected: c.rejected,
          versionById: new Map(c.versions.map((v) => [v.id, v])),
          modById: new Map(c.mods.map((m) => [m.id, m])),
        }),
      )
      .catch((e: unknown) => set({ status: 'error', error: e instanceof Error ? e.message : String(e) }))
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
}));
