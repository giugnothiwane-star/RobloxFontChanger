# Subway Version Hub

Launcher web (React 18 + TypeScript strict + Vite + Tailwind + Zod + Zustand) pour parcourir des éditions, composer des mods et lancer **uniquement** les builds réellement présentes, autorisées et vérifiées.

> Non affilié à SYBO Games / Kiloo. Les éditions officielles de Subway Surfers sont référencées à titre documentaire, **sans aucune ressource, capture ni binaire**. Elles sont natives Android/iOS (Unity) : un APK ne s'exécute pas dans un navigateur, elles sont donc marquées « Non disponible ».
> Le seul moteur jouable est **Subway Lab Infinite** (`../subway-lab`), prototype original du dépôt, sans ressource officielle.

```bash
cd version-hub
npm install
npm run dev          # http://localhost:5190 (copie le moteur + signe les manifestes avant)
npm test             # 83 tests Vitest
npm run build        # typecheck + build de production dans dist/
npm run test:e2e     # test navigateur réel sur le build (Playwright déjà présent dans l'environnement)
```

## Fonctionnalités

| Domaine | Implémentation |
|---|---|
| Catalogue | `catalog/versions.json` validé entrée par entrée (Zod) ; manifestes invalides/doublons écartés et listés dans About |
| Recherche / filtres / tri | nom, ville (insensible aux accents), année, identifiant ; jouables, indisponibles, récentes, anciennes, année, ville, moteur ; date ↑↓, nom, disponibilité |
| Statuts | `playable`, `missing-assets`, `incompatible`, `preparing`, `unavailable`. Le statut **effectif** ne peut que se dégrader : `playable` exige un adaptateur moteur enregistré et un index de ressources signé |
| Mods | déclaratifs uniquement (filtre CSS borné, superposition, audio, paramètre moteur) — **aucun code de mod exécuté**. Vérification : existence, support par la version, plage semver du moteur, dépendances (tri topologique, cycles), conflits motivés, permissions déclarées *et* accordées par le moteur, ressources, somme SHA-256 |
| PLAY | pipeline en 10 étapes (`src/services/launcher.ts`) : configuration → disponibilité → moteur → navigateur/mémoire → index signé → SHA-256 de chaque fichier → mods → initialisation (attente du signal `ready` réel) → configuration → démarrage. 100 % uniquement après `start()` |
| Lecteur | plein écran, pause/reprise (pont postMessage même origine), retour au launcher (iframe libérée), redimensionnement/rotation sans rechargement, pause auto quand l'onglet est masqué |
| Graphismes | LOW / MEDIUM / HIGH / AUTO → échelle de rendu réelle (iframe rendue à `scale ×` puis agrandie : le moteur dessine moins de pixels) |
| Préférences | Zustand `persist` + localStorage tolérant (navigation privée, quota), réhydratation validée par Zod, valeurs corrompues remplacées par défaut |
| Library | sélection, favoris, 30 dernières sessions (succès/échecs), configurations de mods, relance, effacement |
| Accessibilité | lien d'évitement, focus géré au changement de page, `role=switch/radiogroup/progressbar/alert`, modale à focus piégé, cibles ≥ 44 px, `prefers-reduced-motion` + forçage dans Settings |
| Sécurité | CSP stricte injectée au build, chemins de ressources relatifs uniquement (pas de schéma, pas de `..`), iframe `sandbox`, messages filtrés par origine **et** fenêtre source, aucun secret côté client |

## Architecture

```
version-hub/
├── catalog/              sources des manifestes (versions.json, mods.json)
├── scripts/sync-engines.mjs   copie les moteurs du dépôt, génère integrity.json, signe les manifestes
├── public/               icônes ; engines/ et manifests/ sont générés (gitignorés)
├── src/
│   ├── app/              App, routes (HashRouter), thème, garde de catalogue
│   ├── components/       layout/, versions/, mods/, launcher/, ui/
│   ├── engines/          GameEngineAdapter, registre, SubwayLabAdapter, vérification des ressources
│   ├── services/         catalogue, requêtes, résolveur de mods, effets, graphismes, launcher, erreurs
│   ├── stores/           prefs (persistées), catalog, toasts
│   ├── validators/       schémas Zod (source unique des types)
│   ├── pages/            Home, Versions, VersionDetail, Mods, Library, Play (lazy), Settings, About
│   └── utils/            semver, hash canonique/SHA-256, formatage
├── tests/                Vitest (unitaires + composants)
└── tests-e2e/smoke.mjs   test navigateur réel (mobile 393×851 tactile + ordinateur)
```

Choix notables :
- **HashRouter** : fonctionne sur tout hébergement statique sans règle de réécriture.
- **Pas d'IndexedDB** : les données locales sont de quelques Ko ; localStorage suffit. Les ressources moteur passent par le cache HTTP (vérifiées puis réutilisées par l'iframe sans second transfert).
- **iframe même origine** pour le moteur : contexte JS isolé, libération mémoire complète à la sortie (`about:blank` puis retrait).

## Guides

- [Ajouter une version](docs/ADDING_VERSIONS.md)
- [Ajouter un mod](docs/ADDING_MODS.md)
- [Déploiement](docs/DEPLOYMENT.md)

## Limitations connues

- Aucune édition officielle n'est jouable : aucune build web autorisée n'est disponible. L'emplacement « build web autorisée » (`webgl-generic`) est prêt mais sans adaptateur ni ressources.
- Le moteur Subway Lab n'a pas de son : volume et mod « Sourdine » sont désactivés pour lui (refus explicite par permissions).
- Le mod « Assistance de voie » est refusé : le moteur n'expose pas de point d'extension gameplay.
- Langue : français uniquement (l'anglais est affiché comme non disponible).
- AUTO repose sur `hardwareConcurrency` / `deviceMemory` (arrondis, parfois absents) : estimation, pas un benchmark.
- Dates « ≈ » des étapes du World Tour : sources communautaires (wiki fandom), non vérifiées auprès de l'éditeur.
