import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { App } from '@/app/App';
import { useCatalog } from '@/stores/catalog';
import { usePrefs } from '@/stores/prefs';
import { makeMod, makeVersion } from './fixtures';

const versions = [
  makeVersion({ id: 'lab', title: 'Lab Proto', city: 'Laboratoire', year: 2026, supportedMods: ['mod-a', 'mod-b', 'mod-dep'] }),
  makeVersion({ id: 'paris', title: 'World Tour : Paris', city: 'Paris', year: 2013, status: 'unavailable', engineId: 'unity-android-native', assetIndex: null, assetIndexSha256: null }),
];
const mods = [
  makeMod({ id: 'mod-a', name: 'Contraste', conflicts: [{ id: 'mod-b', reason: 'même canal' }] }),
  makeMod({ id: 'mod-b', name: 'Gris', effects: [{ type: 'cssFilter', grayscale: 1 }] }),
  makeMod({ id: 'mod-dep', name: 'Pack', dependencies: [{ id: 'mod-a', range: '^1.0.0' }] }),
];

function boot(hash = '#/') {
  window.location.hash = hash;
  useCatalog.setState({ status: 'idle', versions: [], mods: [], versionById: new Map(), modById: new Map(), rejected: [] });
  usePrefs.getState().clearAll();
  vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify(u.includes('versions') ? { schemaVersion: 1, versions } : { schemaVersion: 1, mods }))));
  return render(<App />);
}

describe('interface', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accueil : bouton Continuer désactivé sans session, compteurs de disponibilité', async () => {
    boot();
    expect((await screen.findByRole('button', { name: /Continuer ma dernière session/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText('Jouable').length).toBeGreaterThan(0);
  });

  it('navigation entre les onglets', async () => {
    boot();
    await screen.findAllByText(/VERSION HUB/);
    const nav = screen.getAllByRole('navigation', { name: 'Navigation principale' })[0]!;
    fireEvent.click(within(nav).getByText('Settings'));
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
    fireEvent.click(within(nav).getByText('About'));
    expect(await screen.findByRole('heading', { name: 'About' })).toBeTruthy();
  });

  it('catalogue : recherche, PLAY désactivé pour une version indisponible, favoris', async () => {
    boot('#/versions');
    const search = await screen.findByLabelText('Recherche');
    fireEvent.change(search, { target: { value: 'paris' } });
    const card = await screen.findByRole('article', { name: 'World Tour : Paris' });
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Lab Proto' })).toBeNull());
    expect((within(card).getByRole('button', { name: /PLAY/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(card).getByRole('button', { name: /Ajouter .* aux favoris/ }));
    expect(usePrefs.getState().favorites).toEqual(['paris']);
    fireEvent.click(within(card).getByRole('button', { name: 'Choisir' }));
    expect(usePrefs.getState().selectedVersionId).toBe('paris');
  });

  it('filtre « Jouables »', async () => {
    boot('#/versions');
    fireEvent.click(await screen.findByRole('radio', { name: 'Jouables' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'World Tour : Paris' })).toBeNull());
    expect(screen.getByRole('article', { name: 'Lab Proto' })).toBeTruthy();
  });

  it('mods : activation, conflit expliqué, dépendance confirmée', async () => {
    boot('#/mods');
    await screen.findByRole('heading', { name: 'Mods' });
    fireEvent.change(screen.getByLabelText('Version ciblée'), { target: { value: 'lab' } });
    const a = await screen.findByRole('article', { name: 'Contraste' });
    fireEvent.click(within(a).getByRole('switch'));
    expect(usePrefs.getState().modConfigs.lab).toEqual(['mod-a']);
    const b = screen.getByRole('article', { name: 'Gris' });
    expect((within(b).getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
    expect(within(b).getByText(/même canal/)).toBeTruthy();
    fireEvent.click(within(a).getByRole('switch'));
    const pack = screen.getByRole('article', { name: 'Pack' });
    fireEvent.click(within(pack).getByRole('switch'));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText(/Contraste/)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Confirmer' }));
    expect(usePrefs.getState().modConfigs.lab).toEqual(['mod-a', 'mod-dep']);
  });

  it('PLAY refuse une version non jouable', async () => {
    usePrefs.getState().selectVersion('paris');
    boot('#/play');
    usePrefs.getState().selectVersion('paris');
    const btn = await screen.findByRole('button', { name: /PLAY/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/lancement impossible/)).toBeTruthy();
  });

  it('page de version inconnue', async () => {
    boot('#/versions/nope');
    expect(await screen.findByText('Version introuvable')).toBeTruthy();
  });

  it('catalogue en erreur : message et bouton Réessayer', async () => {
    window.location.hash = '#/';
    useCatalog.setState({ status: 'idle' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    render(<App />);
    expect(await screen.findByText('Catalogue indisponible')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });
});
