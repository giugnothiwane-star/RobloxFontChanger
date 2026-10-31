import { Link, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useCatalog } from '@/stores/catalog';
import { usePrefs } from '@/stores/prefs';
import { effectiveStatus } from '@/services/availability';
import { useResumableSession } from '@/hooks/useVersionState';
import { VersionCard } from '@/components/versions/VersionCard';
import { Badge, Section } from '@/components/ui/primitives';
import { CATEGORY_LABEL, STATUS_LABEL } from '@/utils/format';
import { VERSION_STATUSES } from '@/validators/schemas';

export function HomePage() {
  const versions = useCatalog((s) => s.versions);
  const mods = useCatalog((s) => s.mods);
  const rejected = useCatalog((s) => s.rejected);
  const resumable = useResumableSession();
  const navigate = useNavigate();

  const counts = useMemo(() => {
    const c = Object.fromEntries(VERSION_STATUSES.map((s) => [s, 0])) as Record<(typeof VERSION_STATUSES)[number], number>;
    for (const v of versions) c[effectiveStatus(v)]++;
    return c;
  }, [versions]);
  const featured = useMemo(
    () => [...versions].sort((a, b) => Number(effectiveStatus(b) === 'playable') - Number(effectiveStatus(a) === 'playable') || b.year - a.year).slice(0, 3),
    [versions],
  );
  const updates = useMemo(() => [...versions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4), [versions]);
  // « Populaires » = mods actifs dans le plus de configurations locales ; aucune statistique distante n'est collectée.
  const modConfigs = usePrefs((s) => s.modConfigs);
  const popular = useMemo(() => {
    const score = new Map<string, number>();
    for (const list of Object.values(modConfigs)) for (const id of list) score.set(id, (score.get(id) ?? 0) + 1);
    return [...mods].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0) || a.name.localeCompare(b.name)).slice(0, 4);
  }, [mods, modConfigs]);

  return (
    <div className="page">
      <header className="card relative overflow-hidden p-6 md:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-accent2/20 blur-3xl" />
        <p className="text-xs font-bold uppercase tracking-[.25em] text-accent">Launcher de versions & mods</p>
        <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight md:text-5xl">
          SUBWAY <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">VERSION HUB</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted md:text-base">
          Parcourez les éditions, composez vos mods et lancez uniquement les builds réellement présentes, autorisées et vérifiées par somme de contrôle.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/versions" className="btn-primary">Explorer les versions</Link>
          <button
            type="button"
            className="btn-ghost"
            disabled={!resumable}
            title={resumable ? undefined : 'Aucune session compatible à reprendre'}
            onClick={() => {
              if (!resumable) return;
              const st = usePrefs.getState();
              st.selectVersion(resumable.version.id);
              st.setMods(resumable.version.id, resumable.session.mods);
              navigate('/play', { state: { autostart: true } });
            }}
          >
            ⟲ Continuer ma dernière session
          </button>
        </div>
        {resumable && <p className="mt-2 text-xs text-muted">Dernière : {resumable.version.title}</p>}
      </header>

      <section aria-label="Disponibilité des jeux" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {VERSION_STATUSES.map((s) => (
          <div key={s} className="card p-3">
            <p className="text-2xl font-black">{counts[s]}</p>
            <p className="text-xs text-muted">{STATUS_LABEL[s]}</p>
          </div>
        ))}
      </section>
      {rejected.length > 0 && (
        <p role="alert" className="mt-3 rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
          {rejected.length} manifeste(s) refusé(s) à la validation — détails dans About.
        </p>
      )}

      <Section title="Sélection" action={<Link to="/versions" className="text-sm font-semibold text-accent">Tout voir →</Link>}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{featured.map((v) => <VersionCard key={v.id} version={v} />)}</div>
      </Section>

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <Section title="Mods populaires" action={<Link to="/mods" className="text-sm font-semibold text-accent">Gérer →</Link>}>
          <ul className="card divide-y divide-line/60">
            {popular.map((m) => (
              <li key={m.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{m.name}</p>
                  <p className="truncate text-xs text-muted">{m.description}</p>
                </div>
                <Badge tone="accent">{CATEGORY_LABEL[m.category]}</Badge>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Dernières mises à jour">
          <ul className="card divide-y divide-line/60">
            {updates.map((v) => (
              <li key={v.id}>
                <Link to={`/versions/${v.id}`} className="flex min-h-[52px] items-center gap-3 p-3 hover:bg-raised/50">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{v.title}</span>
                  <span className="text-xs text-muted">{v.updatedAt}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
