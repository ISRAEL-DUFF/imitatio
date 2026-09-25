import { Link } from 'react-router';
import type { Language, PatternSkeleton } from '@/types';
import { deleteOutput, sortOutputs, toggleStar, useGenerations } from '@/lib/db/generations';
import { OutputCard } from './OutputCard';

// Every stored generation for a pattern, starred first (spec §9.3).
export function GenerationsList({
  entryId,
  skeleton,
  language,
}: {
  entryId: string;
  skeleton: PatternSkeleton;
  language: Language;
}) {
  const generations = useGenerations(entryId);
  if (generations === undefined) return <p className="text-muted">Loading…</p>;

  const outputs = sortOutputs(generations);
  if (!outputs.length) {
    return (
      <p className="text-muted">
        No generations yet.{' '}
        <Link to={`/entry/${entryId}/generate`} className="text-accent underline">
          Generate new text from this pattern
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {outputs.length} composition{outputs.length === 1 ? '' : 's'}.{' '}
        <Link to={`/entry/${entryId}/generate`} className="text-accent underline">
          Generate more
        </Link>
      </p>
      {outputs.map(({ generation, index, output }) => (
        <OutputCard
          key={`${generation.id}-${index}`}
          output={output}
          skeleton={skeleton}
          language={language}
          heading={
            <span className="text-xs text-muted">
              {new Date(generation.createdAt).toLocaleDateString()}
              {generation.request.topic && ` · ${generation.request.topic}`} · {generation.model}
            </span>
          }
          onStar={() => void toggleStar(generation.id, index)}
          onDelete={() => {
            if (window.confirm('Delete this composition?')) void deleteOutput(generation.id, index);
          }}
        />
      ))}
    </div>
  );
}
