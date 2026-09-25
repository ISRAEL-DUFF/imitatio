import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Language, Level, Variety } from '@/types';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Button, Callout, inputClass } from '@/components/ui';
import { saveAnalysis } from '@/lib/db/entries';
import { loadPreferences, useApiKey, usePreferences } from '@/lib/db/settings';
import { wordCount } from '@/lib/greek/normalize';
import { LANGUAGE_LABELS, VARIETIES, varietyFor } from '@/lib/language';
import { analyze, AnalysisFormatError, type AnalysisResult } from '@/lib/llm/analyze';
import type { AnalysisInput } from '@/lib/llm/prompts';
import { PatternCard } from '@/features/pattern/PatternCard';
import { clearDraft, loadDraft, saveDraft } from './draft';

// Analyse screen, spec §9.2. Beta Code input arrives in M5.

const LIMITS: Record<Level, number> = { sentence: 60, period: 120, paragraph: 250 }; // §4.2, soft
const LEVELS: Level[] = ['sentence', 'period', 'paragraph'];

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

function FormatFailure({ error, onRetry }: { error: AnalysisFormatError; onRetry: () => void }) {
  return (
    <Callout tone="warn">
      <div role="alert">
        <p className="font-medium">
          {error.truncated ? 'The analysis was cut off' : 'The model’s answer could not be read'}
        </p>
        <p className="mt-1 text-muted">
          {error.truncated
            ? 'The response hit the output limit before it finished. Try a shorter passage, or split a paragraph into periods.'
            : 'It did not match the expected format, even after one repair attempt. Nothing was saved.'}
        </p>
      </div>
      <Button variant="quiet" className="mt-2" onClick={onRetry}>
        Try again
      </Button>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted">Raw output and errors</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-rule/40 p-2">{error.errors}</pre>
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-rule/40 p-2">{error.raw}</pre>
      </details>
    </Callout>
  );
}

export function AnalyzePage() {
  const navigate = useNavigate();
  const prefs = usePreferences();
  const key = useApiKey();
  const [input, setInput] = useState<AnalysisInput | null>(null);
  const [result, setResult] = useState<AnalysisResult | undefined>();
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [saving, setSaving] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const elapsed = useElapsed(status.state === 'running' ? status.started : null);

  // Restore the draft, or start from the defaults in Settings.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadDraft(), loadPreferences()]).then(([draft, p]) => {
      if (cancelled) return;
      setInput(
        draft?.input ?? {
          language: p.defaultLanguage,
          variety: varietyFor(p.defaultLanguage, p.defaultVariety),
          level: 'sentence',
          text: '',
          source: {},
        },
      );
      setResult(draft?.result);
    });
    return () => {
      cancelled = true;
      abort.current?.abort();
    };
  }, []);

  // Save as the user types.
  useEffect(() => {
    if (!input) return;
    const id = setTimeout(() => void saveDraft({ input, result }), 300);
    return () => clearTimeout(id);
  }, [input, result]);

  if (!input || !prefs) return <p className="text-muted">Loading…</p>;

  const update = (patch: Partial<AnalysisInput>) => setInput((i) => (i ? { ...i, ...patch } : i));
  const count = wordCount(input.text);
  const over = count > LIMITS[input.level];
  const hasKey = !!key && key.source !== 'none';
  const running = status.state === 'running';

  async function run() {
    if (!input) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setStatus({ state: 'running', started: Date.now() });
    try {
      const r = await analyze(input, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setResult(r);
      setStatus({ state: 'idle' });
    } catch (error) {
      if (ctrl.signal.aborted) return setStatus({ state: 'idle' });
      setStatus({ state: 'failed', error });
    }
  }

  async function save() {
    if (!input || !result) return;
    setSaving(true);
    const id = await saveAnalysis(input, result);
    await clearDraft();
    navigate(`/entry/${id}`);
  }

  if (result) {
    return (
      <div className="space-y-4">
        <Callout>
          Not saved yet. This analysis is kept here until you save or discard it.
          {result.repaired && ' (The model’s first answer needed one repair.)'}
        </Callout>
        <PatternCard
          title={result.skeleton.summary}
          text={result.text}
          language={input.language}
          variety={input.variety}
          level={input.level}
          source={input.source}
          notes={result.notes}
          skeleton={result.skeleton}
          model={result.model}
          actions={
            <>
              <Button variant="primary" onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : 'Save to notebook'}
              </Button>
              <Button onClick={() => setResult(undefined)} disabled={saving}>
                Discard
              </Button>
            </>
          }
        />
      </div>
    );
  }

  return (
    <form
      className="space-y-6 max-w-3xl"
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <h1 className="text-2xl font-semibold">Analyse a passage</h1>

      {key?.source === 'none' && (
        <Callout tone="warn">
          Analysis needs an OpenRouter API key.{' '}
          <Link to="/settings" className="text-accent underline">
            Add one in Settings
          </Link>
          . Your text here is kept while you do.
        </Callout>
      )}

      <div className="flex flex-wrap gap-6">
        <fieldset>
          <legend className="text-sm font-medium mb-1">Language</legend>
          <div className="flex gap-4 text-sm">
            {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
              <label key={lang} className="flex gap-2 items-center">
                <input
                  type="radio"
                  name="language"
                  checked={input.language === lang}
                  onChange={() => update({ language: lang, variety: varietyFor(lang, input.variety) })}
                />
                {LANGUAGE_LABELS[lang]}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="variety" className="block text-sm font-medium mb-1">
            Variety
          </label>
          <select
            id="variety"
            value={varietyFor(input.language, input.variety)}
            onChange={(e) => update({ variety: e.target.value as Variety })}
            className={`${inputClass} w-auto`}
          >
            {VARIETIES[input.language].map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className="text-sm font-medium mb-1">Level</legend>
          <div className="flex gap-4 text-sm">
            {LEVELS.map((level) => (
              <label key={level} className="flex gap-2 items-center">
                <input type="radio" name="level" checked={input.level === level} onChange={() => update({ level })} />
                {level}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div>
        <label htmlFor="passage" className="block text-sm font-medium mb-1">
          Passage
        </label>
        <textarea
          id="passage"
          lang={input.language === 'grc' ? 'grc' : 'la'}
          rows={5}
          spellCheck={false}
          value={input.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder={
            input.language === 'grc'
              ? 'Δαρείου καὶ Παρυσάτιδος γίγνονται παῖδες δύο…'
              : 'Gallia est omnis divisa in partes tres…'
          }
          className={`${inputClass} font-classical text-xl leading-relaxed`}
        />
        <p className={`mt-1 text-xs ${over ? 'text-accent' : 'text-muted'}`} aria-live="polite">
          {count} / {LIMITS[input.level]} words for a {input.level}
          {over &&
            (input.level === 'paragraph'
              ? '. Longer passages cost more and may be cut off; consider splitting it.'
              : `. Consider analysing it as a ${input.level === 'sentence' ? 'period' : 'paragraph'}.`)}
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium mb-1">Source (optional)</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ['author', 'Author', 'Xenophon'],
              ['work', 'Work', 'Anabasis'],
              ['locus', 'Locus', '1.1.1'],
            ] as const
          ).map(([field, label, placeholder]) => (
            <label key={field} className="text-sm">
              <span className="sr-only">{label}</span>
              <input
                value={input.source?.[field] ?? ''}
                onChange={(e) => update({ source: { ...input.source, [field]: e.target.value } })}
                placeholder={`${label}, e.g. ${placeholder}`}
                className={inputClass}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={running || !input.text.trim() || !hasKey}>
          {running ? 'Analysing…' : 'Analyse'}
        </Button>
        {running && (
          <>
            <span className="text-sm text-muted" aria-live="polite">
              {prefs.analysisModel} · {elapsed} s. A reasoning model can take a minute or more.
            </span>
            <Button variant="quiet" onClick={() => abort.current?.abort()}>
              Cancel
            </Button>
          </>
        )}
      </div>

      {status.state === 'failed' &&
        (status.error instanceof AnalysisFormatError ? (
          <FormatFailure error={status.error} onRetry={() => void run()} />
        ) : (
          <ErrorNotice error={status.error} onRetry={() => void run()} />
        ))}
    </form>
  );
}
