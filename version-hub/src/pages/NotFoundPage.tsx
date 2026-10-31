import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/primitives';

export function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState title="Page introuvable" action={<Link to="/" className="btn-primary">Accueil</Link>}>Cette adresse ne correspond à aucune page du launcher.</EmptyState>
    </div>
  );
}
