import type { LaunchError, RecoveryAction } from '@/services/errors';
import { LAUNCH_STEPS, type LaunchProgress } from '@/services/launcher';

export function LoadingScreen({ progress, onCancel, title }: { progress: LaunchProgress | null; onCancel: () => void; title: string }) {
  const pct = Math.floor((progress?.ratio ?? 0) * 100);
  const currentIdx = progress ? LAUNCH_STEPS.findIndex((s) => s.id === progress.step) : 0;
  return (
    <div className="card mx-auto max-w-lg animate-scale-in p-6" aria-busy="true">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-accent">Lancement</p>
      <h2 className="h2 mt-1">{title}</h2>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progression du chargement">
        <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent2 transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm" aria-live="polite">
        {pct} % — {progress?.label ?? 'Préparation'} {progress?.detail && <span className="text-muted">({progress.detail})</span>}
      </p>
      <ol className="mt-4 space-y-1 text-xs">
        {LAUNCH_STEPS.map((s, i) => (
          <li key={s.id} className={i < currentIdx ? 'text-ok' : i === currentIdx ? 'font-bold text-ink' : 'text-muted'}>
            {i < currentIdx ? '✓' : i === currentIdx ? '›' : '·'} {s.label}
          </li>
        ))}
      </ol>
      <button type="button" className="btn-ghost mt-5 w-full" onClick={onCancel}>Annuler</button>
    </div>
  );
}

const RECOVERY_LABEL: Record<RecoveryAction, string> = {
  retry: 'Réessayer',
  'choose-version': 'Choisir une autre version',
  'disable-mods': 'Désactiver les mods et réessayer',
  'lower-graphics': 'Passer en LOW et réessayer',
  'update-browser': 'Mettre à jour le navigateur',
  back: 'Retour au launcher',
};

export function ErrorPanel({ error, onAction }: { error: LaunchError; onAction: (a: RecoveryAction) => void }) {
  return (
    <div role="alert" className="card mx-auto max-w-lg animate-scale-in border-bad/50 p-6">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-bad">Erreur · {error.code}</p>
      <h2 className="h2 mt-1">{error.title}</h2>
      <p className="mt-2 text-sm">{error.message}</p>
      {error.details.length > 0 && <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-muted">{error.details.map((d) => <li key={d}>{d}</li>)}</ul>}
      <div className="mt-5 flex flex-wrap gap-2">
        {error.recovery.map((a, i) =>
          a === 'update-browser' ? (
            <p key={a} className="w-full text-xs text-muted">Utilisez une version récente de Chrome, Firefox, Edge ou Safari, en HTTPS ou sur localhost.</p>
          ) : (
            <button key={a} type="button" className={i === 0 ? 'btn-primary' : 'btn-ghost'} onClick={() => onAction(a)}>{RECOVERY_LABEL[a]}</button>
          ),
        )}
        {!error.recovery.includes('back') && <button type="button" className="btn-ghost" onClick={() => onAction('back')}>{RECOVERY_LABEL.back}</button>}
      </div>
    </div>
  );
}
