import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorNotice } from '@/components/ErrorNotice';
import { FormatFailure } from '@/components/FormatFailure';
import { PageStub } from '@/components/PageStub';
import { Button, Callout, inputClass } from '@/components/ui';
import { useEntry } from '@/lib/db/entries';
import { deleteOutput, saveGeneration, toggleStar, useGenerations } from '@/lib/db/generations';
import { useApiKey, usePreferences } from '@/lib/db/settings';
import { generate } from '@/lib/llm/generate';
import { FormatError } from '@/lib/llm/structured';
import { MappedText, sourceSegments, UnitLegend } from './MappedText';
import { OutputCard } from './OutputCard';

// Generate screen, spec §9.4.

type Status = { state: 'idle' } | { state: 'running'; started: number } | { state: 'failed'; error: unknown };

function useElapsed(started: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (started === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [started]);
  return started === null ? 0 : Math.max(0, Math.round((now - started) / 1000));
}

export function GeneratePage() {
  const { id } = useParams();
  const data = useEntry(id);
  const generations = useGenerations(id);
  const prefs = usePreferences();
  const key = useApiKey();
  const [topic, setTopic] = useState('');
  const [constraints, setConstraints] = useState('');
  const [variations, setVariations] = useState(1);
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [latestId, setLatestId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const elapsed = useElapsed(status.state === 'running' ? status.started : null);

  useEffect(() => () => abort.current?.abort(), []);

  if (data === undefined || !prefs) return <p className="text-muted">Loading…</p>;
  if (data === null) {
    return (
      <PageStub title="Pattern not found">
        <Link to="/" className="text-accent underline">
          Back to the notebook
        </Link>
      </PageStub>
    );
  }

  const { entry, passage } = data;
  const { skeleton, language } = entry;
  const hasKey = !!key && key.source !== 'none';
  const running = status.state === 'running';
  const latest = generations?.find((g) => g.id === latestId);

  async function run() {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setStatus({ state: 'running', started: Date.now() });
    const request = {
      ...(topic.trim() ? { topic: topic.trim() } : {}),
      ...(constraints.trim() ? { constraints: constraints.trim() } : {}),
      variations,
    };
    try {
      const result = await generate(skeleton, request, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setLatestId(await saveGeneration(entry.id, request, result));
      setStatus({ state: 'idle' });
    } catch (error) {
      setStatus(ctrl.signal.aborted ? { state: 'idle' } : { state: 'failed', error });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/entry/${entry.id}`} className="text-sm text-muted hover:text-ink">
          ← {entry.title}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Generate from this pattern</h1>
        <p className="mt-1 text-sm text-muted">{skeleton.summary}</p>
      </div>

      {key?.source === 'none' && (
        <Callout tone="warn">
          Generation needs an OpenRouter API key.{' '}
          <Link to="/settings" className="text-accent underline">
            Add one in Settings
          </Link>
          .
        </Callout>
      )}

      <form
        className="space-y-4 max-w-3xl"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Topic (optional)</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. a merchant arriving in Corinth"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Constraints (optional)</span>
            <input
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="e.g. use a verb of motion"
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>
        <fieldset className="text-sm">
          <legend className="font-medium mb-1">Variations</legend>
          <div className="flex gap-4">
            {[1, 2, 3].map((n) => (
              <label key={n} className="flex items-center gap-2">
                <input type="radio" name="variations" checked={variations === n} onChange={() => setVariations(n)} />
                {n}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={running || !hasKey}>
            {running ? 'Generating…' : 'Generate'}
          </Button>
          {running && (
            <>
              <span className="text-sm text-muted" aria-live="polite">
                {prefs.generationModel} · {elapsed} s
              </span>
              <Button variant="quiet" onClick={() => abort.current?.abort()}>
                Cancel
              </Button>
            </>
          )}
        </div>
        {status.state === 'failed' &&
          (status.error instanceof FormatError ? (
            <FormatFailure error={status.error} what="generation" onRetry={() => void run()} />
          ) : (
            <ErrorNotice error={status.error} onRetry={() => void run()} />
          ))}
      </form>

      <UnitLegend skeleton={skeleton} />
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-md border border-rule bg-rule/20 p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted">
            Original
            {passage.source?.author && ` · ${passage.source.author}`}
            {passage.source?.work && `, ${passage.source.work}`}
            {passage.source?.locus && ` ${passage.source.locus}`}
          </p>
          <MappedText text={passage.text} segments={sourceSegments(skeleton)} skeleton={skeleton} language={language} />
          <p className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted">Literal </span>
            {entry.notes.translation.literal}
          </p>
        </article>
        {latest?.outputs.map((output, index) => (
          <OutputCard
            key={index}
            output={output}
            skeleton={skeleton}
            language={language}
            heading={<span className="text-xs text-muted">{latest.model}</span>}
            onStar={() => void toggleStar(latest.id, index)}
            onDelete={() => {
              if (window.confirm('Delete this composition?')) void deleteOutput(latest.id, index);
            }}
          />
        ))}
      </div>
      {latest && (
        <p className="text-sm text-muted">
          Saved with this pattern.{' '}
          <Link to={`/entry/${entry.id}`} className="text-accent underline">
            See all generations
          </Link>{' '}
          on the pattern card.
        </p>
      )}
    </div>
  );
}
