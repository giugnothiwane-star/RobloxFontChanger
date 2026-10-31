import { useMemo } from 'react';
import { usePrefs, type Settings } from '@/stores/prefs';
import { concreteProfile, readDeviceHints, RENDER_SCALE } from '@/services/graphics';
import { Segmented, Toggle } from '@/components/ui/primitives';
import { toast } from '@/stores/toasts';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="h2 mb-3">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const s = usePrefs((x) => x.settings);
  const up = (p: Partial<Settings>) => usePrefs.getState().updateSettings(p);
  const hints = useMemo(() => readDeviceHints(), []);
  const resolved = concreteProfile(s.graphics, hints);
  const effectiveScale = RENDER_SCALE[resolved] * s.resolution;

  return (
    <div className="page">
      <h1 className="h1">Settings</h1>
      <p className="mt-1 text-sm text-muted">Enregistré automatiquement dans ce navigateur.</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Apparence">
          <div>
            <span className="label">Thème</span>
            <Segmented label="Thème" value={s.theme} onChange={(theme) => up({ theme })} options={[{ value: 'dark', label: 'Sombre' }, { value: 'light', label: 'Clair' }, { value: 'system', label: 'Système' }]} />
          </div>
          <div>
            <span className="label">Animations de l'interface</span>
            <Segmented label="Animations" value={s.uiAnimations} onChange={(uiAnimations) => up({ uiAnimations })} options={[{ value: 'system', label: 'Système' }, { value: 'on', label: 'Activées' }, { value: 'off', label: 'Réduites' }]} />
          </div>
          <div>
            <label className="label" htmlFor="s-lang">Langue</label>
            <select id="s-lang" className="input" value={s.language} onChange={() => undefined}>
              <option value="fr">Français</option>
              <option value="en" disabled>English (traduction non disponible)</option>
            </select>
          </div>
        </Card>

        <Card title="Graphismes">
          <div>
            <span className="label">Profil</span>
            <Segmented label="Profil graphique" value={s.graphics} onChange={(graphics) => up({ graphics })} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'auto', label: 'Auto' }]} />
            <p className="mt-2 text-xs text-muted">
              {s.graphics === 'auto' ? `AUTO → ${resolved.toUpperCase()} (indices : ${hints.cores ?? '?'} cœurs, ${hints.memoryGb ?? '?'} Go annoncés). Estimation, pas une mesure.` : `Profil ${resolved.toUpperCase()}.`}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="s-res">Résolution : {Math.round(s.resolution * 100)} % (rendu effectif {Math.round(effectiveScale * 100)} %)</label>
            <input id="s-res" type="range" min={0.5} max={1} step={0.05} value={s.resolution} onChange={(e) => up({ resolution: Number(e.target.value) })} className="w-full accent-[rgb(var(--accent))]" />
          </div>
          <Toggle label="Plein écran au lancement" checked={s.fullscreenOnLaunch} onChange={(fullscreenOnLaunch) => up({ fullscreenOnLaunch })} />
        </Card>

        <Card title="Audio">
          <div>
            <label className="label" htmlFor="s-vol">Volume : {Math.round(s.volume * 100)} %</label>
            <input id="s-vol" type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => up({ volume: Number(e.target.value) })} className="w-full accent-[rgb(var(--accent))]" />
          </div>
          <Toggle label="Effets sonores" checked={s.sfx} onChange={(sfx) => up({ sfx })} />
          <p className="text-xs text-muted">Transmis aux moteurs exposant un canal audio. Le moteur Subway Lab actuel n'a pas de son.</p>
        </Card>

        <Card title="Contrôles & mods">
          <Toggle label="Contrôles tactiles du lecteur" description="Barre de contrôle tactile (pause, retour) au-dessus du jeu." checked={s.touchControls} onChange={(touchControls) => up({ touchControls })} />
          <Toggle label="Résolution automatique des dépendances" description="Active les dépendances d'un mod après confirmation." checked={s.autoResolveModDeps} onChange={(autoResolveModDeps) => up({ autoResolveModDeps })} />
        </Card>
      </div>
      <div className="mt-6">
        <button type="button" className="btn-danger" onClick={() => { usePrefs.getState().resetSettings(); toast('info', 'Réglages réinitialisés'); }}>Réinitialiser les réglages</button>
      </div>
    </div>
  );
}
