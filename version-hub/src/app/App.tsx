import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ThemeController } from './ThemeController';
import { CatalogGate } from './CatalogGate';
import { HomePage } from '@/pages/HomePage';
import { VersionsPage } from '@/pages/VersionsPage';
import { VersionDetailPage } from '@/pages/VersionDetailPage';
import { ModsPage } from '@/pages/ModsPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AboutPage } from '@/pages/AboutPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { Spinner } from '@/components/ui/primitives';

// Le lecteur (moteur, vérification SHA-256) n'est chargé qu'à l'ouverture de PLAY.
const PlayPage = lazy(() => import('@/pages/PlayPage'));

export function App() {
  return (
    <HashRouter>
      <ThemeController />
      <CatalogGate>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="versions" element={<VersionsPage />} />
            <Route path="versions/:id" element={<VersionDetailPage />} />
            <Route path="mods" element={<ModsPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route
              path="play"
              element={
                <Suspense fallback={<div className="page"><Spinner label="Ouverture du lecteur" /></div>}>
                  <PlayPage />
                </Suspense>
              }
            />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </CatalogGate>
    </HashRouter>
  );
}
