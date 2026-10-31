import { DEFAULT_QUERY, facets, queryVersions } from '@/services/versionQuery';
import { makeVersion } from './fixtures';

const V = [
  makeVersion({ id: 'paris-2013', title: 'World Tour : Paris', city: 'Paris', year: 2013, status: 'unavailable', engineId: 'unity-android-native' }),
  makeVersion({ id: 'seoul-2014', title: 'World Tour : Seoul', city: 'Séoul', year: 2014, status: 'unavailable', engineId: 'unity-android-native' }),
  makeVersion({ id: 'lab', title: 'Lab', city: 'Laboratoire', year: 2026, releaseDate: '2026-10-31', status: 'playable' }),
  makeVersion({ id: 'orig', title: 'Original', city: 'Origine', year: 2012, releaseDate: '2012-05-24', status: 'unavailable', engineId: 'unity-android-native' }),
];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('recherche, filtres et tri', () => {
  it('recherche par nom, ville (sans accents), année et identifiant', () => {
    expect(ids(queryVersions(V, { ...DEFAULT_QUERY, text: 'paris' }))).toEqual(['paris-2013']);
    expect(ids(queryVersions(V, { ...DEFAULT_QUERY, text: 'seoul' }))).toEqual(['seoul-2014']);
    expect(ids(queryVersions(V, { ...DEFAULT_QUERY, text: '2012' }))).toEqual(['orig']);
    expect(ids(queryVersions(V, { ...DEFAULT_QUERY, text: 'lab' }))).toEqual(['lab']);
    expect(queryVersions(V, { ...DEFAULT_QUERY, text: 'zzz' })).toEqual([]);
    expect(queryVersions(V, { ...DEFAULT_QUERY, text: '   ' })).toHaveLength(4);
  });
  it('filtre jouables / indisponibles avec le statut effectif fourni', () => {
    expect(ids(queryVersions(V, { ...DEFAULT_QUERY, availability: 'playable' }))).toEqual(['lab']);
    expect(queryVersions(V, { ...DEFAULT_QUERY, availability: 'playable' }, () => 'incompatible')).toEqual([]);
    expect(queryVersions(V, { ...DEFAULT_QUERY, availability: 'unavailable' })).toHaveLength(3);
  });
  it('filtre récentes / anciennes relativement au catalogue', () => {
    expect(ids(queryVersions(V, { ...DEFAULT_QUERY, availability: 'recent' }))).toEqual(['lab']);
    expect(queryVersions(V, { ...DEFAULT_QUERY, availability: 'old' })).toHaveLength(3);
  });
  it('filtre par année, ville et moteur', () => {
    expect(ids(queryVersions(V, { ...DEFAULT_QUERY, year: 2014 }))).toEqual(['seoul-2014']);
    expect(ids(queryVersions(V, { ...DEFAULT_QUERY, city: 'Paris' }))).toEqual(['paris-2013']);
    expect(ids(queryVersions(V, { ...DEFAULT_QUERY, engineId: 'subway-lab' }))).toEqual(['lab']);
  });
  it('trie par date, nom et disponibilité', () => {
    expect(ids(queryVersions(V, { ...DEFAULT_QUERY, sort: 'date-asc' }))).toEqual(['orig', 'paris-2013', 'seoul-2014', 'lab']);
    expect(ids(queryVersions(V, { ...DEFAULT_QUERY, sort: 'date-desc' }))).toEqual(['lab', 'seoul-2014', 'paris-2013', 'orig']);
    expect(ids(queryVersions(V, { ...DEFAULT_QUERY, sort: 'name' }))).toEqual(['lab', 'orig', 'paris-2013', 'seoul-2014']);
    expect(ids(queryVersions(V, { ...DEFAULT_QUERY, sort: 'availability' }))[0]).toBe('lab');
  });
  it('ne modifie pas le tableau source et gère un catalogue vide', () => {
    const copy = [...V];
    queryVersions(V, { ...DEFAULT_QUERY, sort: 'name' });
    expect(V).toEqual(copy);
    expect(queryVersions([], DEFAULT_QUERY)).toEqual([]);
    expect(facets([])).toEqual({ years: [], cities: [], engines: [] });
  });
  it('calcule les facettes', () => {
    const f = facets(V);
    expect(f.years).toEqual([2026, 2014, 2013, 2012]);
    expect(f.engines).toEqual(['subway-lab', 'unity-android-native']);
  });
});
