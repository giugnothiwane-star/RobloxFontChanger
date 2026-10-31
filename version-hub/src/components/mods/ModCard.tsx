import { clsx } from 'clsx';
import type { ModManifest } from '@/validators/schemas';
import type { ModIssue } from '@/services/modResolver';
import { Badge, Toggle } from '@/components/ui/primitives';
import { CATEGORY_LABEL } from '@/utils/format';

interface Props {
  mod: ModManifest;
  active: boolean;
  issues: ModIssue[];
  canToggle: boolean;
  onToggle: (next: boolean) => void;
  registry: ReadonlyMap<string, ModManifest>;
}

export function ModCard({ mod, active, issues, canToggle, onToggle, registry }: Props) {
  const blocked = issues.length > 0 && !active;
  return (
    <article className={clsx('card flex flex-col gap-3 p-4 transition-shadow', active && 'ring-2 ring-accent/70')} aria-label={mod.name}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{CATEGORY_LABEL[mod.category]}</Badge>
        {mod.experimental && <Badge tone="warn">Expérimental</Badge>}
        <span className="ml-auto text-xs text-muted">v{mod.version}</span>
      </div>
      <div>
        <h3 className="font-bold">{mod.name}</h3>
        <p className="mt-1 text-sm text-muted">{mod.description}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted">Auteur</dt><dd className="truncate">{mod.author}</dd>
        <dt className="text-muted">Licence</dt><dd>{mod.license}</dd>
        <dt className="text-muted">Moteurs</dt><dd className="truncate">{mod.compatibility.map((c) => `${c.engineId} ${c.range}`).join(', ')}</dd>
        <dt className="text-muted">Permissions</dt><dd className="truncate">{mod.permissions.join(', ') || '—'}</dd>
        <dt className="text-muted">Dépendances</dt><dd className="truncate">{mod.dependencies.map((d) => registry.get(d.id)?.name ?? d.id).join(', ') || '—'}</dd>
        <dt className="text-muted">Conflits</dt><dd className="truncate">{mod.conflicts.map((c) => registry.get(c.id)?.name ?? c.id).join(', ') || '—'}</dd>
      </dl>
      {issues.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-warn/30 bg-warn/10 p-2 text-xs text-warn" aria-label={`Problèmes de compatibilité de ${mod.name}`}>
          {issues.map((i, k) => <li key={k}>• {i.message}</li>)}
        </ul>
      )}
      <div className="mt-auto">
        <Toggle
          label={active ? 'Activé' : 'Désactivé'}
          checked={active}
          disabled={!canToggle || blocked}
          onChange={onToggle}
          description={!canToggle ? 'Sélectionnez une version pour gérer les mods.' : blocked ? 'Activation impossible : voir ci-dessus.' : undefined}
        />
      </div>
    </article>
  );
}
