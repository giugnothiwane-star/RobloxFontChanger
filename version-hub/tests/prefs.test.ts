import { DEFAULT_SETTINGS, STORAGE_KEY, usePrefs } from '@/stores/prefs';
import { effectiveStatus } from '@/services/availability';
import { resolveAutoProfile } from '@/services/graphics';
import { makeVersion } from './fixtures';

const reset = () => usePrefs.getState().clearAll();

describe('préférences locales', () => {
  beforeEach(reset);

  it('sauvegarde réglages, favoris et mods dans localStorage', () => {
    const s = usePrefs.getState();
    s.updateSettings({ graphics: 'low', theme: 'light' });
    s.toggleFavorite('a');
    s.toggleFavorite('b');
    s.toggleFavorite('a');
    s.setMods('v', ['x', 'x', 'y']);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').state;
    expect(saved.settings.graphics).toBe('low');
    expect(saved.favorites).toEqual(['b']);
    expect(saved.modConfigs.v).toEqual(['x', 'y']);
  });

  it('ignore une mise à jour de réglage invalide', () => {
    usePrefs.getState().updateSettings({ volume: 7 } as never);
    expect(usePrefs.getState().settings.volume).toBe(DEFAULT_SETTINGS.volume);
  });

  it('réhydrate en tolérant des données corrompues', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { settings: { graphics: 'ultra', volume: 0.3 }, favorites: 'oops' }, version: 1 }));
    await usePrefs.persist.rehydrate();
    const s = usePrefs.getState();
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
    expect(s.favorites).toEqual([]);
    localStorage.setItem(STORAGE_KEY, '{not json');
    await usePrefs.persist.rehydrate();
    expect(usePrefs.getState().settings).toEqual(DEFAULT_SETTINGS);
  });

  it('ferme les sessions restées ouvertes à la réhydratation', async () => {
    const id = usePrefs.getState().startSession('v', []);
    await usePrefs.persist.rehydrate();
    expect(usePrefs.getState().sessions.find((x) => x.id === id)?.outcome).toBe('exited');
  });

  it('borne l’historique des sessions et enregistre les échecs', () => {
    for (let i = 0; i < 40; i++) usePrefs.getState().startSession(`v${i}`, []);
    expect(usePrefs.getState().sessions).toHaveLength(30);
    const id = usePrefs.getState().startSession('z', []);
    usePrefs.getState().endSession(id, 'failed', 'boom');
    expect(usePrefs.getState().sessions[0]).toMatchObject({ outcome: 'failed', error: 'boom' });
  });

  it('réinitialise mods et réglages', () => {
    const s = usePrefs.getState();
    s.setMods('v', ['x']);
    s.resetMods('v');
    s.updateSettings({ graphics: 'high' });
    s.resetSettings();
    expect(usePrefs.getState().modConfigs).toEqual({});
    expect(usePrefs.getState().settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('statut effectif et profil AUTO', () => {
  it('ne promeut jamais une version et dégrade si moteur ou index absents', () => {
    expect(effectiveStatus(makeVersion({ status: 'unavailable' }), () => true)).toBe('unavailable');
    expect(effectiveStatus(makeVersion(), () => false)).toBe('incompatible');
    expect(effectiveStatus(makeVersion({ assetIndexSha256: null }), () => true)).toBe('missing-assets');
    expect(effectiveStatus(makeVersion(), () => true)).toBe('playable');
  });
  it('profil AUTO selon les indices matériels', () => {
    expect(resolveAutoProfile({ cores: 8, memoryGb: 8, pixels: 2_000_000, saveData: false })).toBe('high');
    expect(resolveAutoProfile({ cores: 4, memoryGb: 4, pixels: 4_000_000, saveData: false })).toBe('low');
    expect(resolveAutoProfile({ cores: null, memoryGb: null, pixels: null, saveData: false })).toBe('medium');
    expect(resolveAutoProfile({ cores: 8, memoryGb: 8, pixels: 1, saveData: true })).toBe('low');
  });
});
