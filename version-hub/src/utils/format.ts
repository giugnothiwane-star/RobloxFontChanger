import type { ModCategory, VersionStatus } from '@/validators/schemas';

export const STATUS_LABEL: Record<VersionStatus, string> = {
  playable: 'Jouable',
  'missing-assets': 'Ressources manquantes',
  incompatible: 'Moteur incompatible',
  preparing: 'En préparation',
  unavailable: 'Non disponible',
};

export const STATUS_TONE: Record<VersionStatus, 'ok' | 'warn' | 'bad' | 'muted'> = {
  playable: 'ok',
  'missing-assets': 'warn',
  incompatible: 'bad',
  preparing: 'muted',
  unavailable: 'muted',
};

export const CATEGORY_LABEL: Record<ModCategory, string> = {
  graphics: 'Graphismes',
  interface: 'Interface',
  audio: 'Audio',
  gameplay: 'Gameplay',
  customization: 'Personnalisation',
  experimental: 'Expérimental',
};

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ${s % 60} s` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function formatDate(iso: string | number): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}
