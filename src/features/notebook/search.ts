import type { Entry, Language, Level, NoteItem, Passage } from '@/types';
import { searchFold } from '@/lib/greek/normalize';

// Notebook search, filters and sorting (spec §9.5, §11). Pure functions over
// the entries held in memory, so they are fast (see the 2,000-entry test)
// and testable without a browser.

export interface NotebookItem {
  entry: Entry;
  passage: Passage;
  /** Folded text of everything searchable, built once per entry. */
  haystack: string;
  moves: string[];
}

export type Sort = 'newest' | 'oldest' | 'edited';

export interface NotebookQuery {
  q: string;
  language?: Language;
  level?: Level;
  author?: string;
  construction?: string;
  device?: string;
  move?: string;
  tag?: string;
  sort: Sort;
}

export const EMPTY_QUERY: NotebookQuery = { q: '', sort: 'newest' };

const noteText = (n: NoteItem) => [n.title, n.explanation, ...n.evidence];

export function toItem(entry: Entry, passage: Passage): NotebookItem {
  const { notes } = entry;
  const parts = [
    entry.title,
    passage.text,
    passage.source?.author,
    passage.source?.work,
    passage.source?.locus,
    ...entry.tags,
    notes.overview,
    notes.translation.literal,
    notes.translation.idiomatic,
    notes.syntax.clauseMap,
    ...[...notes.syntax.constructions, ...notes.discourse, ...notes.style].flatMap(noteText),
    ...(notes.tokens ?? []).flatMap((t) => [t.lemma, t.gloss]),
    entry.skeleton.summary,
  ];
  return {
    entry,
    passage,
    haystack: searchFold(parts.filter(Boolean).join('\n')),
    moves: [...new Set(entry.skeleton.discourse.moves.map((m) => m.move))],
  };
}

function matches(item: NotebookItem, q: NotebookQuery, terms: string[]): boolean {
  const { entry, passage } = item;
  if (q.language && entry.language !== q.language) return false;
  if (q.level && entry.level !== q.level) return false;
  if (q.author && passage.source?.author !== q.author) return false;
  if (q.construction && !entry.constructionKeys.includes(q.construction)) return false;
  if (q.device && !entry.deviceKeys.includes(q.device)) return false;
  if (q.move && !item.moves.includes(q.move)) return false;
  if (q.tag && !entry.tags.includes(q.tag)) return false;
  return terms.every((t) => item.haystack.includes(t));
}

const SORTS: Record<Sort, (a: NotebookItem, b: NotebookItem) => number> = {
  newest: (a, b) => b.entry.createdAt - a.entry.createdAt,
  oldest: (a, b) => a.entry.createdAt - b.entry.createdAt,
  edited: (a, b) => b.entry.updatedAt - a.entry.updatedAt,
};

/** Every search word must appear somewhere in the entry, in any order. */
export function filterItems(items: NotebookItem[], q: NotebookQuery): NotebookItem[] {
  const terms = searchFold(q.q).split(' ').filter(Boolean);
  return items.filter((item) => matches(item, q, terms)).sort(SORTS[q.sort]);
}

export interface FacetOption {
  value: string;
  count: number;
}

export interface Facets {
  authors: FacetOption[];
  constructions: FacetOption[];
  devices: FacetOption[];
  moves: FacetOption[];
  tags: FacetOption[];
}

function tally(values: string[][]): FacetOption[] {
  const counts = new Map<string, number>();
  for (const vs of values) for (const v of new Set(vs)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** The values present in the notebook, for the filter menus. */
export function facets(items: NotebookItem[]): Facets {
  return {
    authors: tally(items.map((i) => (i.passage.source?.author ? [i.passage.source.author] : []))),
    constructions: tally(items.map((i) => i.entry.constructionKeys)),
    devices: tally(items.map((i) => i.entry.deviceKeys)),
    moves: tally(items.map((i) => i.moves)),
    tags: tally(items.map((i) => i.entry.tags)),
  };
}

// URL <-> query, so filters survive reloads and the back button.

const PARAMS = {
  q: 'q',
  language: 'lang',
  level: 'level',
  author: 'author',
  construction: 'c',
  device: 'd',
  move: 'm',
  tag: 'tag',
  sort: 'sort',
} as const satisfies Record<keyof NotebookQuery, string>;

export function queryFromParams(params: URLSearchParams): NotebookQuery {
  const get = (k: keyof NotebookQuery) => params.get(PARAMS[k]) || undefined;
  const language = get('language');
  const level = get('level');
  const sort = get('sort');
  return {
    q: get('q') ?? '',
    language: language === 'grc' || language === 'la' ? language : undefined,
    level: level === 'sentence' || level === 'period' || level === 'paragraph' ? level : undefined,
    author: get('author'),
    construction: get('construction'),
    device: get('device'),
    move: get('move'),
    tag: get('tag'),
    sort: sort === 'oldest' || sort === 'edited' ? sort : 'newest',
  };
}

export function paramsFromQuery(q: NotebookQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, param] of Object.entries(PARAMS) as [keyof NotebookQuery, string][]) {
    const value = q[key];
    if (value && !(key === 'sort' && value === 'newest')) params.set(param, String(value));
  }
  return params;
}

export function isFiltered(q: NotebookQuery): boolean {
  return paramsFromQuery({ ...q, sort: 'newest' }).size > 0;
}
