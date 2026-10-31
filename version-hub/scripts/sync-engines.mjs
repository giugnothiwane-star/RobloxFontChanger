/**
 * Préparation build : copie les moteurs autorisés présents dans le dépôt vers
 * public/engines, génère leur index d'intégrité (SHA-256 par fichier) puis signe
 * les manifestes du catalogue (somme de l'index, somme des effets de chaque mod).
 * Aucune ressource n'est téléchargée depuis l'extérieur.
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC = join(ROOT, 'public');
const ENGINES = [
  {
    id: 'subway-lab',
    version: '1.0.0',
    source: resolve(ROOT, '..', 'subway-lab'),
    // sw.js exclu : un service worker imbriqué entrerait en conflit avec le cache du launcher.
    include: ['index.html', 'manifest.webmanifest', 'src', 'public'],
    entry: 'index.html',
  },
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Sérialisation canonique (clés triées) : identique au calcul côté navigateur. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else if (entry.isFile()) out.push(p);
  }
  return out;
}

async function syncEngine(engine) {
  const target = join(PUBLIC, 'engines', engine.id);
  await rm(target, { recursive: true, force: true });
  if (!existsSync(engine.source)) {
    console.warn(`[sync] moteur ${engine.id} absent (${engine.source}) : la version restera « ressources manquantes ».`);
    return null;
  }
  await mkdir(target, { recursive: true });
  for (const item of engine.include) {
    const from = join(engine.source, item);
    if (existsSync(from)) await cp(from, join(target, item), { recursive: true });
  }
  const files = [];
  for (const abs of (await walk(target)).sort()) {
    const rel = relative(target, abs).split(sep).join('/');
    if (rel === 'integrity.json') continue;
    const buf = await readFile(abs);
    files.push({ path: rel, sha256: sha256(buf), size: (await stat(abs)).size });
  }
  const index = { engineId: engine.id, engineVersion: engine.version, entry: engine.entry, files };
  const json = JSON.stringify(index, null, 2);
  await writeFile(join(target, 'integrity.json'), json);
  console.log(`[sync] ${engine.id} : ${files.length} fichiers indexés.`);
  return sha256(json);
}

async function main() {
  const indexSums = {};
  for (const engine of ENGINES) indexSums[engine.id] = await syncEngine(engine);

  const versions = JSON.parse(await readFile(join(ROOT, 'catalog', 'versions.json'), 'utf8'));
  for (const v of versions.versions) v.assetIndexSha256 = indexSums[v.engineId] ?? null;
  const mods = JSON.parse(await readFile(join(ROOT, 'catalog', 'mods.json'), 'utf8'));
  for (const m of mods.mods) m.checksum = sha256(canonical(m.effects));

  await mkdir(join(PUBLIC, 'manifests'), { recursive: true });
  await writeFile(join(PUBLIC, 'manifests', 'versions.json'), JSON.stringify(versions, null, 2));
  await writeFile(join(PUBLIC, 'manifests', 'mods.json'), JSON.stringify(mods, null, 2));
  console.log(`[sync] manifestes signés : ${versions.versions.length} versions, ${mods.mods.length} mods.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
