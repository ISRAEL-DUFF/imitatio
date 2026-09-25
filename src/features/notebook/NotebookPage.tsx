import { Link } from 'react-router';
import { Chip, LanguageBadge } from '@/components/badges';
import { useRecentEntries } from '@/lib/db/entries';
import { labelFor } from '@/lib/llm/vocab';

// A plain recent list for now; search, filters and sorting arrive in M3.
export function NotebookPage() {
  const entries = useRecentEntries(50);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Notebook</h1>
        <Link to="/analyze" className="rounded-md bg-accent px-3 py-1.5 text-sm text-paper hover:opacity-90">
          Analyse a passage
        </Link>
      </div>

      {entries === undefined && <p className="text-muted">Opening notebook…</p>}
      {entries?.length === 0 && (
        <p className="text-muted">No saved patterns yet. Analyse a passage and save it to start your notebook.</p>
      )}

      <ul className="space-y-3">
        {entries?.map(({ entry, passage }) => (
          <li key={entry.id}>
            <Link
              to={`/entry/${entry.id}`}
              className="block rounded-md border border-rule px-4 py-3 hover:border-muted"
            >
              <p className="font-medium">{entry.title}</p>
              <p className="mt-1 font-classical text-lg line-clamp-2">{passage.text}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <LanguageBadge language={entry.language} />
                {passage.source?.author && (
                  <span>
                    {passage.source.author}
                    {passage.source.work && `, ${passage.source.work}`}
                    {passage.source.locus && ` ${passage.source.locus}`}
                  </span>
                )}
                {entry.constructionKeys.map((k) => (
                  <Chip key={k} title={k}>
                    {labelFor('construction', k, entry.language)}
                  </Chip>
                ))}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
