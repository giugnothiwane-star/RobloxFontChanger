import type { VersionManifest, VersionStatus } from '@/validators/schemas';

export type AvailabilityFilter = 'all' | 'playable' | 'unavailable' | 'recent' | 'old';
export type SortKey = 'date-asc' | 'date-desc' | 'name' | 'availability';

export interface VersionQuery {
  text: string;
  availability: AvailabilityFilter;
  year: number | null;
  city: string | null;
  engineId: string | null;
  sort: SortKey;
}

export const DEFAULT_QUERY: VersionQuery = { text: '', availability: 'all', year: null, city: null, engineId: null, sort: 'date-desc' };

/** Seuil « récente / ancienne » relatif à la version la plus récente du catalogue, pas à l'horloge. */
export const RECENT_SPAN_YEARS = 3;

const STATUS_RANK: Record<VersionStatus, number> = { playable: 0, preparing: 1, 'missing-assets': 2, incompatible: 3, unavailable: 4 };

export const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

const sortValue = (v: VersionManifest) => v.releaseDate ?? `${v.year}-12-31`;

export function queryVersions(
  versions: readonly VersionManifest[],
  q: VersionQuery,
  effectiveStatus: (v: VersionManifest) => VersionStatus = (v) => v.status,
): VersionManifest[] {
  const needle = normalize(q.text);
  const maxYear = versions.reduce((m, v) => Math.max(m, v.year), 0);
  const recentFrom = maxYear - RECENT_SPAN_YEARS + 1;
  const out = versions.filter((v) => {
    if (needle) {
      const hay = normalize(`${v.title} ${v.city} ${v.year} ${v.id}`);
      if (!needle.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    const st = effectiveStatus(v);
    switch (q.availability) {
      case 'playable': if (st !== 'playable') return false; break;
      case 'unavailable': if (st === 'playable') return false; break;
      case 'recent': if (v.year < recentFrom) return false; break;
      case 'old': if (v.year >= recentFrom) return false; break;
      case 'all': break;
    }
    if (q.year !== null && v.year !== q.year) return false;
    if (q.city !== null && v.city !== q.city) return false;
    if (q.engineId !== null && v.engineId !== q.engineId) return false;
    return true;
  });
  const byName = (a: VersionManifest, b: VersionManifest) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
  const cmp: Record<SortKey, (a: VersionManifest, b: VersionManifest) => number> = {
    'date-asc': (a, b) => sortValue(a).localeCompare(sortValue(b)) || byName(a, b),
    'date-desc': (a, b) => sortValue(b).localeCompare(sortValue(a)) || byName(a, b),
    name: byName,
    availability: (a, b) => STATUS_RANK[effectiveStatus(a)] - STATUS_RANK[effectiveStatus(b)] || byName(a, b),
  };
  return out.sort(cmp[q.sort]);
}

export function facets(versions: readonly VersionManifest[]) {
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  return {
    years: uniq(versions.map((v) => v.year)).sort((a, b) => b - a),
    cities: uniq(versions.map((v) => v.city)).sort((a, b) => a.localeCompare(b, 'fr')),
    engines: uniq(versions.map((v) => v.engineId)).sort(),
  };
}
