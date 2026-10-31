import { z } from 'zod';
import { ModManifestSchema, VersionManifestSchema, type ModManifest, type VersionManifest } from '@/validators/schemas';
import { canonical, hasSubtleCrypto, sha256Hex } from '@/utils/hash';

export interface RejectedEntry {
  source: 'versions' | 'mods';
  index: number;
  id: string | null;
  errors: string[];
}

export interface Catalog {
  versions: VersionManifest[];
  mods: ModManifest[];
  rejected: RejectedEntry[];
}

const Envelope = (key: 'versions' | 'mods') => z.object({ schemaVersion: z.literal(1), [key]: z.array(z.unknown()).max(2000) });

export class CatalogError extends Error {
  constructor(message: string, readonly recoverable: boolean) {
    super(message);
    this.name = 'CatalogError';
  }
}

const describe = (issues: z.ZodIssue[]) => issues.map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`);

/**
 * Validation entrée par entrée : un manifeste mal formé est écarté et signalé
 * sans invalider tout le catalogue. Les doublons d'identifiant sont refusés.
 */
export function validateEntries<T extends { id: string }, I = unknown>(
  raw: unknown[],
  schema: z.ZodType<T, z.ZodTypeDef, I>,
  source: RejectedEntry['source'],
): { valid: T[]; rejected: RejectedEntry[] } {
  const valid: T[] = [];
  const rejected: RejectedEntry[] = [];
  const seen = new Set<string>();
  raw.forEach((entry, index) => {
    const id = entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string' ? (entry as { id: string }).id : null;
    const parsed = schema.safeParse(entry);
    if (!parsed.success) return rejected.push({ source, index, id, errors: describe(parsed.error.issues) });
    if (seen.has(parsed.data.id)) return rejected.push({ source, index, id, errors: ['Identifiant en double.'] });
    seen.add(parsed.data.id);
    valid.push(parsed.data);
  });
  return { valid, rejected };
}

/** Écarte un mod dont les effets ne correspondent plus à la somme signée au build. */
export async function verifyModChecksums(mods: ModManifest[]): Promise<{ valid: ModManifest[]; rejected: RejectedEntry[] }> {
  if (!hasSubtleCrypto()) {
    return { valid: [], rejected: mods.map((m, index) => ({ source: 'mods', index, id: m.id, errors: ['WebCrypto indisponible : intégrité non vérifiable.'] })) };
  }
  const sums = await Promise.all(mods.map((m) => sha256Hex(canonical(m.effects))));
  const valid: ModManifest[] = [];
  const rejected: RejectedEntry[] = [];
  mods.forEach((m, index) => {
    if (sums[index] === m.checksum) valid.push(m);
    else rejected.push({ source: 'mods', index, id: m.id, errors: ['Somme de contrôle invalide : manifeste altéré.'] });
  });
  return { valid, rejected };
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal, cache: 'no-cache', credentials: 'same-origin' });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new CatalogError(`Réseau indisponible pour ${url}.`, true);
  }
  if (!res.ok) throw new CatalogError(`${url} : HTTP ${res.status}.`, res.status >= 500);
  try {
    return await res.json();
  } catch {
    throw new CatalogError(`${url} : JSON illisible.`, false);
  }
}

export async function loadCatalog(baseUrl = './', signal?: AbortSignal): Promise<Catalog> {
  const [rawV, rawM] = await Promise.all([
    fetchJson(`${baseUrl}manifests/versions.json`, signal),
    fetchJson(`${baseUrl}manifests/mods.json`, signal),
  ]);
  const ev = Envelope('versions').safeParse(rawV);
  const em = Envelope('mods').safeParse(rawM);
  if (!ev.success) throw new CatalogError(`Catalogue de versions mal formé : ${describe(ev.error.issues).join(' ; ')}`, false);
  if (!em.success) throw new CatalogError(`Catalogue de mods mal formé : ${describe(em.error.issues).join(' ; ')}`, false);
  const versions = validateEntries(ev.data.versions as unknown[], VersionManifestSchema, 'versions');
  const modsShape = validateEntries(em.data.mods as unknown[], ModManifestSchema, 'mods');
  const mods = await verifyModChecksums(modsShape.valid);
  return { versions: versions.valid, mods: mods.valid, rejected: [...versions.rejected, ...modsShape.rejected, ...mods.rejected] };
}
