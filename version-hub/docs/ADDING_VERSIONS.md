# Ajouter une version

1. **Droits** : n'ajoutez des ressources que si vous détenez l'autorisation de les distribuer. Sinon, ajoutez une entrée documentaire avec `status: "unavailable"`, `assets: []`, `assetIndex: null`.
2. Ajoutez l'entrée dans `catalog/versions.json` (schéma : `src/validators/schemas.ts` → `VersionManifestSchema`). Champs clés :
   - `id` : `^[a-z0-9][a-z0-9-]{1,63}$`, unique.
   - `releaseDate` + `dateConfidence` (`verified` uniquement si la date vient de l'éditeur).
   - `thumbnail` : `gradient` (générique) ou `image` avec `src` relatif local, `alt` et `license`.
3. **Build jouable** :
   - Implémentez un `GameEngineAdapter` (`src/engines/types.ts`) — `loadAssets` (réutilisez `verifyAssets`), `initialize` (n'résout qu'au signal réel de disponibilité), `applyConfiguration`, `start`, `pause`, `resume`, `resize`, `dispose`.
   - Enregistrez-le dans `src/engines/registry.ts` avec ses permissions accordées.
   - Déclarez le moteur dans `scripts/sync-engines.mjs` (`ENGINES`) : source locale, fichiers inclus, point d'entrée. Le script génère `public/engines/<id>/integrity.json` et signe la version (`assetIndexSha256`).
   - Mettez `status: "playable"` **seulement après** un lancement réussi via `npm run test:e2e` (ajoutez un scénario).
4. `npm test && npm run build`.

Un APK Android n'est pas une build web : un moteur natif nécessite une build WebGL/WebAssembly officielle.
