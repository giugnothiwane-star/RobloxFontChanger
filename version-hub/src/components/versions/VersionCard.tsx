import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import type { VersionManifest } from '@/validators/schemas';
import { effectiveStatus } from '@/services/availability';
import { usePrefs } from '@/stores/prefs';
import { toast } from '@/stores/toasts';
import { StatusBadge } from '@/components/ui/primitives';
import { VersionThumb } from './VersionThumb';

export function VersionCard({ version }: { version: VersionManifest }) {
  const status = effectiveStatus(version);
  const selected = usePrefs((s) => s.selectedVersionId === version.id);
  const fav = usePrefs((s) => s.favorites.includes(version.id));
  const { selectVersion, toggleFavorite } = usePrefs.getState();
  const navigate = useNavigate();
  const playable = status === 'playable';

  return (
    <article className={clsx('card group flex flex-col overflow-hidden transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5', selected && 'ring-2 ring-accent')} aria-label={version.title}>
      <div className="relative">
        <VersionThumb version={version} className="aspect-[16/9] w-full" />
        <button
          type="button"
          onClick={() => toggleFavorite(version.id)}
          aria-pressed={fav}
          aria-label={fav ? `Retirer ${version.title} des favoris` : `Ajouter ${version.title} aux favoris`}
          className="absolute right-2 top-8 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-lg text-white backdrop-blur transition hover:bg-black/60"
        >
          {fav ? '★' : '☆'}
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {version.kind === 'original-prototype' && <span className="chip bg-accent2/15 text-accent2 ring-1 ring-accent2/30">Création originale</span>}
        </div>
        <h3 className="text-base font-bold leading-snug">{version.title}</h3>
        <p className="text-xs text-muted">
          {version.year}
          {version.dateConfidence === 'community' && <span title="Date issue de sources communautaires"> (≈)</span>} · {version.city}
        </p>
        <div className="mt-auto grid grid-cols-3 gap-2 pt-2">
          <Link to={`/versions/${version.id}`} className="btn-ghost px-2 text-xs">Détails</Link>
          <button
            type="button"
            className="btn-ghost px-2 text-xs"
            aria-pressed={selected}
            onClick={() => {
              selectVersion(version.id);
              toast('ok', 'Version sélectionnée', version.title);
            }}
          >
            {selected ? 'Choisie' : 'Choisir'}
          </button>
          <button
            type="button"
            className="btn-primary px-2 text-xs"
            disabled={!playable}
            title={playable ? undefined : 'Cette version n’est pas jouable dans le navigateur'}
            onClick={() => {
              selectVersion(version.id);
              navigate('/play', { state: { autostart: true } });
            }}
          >
            ▶ PLAY
          </button>
        </div>
      </div>
    </article>
  );
}
