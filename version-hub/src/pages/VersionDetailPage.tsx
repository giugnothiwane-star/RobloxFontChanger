import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useCatalog } from '@/stores/catalog';
import { usePrefs } from '@/stores/prefs';
import { effectiveStatus } from '@/services/availability';
import { hasEngine } from '@/engines/registry';
import { useModState } from '@/hooks/useVersionState';
import { AssetIndexSchema } from '@/validators/schemas';
import { formatBytes, STATUS_LABEL } from '@/utils/format';
import { sha256Hex } from '@/utils/hash';
import { EmptyState, StatusBadge, Spinner } from '@/components/ui/primitives';
import { VersionThumb } from '@/components/versions/VersionThumb';
import { toast } from '@/stores/toasts';

type Check = { state: 'idle' } | { state: 'running' } | { state: 'done'; files: number; bytes: number } | { state: 'error'; message: string };

export function VersionDetailPage() {
  const { id = '' } = useParams();
  const version = useCatalog((s) => s.versionById.get(id));
  const modById = useCatalog((s) => s.modById);
  const fav = usePrefs((s) => s.favorites.includes(id));
  const selected = usePrefs((s) => s.selectedVersionId === id);
  const { resolved, active } = useModState(version ?? null);
  const navigate = useNavigate();
  const [check, setCheck] = useState<Check>({ state: 'idle' });

  if (!version) {
    return (
      <div className="page">
        <EmptyState title="Version introuvable" action={<Link className="btn-primary" to="/versions">Retour au catalogue</Link>}>
          Aucun manifeste valide ne porte l'identifiant « {id} ».
        </EmptyState>
      </div>
    );
  }
  const status = effectiveStatus(version);
  const playable = status === 'playable';

  /** Contrôle léger de l'index signé (sans télécharger les fichiers ; le lancement, lui, vérifie chaque SHA-256). */
  const verifyIndex = async () => {
    if (!version.assetIndex || !version.assetIndexSha256) return setCheck({ state: 'error', message: 'Aucun index de ressources signé dans le manifeste.' });
    setCheck({ state: 'running' });
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${version.assetIndex}`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status === 404 ? 'Index absent : build non déployée.' : `HTTP ${res.status}`);
      const text = await res.text();
      if ((await sha256Hex(text)) !== version.assetIndexSha256) throw new Error('Signature de l’index invalide.');
      const idx = AssetIndexSchema.parse(JSON.parse(text));
      setCheck({ state: 'done', files: idx.files.length, bytes: idx.files.reduce((s, f) => s + f.size, 0) });
    } catch (e) {
      setCheck({ state: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="page">
      <Link to="/versions" className="text-sm font-semibold text-muted hover:text-ink">← Catalogue</Link>
      <div className="mt-3 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <VersionThumb version={version} className="aspect-[16/10] w-full rounded-2xl" />
          {version.thumbnail.kind === 'gradient' && <p className="mt-2 text-xs text-muted">Visuel générique : aucune capture officielle n'est distribuée par ce launcher.</p>}
        </div>
        <div className="lg:col-span-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {status !== version.status && <span className="text-xs text-muted">(déclaré : {STATUS_LABEL[version.status]})</span>}
          </div>
          <h1 className="h1 mt-2">{version.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {version.releaseDate ?? version.year}
            {version.dateConfidence === 'community' ? ' · date issue de sources communautaires' : version.dateConfidence === 'verified' ? ' · date vérifiée' : ''} · {version.city}
          </p>
          <p className="mt-4 text-sm leading-relaxed">{version.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={!playable} onClick={() => { usePrefs.getState().selectVersion(version.id); navigate('/play', { state: { autostart: true } }); }}>▶ PLAY</button>
            <button type="button" className="btn-ghost" aria-pressed={selected} onClick={() => { usePrefs.getState().selectVersion(version.id); toast('ok', 'Version sélectionnée', version.title); }}>{selected ? '✓ Sélectionnée' : 'Sélectionner'}</button>
            <button type="button" className="btn-ghost" aria-pressed={fav} onClick={() => usePrefs.getState().toggleFavorite(version.id)}>{fav ? '★ Favori' : '☆ Favori'}</button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="h2">Moteur & ressources</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted">Identifiant</dt><dd className="font-mono text-xs">{version.id}</dd>
            <dt className="text-muted">Moteur</dt><dd>{version.engineId} {version.engineVersion} {hasEngine(version.engineId) ? '· adaptateur présent' : '· aucun adaptateur'}</dd>
            <dt className="text-muted">Index</dt><dd className="truncate font-mono text-xs">{version.assetIndex ?? '—'}</dd>
            <dt className="text-muted">Signature</dt><dd className="truncate font-mono text-xs">{version.assetIndexSha256?.slice(0, 16) ?? '—'}</dd>
            <dt className="text-muted">Graphismes</dt><dd className="uppercase">{version.recommendedGraphics}</dd>
            <dt className="text-muted">Plateformes</dt>
            <dd>{[version.compatibility.mobile && 'mobile', version.compatibility.desktop && 'ordinateur', version.compatibility.touch && 'tactile', version.compatibility.keyboard && 'clavier'].filter(Boolean).join(', ') || 'aucune'}</dd>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-ghost" onClick={() => void verifyIndex()} disabled={check.state === 'running'}>Vérifier les ressources</button>
            <div aria-live="polite" className="text-sm">
              {check.state === 'running' && <Spinner label="Vérification" />}
              {check.state === 'done' && <span className="text-ok">Index signé valide : {check.files} fichiers, {formatBytes(check.bytes)}.</span>}
              {check.state === 'error' && <span className="text-bad">{check.message}</span>}
            </div>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="h2">Mods compatibles</h2>
          {version.supportedMods.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Aucun mod déclaré pour cette version.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {version.supportedMods.map((mid) => {
                const m = modById.get(mid);
                const on = active.includes(mid);
                const bad = resolved?.issues.some((i) => i.modId === mid);
                return (
                  <li key={mid} className="flex items-center gap-2">
                    <span aria-hidden className={on ? 'text-ok' : 'text-muted'}>{on ? '●' : '○'}</span>
                    <span className="flex-1">{m?.name ?? `${mid} (introuvable)`}</span>
                    {bad && <span className="text-xs text-warn">à vérifier</span>}
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/mods" className="btn-ghost mt-4" onClick={() => usePrefs.getState().selectVersion(version.id)}>Configurer les mods</Link>
        </section>

        <section className="card p-4 md:col-span-2">
          <h2 className="h2">Incompatibilités</h2>
          {version.incompatibilities.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Aucune incompatibilité connue.</p>
          ) : (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">{version.incompatibilities.map((x) => <li key={x}>{x}</li>)}</ul>
          )}
          <h2 className="h2 mt-5">Captures</h2>
          {version.screenshots.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Aucune capture autorisée fournie.</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {version.screenshots.map((s) => (
                <figure key={s.src}><img src={`${import.meta.env.BASE_URL}${s.src}`} alt={s.alt} loading="lazy" className="rounded-xl" /><figcaption className="mt-1 text-[10px] text-muted">{s.license}</figcaption></figure>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
