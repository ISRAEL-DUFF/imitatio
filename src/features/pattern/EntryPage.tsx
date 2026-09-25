import { Link, useParams } from 'react-router';
import { PageStub } from '@/components/PageStub';

const TABS = ['Notes', 'Skeleton', 'Tokens', 'Generations'] as const;

export function EntryPage() {
  const { id } = useParams();

  return (
    <PageStub title="Pattern">
      <p>
        Entry <code>{id}</code>. Tabs: {TABS.join(', ')}. The pattern card arrives in M2.
      </p>
      <Link to={`/entry/${id}/generate`} className="text-accent underline">
        Generate from this pattern
      </Link>
    </PageStub>
  );
}
