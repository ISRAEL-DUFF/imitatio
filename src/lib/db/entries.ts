import { useLiveQuery } from 'dexie-react-hooks';
import type { Entry, Passage } from '@/types';
import type { AnalysisResult } from '@/lib/llm/analyze';
import type { AnalysisInput } from '@/lib/llm/prompts';
import { db as defaultDb, type ImitatioDB } from './db';

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
