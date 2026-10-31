# Déploiement

Site 100 % statique : `npm ci && npm run build` → `dist/`.

- Le build lance `sync:engines` : le dossier `../subway-lab` doit être présent (dépôt complet). Sans lui, la version Subway Lab passe automatiquement en « Ressources manquantes ».
- `base: './'` + HashRouter : déployable dans n'importe quel sous-dossier (GitHub Pages, Netlify, Vercel, Render static, nginx) sans règle de réécriture.
- **HTTPS obligatoire** hors localhost : WebCrypto (vérification SHA-256) n'existe qu'en contexte sécurisé ; sinon le lancement affiche « Navigateur non compatible ».
- Aucune variable d'environnement ni secret requis.
- En-têtes recommandés côté serveur : `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` ; ne pas envoyer `X-Frame-Options: DENY` (le moteur est servi en iframe même origine, `SAMEORIGIN` convient). La CSP est déjà injectée en `<meta>`.

Vercel (exemple) : racine `version-hub`, build `npm run build`, sortie `dist`. Aucun déploiement n'a été effectué.
