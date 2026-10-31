import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useCatalog } from '@/stores/catalog';
import { usePrefs } from '@/stores/prefs';
import { effectiveStatus } from '@/services/availability';
import { VersionCard } from '@/components/versions/VersionCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, Section, StatusBadge } from '@/components/ui/primitives';
import { formatDate, formatDuration } from '@/utils/format';
import { toast } from '@/stores/toasts';

export function LibraryPage() {
  const byId = useCatalog((s) => s.versionById);
  const modById = useCatalog((s) => s.modById);
  const { favorites, sessions, modConfigs, selectedVersionId } = usePrefs();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const favVersions = favorites.map((id) => byId.get(id)).filter((v): v is NonNullable<typeof v> => !!v);
  const selected = selectedVersionId ? byId.get(selectedVersionId) : undefined;
  const configs = Object.entries(modConfigs).filter(([, l]) => l.length > 0);

  return (
    <div className="page">
      <h1 className="h1">Library</h1>
      <p className="mt-1 text-sm text-muted">Préférences locales à cet appareil. Aucun fichier de jeu n'est téléchargé dans la bibliothèque : seules vos sélections et sessions sont mémorisées.</p>

      <Section title="Version sélectionnée">
        {selected ? <div className="max-w-sm"><VersionCard version={selected} /></div> : <EmptyState title="Aucune version sélectionnée" action={<Link to="/versions" className="btn-primary">Parcourir</Link>} />}
      </Section>

      <Section title={`Favoris (${favVersions.length})`}>
        {favVersions.length === 0 ? <EmptyState title="Aucun favori">Utilisez ☆ sur une carte de version.</EmptyState> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{favVersions.map((v) => <VersionCard key={v.id} version={v} />)}</div>
        )}
      </Section>

      <Section title="Dernières sessions">
        {sessions.length === 0 ? <EmptyState title="Aucune session">Les lancements réussis ou échoués apparaissent ici.</EmptyState> : (
          <ul className="card divide-y divide-line/60">
            {sessions.map((s) => {
              const v = byId.get(s.versionId);
              const ok = v ? effectiveStatus(v) === 'playable' : false;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{v?.title ?? `${s.versionId} (retirée du catalogue)`}</p>
                    <p className="text-xs text-muted">
                      {formatDate(s.startedAt)} · {s.endedAt ? formatDuration(s.endedAt - s.startedAt) : 'en cours'} · {s.mods.length} mod(s)
                      {s.outcome === 'failed' && <span className="text-bad"> · échec : {s.error}</span>}
                    </p>
                  </div>
                  {v && <StatusBadge status={effectiveStatus(v)} />}
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={!ok}
                    onClick={() => {
                      const st = usePrefs.getState();
                      st.selectVersion(s.versionId);
                      st.setMods(s.versionId, s.mods);
                      navigate('/play', { state: { autostart: true } });
                    }}
                  >
                    Relancer
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Configurations de mods">
        {configs.length === 0 ? <EmptyState title="Aucune configuration enregistrée" /> : (
          <ul className="card divide-y divide-line/60">
            {configs.map(([vid, list]) => (
              <li key={vid} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{byId.get(vid)?.title ?? vid}</p>
                  <p className="truncate text-xs text-muted">{list.map((m) => modById.get(m)?.name ?? m).join(', ')}</p>
                </div>
                <button type="button" className="btn-ghost" onClick={() => usePrefs.getState().resetMods(vid)}>Effacer</button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Données locales">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" disabled={sessions.length === 0} onClick={() => usePrefs.getState().clearSessions()}>Effacer l'historique</button>
          <button type="button" className="btn-danger" onClick={() => setConfirm(true)}>Supprimer toutes les préférences locales</button>
        </div>
      </Section>

      <ConfirmDialog
        open={confirm}
        title="Supprimer les préférences locales ?"
        confirmLabel="Supprimer"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          usePrefs.getState().clearAll();
          setConfirm(false);
          toast('info', 'Préférences locales supprimées');
        }}
      >
        Favoris, sessions, configurations de mods et réglages seront réinitialisés. Le moteur Subway Lab conserve ses propres sauvegardes.
      </ConfirmDialog>
    </div>
  );
}
