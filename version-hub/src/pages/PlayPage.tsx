import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useCatalog } from '@/stores/catalog';
import { usePrefs } from '@/stores/prefs';
import { useModState, useSelectedVersion } from '@/hooks/useVersionState';
import { effectiveStatus } from '@/services/availability';
import { launch, type LaunchProgress } from '@/services/launcher';
import { LaunchError, toLaunchError, type RecoveryAction } from '@/services/errors';
import { concreteProfile, readDeviceHints, RENDER_SCALE } from '@/services/graphics';
import { createEngine, engineCapabilities } from '@/engines/registry';
import type { GameEngineAdapter } from '@/engines/types';
import type { ComposedEffects } from '@/services/effects';
import { EmptyState, StatusBadge } from '@/components/ui/primitives';
import { ErrorPanel, LoadingScreen } from '@/components/launcher/LaunchPanels';
import { toast } from '@/stores/toasts';
import { STATUS_LABEL } from '@/utils/format';

type Phase = { kind: 'idle' } | { kind: 'loading' } | { kind: 'running' } | { kind: 'error'; error: LaunchError };

export default function PlayPage() {
  const version = useSelectedVersion();
  const registry = useCatalog((s) => s.modById);
  const settings = usePrefs((s) => s.settings);
  const { active, resolved } = useModState(version);
  const navigate = useNavigate();
  const location = useLocation();

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [progress, setProgress] = useState<LaunchProgress | null>(null);
  const [paused, setPaused] = useState(false);
  const [overlays, setOverlays] = useState<ComposedEffects['overlays']>([]);
  const [hasAudio, setHasAudio] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<GameEngineAdapter | null>(null);
  const abort = useRef<AbortController | null>(null);
  const sessionId = useRef<string | null>(null);
  const autostarted = useRef(false);

  const teardown = useCallback((outcome: 'exited' | 'failed' = 'exited', err?: string) => {
    abort.current?.abort();
    abort.current = null;
    engine.current?.dispose();
    engine.current = null;
    if (sessionId.current) usePrefs.getState().endSession(sessionId.current, outcome, err);
    sessionId.current = null;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const start = useCallback(
    async (override?: { mods?: string[]; graphics?: 'low' }) => {
      if (!version || !host.current) return;
      teardown();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setPhase({ kind: 'loading' });
      setProgress(null);
      setPaused(false);
      const mods = override?.mods ?? active;
      const profile = override?.graphics ?? concreteProfile(settings.graphics);
      const hints = readDeviceHints();
      try {
        const res = await launch({
          version,
          mods,
          registry,
          createEngine: (id) => createEngine(id, import.meta.env.BASE_URL),
          capabilities: engineCapabilities,
          container: host.current,
          config: { renderScale: RENDER_SCALE[profile] * settings.resolution, volume: settings.sfx ? settings.volume : 0, touchControls: settings.touchControls },
          baseUrl: import.meta.env.BASE_URL,
          signal: ctrl.signal,
          onProgress: setProgress,
          deviceMemoryGb: hints.memoryGb,
        });
        if (ctrl.signal.aborted) {
          res.engine.dispose();
          return;
        }
        engine.current = res.engine;
        setOverlays(res.config.effects.overlays);
        setHasAudio(res.engine.hasAudio);
        sessionId.current = usePrefs.getState().startSession(version.id, res.appliedMods);
        setPhase({ kind: 'running' });
        if (settings.fullscreenOnLaunch) stage.current?.requestFullscreen?.().catch(() => toast('warn', 'Plein écran refusé par le navigateur'));
      } catch (e) {
        if (ctrl.signal.aborted && !(e instanceof LaunchError && e.code !== 'aborted')) {
          return;
        }
        const err = toLaunchError(e);
        const sid = usePrefs.getState().startSession(version.id, mods);
        usePrefs.getState().endSession(sid, 'failed', err.message);
        setPhase({ kind: 'error', error: err });
      }
    },
    [version, active, registry, settings, teardown],
  );

  // Démarrage automatique quand on arrive depuis un bouton PLAY (une seule fois par navigation).
  useEffect(() => {
    const auto = (location.state as { autostart?: boolean } | null)?.autostart;
    if (auto && !autostarted.current && version && effectiveStatus(version) === 'playable') {
      autostarted.current = true;
      navigate('.', { replace: true, state: null });
      void start();
    }
  }, [location.state, version, start, navigate]);

  // Redimensionnement / rotation : on redimensionne le moteur sans recharger la session.
  useEffect(() => {
    const el = host.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) engine.current?.resize(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (phase.kind !== 'running') return;
    const onHide = () => {
      if (document.hidden && engine.current) void engine.current.pause().then((ok) => ok && setPaused(true));
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [phase.kind]);

  const exit = () => {
    teardown();
    setPhase({ kind: 'idle' });
    toast('info', 'Retour au launcher');
  };

  const togglePause = async () => {
    const e = engine.current;
    if (!e) return;
    if (paused) {
      if (await e.resume()) setPaused(false);
    } else if (await e.pause()) setPaused(true);
    else toast('info', 'Aucune partie en cours à mettre en pause', 'Lancez une run dans le jeu.');
  };

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else stage.current?.requestFullscreen?.().catch(() => toast('warn', 'Plein écran indisponible'));
  };

  const onRecovery = (a: RecoveryAction) => {
    switch (a) {
      case 'retry': return void start();
      case 'disable-mods':
        if (version) usePrefs.getState().setMods(version.id, []);
        return void start({ mods: [] });
      case 'lower-graphics':
        usePrefs.getState().updateSettings({ graphics: 'low' });
        return void start({ graphics: 'low' });
      case 'choose-version': return navigate('/versions');
      case 'back':
      case 'update-browser':
        setPhase({ kind: 'idle' });
    }
  };

  const running = phase.kind === 'running';
  const status = version ? effectiveStatus(version) : null;

  return (
    <div className={clsx(!running && 'page')}>
      {!running && <h1 className="h1">Play</h1>}

      {!version && phase.kind === 'idle' && (
        <div className="mt-5"><EmptyState title="Aucune version sélectionnée" action={<Link to="/versions" className="btn-primary">Choisir une version</Link>}>Sélectionnez une version jouable dans le catalogue.</EmptyState></div>
      )}

      {version && phase.kind === 'idle' && (
        <div className="card mt-5 p-5">
          <div className="flex flex-wrap items-center gap-2">{status && <StatusBadge status={status} />}<span className="text-xs text-muted">{version.engineId} {version.engineVersion}</span></div>
          <h2 className="mt-2 text-xl font-bold">{version.title}</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            <li>Mods actifs : {active.length ? active.map((m) => registry.get(m)?.name ?? m).join(', ') : 'aucun'}</li>
            <li>Graphismes : {settings.graphics.toUpperCase()} → {concreteProfile(settings.graphics).toUpperCase()}, résolution {Math.round(settings.resolution * 100)} %</li>
          </ul>
          {resolved && !resolved.ok && <p role="alert" className="mt-3 text-sm text-warn">La configuration de mods sera refusée : {resolved.issues[0]?.message}</p>}
          {status !== 'playable' && status && <p className="mt-3 text-sm text-bad">Statut « {STATUS_LABEL[status]} » : lancement impossible. {version.incompatibilities[0]}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-primary min-w-[160px] text-base" disabled={status !== 'playable'} onClick={() => void start()}>▶ PLAY</button>
            <Link to="/mods" className="btn-ghost">Mods</Link>
            <Link to="/versions" className="btn-ghost">Changer de version</Link>
          </div>
        </div>
      )}

      {phase.kind === 'loading' && <div className="mt-5"><LoadingScreen title={version?.title ?? ''} progress={progress} onCancel={() => { teardown(); setPhase({ kind: 'idle' }); }} /></div>}
      {phase.kind === 'error' && <div className="mt-5"><ErrorPanel error={phase.error} onAction={onRecovery} /></div>}

      {/* Le conteneur existe en permanence : l'iframe s'y initialise de façon invisible pendant le chargement. */}
      <div
        ref={stage}
        className={clsx(running ? 'fixed inset-0 z-40 flex flex-col bg-black animate-fade-up' : 'pointer-events-none fixed -left-[9999px] top-0 h-[600px] w-[400px] opacity-0')}
        aria-hidden={!running}
      >
        {running && (
          <div className="flex items-center gap-1 bg-black/90 px-2 pb-1 pt-[max(.25rem,env(safe-area-inset-top))] text-white">
            <button type="button" className="btn min-h-[40px] px-3 hover:bg-white/10" onClick={exit} aria-label="Retour au launcher">← Launcher</button>
            <span className="mx-2 min-w-0 flex-1 truncate text-xs text-white/60">{version?.title}</span>
            <label className="hidden items-center gap-1 text-xs sm:flex" title={hasAudio ? undefined : 'Ce moteur n’a pas de son'}>
              <span aria-hidden>🔊</span>
              <span className="sr-only">Volume</span>
              <input type="range" min={0} max={1} step={0.05} value={settings.volume} disabled={!hasAudio} onChange={(e) => usePrefs.getState().updateSettings({ volume: Number(e.target.value) })} />
            </label>
            {settings.touchControls && (
              <button type="button" className="btn min-h-[40px] px-3 hover:bg-white/10" onClick={() => void togglePause()} aria-pressed={paused}>{paused ? '▶ Reprendre' : '❚❚ Pause'}</button>
            )}
            <button type="button" className="btn min-h-[40px] px-3 hover:bg-white/10" onClick={fullscreen} aria-label="Plein écran">⛶</button>
          </div>
        )}
        <div ref={host} className="relative flex-1 overflow-hidden">
          {overlays.map((o) => (
            <div key={o.pattern} aria-hidden className={`pointer-events-none absolute inset-0 z-10 overlay-${o.pattern}`} style={{ opacity: o.opacity }} />
          ))}
        </div>
      </div>
    </div>
  );
}
