import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/, 'Identifiant invalide (minuscules, chiffres, tirets).');
const semver = z.string().regex(/^\d+\.\d+\.\d+$/, 'Version sémantique attendue (x.y.z).');
const sha = z.string().regex(/^[a-f0-9]{64}$/, 'Somme SHA-256 hexadécimale attendue.');
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/**
 * Chemin de ressource strictement relatif à l'origine : interdit les schémas
 * (javascript:, data:, http:), les chemins absolus et la remontée « .. ».
 */
export const safeRelativePath = z
  .string()
  .min(1)
  .max(256)
  .refine((p) => !/^[a-z][a-z0-9+.-]*:/i.test(p) && !p.startsWith('/') && !p.startsWith('\\'), 'URL externe ou absolue refusée.')
  .refine((p) => !p.split(/[\\/]/).includes('..'), 'Remontée de répertoire refusée.')
  .refine((p) => /^[\w./-]+$/.test(p), 'Caractères non autorisés dans le chemin.');

export const VERSION_STATUSES = ['playable', 'missing-assets', 'incompatible', 'preparing', 'unavailable'] as const;
export const GRAPHICS_PROFILES = ['low', 'medium', 'high', 'auto'] as const;
export const MOD_CATEGORIES = ['graphics', 'interface', 'audio', 'gameplay', 'customization', 'experimental'] as const;
export const MOD_PERMISSIONS = ['render.filter', 'render.overlay', 'audio.volume', 'gameplay.local'] as const;

export const AssetManifestSchema = z.object({
  path: safeRelativePath,
  sha256: sha,
  size: z.number().int().nonnegative().optional(),
  required: z.boolean().default(true),
});

export const ThumbnailSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('gradient'), from: hexColor, to: hexColor, label: z.string().max(24) }),
  z.object({ kind: z.literal('image'), src: safeRelativePath, alt: z.string().min(1).max(160), license: z.string().min(1) }),
]);

export const VersionManifestSchema = z.object({
  id: slug,
  title: z.string().min(1).max(120),
  kind: z.enum(['official', 'original-prototype']),
  year: z.number().int().min(2012).max(2100),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  dateConfidence: z.enum(['verified', 'community', 'unknown']),
  city: z.string().min(1).max(60),
  description: z.string().min(1).max(1200),
  engineId: slug,
  engineVersion: semver,
  assets: z.array(AssetManifestSchema).max(5000),
  assetIndex: safeRelativePath.nullable(),
  assetIndexSha256: sha.nullable().optional(),
  supportedMods: z.array(slug).max(200),
  compatibility: z.object({ mobile: z.boolean(), desktop: z.boolean(), touch: z.boolean(), keyboard: z.boolean() }),
  status: z.enum(VERSION_STATUSES),
  recommendedGraphics: z.enum(GRAPHICS_PROFILES),
  incompatibilities: z.array(z.string().max(300)).max(20),
  thumbnail: ThumbnailSchema,
  screenshots: z.array(z.object({ src: safeRelativePath, alt: z.string().min(1), license: z.string().min(1) })).max(20),
  manifestVersion: z.literal(1),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const unit = (min: number, max: number) => z.number().finite().min(min).max(max);

/** Effets déclaratifs uniquement : aucun code de mod n'est jamais exécuté. */
export const ModEffectSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('cssFilter'),
      brightness: unit(0.3, 1.8).optional(),
      contrast: unit(0.5, 2).optional(),
      saturate: unit(0, 2).optional(),
      hueRotate: unit(-180, 180).optional(),
      grayscale: unit(0, 1).optional(),
    })
    .strict(),
  z.object({ type: z.literal('overlay'), pattern: z.enum(['scanlines', 'vignette', 'letterbox']), opacity: unit(0, 1) }).strict(),
  z.object({ type: z.literal('audio'), volume: unit(0, 1) }).strict(),
  z.object({ type: z.literal('engineParam'), key: z.string().regex(/^[a-zA-Z][\w]{0,31}$/), value: z.union([z.boolean(), z.number().finite(), z.string().max(64)]) }).strict(),
]);

const range = z.string().regex(/^(\*|\^\d+\.\d+\.\d+|~\d+\.\d+\.\d+|\d+\.\d+\.\d+|>=\d+\.\d+\.\d+( <\d+\.\d+\.\d+)?)$/, 'Plage de versions non reconnue.');

export const ModManifestSchema = z.object({
  id: slug,
  name: z.string().min(1).max(80),
  version: semver,
  category: z.enum(MOD_CATEGORIES),
  description: z.string().min(1).max(600),
  author: z.string().min(1).max(80),
  license: z.string().min(1).max(40),
  compatibility: z.array(z.object({ engineId: slug, range })).min(1),
  dependencies: z.array(z.object({ id: slug, range })).max(20),
  conflicts: z.array(z.object({ id: slug, reason: z.string().min(1).max(300) })).max(20),
  assets: z.array(AssetManifestSchema).max(200),
  permissions: z.array(z.enum(MOD_PERMISSIONS)).max(MOD_PERMISSIONS.length),
  effects: z.array(ModEffectSchema).min(1).max(8),
  experimental: z.boolean(),
  checksum: sha,
});

export const AssetIndexSchema = z.object({
  engineId: slug,
  engineVersion: semver,
  entry: safeRelativePath,
  files: z.array(z.object({ path: safeRelativePath, sha256: sha, size: z.number().int().nonnegative() })).min(1).max(5000),
});

export type VersionStatus = (typeof VERSION_STATUSES)[number];
export type GraphicsProfile = (typeof GRAPHICS_PROFILES)[number];
export type ModCategory = (typeof MOD_CATEGORIES)[number];
export type ModPermission = (typeof MOD_PERMISSIONS)[number];
export type AssetManifest = z.infer<typeof AssetManifestSchema>;
export type VersionManifest = z.infer<typeof VersionManifestSchema>;
export type ModManifest = z.infer<typeof ModManifestSchema>;
export type ModEffect = z.infer<typeof ModEffectSchema>;
export type AssetIndex = z.infer<typeof AssetIndexSchema>;
