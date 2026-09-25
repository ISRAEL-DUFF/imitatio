import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { PageStub } from '@/components/PageStub';
import { db } from '@/lib/db/db';

export function NotebookPage() {
  const count = useLiveQuery(() => db.entries.count());

  return (
    <PageStub title="Notebook">
      <p>
        {count === undefined ? 'Opening notebook…' : `${count} saved pattern${count === 1 ? '' : 's'}.`}
      </p>
      <p>Search, filters and the pattern list arrive in M3.</p>
      <Link to="/analyze" className="text-accent underline">
        Analyse a passage
      </Link>
    </PageStub>
  );
}
