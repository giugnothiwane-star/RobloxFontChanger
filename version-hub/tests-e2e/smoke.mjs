/**
 * Test navigateur réel sur le build de production (vite preview).
 * Utilise le Playwright disponible dans l'environnement ; aucune installation requise.
 * Usage : npm run build && npm run test:e2e   (captures dans tests-e2e/screens/)
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = new URL('./screens/', import.meta.url).pathname;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
// Groupe de processus : npx lance vite en enfant, il faut tuer les deux.
const stop = () => {
  try { process.kill(-server.pid, 'SIGTERM'); } catch { /* déjà arrêté */ }
};
process.on('exit', stop);

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('vite preview ne répond pas');
}

const steps = [];
const step = async (name, fn) => {
  await fn();
  steps.push(name);
  console.log(`  ✓ ${name}`);
};

let browser;
try {
  await waitServer();
  await mkdir(SHOTS, { recursive: true });
  browser = await chromium.launch();
  const errors = [];

  for (const profile of [
    { name: 'mobile', viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    { name: 'desktop', viewport: { width: 1366, height: 820 } },
  ]) {
    console.log(`Profil ${profile.name}`);
    const ctx = await browser.newContext(profile);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${profile.name}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${profile.name} console: ${m.text()}`));

    await step('accueil chargé, Continuer désactivé', async () => {
      await page.goto(BASE);
      await page.getByRole('link', { name: 'Explorer les versions' }).waitFor();
      assert.equal(await page.getByRole('button', { name: /Continuer ma dernière session/ }).isDisabled(), true);
      await page.screenshot({ path: `${SHOTS}${profile.name}-home.png`, fullPage: true });
    });

    await step('aucun débordement horizontal', async () => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, `débordement de ${overflow}px`);
    });

    await step('catalogue : recherche + PLAY désactivé pour une édition officielle', async () => {
      await page.goto(`${BASE}#/versions`);
      await page.getByLabel('Recherche').fill('tokyo');
      const card = page.getByRole('article', { name: 'World Tour : Tokyo' });
      await card.waitFor();
      assert.equal(await card.getByRole('button', { name: /PLAY/ }).isDisabled(), true);
      assert.equal(await page.getByRole('article').count(), 1);
      await page.getByLabel('Recherche').fill('');
      await page.screenshot({ path: `${SHOTS}${profile.name}-versions.png` });
    });

    await step('mods : activation Contraste élevé + Lignes rétro sur Subway Lab', async () => {
      await page.goto(`${BASE}#/mods`);
      await page.getByLabel('Version ciblée').selectOption('subway-lab-infinite');
      for (const name of ['Contraste élevé', 'Lignes rétro']) await page.getByRole('article', { name }).getByRole('switch').click();
      const audio = page.getByRole('article', { name: 'Sourdine du moteur' });
      assert.equal(await audio.getByRole('switch').isDisabled(), true, 'mod audio devrait être refusé (moteur sans son)');
      await page.screenshot({ path: `${SHOTS}${profile.name}-mods.png`, fullPage: true });
    });

    await step('PLAY réel : vérification SHA-256, iframe prête, jeu affiché', async () => {
      await page.goto(`${BASE}#/versions/subway-lab-infinite`);
      await page.getByRole('button', { name: /PLAY/ }).first().click();
      await page.getByRole('button', { name: 'Retour au launcher' }).waitFor({ timeout: 30000 });
      const frame = page.frameLocator('iframe.svh-engine-frame');
      await frame.locator('canvas#game').waitFor();
      const filter = await page.locator('iframe.svh-engine-frame').evaluate((f) => f.style.filter);
      assert.match(filter, /contrast\(1\.35\)/);
      assert.equal(await page.locator('.overlay-scanlines').count(), 1);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SHOTS}${profile.name}-play.png` });
    });

    await step('pause / reprise via le pont postMessage', async () => {
      const lab = () => page.frames().find((f) => f.url().includes('/engines/subway-lab/'));
      // Démarre une run dans le moteur pour que la pause ait un sens.
      await lab().evaluate(() => window.__lab.startRun());
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /Pause/ }).click();
      await page.getByRole('button', { name: /Reprendre/ }).waitFor();
      assert.match(await lab().evaluate(() => window.__lab.fsm.state), /PAUSED/);
      await page.getByRole('button', { name: /Reprendre/ }).click();
      await page.getByRole('button', { name: /Pause/ }).waitFor();
      assert.doesNotMatch(await lab().evaluate(() => window.__lab.fsm.state), /PAUSED/);
    });

    await step('rotation / redimensionnement sans perte de session', async () => {
      const before = await page.locator('iframe.svh-engine-frame').evaluate((f) => f.contentWindow.performance.timeOrigin);
      await page.setViewportSize({ width: profile.viewport.height, height: profile.viewport.width });
      await page.waitForTimeout(300);
      const after = await page.locator('iframe.svh-engine-frame').evaluate((f) => f.contentWindow.performance.timeOrigin);
      assert.equal(before, after, "l'iframe a été rechargée");
      await page.setViewportSize(profile.viewport);
    });

    await step('retour au launcher : moteur libéré, session enregistrée, Continuer actif', async () => {
      await page.getByRole('button', { name: 'Retour au launcher' }).click();
      assert.equal(await page.locator('iframe.svh-engine-frame').count(), 0);
      await page.goto(BASE);
      assert.equal(await page.getByRole('button', { name: /Continuer ma dernière session/ }).isDisabled(), false);
    });

    await step('préférences persistées après rechargement', async () => {
      await page.goto(`${BASE}#/settings`);
      await page.getByRole('radio', { name: 'Clair' }).click();
      await page.reload();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
      await page.screenshot({ path: `${SHOTS}${profile.name}-settings-light.png`, fullPage: true });
    });

    await step('ressource corrompue détectée au lancement', async () => {
      await page.route('**/engines/subway-lab/src/main.js', (r) => r.fulfill({ status: 200, body: 'tampered', contentType: 'text/javascript' }));
      await page.goto(`${BASE}#/play`);
      await page.getByRole('button', { name: /PLAY/ }).click();
      await page.getByRole('alert').filter({ hasText: 'Ressource corrompue' }).waitFor({ timeout: 20000 });
      await page.screenshot({ path: `${SHOTS}${profile.name}-error.png` });
      await page.unroute('**/engines/subway-lab/src/main.js');
    });

    await ctx.close();
  }
  await browser.close();
  const relevant = errors.filter((e) => !/favicon|ERR_ABORTED/.test(e));
  assert.deepEqual(relevant, [], `erreurs JS : ${relevant.join('\n')}`);
  console.log(`\n${steps.length} étapes réussies.`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => undefined);
  stop();
  process.exit(process.exitCode ?? 0);
}
