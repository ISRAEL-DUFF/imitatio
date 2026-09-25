import { useMemo, useState } from 'react';
import type { GeneratedText, Language, PatternSkeleton } from '@/types';
import { Button } from '@/components/ui';
import { checkGeneration } from '@/lib/checks';
import { MappedText } from './MappedText';

// One generated text (spec §9.4): always labelled as a composition, with its
// literal translation, colour-coded unit mapping, the model's own deviations
// and the client-side check warnings.
export function OutputCard({
  output,
  skeleton,
  language,
  heading,
  onStar,
  onDelete,
}: {
  output: GeneratedText;
  skeleton: PatternSkeleton;
  language: Language;
  heading?: React.ReactNode;
  onStar?: () => void;
  onDelete?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const warnings = useMemo(
    () => checkGeneration(output.text, output.unitMapping, skeleton, language),
    [output, skeleton, language],
  );
  const segments = useMemo(() => output.unitMapping.map((m) => ({ unitId: m.unitId, quote: m.text })), [output]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(output.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="rounded-md border border-rule p-4 space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded border border-accent/60 px-1.5 text-xs leading-5 text-accent">
          Composition — not authentic text
        </span>
        {heading}
      </header>

      <MappedText text={output.text} segments={segments} skeleton={skeleton} language={language} />
      <p className="text-sm">
        <span className="text-xs uppercase tracking-wide text-muted">Literal </span>
        {output.literalTranslation}
      </p>

      {output.deviations.length > 0 && (
        <div className="text-sm">
          <p className="text-xs uppercase tracking-wide text-muted">Departures from the pattern (the model’s own report)</p>
          <ul className="mt-1 list-disc pl-5">
            {output.deviations.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 ? (
        <div className="rounded-md border border-accent/60 bg-accent/5 px-3 py-2 text-sm">
          <p className="text-xs font-medium text-accent">
            {warnings.length} check warning{warnings.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-1 space-y-0.5 font-classical">
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted">All checks passed: every unit is mapped and every connective is present.</p>
      )}

      {(onStar || onDelete) && (
        <div className="flex flex-wrap gap-2">
          {onStar && (
            <Button onClick={onStar} aria-pressed={output.starred}>
              {output.starred ? '★ Starred' : '☆ Star'}
            </Button>
          )}
          <Button onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</Button>
          {onDelete && (
            <Button variant="quiet" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
