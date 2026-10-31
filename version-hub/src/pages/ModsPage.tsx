import { useMemo, useState } from 'react';
import { useCatalog } from '@/stores/catalog';
import { usePrefs } from '@/stores/prefs';
import { useModState, useSelectedVersion } from '@/hooks/useVersionState';
import { checkModStandalone, planActivation, planDeactivation } from '@/services/modResolver';
import { normalize } from '@/services/versionQuery';
import { MOD_CATEGORIES, type ModCategory } from '@/validators/schemas';
import { CATEGORY_LABEL } from '@/utils/format';
import { ModCard } from '@/components/mods/ModCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/primitives';
import { toast } from '@/stores/toasts';

interface Pending {
  modId: string;
  next: string[];
  added: string[];
}

export function ModsPage() {
  const mods = useCatalog((s) => s.mods);
  const registry = useCatalog((s) => s.modById);
  const versions = useCatalog((s) => s.versions);
  const version = useSelectedVersion();
  const { active, caps, resolved } = useModState(version);
  const autoDeps = usePrefs((s) => s.settings.autoResolveModDeps);
  const [text, setText] = useState('');
  const [cat, setCat] = useState<ModCategory | 'all'>('all');
  const [pending, setPending] = useState<Pending | null>(null);

  const list = useMemo(() => {
    const n = normalize(text);
    return mods.filter((m) => (cat === 'all' || m.category === cat) && (!n || normalize(`${m.name} ${m.description} ${m.id} ${m.author}`).includes(n)));
  }, [mods, text, cat]);

  // Problèmes qu'entraînerait l'activation (conflits avec les mods actifs inclus) ; les erreurs
  // préexistantes de l'ensemble actif ne sont pas imputées au mod prévisualisé.
  const previewIssues = (modId: string) => {
    if (!version) return [];
    const plan = planActivation(modId, active, registry, version, caps);
    if (plan.ok) return [];
    const preexisting = new Set(resolved?.issues.map((i) => i.message) ?? []);
    const own = plan.issues.filter((i) => !preexisting.has(i.message));
    return own.length ? own : checkModStandalone(modId, registry, version, caps);
  };

  const commit = (next: string[], label: string) => {
    if (!version) return;
    usePrefs.getState().setMods(version.id, next);
    toast('ok', label);
  };

  const toggle = (modId: string, on: boolean) => {
    if (!version) return;
    const name = registry.get(modId)?.name ?? modId;
    if (!on) {
      const r = planDeactivation(modId, active, registry);
      commit(r.next, r.removed.length ? `${name} désactivé (+ ${r.removed.map((x) => registry.get(x)?.name ?? x).join(', ')})` : `${name} désactivé`);
      return;
    }
    const plan = planActivation(modId, active, registry, version, caps);
    if (!plan.ok) {
      toast('bad', `Impossible d'activer ${name}`, plan.issues.map((i) => i.message).join(' '));
      return;
    }
    if (plan.added.length && !autoDeps) {
      toast('warn', `${name} nécessite des dépendances`, 'Activez-les d’abord, ou autorisez la résolution automatique dans Settings.');
      return;
    }
    // Confirmation explicite dès qu'une activation modifie d'autres mods ou est expérimentale.
    if (plan.added.length || registry.get(modId)?.experimental) setPending({ modId, next: plan.next, added: plan.added });
    else commit(plan.next, `${name} activé`);
  };

  return (
    <div className="page">
      <h1 className="h1">Mods</h1>
      <p className="mt-1 text-sm text-muted">
        Mods déclaratifs uniquement (filtres, superpositions, paramètres bornés) : aucun code de mod n'est exécuté. Chaque manifeste est validé et sa somme de contrôle vérifiée.
      </p>

      <div className="card mt-5 grid gap-3 p-4 md:grid-cols-3">
        <div>
          <label className="label" htmlFor="m-version">Version ciblée</label>
          <select id="m-version" className="input" value={version?.id ?? ''} onChange={(e) => usePrefs.getState().selectVersion(e.target.value || null)}>
            <option value="">— Choisir —</option>
            {versions.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="m-search">Recherche</label>
          <input id="m-search" type="search" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Nom, description, auteur" />
        </div>
        <div>
          <label className="label" htmlFor="m-cat">Catégorie</label>
          <select id="m-cat" className="input" value={cat} onChange={(e) => setCat(e.target.value as ModCategory | 'all')}>
            <option value="all">Toutes</option>
            {MOD_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </div>
      </div>

      {version && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted">{active.length} mod(s) actif(s) pour {version.title}.</span>
          {resolved && !resolved.ok && <span role="alert" className="text-warn">Configuration enregistrée invalide : {resolved.issues.length} problème(s).</span>}
          <button type="button" className="btn-ghost ml-auto" disabled={active.length === 0} onClick={() => { usePrefs.getState().resetMods(version.id); toast('info', 'Configuration de mods réinitialisée'); }}>
            Réinitialiser
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="mt-4"><EmptyState title="Aucun mod trouvé" /></div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => {
            const on = active.includes(m.id);
            const issues = version
              ? on
                ? resolved?.issues.filter((i) => i.modId === m.id) ?? []
                : previewIssues(m.id)
              : [];
            return <ModCard key={m.id} mod={m} active={on} issues={issues} canToggle={!!version} onToggle={(v) => toggle(m.id, v)} registry={registry} />;
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        title={`Activer ${pending ? registry.get(pending.modId)?.name ?? pending.modId : ''} ?`}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) commit(pending.next, `${registry.get(pending.modId)?.name ?? pending.modId} activé`);
          setPending(null);
        }}
      >
        {pending?.added.length ? <p>Dépendances activées en même temps : {pending.added.map((x) => registry.get(x)?.name ?? x).join(', ')}.</p> : null}
        {pending && registry.get(pending.modId)?.experimental && <p className="mt-2 text-warn">Ce mod est expérimental.</p>}
      </ConfirmDialog>
    </div>
  );
}
