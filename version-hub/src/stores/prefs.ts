import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { z } from 'zod';
import { GRAPHICS_PROFILES } from '@/validators/schemas';

export const SettingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  language: z.enum(['fr']),
  graphics: z.enum(GRAPHICS_PROFILES),
  /** Multiplicateur appliqué au profil (0,5–1) : résolution fine en plus du profil. */
  resolution: z.number().min(0.5).max(1),
  volume: z.number().min(0).max(1),
  sfx: z.boolean(),
  uiAnimations: z.enum(['system', 'on', 'off']),
  fullscreenOnLaunch: z.boolean(),
  touchControls: z.boolean(),
  autoResolveModDeps: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'fr',
  graphics: 'auto',
  resolution: 1,
  volume: 0.8,
  sfx: true,
  uiAnimations: 'system',
  fullscreenOnLaunch: false,
  touchControls: true,
  autoResolveModDeps: true,
};

const SessionSchema = z.object({
  id: z.string(),
  versionId: z.string(),
  mods: z.array(z.string()),
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  outcome: z.enum(['running', 'exited', 'failed']),
  error: z.string().nullable(),
});
export type Session = z.infer<typeof SessionSchema>;

const PersistedSchema = z.object({
  settings: SettingsSchema,
  selectedVersionId: z.string().nullable(),
  favorites: z.array(z.string()).max(500),
  sessions: z.array(SessionSchema).max(50),
  modConfigs: z.record(z.array(z.string()).max(100)),
});
type Persisted = z.infer<typeof PersistedSchema>;

export const MAX_SESSIONS = 30;

interface PrefsState extends Persisted {
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  selectVersion: (id: string | null) => void;
  toggleFavorite: (id: string) => void;
  setMods: (versionId: string, mods: string[]) => void;
  resetMods: (versionId: string) => void;
  startSession: (versionId: string, mods: string[]) => string;
  endSession: (id: string, outcome: 'exited' | 'failed', error?: string) => void;
  clearSessions: () => void;
  clearAll: () => void;
}

const initial: Persisted = { settings: DEFAULT_SETTINGS, selectedVersionId: null, favorites: [], sessions: [], modConfigs: {} };

/** Stockage tolérant : navigation privée, quota plein ou accès refusé ne doivent jamais faire planter l'UI. */
const safeLocalStorage: StateStorage = {
  getItem: (k) => {
    try {
      return globalThis.localStorage?.getItem(k) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      globalThis.localStorage?.setItem(k, v);
    } catch {
      /* quota ou stockage bloqué : la session continue en mémoire */
    }
  },
  removeItem: (k) => {
    try {
      globalThis.localStorage?.removeItem(k);
    } catch {
      /* idem */
    }
  },
};

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export const STORAGE_KEY = 'svh.prefs';

export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      ...initial,
      updateSettings: (patch) => {
        const next = SettingsSchema.safeParse({ ...get().settings, ...patch });
        if (next.success) set({ settings: next.data });
      },
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
      selectVersion: (id) => set({ selectedVersionId: id }),
      toggleFavorite: (id) =>
        set((s) => ({ favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id] })),
      setMods: (versionId, mods) => set((s) => ({ modConfigs: { ...s.modConfigs, [versionId]: [...new Set(mods)] } })),
      resetMods: (versionId) =>
        set((s) => {
          const { [versionId]: _removed, ...rest } = s.modConfigs;
          return { modConfigs: rest };
        }),
      startSession: (versionId, mods) => {
        const id = newId();
        set((s) => ({
          sessions: [{ id, versionId, mods: [...mods], startedAt: Date.now(), endedAt: null, outcome: 'running' as const, error: null }, ...s.sessions].slice(0, MAX_SESSIONS),
        }));
        return id;
      },
      endSession: (id, outcome, error) =>
        set((s) => ({ sessions: s.sessions.map((x) => (x.id === id && x.outcome === 'running' ? { ...x, outcome, endedAt: Date.now(), error: error ?? null } : x)) })),
      clearSessions: () => set({ sessions: [] }),
      clearAll: () => set({ ...initial }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s): Persisted => ({ settings: s.settings, selectedVersionId: s.selectedVersionId, favorites: s.favorites, sessions: s.sessions, modConfigs: s.modConfigs }),
      // Données locales corrompues ou d'un ancien schéma : on repart des valeurs par défaut champ par champ.
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<Persisted>;
        const settings = SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) });
        const whole = PersistedSchema.safeParse({ ...initial, ...raw, settings: settings.success ? settings.data : DEFAULT_SETTINGS });
        const data = whole.success ? whole.data : { ...initial, settings: settings.success ? settings.data : DEFAULT_SETTINGS };
        // Une session restée « running » (onglet fermé) est close à la réhydratation.
        data.sessions = data.sessions.map((x) => (x.outcome === 'running' ? { ...x, outcome: 'exited' as const, endedAt: x.endedAt ?? x.startedAt } : x));
        return { ...current, ...data };
      },
    },
  ),
);
