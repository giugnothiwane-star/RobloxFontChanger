import { clsx } from 'clsx';
import type { VersionManifest } from '@/validators/schemas';

/**
 * Vignette générique : aucune capture officielle n'est utilisée. Une image n'est
 * affichée que si le manifeste en déclare une, avec licence, servie localement.
 */
export function VersionThumb({ version, className }: { version: VersionManifest; className?: string }) {
  const t = version.thumbnail;
  if (t.kind === 'image') {
    return <img src={`${import.meta.env.BASE_URL}${t.src}`} alt={t.alt} loading="lazy" decoding="async" className={clsx('object-cover', className)} />;
  }
  return (
    <div
      role="img"
      aria-label={`Visuel générique pour ${version.title}`}
      className={clsx('relative overflow-hidden', className)}
      style={{ backgroundImage: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
    >
      <div aria-hidden className="absolute inset-0 opacity-25" style={{ backgroundImage: 'repeating-linear-gradient(115deg, rgb(255 255 255 / .35) 0 2px, transparent 2px 22px)' }} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
      <span aria-hidden className="absolute bottom-2 left-3 text-2xl font-black uppercase tracking-tight text-white/90 drop-shadow">{t.label}</span>
      <span aria-hidden className="absolute right-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">{version.year}</span>
    </div>
  );
}
