# Ajouter un mod

Les mods sont **déclaratifs** : aucun JavaScript de mod n'est chargé ni exécuté.

1. Ajoutez l'entrée dans `catalog/mods.json` (`ModManifestSchema`).
2. `effects` (1 à 8), valeurs bornées par le schéma :
   | type | champs | permission |
   |---|---|---|
   | `cssFilter` | `brightness` 0.3–1.8, `contrast` 0.5–2, `saturate` 0–2, `hueRotate` −180–180, `grayscale` 0–1 | `render.filter` |
   | `overlay` | `pattern` `scanlines` \| `vignette` \| `letterbox`, `opacity` 0–1 | `render.overlay` |
   | `audio` | `volume` 0–1 | `audio.volume` |
   | `engineParam` | `key`, `value` (bool/nombre/texte court) | `gameplay.local` |
3. `permissions` doit couvrir chaque effet ; le moteur doit aussi **accorder** la permission (`registry.ts`), sinon le mod est refusé avec une explication.
4. `compatibility` : `[{ engineId, range }]` avec `*`, `x.y.z`, `^x.y.z`, `~x.y.z`, `>=a.b.c [<d.e.f]`.
5. `dependencies` / `conflicts` (avec `reason` affichée à l'utilisateur).
6. Ajoutez l'id du mod dans `supportedMods` des versions concernées.
7. `checksum` est calculé au build (`npm run sync:engines`) : SHA-256 de la sérialisation canonique des effets. Un manifeste modifié après signature est rejeté au chargement.
