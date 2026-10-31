import { useCatalog } from '@/stores/catalog';

export function AboutPage() {
  const rejected = useCatalog((s) => s.rejected);
  return (
    <div className="page max-w-3xl">
      <h1 className="h1">About</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed">
        <p>
          <strong>Subway Version Hub</strong> est un launcher web de versions et de mods. Il n'est ni affilié à SYBO Games ni à Kiloo. « Subway Surfers » est une marque de ses détenteurs ;
          les éditions officielles sont référencées à titre documentaire, <strong>sans aucune ressource ni capture</strong>.
        </p>
        <p>
          Les éditions officielles sont des applications natives Android/iOS (Unity) : un APK ne s'exécute pas dans un navigateur et aucune build web autorisée n'est disponible. Elles sont donc marquées « Non disponible ».
          Le seul moteur jouable est <strong>Subway Lab Infinite</strong>, un prototype original développé dans ce dépôt, sans ressource officielle.
        </p>
        <p>
          Une version n'est lançable que si son adaptateur moteur existe, que l'index de ressources signé au build correspond au catalogue et que chaque fichier passe la vérification SHA-256 au lancement.
        </p>
        <p>Dates « ≈ » : issues de sources communautaires (wiki fandom), non confirmées par l'éditeur.</p>
      </div>
      <section className="card mt-6 p-4">
        <h2 className="h2">Manifestes refusés ({rejected.length})</h2>
        {rejected.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Tous les manifestes chargés sont valides.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {rejected.map((r) => (
              <li key={`${r.source}-${r.index}`} className="rounded-lg bg-raised p-2">
                <strong>{r.source} #{r.index}</strong> {r.id && <code>({r.id})</code>}
                <ul className="mt-1 list-inside list-disc text-muted">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
