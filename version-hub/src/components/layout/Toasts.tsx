import { clsx } from 'clsx';
import { useToasts } from '@/stores/toasts';

const TONE = { info: 'border-line', ok: 'border-ok/60', warn: 'border-warn/60', bad: 'border-bad/60' } as const;

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6">
      {toasts.map((t) => (
        <div key={t.id} role={t.tone === 'bad' ? 'alert' : 'status'} className={clsx('card pointer-events-auto w-full max-w-sm animate-scale-in border-l-4 p-3', TONE[t.tone])}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs text-muted">{t.body}</p>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Fermer la notification" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-raised">
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
