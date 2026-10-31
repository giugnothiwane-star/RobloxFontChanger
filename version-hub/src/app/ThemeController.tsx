import { useEffect } from 'react';
import { usePrefs } from '@/stores/prefs';

/** Applique thème et préférence d'animations sur <html> ; suit le thème système si demandé. */
export function ThemeController() {
  const theme = usePrefs((s) => s.settings.theme);
  const motion = usePrefs((s) => s.settings.uiAnimations);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    const apply = () => root.setAttribute('data-theme', theme === 'system' ? (mq?.matches ? 'light' : 'dark') : theme);
    apply();
    if (theme !== 'system' || !mq) return;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.setAttribute('data-motion', motion);
  }, [motion]);
  return null;
}
