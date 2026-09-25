import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router';
import { PageStub } from '@/components/PageStub';
import { Button } from '@/components/ui';
import { db } from '@/lib/db/db';
import { deleteEntry, updateEntry, useEntry } from '@/lib/db/entries';
import { GenerationsList } from '@/features/generate/GenerationsList';
import { PatternCard } from './PatternCard';

export function EntryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const data = useEntry(id);
  // Every tag in the notebook, straight from the multi-entry index.
  const allTags = useLiveQuery(async () => (await db.entries.orderBy('tags').uniqueKeys()).map(String), []);

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

  async function remove() {
    if (!window.confirm(`Delete “${entry.title}”? This cannot be undone.`)) return;
    await deleteEntry(entry.id);
    navigate('/', { replace: true });
  }

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
      tags={entry.tags}
      tagSuggestions={allTags}
      userEdited={entry.userEdited}
      onEdit={(patch) => updateEntry(entry.id, patch)}
      generations={<GenerationsList entryId={entry.id} skeleton={entry.skeleton} language={entry.language} />}
      actions={
        <>
          <Link
            to={`/entry/${entry.id}/generate`}
            className="rounded-md border border-rule px-3 py-1.5 text-sm hover:border-muted"
          >
            Generate from this pattern
          </Link>
          <Button variant="quiet" onClick={() => void remove()} className="ml-auto">
            Delete
          </Button>
        </>
      }
    />
  );
}
