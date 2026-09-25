import type { AnalysisResult } from '@/lib/llm/analyze';
import type { AnalysisInput } from '@/lib/llm/prompts';
import { db as defaultDb, type ImitatioDB } from '@/lib/db/db';

// The Analyse screen's working state, saved as the user types (spec §8.5) so
// a failed request, a reload or a closed tab never loses the input. An
// unsaved result is kept too: it cost a model call.

const KEY = 'analyzeDraft';

export interface AnalyzeDraft {
  input: AnalysisInput;
  result?: AnalysisResult;
}

export async function loadDraft(db: ImitatioDB = defaultDb): Promise<AnalyzeDraft | null> {
  const row = await db.settings.get(KEY);
  return (row?.value as AnalyzeDraft | undefined) ?? null;
}

export async function saveDraft(draft: AnalyzeDraft, db: ImitatioDB = defaultDb): Promise<void> {
  await db.settings.put({ key: KEY, value: draft });
}

export async function clearDraft(db: ImitatioDB = defaultDb): Promise<void> {
  await db.settings.delete(KEY);
}
