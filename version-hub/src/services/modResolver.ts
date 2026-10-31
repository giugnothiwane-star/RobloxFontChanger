import type { ModManifest, ModPermission, VersionManifest } from '@/validators/schemas';
import { satisfies } from '@/utils/semver';

export type ModIssueCode =
  | 'unknown-mod'
  | 'not-supported-by-version'
  | 'engine-incompatible'
  | 'missing-dependency'
  | 'dependency-version'
  | 'conflict'
  | 'permission-undeclared'
  | 'permission-denied'
  | 'assets-missing';

export interface ModIssue {
  code: ModIssueCode;
  modId: string;
  message: string;
  relatedId?: string;
}

export interface EngineCapabilities {
  engineId: string;
  engineVersion: string;
  /** Permissions que le moteur sait honorer ; tout le reste est refusé. */
  grants: readonly ModPermission[];
}

const EFFECT_PERMISSION: Record<ModManifest['effects'][number]['type'], ModPermission> = {
  cssFilter: 'render.filter',
  overlay: 'render.overlay',
  audio: 'audio.volume',
  engineParam: 'gameplay.local',
};

/**
 * Vérifie un mod isolément (existence, support, moteur, permissions, ressources).
 * Les dépendances et conflits dépendent de l'ensemble actif : voir resolveModSet.
 */
export function checkModStandalone(
  modId: string,
  registry: ReadonlyMap<string, ModManifest>,
  version: VersionManifest,
  caps: EngineCapabilities | null,
): ModIssue[] {
  const mod = registry.get(modId);
  if (!mod) return [{ code: 'unknown-mod', modId, message: `Le mod « ${modId} » n'existe pas dans le catalogue.` }];
  const issues: ModIssue[] = [];
  if (!version.supportedMods.includes(modId)) {
    issues.push({ code: 'not-supported-by-version', modId, message: `« ${mod.name} » n'est pas déclaré compatible avec ${version.title}.` });
  }
  const engineOk = mod.compatibility.some((c) => c.engineId === version.engineId && satisfies(version.engineVersion, c.range));
  if (!engineOk) {
    const wanted = mod.compatibility.map((c) => `${c.engineId} ${c.range}`).join(', ');
    issues.push({ code: 'engine-incompatible', modId, message: `« ${mod.name} » cible ${wanted} ; la version utilise ${version.engineId} ${version.engineVersion}.` });
  }
  for (const effect of mod.effects) {
    const need = EFFECT_PERMISSION[effect.type];
    if (!mod.permissions.includes(need)) {
      issues.push({ code: 'permission-undeclared', modId, message: `« ${mod.name} » utilise un effet « ${effect.type} » sans déclarer la permission ${need}.` });
    } else if (!caps || !caps.grants.includes(need)) {
      issues.push({ code: 'permission-denied', modId, message: `Le moteur ${version.engineId} n'accorde pas la permission ${need} requise par « ${mod.name} ».` });
    }
  }
  if (mod.assets.some((a) => a.required)) {
    // Le launcher ne livre pas encore de ressources de mods : refus explicite plutôt qu'activation partielle.
    issues.push({ code: 'assets-missing', modId, message: `« ${mod.name} » requiert des ressources non fournies.` });
  }
  return dedupe(issues);
}

function dedupe(issues: ModIssue[]): ModIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const k = `${i.code}|${i.modId}|${i.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface ResolveResult {
  ok: boolean;
  issues: ModIssue[];
  /** Ordre d'application : dépendances avant dépendants (tri topologique). */
  order: string[];
}

export function resolveModSet(
  activeIds: readonly string[],
  registry: ReadonlyMap<string, ModManifest>,
  version: VersionManifest,
  caps: EngineCapabilities | null,
): ResolveResult {
  const active = new Set(activeIds);
  const issues: ModIssue[] = [];
  for (const id of active) issues.push(...checkModStandalone(id, registry, version, caps));

  for (const id of active) {
    const mod = registry.get(id);
    if (!mod) continue;
    for (const dep of mod.dependencies) {
      const target = registry.get(dep.id);
      if (!active.has(dep.id) || !target) {
        issues.push({ code: 'missing-dependency', modId: id, relatedId: dep.id, message: `« ${mod.name} » nécessite « ${target?.name ?? dep.id} » (${dep.range}), qui n'est pas activé.` });
      } else if (!satisfies(target.version, dep.range)) {
        issues.push({ code: 'dependency-version', modId: id, relatedId: dep.id, message: `« ${mod.name} » nécessite « ${target.name} » ${dep.range} ; version présente ${target.version}.` });
      }
    }
    for (const c of mod.conflicts) {
      // Un conflit déclaré d'un seul côté suffit ; on ne le signale qu'une fois par paire.
      if (active.has(c.id) && (id < c.id || !registry.get(c.id)?.conflicts.some((x) => x.id === id))) {
        issues.push({ code: 'conflict', modId: id, relatedId: c.id, message: `« ${mod.name} » est incompatible avec « ${registry.get(c.id)?.name ?? c.id} » : ${c.reason}` });
      }
    }
  }

  const order: string[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (id: string, stack: string[]): void => {
    const s = state.get(id);
    if (s === 2) return;
    if (s === 1) {
      issues.push({ code: 'missing-dependency', modId: id, message: `Dépendance circulaire : ${[...stack, id].join(' → ')}.` });
      return;
    }
    state.set(id, 1);
    for (const dep of registry.get(id)?.dependencies ?? []) if (active.has(dep.id)) visit(dep.id, [...stack, id]);
    state.set(id, 2);
    order.push(id);
  };
  for (const id of [...active].sort()) if (registry.has(id)) visit(id, []);

  const unique = dedupe(issues);
  return { ok: unique.length === 0, issues: unique, order };
}

/**
 * Simulation d'activation : renvoie l'ensemble final (avec dépendances ajoutées
 * automatiquement si elles sont elles-mêmes valides) ou les raisons du refus.
 */
export function planActivation(
  modId: string,
  activeIds: readonly string[],
  registry: ReadonlyMap<string, ModManifest>,
  version: VersionManifest,
  caps: EngineCapabilities | null,
): { ok: true; next: string[]; added: string[] } | { ok: false; issues: ModIssue[] } {
  const next = new Set(activeIds);
  next.add(modId);
  const added: string[] = [];
  const queue = [modId];
  while (queue.length) {
    const cur = registry.get(queue.shift() as string);
    for (const dep of cur?.dependencies ?? []) {
      if (!next.has(dep.id) && registry.has(dep.id)) {
        next.add(dep.id);
        added.push(dep.id);
        queue.push(dep.id);
      }
    }
  }
  const res = resolveModSet([...next], registry, version, caps);
  return res.ok ? { ok: true, next: res.order, added } : { ok: false, issues: res.issues };
}

/** Désactivation : retire aussi les mods qui dépendaient transitivement de celui-ci. */
export function planDeactivation(modId: string, activeIds: readonly string[], registry: ReadonlyMap<string, ModManifest>): { next: string[]; removed: string[] } {
  const removed = new Set([modId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of activeIds) {
      if (removed.has(id)) continue;
      if (registry.get(id)?.dependencies.some((d) => removed.has(d.id))) {
        removed.add(id);
        changed = true;
      }
    }
  }
  return { next: activeIds.filter((id) => !removed.has(id)), removed: [...removed].filter((id) => id !== modId) };
}
