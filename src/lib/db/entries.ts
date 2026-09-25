import { useLiveQuery } from 'dexie-react-hooks';
import type { Entry, Passage } from '@/types';
import { indexKeys, type AnalysisResult } from '@/lib/llm/analyze';
import type { AnalysisInput } from '@/lib/llm/prompts';
import { normalizeTags } from '@/lib/tags';
import { db as defaultDb, type ImitatioDB } from './db';

export { normalizeTag, normalizeTags } from '@/lib/tags';

// Entry repository: saving an analysis creates its passage and entry together.

export async function saveAnalysis(
  input: AnalysisInput,
  result: AnalysisResult,
  db: ImitatioDB = defaultDb,
): Promise<string> {
  const now = Date.now();
  const source = input.source && Object.values(input.source).some(Boolean) ? input.source : undefined;
  const passage: Passage = {
    id: crypto.randomUUID(),
    language: input.language,
    variety: input.variety,
    text: result.text,
    source,
    createdAt: now,
  };
  const entry: Entry = {
    id: crypto.randomUUID(),
    passageId: passage.id,
    language: input.language,
    level: input.level,
    title: result.skeleton.summary,
    notes: result.notes,
    skeleton: result.skeleton,
    tags: [],
    constructionKeys: result.constructionKeys,
    deviceKeys: result.deviceKeys,
    userEdited: false,
    model: result.model,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction('rw', db.passages, db.entries, async () => {
    await db.passages.add(passage);
    await db.entries.add(entry);
  });
  return entry.id;
}

export interface EntryWithPassage {
  entry: Entry;
  passage: Passage;
}

/** undefined while loading, null if not found. */
export function useEntry(id: string | undefined): EntryWithPassage | null | undefined {
  return useLiveQuery(async () => {
    const entry = id ? await defaultDb.entries.get(id) : undefined;
    const passage = entry && (await defaultDb.passages.get(entry.passageId));
    return entry && passage ? { entry, passage } : null;
  }, [id]);
}

export function useRecentEntries(limit = 20): EntryWithPassage[] | undefined {
  return useLiveQuery(async () => {
    const entries = await defaultDb.entries.orderBy('createdAt').reverse().limit(limit).toArray();
    const passages = await defaultDb.passages.bulkGet(entries.map((e) => e.passageId));
    return entries.flatMap((entry, i) => (passages[i] ? [{ entry, passage: passages[i] }] : []));
  }, [limit]);
}

export type EntryPatch = Partial<Pick<Entry, 'title' | 'tags' | 'notes' | 'skeleton'>>;

/**
 * Apply an edit. Changing the notes or skeleton marks the entry as
 * user-edited (spec §9.3, §12); a new skeleton also refreshes the index keys.
 * Title and tags are organisation, not analysis, so they do not.
 */
export type EntryEdit = EntryPatch | ((current: Entry) => EntryPatch);

/**
 * Apply an edit. A function edit is computed from the stored entry inside the
 * transaction, so quick successive edits (two tags in a row) build on each
 * other instead of on a stale copy held by the UI.
 */
export async function updateEntry(id: string, edit: EntryEdit, db: ImitatioDB = defaultDb): Promise<void> {
  await db.transaction('rw', db.entries, async () => {
    const entry = await db.entries.get(id);
    if (!entry) throw new Error(`No entry ${id}`);
    const patch = typeof edit === 'function' ? edit(entry) : edit;
    const changes: Partial<Entry> = { ...patch, updatedAt: Date.now() };
    if (patch.title !== undefined) changes.title = patch.title.trim() || 'Untitled pattern';
    if (patch.tags) changes.tags = normalizeTags(patch.tags);
    if (patch.notes || patch.skeleton) changes.userEdited = true;
    if (patch.skeleton) Object.assign(changes, indexKeys(patch.skeleton));
    await db.entries.put({ ...entry, ...changes });
  });
}

/** Delete an entry with its passage and generations. */
export async function deleteEntry(id: string, db: ImitatioDB = defaultDb): Promise<void> {
  await db.transaction('rw', db.entries, db.passages, db.generations, async () => {
    const entry = await db.entries.get(id);
    if (!entry) return;
    await db.generations.where('entryId').equals(id).delete();
    await db.entries.delete(id);
    // A passage belongs to one entry today; keep it if another ever shares it.
    const others = await db.entries.where('passageId').equals(entry.passageId).count();
    if (others === 0) await db.passages.delete(entry.passageId);
  });
}

/** Every entry with its passage, for the notebook. */
export function useAllEntries(): EntryWithPassage[] | undefined {
  return useLiveQuery(async () => {
    const [entries, passages] = await Promise.all([defaultDb.entries.toArray(), defaultDb.passages.toArray()]);
    const byId = new Map(passages.map((p) => [p.id, p]));
    return entries.flatMap((entry) => {
      const passage = byId.get(entry.passageId);
      return passage ? [{ entry, passage }] : [];
    });
  });
}
