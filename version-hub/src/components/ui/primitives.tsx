import { clsx } from 'clsx';
import { useId, type ReactNode } from 'react';
import type { VersionStatus } from '@/validators/schemas';
import { STATUS_LABEL, STATUS_TONE } from '@/utils/format';

const TONE = {
  ok: 'bg-ok/15 text-ok ring-1 ring-ok/30',
  warn: 'bg-warn/15 text-warn ring-1 ring-warn/30',
  bad: 'bg-bad/15 text-bad ring-1 ring-bad/30',
  muted: 'bg-raised text-muted ring-1 ring-line',
  accent: 'bg-accent/15 text-accent ring-1 ring-accent/30',
} as const;

export function Badge({ tone = 'muted', children, className }: { tone?: keyof typeof TONE; children: ReactNode; className?: string }) {
  return <span className={clsx('chip', TONE[tone], className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: VersionStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        {description && <p id={`${id}-d`} className="text-xs text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx('relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-40', checked ? 'bg-accent' : 'bg-line')}
      >
        <span className={clsx('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-7' : 'translate-x-1')} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-raised/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx('min-h-[40px] flex-1 rounded-lg px-3 text-xs font-bold uppercase tracking-wide transition-colors', value === o.value ? 'bg-accent text-white shadow' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <p className="h2">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function Spinner({ label = 'Chargement' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none" />
      {label}
    </span>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8 min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="h2">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
