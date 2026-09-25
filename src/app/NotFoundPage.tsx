import { Link } from 'react-router';
import { PageStub } from '@/components/PageStub';

export function NotFoundPage() {
  return (
    <PageStub title="Not found">
      <Link to="/" className="text-accent underline">
        Back to the notebook
      </Link>
    </PageStub>
  );
}
