import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { Language, Level } from '@/types';
import { Chip, LanguageBadge } from '@/components/badges';
import { Button, inputClass } from '@/components/ui';
import { useAllEntries } from '@/lib/db/entries';
import { LANGUAGE_LABELS } from '@/lib/language';
import { labelFor, labelForAny } from '@/lib/llm/vocab';
import {
  facets,
  filterItems,
  isFiltered,
  paramsFromQuery,
  queryFromParams,
  toItem,
  type FacetOption,
  type NotebookQuery,
  type Sort,
} from './search';

// Notebook, spec §9.5.

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: { value: string; label: string; count?: number }[];
}) {
  if (!options.length) return null;
  const id = `filter-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-muted mb-0.5">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={`${inputClass} w-auto max-w-48 ${value ? 'border-accent' : ''}`}
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.count !== undefined ? ` (${o.count})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

const withLabels = (opts: FacetOption[], label: (v: string) => string) =>
  opts.map((o) => ({ ...o, label: label(o.value) }));

export function NotebookPage() {
  const all = useAllEntries();
  const [params, setParams] = useSearchParams();

  // The query lives in state, updated functionally so rapid changes can never
  // overwrite each other, and is mirrored to the URL both ways (reloads and
  // the back button). Filtering follows a beat behind typing.
  const [query, setQuery] = useState(() => queryFromParams(params));
  const replaceNext = useRef(false);
  useEffect(() => {
    if (paramsFromQuery(query).toString() !== params.toString()) setQuery(queryFromParams(params));
    // Only when the URL changes from outside (back/forward, a link).
  }, [params]);
  useEffect(() => {
    const next = paramsFromQuery(query);
    if (next.toString() !== params.toString()) setParams(next, { replace: replaceNext.current });
    replaceNext.current = false;
  }, [query]);
  const deferredQuery = useDeferredValue(query);

  const items = useMemo(() => (all ?? []).map(({ entry, passage }) => toItem(entry, passage)), [all]);
  const f = useMemo(() => facets(items), [items]);
  const results = useMemo(() => filterItems(items, deferredQuery), [items, deferredQuery]);

  const set = (patch: Partial<NotebookQuery>) => {
    replaceNext.current = 'q' in patch; // typing does not flood the history
    setQuery((q) => ({ ...q, ...patch }));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Notebook</h1>
        <Link to="/analyze" className="rounded-md bg-accent px-3 py-1.5 text-sm text-paper hover:opacity-90">
          Analyse a passage
        </Link>
      </div>

      {all === undefined && <p className="text-muted">Opening notebook…</p>}
      {all?.length === 0 && (
        <p className="text-muted">No saved patterns yet. Analyse a passage and save it to start your notebook.</p>
      )}

      {!!all?.length && (
        <div className="space-y-3">
          <label htmlFor="search" className="sr-only">
            Search the notebook
          </label>
          <input
            id="search"
            type="search"
            value={query.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search titles, passages and notes (accents optional)"
            className={`${inputClass} text-base`}
          />
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="Language"
              value={query.language}
              onChange={(v) => set({ language: v as Language | undefined })}
              options={(['grc', 'la'] as const).map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))}
            />
            <Select
              label="Level"
              value={query.level}
              onChange={(v) => set({ level: v as Level | undefined })}
              options={['sentence', 'period', 'paragraph'].map((l) => ({ value: l, label: l }))}
            />
            <Select label="Author" value={query.author} onChange={(author) => set({ author })} options={withLabels(f.authors, (a) => a)} />
            <Select
              label="Construction"
              value={query.construction}
              onChange={(construction) => set({ construction })}
              options={withLabels(f.constructions, (k) => labelForAny('construction', k))}
            />
            <Select
              label="Device"
              value={query.device}
              onChange={(device) => set({ device })}
              options={withLabels(f.devices, (k) => labelForAny('device', k))}
            />
            <Select
              label="Discourse move"
              value={query.move}
              onChange={(move) => set({ move })}
              options={withLabels(f.moves, (k) => labelForAny('move', k))}
            />
            <Select label="Tag" value={query.tag} onChange={(tag) => set({ tag })} options={withLabels(f.tags, (t) => t)} />
            <Select
              label="Sort"
              value={query.sort}
              onChange={(v) => set({ sort: (v ?? 'newest') as Sort })}
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'edited', label: 'Recently edited' },
              ]}
            />
          </div>
          <p className="flex flex-wrap items-center gap-3 text-sm text-muted" aria-live="polite">
            {isFiltered(query)
              ? `${results.length} of ${all.length} pattern${all.length === 1 ? '' : 's'}`
              : `${all.length} pattern${all.length === 1 ? '' : 's'}`}
            {isFiltered(query) && (
              <Button variant="quiet" onClick={() => setQuery((q) => ({ q: '', sort: q.sort }))}>
                Clear search and filters
              </Button>
            )}
          </p>
        </div>
      )}

      {!!all?.length && results.length === 0 && <p className="text-muted">No patterns match.</p>}

      <ul className="space-y-3">
        {results.map(({ entry, passage }) => (
          <li key={entry.id}>
            <Link to={`/entry/${entry.id}`} className="block rounded-md border border-rule px-4 py-3 hover:border-muted">
              <p className="font-medium">{entry.title}</p>
              <p lang={entry.language} className="mt-1 font-classical text-lg line-clamp-2">
                {passage.text}
              </p>
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
                {entry.tags.map((t) => (
                  <span key={t} className="text-accent">
                    #{t}
                  </span>
                ))}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
