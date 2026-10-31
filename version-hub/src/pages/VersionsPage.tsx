import { useDeferredValue, useMemo, useState } from 'react';
import { useCatalog } from '@/stores/catalog';
import { DEFAULT_QUERY, facets, queryVersions, type AvailabilityFilter, type SortKey, type VersionQuery } from '@/services/versionQuery';
import { effectiveStatus } from '@/services/availability';
import { VersionCard } from '@/components/versions/VersionCard';
import { EmptyState, Segmented } from '@/components/ui/primitives';

const AVAIL: { value: AvailabilityFilter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'playable', label: 'Jouables' },
  { value: 'unavailable', label: 'Indispo.' },
  { value: 'recent', label: 'Récentes' },
  { value: 'old', label: 'Anciennes' },
];

export function VersionsPage() {
  const versions = useCatalog((s) => s.versions);
  const [q, setQ] = useState<VersionQuery>(DEFAULT_QUERY);
  const deferredText = useDeferredValue(q.text);
  const f = useMemo(() => facets(versions), [versions]);
  const results = useMemo(() => queryVersions(versions, { ...q, text: deferredText }, effectiveStatus), [versions, q, deferredText]);
  const patch = (p: Partial<VersionQuery>) => setQ((x) => ({ ...x, ...p }));
  const dirty = JSON.stringify(q) !== JSON.stringify(DEFAULT_QUERY);

  return (
    <div className="page">
      <h1 className="h1">Versions</h1>
      <p className="mt-1 text-sm text-muted">{versions.length} éditions au catalogue. Les éditions officielles sont référencées sans ressources : elles ne sont pas lançables.</p>

      <div className="card mt-5 grid gap-3 p-4 md:grid-cols-12">
        <div className="md:col-span-5">
          <label className="label" htmlFor="v-search">Recherche</label>
          <input id="v-search" type="search" className="input" placeholder="Nom, ville, année ou identifiant" value={q.text} onChange={(e) => patch({ text: e.target.value })} autoComplete="off" />
        </div>
        <div className="md:col-span-7">
          <span className="label">Disponibilité</span>
          <Segmented label="Disponibilité" value={q.availability} options={AVAIL} onChange={(availability) => patch({ availability })} />
        </div>
        <div className="md:col-span-3">
          <label className="label" htmlFor="v-year">Année</label>
          <select id="v-year" className="input" value={q.year ?? ''} onChange={(e) => patch({ year: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Toutes</option>
            {f.years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="label" htmlFor="v-city">Ville / thème</label>
          <select id="v-city" className="input" value={q.city ?? ''} onChange={(e) => patch({ city: e.target.value || null })}>
            <option value="">Toutes</option>
            {f.cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="label" htmlFor="v-engine">Moteur</label>
          <select id="v-engine" className="input" value={q.engineId ?? ''} onChange={(e) => patch({ engineId: e.target.value || null })}>
            <option value="">Tous</option>
            {f.engines.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="label" htmlFor="v-sort">Tri</label>
          <select id="v-sort" className="input" value={q.sort} onChange={(e) => patch({ sort: e.target.value as SortKey })}>
            <option value="date-desc">Date décroissante</option>
            <option value="date-asc">Date croissante</option>
            <option value="name">Nom (A → Z)</option>
            <option value="availability">Disponibilité</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted" role="status" aria-live="polite">{results.length} résultat(s)</p>
        {dirty && <button type="button" className="text-sm font-semibold text-accent" onClick={() => setQ(DEFAULT_QUERY)}>Réinitialiser les filtres</button>}
      </div>

      {results.length === 0 ? (
        <div className="mt-4"><EmptyState title="Aucune version ne correspond">Modifiez la recherche ou les filtres.</EmptyState></div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{results.map((v) => <VersionCard key={v.id} version={v} />)}</div>
      )}
    </div>
  );
}
