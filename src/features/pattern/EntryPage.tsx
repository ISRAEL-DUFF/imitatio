import { Link, useParams } from 'react-router';
import { PageStub } from '@/components/PageStub';
import { useEntry } from '@/lib/db/entries';
import { PatternCard } from './PatternCard';

export function EntryPage() {
  const { id } = useParams();
  const data = useEntry(id);

  if (data === undefined) return <p className="text-muted">Loading…</p>;
  if (data === null) {
    return (
      <PageStub title="Pattern not found">
        <p>There is no saved pattern with this address. It may have been deleted.</p>
        <Link to="/" className="text-accent underline">
          Back to the notebook
        </Link>
      </PageStub>
    );
  }

  const { entry, passage } = data;
  return (
    <PatternCard
      title={entry.title}
      text={passage.text}
      language={entry.language}
      variety={passage.variety}
      level={entry.level}
      source={passage.source}
      notes={entry.notes}
      skeleton={entry.skeleton}
      model={entry.model}
      actions={
        <Link
          to={`/entry/${entry.id}/generate`}
          className="rounded-md border border-rule px-3 py-1.5 text-sm hover:border-muted"
        >
          Generate from this pattern
        </Link>
      }
    />
  );
}
