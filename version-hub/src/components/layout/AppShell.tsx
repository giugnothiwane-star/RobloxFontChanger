import { clsx } from 'clsx';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { NAV } from './nav';
import { Icon } from './Icon';
import { Toasts } from './Toasts';
import { useSelectedVersion } from '@/hooks/useVersionState';
import { useEffect, useRef } from 'react';

export function AppShell() {
  const selected = useSelectedVersion();
  const loc = useLocation();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  // Changement de page : focus sur le contenu pour les lecteurs d'écran, sauf au premier rendu.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  return (
    <div className="md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-white">
        Aller au contenu
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line/60 bg-surface/70 px-3 py-5 backdrop-blur md:flex">
        <NavLink to="/" className="mb-6 flex items-center gap-2 px-2">
          <img src={`${import.meta.env.BASE_URL}icons/hub.svg`} alt="" className="h-9 w-9" />
          <span className="leading-tight">
            <span className="block text-sm font-black tracking-wide">SUBWAY</span>
            <span className="block text-xs font-semibold text-muted">VERSION HUB</span>
          </span>
        </NavLink>
        <nav aria-label="Navigation principale" className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                clsx('flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-bold uppercase tracking-wider transition-colors', isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-raised hover:text-ink')
              }
            >
              <Icon d={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-line/60 bg-raised/50 p-3 text-xs">
          <p className="font-semibold text-muted">Version sélectionnée</p>
          <p className="mt-1 truncate font-bold">{selected?.title ?? 'Aucune'}</p>
        </div>
      </aside>

      <main id="main" ref={main} tabIndex={-1} className="min-h-dvh min-w-0 flex-1 outline-none">
        <Outlet />
      </main>

      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-7">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) => clsx('flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase', isActive ? 'text-accent' : 'text-muted')}
              >
                {n.to === '/play' ? (
                  <span className="-mt-5 grid h-12 w-12 place-items-center rounded-2xl bg-accent text-white shadow-glow">
                    <Icon d={n.icon} className="h-6 w-6" />
                  </span>
                ) : (
                  <Icon d={n.icon} />
                )}
                <span className="max-w-full truncate px-0.5">{n.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Toasts />
    </div>
  );
}
