import { useEffect, useState } from 'react';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Button, Callout, inputClass, Section } from '@/components/ui';
import { updatePreferences, useApiKey, type Preferences } from '@/lib/db/settings';
import {
  isStale,
  loadCachedCatalog,
  refreshCatalog,
  type ModelCatalog,
  type ModelInfo,
} from '@/lib/llm/catalog';
import { testConnection, type ConnectionTestResult } from '@/lib/llm';
import { DEFAULT_MODELS, type ModelTask } from '@/lib/llm/models';

function useModelCatalog() {
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setCatalog(await refreshCatalog());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void loadCachedCatalog().then((cached) => {
      if (cancelled) return;
      setCatalog(cached);
      if (isStale(cached) && navigator.onLine) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, loading, error, refresh };
}

function price(n: number | undefined) {
  if (n === undefined) return '?';
  return n === 0 ? 'free' : `$${n < 1 ? n.toFixed(2) : n.toFixed(n < 10 ? 2 : 0)}`;
}

function ModelInfoLine({ info }: { info: ModelInfo }) {
  return (
    <p className="text-xs text-muted">
      {info.name}
      {' · '}
      {price(info.promptPricePerM)} in / {price(info.completionPricePerM)} out per million tokens
      {info.contextLength ? ` · ${Math.round(info.contextLength / 1000)}k context` : ''}
      {' · '}
      {info.supportsJson ? 'JSON mode' : 'no JSON mode'}
    </p>
  );
}

const TASKS: { task: ModelTask; field: 'analysisModel' | 'generationModel'; label: string; hint: string }[] = [
  {
    task: 'analysis',
    field: 'analysisModel',
    label: 'Analysis model',
    hint: 'Used to analyse passages. A reasoning model gives better parsing.',
  },
  {
    task: 'generation',
    field: 'generationModel',
    label: 'Generation model',
    hint: 'Used to compose new text from a pattern. A cheaper, faster model is fine.',
  },
];

function ModelField({
  task,
  field,
  label,
  hint,
  prefs,
  catalog,
  hasKey,
}: (typeof TASKS)[number] & { prefs: Preferences; catalog: ModelCatalog | null; hasKey: boolean }) {
  const saved = prefs[field];
  const [draft, setDraft] = useState(saved);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => setDraft(saved), [saved]);

  const id = draft.trim();
  const info = catalog?.models.find((m) => m.id === id);

  function commit(value: string) {
    const v = value.trim();
    setResult(null);
    setError(null);
    if (v && v !== saved) void updatePreferences({ [field]: v });
    else setDraft(saved);
  }

  async function runTest() {
    setTesting(true);
    setResult(null);
    setError(null);
    try {
      setResult(await testConnection(task, id));
    } catch (err) {
      setError(err);
    } finally {
      setTesting(false);
    }
  }

  const inputId = `model-${task}`;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium">
        {label}
      </label>
      <p className="text-xs text-muted">{hint}</p>
      <div className="flex flex-wrap gap-2">
        <input
          id={inputId}
          list="openrouter-models"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(e.currentTarget.value);
          }}
          className={`${inputClass} font-mono flex-1 min-w-60`}
        />
        <Button onClick={() => void runTest()} disabled={testing || !id || !hasKey}>
          {testing ? 'Testing…' : 'Test'}
        </Button>
        {saved !== DEFAULT_MODELS[task] && (
          <Button variant="quiet" onClick={() => void updatePreferences({ [field]: DEFAULT_MODELS[task] })}>
            Reset to {DEFAULT_MODELS[task]}
          </Button>
        )}
      </div>
      {info && <ModelInfoLine info={info} />}
      {catalog && id && !info && (
        <p className="text-xs text-accent">Not in OpenRouter&apos;s model list. Check the spelling.</p>
      )}
      {result && (
        <Callout tone="ok">
          <span role="status">
            Working. <span className="font-mono">{result.model}</span> replied{' '}
            <span className="font-classical">&ldquo;{result.reply}&rdquo;</span> in {(result.ms / 1000).toFixed(1)} s.
          </span>
        </Callout>
      )}
      {error !== null && <ErrorNotice error={error} onRetry={() => void runTest()} />}
    </div>
  );
}

export function ModelsSection({ prefs }: { prefs: Preferences }) {
  const { catalog, loading, error, refresh } = useModelCatalog();
  const key = useApiKey();
  const hasKey = !!key && key.source !== 'none';

  return (
    <Section
      title="Models"
      description="Any OpenRouter model can be used. The defaults are Google Gemini models. Test sends a tiny real request, which costs a fraction of a cent."
    >
      <datalist id="openrouter-models">
        {catalog?.models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </datalist>

      {TASKS.map((t) => (
        <ModelField key={t.task} {...t} prefs={prefs} catalog={catalog} hasKey={hasKey} />
      ))}

      {!hasKey && <p className="text-xs text-muted">Save an API key above to test a model.</p>}

      <div className="flex flex-wrap gap-3 items-center text-xs text-muted">
        <span>
          {catalog
            ? `${catalog.models.length} models listed, updated ${new Date(catalog.fetchedAt).toLocaleString()}.`
            : loading
              ? 'Loading the model list…'
              : 'Model list not loaded yet. You can still type a model name.'}
        </span>
        <Button variant="quiet" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh list'}
        </Button>
        {error && <span className="text-accent">Could not load the model list ({error}).</span>}
      </div>
    </Section>
  );
}
