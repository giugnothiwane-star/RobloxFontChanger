import { useEffect, type ReactNode } from 'react';
import { useCatalog } from '@/stores/catalog';
import { EmptyState } from '@/components/ui/primitives';

export function CatalogGate({ children }: { children: ReactNode }) {
  const { status, error, load } = useCatalog();
  useEffect(() => {
    void load();
  }, [load]);
  if (status === 'error') {
    return (
      <div className="page">
        <EmptyState title="Catalogue indisponible" action={<button className="btn-primary" onClick={() => void load(true)}>Réessayer</button>}>
          <p role="alert">{error}</p>
        </EmptyState>
      </div>
    );
  }
  if (status !== 'ready') {
    return (
      <div className="page" aria-busy="true">
        <div className="skeleton h-10 w-64" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-56" />)}
        </div>
        <span className="sr-only" role="status">Chargement du catalogue…</span>
      </div>
    );
  }
  return <>{children}</>;
}
